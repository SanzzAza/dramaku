/**
 * YouTube Downloader API — via hub.ytconvert.org
 * GET  /api/youtube?url=https://www.youtube.com/watch?v=...
 * GET  /api/youtube?url=...&format=mp3|mp4
 * GET  /api/youtube?url=...&quality=128|192|320        (audio)
 * GET  /api/youtube?url=...&quality=360|480|720|1080   (video)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const API_BASE = "https://hub.ytconvert.org";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  "Referer": "https://ytconvert.org/",
  "Origin": "https://ytconvert.org",
  "Content-Type": "application/json",
  "Accept": "application/json",
};

// ─── Handler ────────────────────────────────────────────────────────────────

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
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=mp3&quality=128",
    });
  }

  const ytRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts|embed)|youtu\.be)\/.+/i;
  if (!ytRegex.test(url)) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "URL tidak valid. Masukkan link YouTube, YouTube Shorts, atau youtu.be.",
    });
  }

  try {
    const result = await fetchYoutube(url, format, quality);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[YouTube]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mengambil media.",
    });
  }
}

// ─── Core fetcher ────────────────────────────────────────────────────────────

async function fetchYoutube(url, format, quality) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const audioOnly = format !== "mp4";
  const outputType = audioOnly ? "audio" : "video";
  const isShorts  = /\/shorts\//i.test(url);
  const thumbHQ   = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbMQ   = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // ── Step 1: Submit conversion job ──
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
    headers: HEADERS,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!submitResp.ok) {
    throw new Error(`Submit gagal: ${submitResp.status} — ${await submitResp.text()}`);
  }

  const submitData = await submitResp.json();
  console.log("[YouTube] Submit response:", JSON.stringify(submitData));

  // Kalau langsung completed
  if (submitData?.status === "completed" && submitData?.downloadUrl) {
    return buildResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly, data: submitData });
  }

  // ── Step 2: Polling via statusUrl ──
  const statusUrl = submitData?.statusUrl;
  if (!statusUrl) {
    throw new Error("Tidak ada statusUrl dari server. Response: " + JSON.stringify(submitData));
  }

  console.log("[YouTube] Polling:", statusUrl);

  // Vercel maxDuration = 20s → sisakan ~17s untuk polling (submit sudah ~3s)
  // 7 percobaan × 2 detik = 14 detik aman
  const MAX_ATTEMPTS = 7;
  const POLL_DELAY   = 2_000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_DELAY);

    const statusResp = await fetch(statusUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8_000),
    });

    if (!statusResp.ok) {
      console.warn(`[YouTube] Poll ${attempt + 1} gagal: ${statusResp.status}`);
      continue;
    }

    const statusData = await statusResp.json();
    const status = statusData?.status;
    console.log(`[YouTube] Poll ${attempt + 1}: status=${status}`);

    if (status === "completed" && statusData?.downloadUrl) {
      return buildResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly, data: { ...submitData, ...statusData } });
    }

    if (status === "failed" || status === "error") {
      throw new Error(statusData?.message || "Konversi gagal di server.");
    }

    // masih processing → lanjut poll
  }

  throw new Error("Timeout: konversi memakan waktu terlalu lama. Coba lagi sebentar.");
}

// ─── Response builder ────────────────────────────────────────────────────────

function buildResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly, data }) {
  const title     = data?.title    || null;
  const duration  = data?.duration || null;
  const fileSize  = data?.fileSize || null;
  const safeTitle = (title || `youtube_${videoId}`)
    .slice(0, 80)
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: null,
      avatar: null,
      channel_url: null,
    },
    video: {
      id: videoId,
      title,
      duration,
      type: isShorts ? "shorts" : "video",
      quality: audioOnly ? null : quality,
      play: audioOnly ? null : data?.downloadUrl,
      audio_only: audioOnly ? data?.downloadUrl : null,
      cover: thumbHQ,
      filename: `${safeTitle}.${format}`,
      file_size: fileSize,
    },
    audio: {
      play: audioOnly ? data?.downloadUrl : null,
      quality: audioOnly ? `${quality}kbps` : null,
      author: null,
    },
    stats: {
      view_count: null,
      like_count: null,
      comment_count: null,
    },
    meta: {
      video_id: videoId,
      source_url: sourceUrl,
      thumbnail_hq: thumbHQ,
      thumbnail_mq: thumbMQ,
      is_shorts: isShorts,
      format,
      provider: "hub.ytconvert.org",
    },
  };
}

// ─── Util ────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
