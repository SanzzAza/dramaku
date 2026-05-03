/**
 * Terabox Proxy — redirect ke URL Terabox dengan header yang benar
 *
 * GET /api/proxy?url=https://d8.freeterabox.com/...
 *
 * Karena Vercel tidak bisa stream file besar (limit 4.5MB / 10s timeout),
 * endpoint ini fetch URL final dari Terabox (ikuti redirect), lalu
 * kembalikan 302 redirect ke URL final tersebut.
 * Browser akan download langsung dari CDN Terabox.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
};

const TERABOX_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ALLOWED_DOMAINS = [
  "freeterabox.com", "1024terabox.com", "terabox.com",
  "teraboxapp.com", "terafileshare.com", "nephobox.com",
  "4funbox.com", "mirrorbox.cc", "gibibox.com",
];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: false, message: "Method Not Allowed" }));
  }

  const url = req.query?.url;

  if (!url) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: false,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/proxy?url=https://d8.freeterabox.com/file/...",
    }));
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (_) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: false, message: "URL tidak valid." }));
  }

  const hostname = parsedUrl.hostname.replace(/^www\./, "").replace(/^d\d+\./, "");
  if (!ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d))) {
    res.writeHead(403, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: false, message: "Domain tidak diizinkan." }));
  }

  try {
    // Fetch HEAD dulu untuk ikuti redirect dan dapat final URL
    // Terabox biasanya redirect 1-2x ke CDN node yang sebenarnya
    const upstream = await fetch(url, {
      method  : "HEAD",
      headers : {
        "User-Agent": TERABOX_UA,
        "Referer"   : "https://www.1024terabox.com/",
        "Origin"    : "https://www.1024terabox.com",
      },
      redirect: "follow",
      signal  : AbortSignal.timeout(10_000),
    });

    // URL final setelah semua redirect diikuti
    const finalUrl = upstream.url || url;

    // Redirect browser langsung ke CDN Terabox
    res.writeHead(302, {
      ...CORS_HEADERS,
      "Location": finalUrl,
    });
    return res.end();

  } catch (_) {
    // Kalau HEAD gagal, langsung redirect ke URL original
    res.writeHead(302, {
      ...CORS_HEADERS,
      "Location": url,
    });
    return res.end();
  }
}
