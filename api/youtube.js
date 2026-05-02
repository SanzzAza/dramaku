/**
 * YouTube Downloader API — scraping ytdl.y2mp3.co (backend of ytconvert.org)
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 * GET /api/youtube?url=...&quality=128|192|320      (audio bitrate)
 * GET /api/youtube?url=...&format=mp3|mp4
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const API_BASE = "https://ytdl.y2mp3.co";
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";

const HEADERS = {
  "Accept": "application/json",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Origin": "https://ytconvert.org",
  "Referer": "https://ytconvert.org/",
  "User-Agent": UA,
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const url      = req.query.url    || req.body?.url;
  const format   = req.query.format || req.body?.format   || "mp3";
  const quality  = req.query.quality|| req.body?.quality  || "128";
  const audioOnly = format !== "mp4";

  if (!url) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=mp3",
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

async function fetchYoutube(url, format, quality) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts  = /\/shorts\//i.test(url);
  const thumbHQ   = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbMQ   = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const audioOnly = format !== "mp4";

  // Step 1: Submit convert job
  // URL pattern dari ytconvert.org: /?v={videoId}&format=mp3&quality=128
  const convertUrl = `${API_BASE}/api/convert?v=${videoId}&format=${format}&quality=${quality}`;
  
  const submitResp = await fetch(convertUrl, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!submitResp.ok) throw new Error(`Submit job failed: ${submitResp.status}`);

  const submitData = await submitResp.json();
  console.log("[YouTube] Submit response:", JSON.stringify(submitData));

  // Jika langsung dapat downloadUrl (status completed)
  if (submitData?.downloadUrl || submitData?.status === "completed") {
    return buildResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, data: submitData });
  }

  // Step 2: Polling status jika ada jobId
  const jobId = submitData?.jobId || submitData?.id || videoId;
  const maxTries = 20;
  const delay = 2000; // 2 detik tiap poll

  for (let i = 0; i < maxTries; i++) {
    await sleep(delay);

    const statusResp = await fetch(`${API_BASE}/api/status/${jobId}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
    });

    if (!statusResp.ok) continue;

    const statusData = await statusResp.json();
    console.log(`[YouTube] Poll ${i+1}:`, JSON.stringify(statusData));

    if (statusData?.status === "completed" && statusData?.downloadUrl) {
      return buildResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, data: statusData });
    }

    if (statusData?.status === "failed" || statusData?.status === "error") {
      throw new Error(statusData?.message || "Konversi gagal di server.");
    }
  }

  throw new Error("Timeout: konversi memakan waktu terlalu lama.");
}

function buildResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, data }) {
  const title     = data?.title || null;
  const audioOnly = format !== "mp4";
  const safeTitle = (title || `youtube_${videoId}`)
    .slice(0, 50)
    .replace(/[\\/:*?"<>|]/g, "_");

  return {
    status: true, code: 200,
    message: "Berhasil mengambil data media.",
    author: { username: null, avatar: null, channel_url: null },
    video: {
      id: videoId,
      title,
      duration: data?.duration || null,
      type: isShorts ? "shorts" : "video",
      quality: audioOnly ? null : quality,
      play: audioOnly ? null : data?.downloadUrl,
      audio_only: audioOnly ? data?.downloadUrl : null,
      cover: thumbHQ,
      filename: `${safeTitle}.${format}`,
    },
    audio: {
      play: audioOnly ? data?.downloadUrl : null,
      quality: audioOnly ? `${quality}kbps` : null,
      author: null,
    },
    stats: { view_count: null, like_count: null, comment_count: null },
    meta: {
      video_id: videoId,
      source_url: sourceUrl,
      thumbnail_hq: thumbHQ,
      thumbnail_mq: thumbMQ,
      is_shorts: isShorts,
      provider: "ytdl.y2mp3.co",
    },
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
