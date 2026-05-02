/**
 * Instagram Downloader API
 * Library: instagram-url-direct
 *
 * GET /api/instagram?url=https://www.instagram.com/reel/...
 */

import { instagramGetUrl } from "instagram-url-direct";

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
    const data = await instagramGetUrl(url, { retries: 3, delay: 1000 });

    if (!data || data.results_number === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Media tidak ditemukan.",
      });
    }

    const first = data.media_details[0];

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      author: {
        username: data.post_info?.owner_username || null,
        fullname: data.post_info?.owner_fullname || null,
        is_verified: data.post_info?.is_verified || false,
      },
      result: {
        type: first?.type || "unknown",
        url: first?.url || data.url_list[0] || null,
        download_url: first?.url || data.url_list[0] || null,
        thumbnail: first?.thumbnail || null,
        // Kalau carousel (multi-media)
        media_count: data.results_number,
        all_urls: data.url_list,
      },
    });
  } catch (err) {
    console.error("[Instagram]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mengambil data media.",
    });
  }
}
