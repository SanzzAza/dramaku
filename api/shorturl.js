/**
 * Short URL API — via TinyURL (free, no key needed)
 * GET /api/shorturl?url=https://example.com/very/long/url
 * GET /api/shorturl?url=...&alias=mybrand   (custom alias, opsional)
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

  const url   = req.query.url   || req.body?.url;
  const alias = req.query.alias || req.body?.alias || "";

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/shorturl?url=https://example.com/very/long/path",
    });
  }

  const urlRegex = /^https?:\/\/.+\..+/i;
  if (!urlRegex.test(url)) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "URL tidak valid. Pastikan diawali dengan http:// atau https://",
    });
  }

  try {
    const result = await shortenUrl(url, alias);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[ShortURL]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mempersingkat URL.",
    });
  }
}

async function shortenUrl(url, alias) {
  // Pakai is.gd — free, no key, support custom alias
  const apiUrl = new URL("https://is.gd/create.php");
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("url", url);
  if (alias) apiUrl.searchParams.set("shorturl", alias);

  const resp = await fetch(apiUrl.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SanzXD-API/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) throw new Error(`is.gd merespons ${resp.status}.`);

  const data = await resp.json();

  if (data.errorcode) {
    throw new Error(data.errormessage || "Gagal mempersingkat URL.");
  }

  const shortUrl = data.shorturl;
  if (!shortUrl) throw new Error("Gagal mendapatkan short URL.");

  const saved = url.length - shortUrl.length;

  return {
    creator: "@SanzXD",
    status: true,
    code: 200,
    message: "URL berhasil dipersingkat.",
    result: {
      original_url: url,
      short_url: shortUrl,
      alias: shortUrl.split("/").pop(),
      chars_saved: saved > 0 ? saved : 0,
      provider: "is.gd",
    },
  };
}
