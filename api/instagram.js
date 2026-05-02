/**
 * Instagram Downloader API — via yt-dlp-exec
 * GET /api/instagram?url=https://www.instagram.com/reel/...
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

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/instagram?url=https://www.instagram.com/reel/ABC123/",
    });
  }

  const igRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\/.+/i;
  if (!igRegex.test(url)) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "URL tidak valid. Masukkan link Instagram Post, Reel, atau IGTV.",
    });
  }

  try {
    const result = await fetchViaYtDlp(url);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Instagram]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mengambil media.",
    });
  }
}

async function fetchViaYtDlp(url) {
  const info = await ytDlp(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCallHome: true,
    preferFreeFormats: true,
    addHeader: ["referer:instagram.com", "user-agent:Mozilla/5.0"],
  });

  const shortcode = url.match(/\/(p|reel|tv|stories)\/([^/?]+)/)?.[2] ?? null;

  // Ambil video URL terbaik
  const formats = info.formats || [];
  const videoFormat = formats
    .filter(f => f.vcodec !== "none" && f.url)
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const audioFormat = formats
    .filter(f => f.vcodec === "none" && f.acodec !== "none" && f.url)[0];

  const videoUrl = videoFormat?.url || info.url || null;
  const audioUrl = audioFormat?.url || null;
  const thumb = info.thumbnail || null;

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: info.uploader_id || info.uploader || null,
      avatar: null,
      verified: null,
    },
    video: {
      play: videoUrl,
      hdplay: videoUrl,
      wmplay: null,
      cover: thumb,
      title: info.title || null,
      duration: info.duration || null,
      filename: `instagram_${shortcode}.mp4`,
    },
    audio: {
      play: audioUrl,
      title: info.track || null,
      author: info.artist || null,
    },
    stats: {
      play_count: info.view_count || null,
      like_count: info.like_count || null,
      comment_count: info.comment_count || null,
      share_count: null,
    },
    meta: {
      shortcode,
      source_url: url,
      thumbnail: thumb,
      provider: "yt-dlp",
    },
  };
}
