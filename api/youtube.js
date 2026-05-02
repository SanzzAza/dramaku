/**
 * YouTube Downloader API — hub.ytconvert.org dengan auto-retry
 *
 * Server mereka load-balance ke banyak VPS. Kadang satu VPS error
 * INTERNAL_ERROR — retry otomatis untuk kena VPS yang sehat.
 *
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 * GET /api/youtube?url=...&format=mp3|mp4
 * GET /api/youtube?url=...&quality=128|192|320|360|480|720|1080
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const API_SUBMIT = "https://hub.ytconvert.org/api/download";

const HEADERS = {
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
    const result = await fetchYoutube(url, format, quality);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[YouTube]", err.message);
    return res.status(500).json({
      status: false, code: 500,
      message: err.message || "Gagal mengambil media.",
    });
  }
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function fetchYoutube(url, format, quality) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts  = /\/shorts\//i.test(url);
  const thumbHQ   = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbMQ   = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const audioOnly = format !== "mp4";

  const payload = {
    url: sourceUrl,
    output: {
      type: audioOnly ? "audio" : "video",
      format,
      quality,
    },
  };

  // ── Auto-retry submit sampai 4x ──────────────────────────────────────────
  // Server load-balance ke banyak VPS. Kalau kena VPS yang error
  // (INTERNAL_ERROR / Failed to fetch video metadata), retry akan
  // landing ke VPS lain yang sehat — persis seperti jalanin Python berkali-kali.
  const MAX_SUBMIT_RETRIES = 4;
  let submitData = null;
  let lastError  = null;

  for (let attempt = 1; attempt <= MAX_SUBMIT_RETRIES; attempt++) {
    try {
      console.log(`[YouTube] Submit attempt ${attempt}/${MAX_SUBMIT_RETRIES}`);

      const submitResp = await fetch(API_SUBMIT, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await submitResp.json();

      // Cek apakah VPS ini error INTERNAL_ERROR
      if (data?.error?.code === "INTERNAL_ERROR" || !submitResp.ok) {
        const errMsg = data?.error?.message ?? `HTTP ${submitResp.status}`;
        console.warn(`[YouTube] VPS error (attempt ${attempt}): ${errMsg} — retrying...`);
        lastError = errMsg;

        // Tunggu sebentar sebelum retry supaya landing ke VPS berbeda
        if (attempt < MAX_SUBMIT_RETRIES) await sleep(800);
        continue;
      }

      // Sukses dapat statusUrl
      if (data?.statusUrl) {
        submitData = data;
        console.log(`[YouTube] Submit OK (attempt ${attempt}), domain: ${data?.domain}`);
        break;
      }

      // Kalau langsung completed tanpa polling
      if (data?.downloadUrl || data?.status === "completed") {
        return buildResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly, data });
      }

      lastError = "Response tidak valid: " + JSON.stringify(data);
      if (attempt < MAX_SUBMIT_RETRIES) await sleep(800);

    } catch (err) {
      lastError = err.message;
      console.warn(`[YouTube] Submit exception (attempt ${attempt}): ${err.message}`);
      if (attempt < MAX_SUBMIT_RETRIES) await sleep(800);
    }
  }

  if (!submitData) {
    throw new Error(`Submit gagal setelah ${MAX_SUBMIT_RETRIES}x retry. Error terakhir: ${lastError}`);
  }

  // ── Polling status ───────────────────────────────────────────────────────
  const statusUrl = submitData.statusUrl;
  console.log(`[YouTube] Polling: ${statusUrl}`);

  // Polling ke VPS spesifik (vps-xxxx.ytconvert.org) yang assign job ini
  // Max 7x × 2 detik = 14 detik → aman di Vercel maxDuration 20s
  const MAX_POLL  = 7;
  const POLL_DELAY = 2_000;

  for (let i = 0; i < MAX_POLL; i++) {
    await sleep(POLL_DELAY);

    try {
      const statusResp = await fetch(statusUrl, {
        headers: { ...HEADERS, "Content-Type": undefined },
        signal: AbortSignal.timeout(8_000),
      });

      if (!statusResp.ok) {
        console.warn(`[YouTube] Poll ${i + 1} HTTP ${statusResp.status}`);
        continue;
      }

      const statusData = await statusResp.json();
      const status = statusData?.status;
      console.log(`[YouTube] Poll ${i + 1}: status=${status} progress=${statusData?.progress ?? "?"}%`);

      if (status === "completed" && statusData?.downloadUrl) {
        return buildResponse({
          videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly,
          data: { ...submitData, ...statusData },
        });
      }

      if (status === "failed" || status === "error") {
        throw new Error(statusData?.message || "Konversi gagal di server.");
      }

    } catch (err) {
      if (err.message.includes("Konversi gagal")) throw err;
      console.warn(`[YouTube] Poll ${i + 1} exception: ${err.message}`);
    }
  }

  throw new Error("Timeout: konversi memakan waktu terlalu lama. Coba lagi.");
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
    author: { username: null, avatar: null, channel_url: null },
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
      author:  null,
    },
    stats: { view_count: null, like_count: null, comment_count: null },
    meta: {
      video_id:     videoId,
      source_url:   sourceUrl,
      thumbnail_hq: thumbHQ,
      thumbnail_mq: thumbMQ,
      is_shorts:    isShorts,
      format,
      quality,
      provider: "hub.ytconvert.org",
    },
  };
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
