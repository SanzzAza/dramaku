/**
 * TikTok Downloader API — No external dependencies
 * Uses TikTok's internal oEmbed + Tikwm API fallback
 * GET /api/tiktok?url=https://vt.tiktok.com/...
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default async function handler(req, res) {
  // CORS preflight
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
      example: "/api/tiktok?url=https://vt.tiktok.com/ZS9mu8NkJ/",
    });
  }

  const tiktokRegex = /^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\/.+/i;
  if (!tiktokRegex.test(url)) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "URL tidak valid. Masukkan link TikTok yang benar.",
    });
  }

  try {
    const data = await fetchTikTok(url);
    return res.status(200).json(data);
  } catch (err) {
    console.error("[TikTok API]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mengambil data video.",
    });
  }
}

// ── MAIN FETCHER via tikwm.com (free, no key needed) ──
async function fetchTikTok(url) {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;

  const resp = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TikTokDL/1.0)",
    },
  });

  if (!resp.ok) throw new Error(`tikwm responded ${resp.status}`);

  const json = await resp.json();

  if (!json || json.code !== 0) {
    throw new Error(json?.msg || "Video tidak ditemukan atau link expired.");
  }

  const d = json.data;

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data video.",
    author: {
      id: d.author?.id || null,
      username: d.author?.unique_id || null,
      nickname: d.author?.nickname || null,
      avatar: d.author?.avatar || null,
      verified: d.author?.verified || false,
    },
    video: {
      id: d.id || null,
      title: d.title || null,
      duration: d.duration || null,
      cover: d.cover || null,
      origin_cover: d.origin_cover || null,
      // No watermark
      play: d.play ? `https://www.tikwm.com${d.play}` : null,
      // HD no watermark
      hdplay: d.hdplay ? `https://www.tikwm.com${d.hdplay}` : null,
      // With watermark
      wmplay: d.wmplay ? `https://www.tikwm.com${d.wmplay}` : null,
      size: d.size || null,
      hd_size: d.hd_size || null,
      wm_size: d.wm_size || null,
    },
    audio: {
      play: d.music ? `https://www.tikwm.com${d.music}` : null,
      title: d.music_info?.title || null,
      author: d.music_info?.author || null,
      cover: d.music_info?.cover || null,
      duration: d.music_info?.duration || null,
      original: d.music_info?.original || false,
    },
    stats: {
      play_count: d.play_count || null,
      like_count: d.digg_count || null,
      comment_count: d.comment_count || null,
      share_count: d.share_count || null,
      download_count: d.download_count || null,
    },
  };
}
