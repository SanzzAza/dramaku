import { Downloader } from "@tobyg74/tiktok-api-dl";

/**
 * TikTok Downloader API
 * GET/POST /api/tiktok?url=https://vt.tiktok.com/...
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow GET and POST
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      status: false,
      code: 405,
      message: "Method Not Allowed. Use GET or POST.",
    });
  }

  // Get URL from query or body
  const url = req.query.url || req.body?.url;

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/tiktok?url=https://vt.tiktok.com/ZS9mu8NkJ/",
    });
  }

  // Validate TikTok URL
  const tiktokRegex =
    /^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\/.+/i;
  if (!tiktokRegex.test(url)) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "URL tidak valid. Masukkan link TikTok yang benar.",
    });
  }

  try {
    const result = await Downloader(url, {
      version: "v3", // v1 | v2 | v3
    });

    if (!result || result.status !== "success") {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Video tidak ditemukan atau link sudah expired.",
      });
    }

    const data = result.result;

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Berhasil mengambil data video.",
      author: {
        uid: data.author?.uid || null,
        username: data.author?.username || null,
        nickname: data.author?.nickname || null,
        signature: data.author?.signature || null,
        avatar: data.author?.avatar || null,
        verified: data.author?.verified || false,
      },
      video: {
        id: data.id || null,
        title: data.desc || null,
        duration: data.duration || null,
        cover: data.cover || null,
        dynamic_cover: data.dynamicCover || null,
        // No watermark links
        play: data.video?.[0] || null,
        play_watermark: data.videoWatermark?.[0] || null,
        hdplay: data.videoHD?.[0] || null,
        size: data.videoSize || null,
        hd_size: data.videoHDSize || null,
      },
      audio: {
        play: data.music || null,
        title: data.musicInfo?.title || null,
        author: data.musicInfo?.author || null,
        cover: data.musicInfo?.cover || null,
        duration: data.musicInfo?.duration || null,
      },
      stats: {
        play_count: data.playCount || null,
        like_count: data.likeCount || null,
        comment_count: data.commentCount || null,
        share_count: data.shareCount || null,
        download_count: data.downloadCount || null,
      },
    });
  } catch (error) {
    console.error("[TikTok API Error]", error.message);

    return res.status(500).json({
      status: false,
      code: 500,
      message: "Terjadi kesalahan pada server. Coba lagi nanti.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
