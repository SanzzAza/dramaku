/**
 * Instagram Downloader API — via api.danzy.web.id
 * GET /api/instagram?url=https://www.instagram.com/reel/...
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
    const result = await fetchViaDanzy(url);
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

async function fetchViaDanzy(url) {
  const apiUrl = `https://api.danzy.web.id/instagram?url=${encodeURIComponent(url)}`;

  const resp = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Android 10; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
      "Accept": "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`Danzy API responded ${resp.status}`);
  }

  const data = await resp.json();

  // Validasi response dari danzy
  if (!data.status || !data.result) {
    throw new Error("Gagal mendapatkan data dari sumber. Coba beberapa saat lagi.");
  }

  const { type, username, thumb, videos, images, mp3 } = data.result;

  // Bangun result berdasarkan tipe media
  const result = { type, username: username || null };

  if (type === "video") {
    if (!videos || videos.length === 0) {
      throw new Error("URL video tidak ditemukan dalam response.");
    }
    result.url = videos[0];
    result.download_url = videos[0];
    result.thumbnail = thumb || null;
    result.all_videos = videos; // kalau ada multiple quality
    result.mp3 = mp3?.[0]?.url || null;

  } else if (type === "image") {
    if (!images || images.length === 0) {
      throw new Error("URL gambar tidak ditemukan dalam response.");
    }
    result.url = images[0];
    result.download_url = images[0];
    result.thumbnail = thumb || null;
    result.all_images = images; // support carousel/multiple images

  } else {
    throw new Error(`Tipe media tidak dikenali: ${type}`);
  }

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    result,
  };
}
