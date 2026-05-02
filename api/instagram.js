/**
 * Instagram Downloader API — No external dependencies
 * Supports: Post, Reel, Story, IGTV
 * GET /api/instagram?url=https://www.instagram.com/p/...
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

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/instagram?url=https://www.instagram.com/p/ABC123/",
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
    const data = await fetchInstagram(url);
    return res.status(200).json(data);
  } catch (err) {
    console.error("[Instagram API]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mengambil data. Pastikan akun tidak private.",
    });
  }
}

// ── FETCHER via snapinsta / instafinsta API ──
async function fetchInstagram(url) {
  // Primary: snapinsta scrape via saveig API (no key needed)
  const apiUrl = `https://api.saveig.app/api/?url=${encodeURIComponent(url)}`;

  const resp = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; InstagramDL/1.0)",
      "Accept": "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`API responded ${resp.status}`);
  }

  const json = await resp.json();

  if (!json || !json.data || json.data.length === 0) {
    throw new Error("Konten tidak ditemukan. Pastikan link benar dan akun tidak private.");
  }

  const items = json.data.map((item, i) => ({
    index: i + 1,
    type: item.type || "unknown",       // "video" | "image"
    url: item.url || null,
    thumbnail: item.thumbnail || null,
    duration: item.duration || null,
  }));

  const isVideo  = items.some(i => i.type === "video");
  const isMulti  = items.length > 1;

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    meta: {
      type: isMulti ? "carousel" : isVideo ? "video" : "image",
      total_media: items.length,
      source_url: url,
    },
    media: items,
  };
}
