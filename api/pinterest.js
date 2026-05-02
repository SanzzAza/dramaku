/**
 * Pinterest Downloader API — scraping og meta tags
 * GET /api/pinterest?url=https://www.pinterest.com/pin/...
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(200, CORS_HEADERS); return res.end(); }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (!["GET","POST"].includes(req.method)) return res.status(405).json({ status:false, code:405, message:"Method Not Allowed." });

  const url = req.query.url || req.body?.url;

  if (!url) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/pinterest?url=https://www.pinterest.com/pin/123456789/",
    });
  }

  const pinRegex = /^https?:\/\/(www\.|id\.|in\.)?pinterest\.(com|co\.uk|co\.id)\/pin\/.+/i;
  if (!pinRegex.test(url)) {
    return res.status(400).json({
      status: false, code: 400,
      message: "URL tidak valid. Masukkan link Pinterest pin yang benar.",
    });
  }

  try {
    const result = await fetchPinterest(url);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Pinterest]", err.message);
    return res.status(500).json({ status:false, code:500, message: err.message });
  }
}

async function fetchPinterest(url) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!resp.ok) throw new Error(`Pinterest merespons ${resp.status}.`);
  const html = await resp.text();

  // Parse meta tags
  const getMeta = (prop) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]+)"`, "i"))
      || html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="${prop}"`, "i"));
    return m ? m[1] : null;
  };

  const videoUrl  = getMeta("og:video") || getMeta("og:video:url");
  const imageUrl  = getMeta("og:image");
  const title     = getMeta("og:title");
  const desc      = getMeta("og:description");

  if (!videoUrl && !imageUrl) throw new Error("Media tidak ditemukan di pin ini.");

  const type = videoUrl ? "video" : "image";

  return {
    creator: "@SanzXD",
    status: true, code: 200,
    message: "Berhasil mengambil media Pinterest.",
    result: {
      source_url: url,
      type,
      title: title || null,
      description: desc || null,
      media: {
        url: videoUrl || imageUrl,
        video: videoUrl || null,
        image: imageUrl || null,
      },
      provider: "pinterest.com",
    },
  };
}
