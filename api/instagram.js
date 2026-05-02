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

  if (!resp.ok) throw new Error(`Cobalt responded ${resp.status}`);

  const data = await resp.json();

  // Ekstrak shortcode dari URL untuk username fallback
  const shortcode = url.match(/\/(p|reel|tv|stories)\/([^/?]+)/)?.[2] ?? null;

  if (data.status === "tunnel" || data.status === "redirect") {
    return buildResponse({
      type: "video",
      url: data.url,
      filename: data.filename ?? null,
      shortcode,
      items: null,
    });
  }

  if (data.status === "picker") {
    const items = data.picker ?? [];
    return buildResponse({
      type: items[0]?.type === "video" ? "video" : "image",
      url: items[0]?.url ?? null,
      filename: data.filename ?? null,
      shortcode,
      items: items.map(i => ({ type: i.type, url: i.url })),
    });
  }

  const errCode = data.error?.code ?? "unknown";
  throw new Error(`Cobalt error: ${errCode}`);
}

function buildResponse({ type, url, filename, shortcode, items }) {
  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: null,   // tidak tersedia dari Cobalt
      avatar: null,
      verified: null,
    },
    video: type === "video" ? {
      play: url,
      hdplay: url,      // Cobalt sudah return kualitas terbaik
      wmplay: null,     // Instagram tidak ada watermark version
      cover: null,      // tidak tersedia
      filename: filename,
    } : null,
    image: type === "image" ? {
      url: url,
      all_images: items ?? [],
    } : null,
    audio: {
      play: null,       // tidak tersedia dari Cobalt
      title: null,
      author: null,
    },
    stats: {
      play_count: null,
      like_count: null,
      comment_count: null,
      share_count: null,
    },
    meta: {
      shortcode,
      source_url: `https://www.instagram.com/reel/${shortcode}/`,
      provider: "cobalt",
    },
  };
}
