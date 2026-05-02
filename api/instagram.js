/**
 * Instagram Downloader API — via Cobalt (self-hosted on Railway)
 * GET /api/instagram?url=https://www.instagram.com/reel/...
 */

const COBALT_URL = "https://cobalt-api-production-2914.up.railway.app";

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
    const result = await fetchViaCobalt(url);
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

async function fetchViaCobalt(url) {
  const resp = await fetch(COBALT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!resp.ok) {
    throw new Error(`Cobalt responded ${resp.status}`);
  }

  const data = await resp.json();

  // status: "tunnel" atau "redirect" = sukses, langsung ada URL-nya
  if (data.status === "tunnel" || data.status === "redirect") {
    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: "video",
        url: data.url,
        download_url: data.url,
        filename: data.filename ?? null,
        thumbnail: null,
      },
    };
  }

  // status: "picker" = multiple media (carousel/slideshow)
  if (data.status === "picker") {
    const items = data.picker ?? [];

    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: items[0]?.type ?? "image",
        url: items[0]?.url ?? null,
        download_url: items[0]?.url ?? null,
        thumbnail: null,
        all_items: items.map(i => ({ type: i.type, url: i.url })),
      },
    };
  }

  // status: "error"
  const errCode = data.error?.code ?? "unknown";
  throw new Error(`Cobalt error: ${errCode}`);
}
