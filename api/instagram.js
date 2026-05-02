/**
 * Instagram Downloader API — via yozora yt-dlp
 * GET /api/instagram?url=https://www.instagram.com/reel/...
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
    const result = await fetchViaYtdlp(url);
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

async function fetchViaYtdlp(url) {
  const apiUrl = `${YTDLP_API}?query=${encodeURIComponent(url)}`;

  const resp = await fetch(apiUrl, {
    headers: { "Accept": "application/json" },
  });

  if (!resp.ok) throw new Error(`yt-dlp API responded ${resp.status}`);

  const data = await resp.json();
  if (!data || data.error) throw new Error(data?.error || "Gagal mengambil data.");

  const shortcode = url.match(/\/(p|reel|tv|stories)\/([^/?]+)/)?.[2] ?? null;
  const videoUrl = data.url || data.formats?.find(f => f.vcodec !== "none")?.url || null;
  const audioUrl = data.formats?.find(f => f.vcodec === "none" && f.acodec !== "none")?.url || null;
  const thumb = data.thumbnail || null;

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: data.uploader_id || data.uploader || null,
      avatar: null,
      verified: null,
    },
    video: {
      play: videoUrl,
      hdplay: videoUrl,
      wmplay: null,
      cover: thumb,
      title: data.title || null,
      duration: data.duration || null,
      filename: `instagram_${shortcode}.mp4`,
    },
    audio: {
      play: audioUrl,
      title: data.track || null,
      author: data.artist || null,
    },
    stats: {
      play_count: data.view_count || null,
      like_count: data.like_count || null,
      comment_count: data.comment_count || null,
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
