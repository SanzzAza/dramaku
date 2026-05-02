/**
 * YouTube Downloader API — via ytconvert.org scraping
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 * GET /api/youtube?url=...&quality=360|480|720|1080
 * GET /api/youtube?url=...&audio_only=true
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const BASE   = "https://ytconvert.org";
const UA     = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const url       = req.query.url       || req.body?.url;
  const quality   = req.query.quality   || req.body?.quality   || "720";
  const audioOnly = req.query.audio_only === "true" || req.body?.audio_only === true;

  if (!url) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
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
    const result = await fetchYoutube(url, quality, audioOnly);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[YouTube]", err.message);
    return res.status(500).json({
      status: false, code: 500,
      message: err.message || "Gagal mengambil media.",
    });
  }
}

// ── Ambil cookies dari halaman utama (untuk bypass anti-bot) ──
async function getCookies() {
  const r = await fetch(`${BASE}/`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  const raw = r.headers.get("set-cookie") || "";
  return raw.split(",").map(c => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

// ── Hit endpoint ytmp3 ──
async function fetchMp3(url, cookies) {
  const r = await fetch(`${BASE}/api/ytmp3`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      "Referer": `${BASE}/`,
      "Origin": BASE,
      "Cookie": cookies,
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(15000),
  });

  if (!r.ok) throw new Error(`ytconvert mp3 responded ${r.status}`);
  const json = await r.json();
  if (!json?.status || !json?.data?.downloadUrl) {
    throw new Error(json?.message || "Gagal mendapatkan link audio.");
  }
  return json;
}

// ── Hit endpoint ytmp4 ──
async function fetchMp4(url, quality, cookies) {
  const r = await fetch(`${BASE}/api/ytmp4`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      "Referer": `${BASE}/`,
      "Origin": BASE,
      "Cookie": cookies,
    },
    body: JSON.stringify({ url, quality: `${quality}p` }),
    signal: AbortSignal.timeout(15000),
  });

  if (!r.ok) throw new Error(`ytconvert mp4 responded ${r.status}`);
  const json = await r.json();
  if (!json?.status || !json?.result?.downloads?.video?.url) {
    throw new Error(json?.message || "Gagal mendapatkan link video.");
  }
  return json;
}

async function fetchYoutube(url, quality, audioOnly) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts  = /\/shorts\//i.test(url);
  const thumbHQ   = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbMQ   = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Ambil cookies dulu
  const cookies = await getCookies();

  // Ambil metadata dari oEmbed (ringan, no auth)
  let title = null, author = null;
  try {
    const oe = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (oe.ok) {
      const d = await oe.json();
      title  = d.title       || null;
      author = d.author_name || null;
    }
  } catch { /* optional */ }

  const safeTitle = (title || `youtube_${videoId}`)
    .slice(0, 50)
    .replace(/[\\/:*?"<>|]/g, "_");

  // ── Audio only ──
  if (audioOnly) {
    const data = await fetchMp3(url, cookies);
    const d    = data.data;

    return {
      status: true, code: 200,
      message: "Berhasil mengambil data media.",
      author: { username: author || null, avatar: null, channel_url: null },
      video: {
        id: videoId, title: d.title || title, duration: null,
        type: isShorts ? "shorts" : "video", quality: d.quality || "128k",
        play: null, audio_only: d.downloadUrl, cover: thumbHQ,
        filename: `${safeTitle}.mp3`,
      },
      audio: { play: d.downloadUrl, quality: d.quality || null, author: author || null },
      stats: { view_count: null, like_count: null, comment_count: null },
      meta: {
        video_id: videoId, source_url: sourceUrl,
        thumbnail_hq: thumbHQ, thumbnail_mq: thumbMQ,
        is_shorts: isShorts, provider: "ytconvert",
      },
    };
  }

  // ── Video ──
  const data = await fetchMp4(url, quality, cookies);
  const r    = data.result;
  const vid  = r.downloads.video;

  return {
    status: true, code: 200,
    message: "Berhasil mengambil data media.",
    author: { username: author || null, avatar: null, channel_url: null },
    video: {
      id: videoId, title: r.title || title, duration: null,
      type: isShorts ? "shorts" : "video", quality: vid.quality || quality,
      play: vid.url, audio_only: null, cover: thumbHQ,
      filename: `${safeTitle}.mp4`,
    },
    audio: { play: null, author: author || null },
    stats: { view_count: null, like_count: null, comment_count: null },
    meta: {
      video_id: videoId, source_url: sourceUrl,
      thumbnail_hq: thumbHQ, thumbnail_mq: thumbMQ,
      is_shorts: isShorts, provider: "ytconvert",
    },
  };
}
