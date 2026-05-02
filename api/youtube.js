/**
 * YouTube Downloader API — via yozora yt-dlp
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 */

const YTDLP_API = "https://yozora.vercel.app/api/info";

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
    const result = await fetchViaYtdlp(url, quality, audioOnly);
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

async function fetchViaYtdlp(url, quality, audioOnly) {
  const format = audioOnly
    ? "bestaudio[ext=m4a]/bestaudio"
    : `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}]/best`;

  const apiUrl = `${YTDLP_API}?query=${encodeURIComponent(url)}&format=${encodeURIComponent(format)}`;

  const resp = await fetch(apiUrl, {
    headers: { "Accept": "application/json" },
  });

  if (!resp.ok) throw new Error(`yt-dlp API responded ${resp.status}`);

  const data = await resp.json();
  if (!data || data.error) throw new Error(data?.error || "Gagal mengambil data.");

  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
  const isShorts = /\/shorts\//i.test(url);
  const videoUrl = data.url || null;
  const thumb = data.thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null);

  // Cari format audio dan video terbaik dari list formats
  const formats = data.formats || [];
  const audioFormat = formats.find(f => f.vcodec === "none" && f.acodec !== "none");
  const videoFormat = formats.find(f => f.vcodec !== "none" && f.height && f.height <= parseInt(quality));

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: data.uploader_id || data.uploader || null,
      avatar: null,
      channel_url: data.channel_url || null,
    },
    video: {
      id: videoId,
      title: data.title || null,
      description: data.description ? data.description.slice(0, 300) : null,
      duration: data.duration || null,
      type: isShorts ? "shorts" : "video",
      quality: quality,
      play: audioOnly ? null : videoUrl,
      audio_only: audioOnly ? videoUrl : (audioFormat?.url || null),
      cover: thumb,
      filename: data.title ? `${data.title.slice(0, 50)}.mp4` : `youtube_${videoId}.mp4`,
    },
    audio: {
      play: audioFormat?.url || null,
      title: data.track || data.title || null,
      author: data.artist || data.uploader || null,
    },
    stats: {
      view_count: data.view_count || null,
      like_count: data.like_count || null,
      comment_count: data.comment_count || null,
    },
    meta: {
      video_id: videoId,
      source_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : url,
      thumbnail_hq: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : thumb,
      thumbnail_mq: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
      tags: data.tags?.slice(0, 10) || null,
      categories: data.categories || null,
      provider: "yt-dlp",
    },
  };
}
