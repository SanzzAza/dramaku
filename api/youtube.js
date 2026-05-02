/**
 * YouTube Downloader API — port dari Python script (hub.ytconvert.org)
 * Perbedaan utama vs fetch biasa: cookies dari submit diteruskan ke polling
 * persis seperti requests.Session() di Python.
 *
 * GET /api/youtube?url=...
 * GET /api/youtube?url=...&format=mp3|mp4
 * GET /api/youtube?url=...&quality=128|192|320|360|480|720|1080
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const API_BASE = "https://hub.ytconvert.org";

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://ytconvert.org/",
  "Origin": "https://ytconvert.org",
  "Content-Type": "application/json",
  "Accept": "application/json",
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const url     = req.query.url     || req.body?.url;
  const format  = req.query.format  || req.body?.format  || "mp3";
  const quality = req.query.quality || req.body?.quality || "128";

  if (!url) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=mp3&quality=128",
    });
  }

  const ytRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts|embed)|youtu\.be)\/.+/i;
  if (!ytRegex.test(url)) {
    return res.status(400).json({
      status: false, code: 400,
      message: "URL tidak valid. Masukkan link YouTube, YouTube Shorts, atau youtu.be.",
    });
  }

  try {
    const result = await convertYoutube(url, format, quality);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[YouTube]", err.message);
    return res.status(500).json({
      status: false, code: 500,
      message: err.message || "Gagal mengambil media.",
    });
  }
}

// ─── Core — port 1:1 dari Python convert_youtube() ───────────────────────────

async function convertYoutube(url, format, quality) {
  const videoId   = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts  = /\/shorts\//i.test(url);
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbHQ   = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbMQ   = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const audioOnly = format !== "mp4";
  const outputType = audioOnly ? "audio" : "video";

  // ── Step 1: Submit — sama persis dengan Python ────────────────────────────
  const payload = {
    url: sourceUrl,
    output: {
      type: outputType,
      format,
      quality,
    },
  };

  console.log("[YouTube] Submitting:", sourceUrl);

  const submitResp = await fetch(`${API_BASE}/api/download`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!submitResp.ok) {
    const text = await submitResp.text().catch(() => "");
    throw new Error(`Submit gagal: ${submitResp.status} — ${text}`);
  }

  // ⚡ Simpan cookies dari response submit — ini yang bikin Python bisa tapi JS tidak
  // requests.Session() otomatis forward cookies, kita harus manual
  const setCookieHeader = submitResp.headers.get("set-cookie");
  const sessionCookies  = parseCookies(setCookieHeader);

  const submitData = await submitResp.json();
  console.log("[YouTube] Submit response:", JSON.stringify(submitData));

  // Kalau langsung completed (jarang terjadi)
  if (submitData?.status === "completed" && submitData?.downloadUrl) {
    return buildResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly, data: { ...submitData, ...submitData } });
  }

  const statusUrl = submitData?.statusUrl;
  if (!statusUrl) {
    throw new Error("Tidak ada statusUrl dari server. Response: " + JSON.stringify(submitData));
  }

  // ── Step 2: Polling — sama persis dengan Python, + forward cookies ────────
  console.log("[YouTube] Polling:", statusUrl);

  // Python pakai max 60x × 2 detik = 2 menit
  // Vercel limit ~20 detik → pakai 7x × 2 detik = 14 detik (aman)
  const MAX_ATTEMPTS = 7;
  const POLL_DELAY   = 2_000;

  // Header polling dengan cookies dari submit (meniru Session behavior)
  const pollHeaders = {
    ...BASE_HEADERS,
    ...(sessionCookies ? { "Cookie": sessionCookies } : {}),
  };
  // Content-Type tidak perlu di GET
  delete pollHeaders["Content-Type"];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_DELAY);

    const statusResp = await fetch(statusUrl, {
      method: "GET",
      headers: pollHeaders,
      signal: AbortSignal.timeout(10_000),
    });

    if (!statusResp.ok) {
      console.warn(`[YouTube] Poll ${attempt + 1} gagal: ${statusResp.status}`);
      continue;
    }

    // Update cookies kalau ada yang baru dari response poll
    const newCookies = statusResp.headers.get("set-cookie");
    if (newCookies) {
      const merged = mergeCookies(sessionCookies, parseCookies(newCookies));
      pollHeaders["Cookie"] = merged;
    }

    const statusData = await statusResp.json();
    const status = statusData?.status;
    console.log(`[YouTube] Poll ${attempt + 1}: status=${status}`);

    if (status === "completed" && statusData?.downloadUrl) {
      return buildResponse({
        videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly,
        data: { ...submitData, ...statusData },
      });
    }

    if (status === "failed" || status === "error") {
      throw new Error(statusData?.message || "Konversi gagal di server.");
    }

    // masih "processing" → lanjut poll
  }

  throw new Error("Timeout: konversi memakan waktu terlalu lama. Coba lagi sebentar.");
}

// ─── Response builder ─────────────────────────────────────────────────────────

function buildResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly, data }) {
  const title    = data?.title    ?? null;
  const duration = data?.duration ?? null;
  const fileSize = data?.fileSize ?? null;
  const safeTitle = (title || `youtube_${videoId}`)
    .slice(0, 80)
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();

  return {
    status: true, code: 200,
    message: "Berhasil mengambil data media.",
    author:  { username: null, avatar: null, channel_url: null },
    video: {
      id:        videoId,
      title,
      duration,
      type:      isShorts ? "shorts" : "video",
      quality:   audioOnly ? null : `${quality}p`,
      play:      audioOnly ? null : data?.downloadUrl,
      audio_only: audioOnly ? data?.downloadUrl : null,
      cover:     thumbHQ,
      filename:  `${safeTitle}.${format}`,
      file_size: fileSize,
    },
    audio: {
      play:    audioOnly ? data?.downloadUrl : null,
      quality: audioOnly ? `${quality}kbps`  : null,
    },
    stats: { view_count: null, like_count: null, comment_count: null },
    meta: {
      video_id:      videoId,
      source_url:    sourceUrl,
      thumbnail_hq:  thumbHQ,
      thumbnail_mq:  thumbMQ,
      is_shorts:     isShorts,
      format,
      quality,
      provider: "hub.ytconvert.org",
    },
  };
}

// ─── Cookie helpers (meniru requests.Session) ─────────────────────────────────

/**
 * Parse "set-cookie" header string → "key=value; key2=value2"
 * set-cookie bisa berisi beberapa cookies dipisah koma
 */
function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return "";

  // set-cookie header bisa "a=1; Path=/, b=2; Path=/"
  // Kita hanya ambil key=value pertama dari tiap cookie
  return setCookieHeader
    .split(/,(?=[^ ])/)           // split antar cookies (hati-hati koma di dalam value)
    .map((c) => c.split(";")[0].trim())  // ambil hanya "key=value"
    .filter(Boolean)
    .join("; ");
}

/**
 * Merge existing cookies dengan cookies baru (update nilai yang sama)
 */
function mergeCookies(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const map = new Map();
  for (const part of existing.split(";")) {
    const [k] = part.trim().split("=");
    if (k) map.set(k.trim(), part.trim());
  }
  for (const part of incoming.split(";")) {
    const [k] = part.trim().split("=");
    if (k) map.set(k.trim(), part.trim());
  }
  return [...map.values()].join("; ");
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
