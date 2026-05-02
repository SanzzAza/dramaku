/**
 * YouTube Downloader API — via yt-dlp-exec
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 */

import ytDlp from "yt-dlp-exec";

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
    const result = await fetchViaYtDlp(url, quality, audioOnly);
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

async function fetchViaYtDlp(url, quality, audioOnly) {
  const format = audioOnly
    ? "bestaudio[ext=m4a]/bestaudio"
    : `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}]/best`;

  const info = await ytDlp(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCallHome: true,
    format,
    addHeader: ["referer:youtube.com", "user-agent:Mozilla/5.0"],
  });

  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
  const isShorts = /\/shorts\//i.test(url);
  const thumb = info.thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null);

  const formats = info.formats || [];
  const audioFormat = formats
    .filter(f => f.vcodec === "none" && f.acodec !== "none" && f.url)
    .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
  const videoFormat = formats
    .filter(f => f.vcodec !== "none" && f.height && f.height <= parseInt(quality) && f.url)
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

  const videoUrl = videoFormat?.url || info.url || null;
  const audioUrl = audioFormat?.url || null;

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: info.uploader_id || info.uploader || null,
      avatar: null,
      channel_url: info.channel_url || null,
    },
    video: {
      id: videoId,
      title: info.title || null,
      description: info.description ? info.description.slice(0, 300) : null,
      duration: info.duration || null,
      type: isShorts ? "shorts" : "video",
      quality,
      play: audioOnly ? null : videoUrl,
      audio_only: audioOnly ? videoUrl : null,
      cover: thumb,
      filename: info.title ? `${info.title.slice(0, 50)}.mp4` : `youtube_${videoId}.mp4`,
    },
    audio: {
      play: audioUrl,
      title: info.track || info.title || null,
      author: info.artist || info.uploader || null,
    },
    stats: {
      view_count: info.view_count || null,
      like_count: info.like_count || null,
      comment_count: info.comment_count || null,
    },
    meta: {
      video_id: videoId,
      source_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : url,
      thumbnail_hq: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : thumb,
      thumbnail_mq: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
      tags: info.tags?.slice(0, 10) || null,
      categories: info.categories || null,
      provider: "yt-dlp",
    },
  };
}
