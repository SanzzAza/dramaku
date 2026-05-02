/**
 * YouTube Downloader API — via Cobalt API (no binary needed, works on Vercel)
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 * GET /api/youtube?url=...&quality=720
 * GET /api/youtube?url=...&audio_only=true
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
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

  const url = req.query.url || req.body?.url;
  const quality = req.query.quality || req.body?.quality || "1080";
  const audioOnly = req.query.audio_only === "true" || req.body?.audio_only === true;

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
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
    const result = await fetchViaCobalt(url, quality, audioOnly);
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

async function fetchViaCobalt(url, quality, audioOnly) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
  const isShorts = /\/shorts\//i.test(url);

  const qualityMap = { "144": 144, "360": 360, "480": 480, "720": 720, "1080": 1080 };
  const resolvedQuality = qualityMap[quality] ?? 1080;

  // Cobalt API — free, no API key needed
  const cobaltRes = await fetch("https://api.cobalt.tools/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      url,
      videoQuality: String(resolvedQuality),
      audioFormat: "mp3",
      downloadMode: audioOnly ? "audio" : "auto",
    }),
  });

  if (!cobaltRes.ok) {
    throw new Error(`Cobalt API responded ${cobaltRes.status}`);
  }

  const cobalt = await cobaltRes.json();

  if (cobalt.status === "error") {
    throw new Error(cobalt.error?.code || "Video tidak dapat diproses.");
  }

  const mediaUrl = cobalt.url || null;
  const thumb = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : null;

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
      title: null,
      duration: null,
      type: isShorts ? "shorts" : "video",
      quality: String(resolvedQuality),
      play: audioOnly ? null : mediaUrl,
      audio_only: audioOnly ? mediaUrl : null,
      cover: thumb,
      filename: videoId ? `youtube_${videoId}.mp4` : "youtube_video.mp4",
    },
    audio: {
      play: audioOnly ? mediaUrl : null,
      title: null,
      author: null,
    },
    stats: {
      view_count: null,
      like_count: null,
      comment_count: null,
    },
    meta: {
      video_id: videoId,
      source_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : url,
      thumbnail_hq: thumb,
      thumbnail_mq: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
      provider: "cobalt",
    },
  };
}
