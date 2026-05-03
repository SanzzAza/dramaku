/**
 * Terabox Proxy — stream/download file langsung dari server
 * 
 * GET /api/proxy?url=https://d8.freeterabox.com/...
 * 
 * Endpoint ini mem-proxy request ke Terabox dengan header yang benar,
 * sehingga file bisa diplay/download langsung dari browser.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type",
};

const TERABOX_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

  // Validasi hanya domain Terabox yang diizinkan
  const ALLOWED_DOMAINS = [
    "freeterabox.com", "1024terabox.com", "terabox.com",
    "teraboxapp.com", "terafileshare.com", "nephobox.com",
    "4funbox.com", "mirrorbox.cc", "gibibox.com",
  ];

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
    // Forward Range header untuk support video seeking
    const reqHeaders = {
      "User-Agent": TERABOX_UA,
      "Referer"   : "https://www.1024terabox.com/",
      "Origin"    : "https://www.1024terabox.com",
      "Accept"    : "*/*",
    };

    if (req.headers?.range) {
      reqHeaders["Range"] = req.headers.range;
    }

    const upstream = await fetch(url, {
      headers: reqHeaders,
      redirect: "follow",
      signal  : AbortSignal.timeout(30_000),
    });

    // Forward headers penting ke client
    const resHeaders = { ...CORS_HEADERS };
    const forwardHeaders = [
      "content-type", "content-length", "content-range",
      "accept-ranges", "last-modified", "etag",
    ];
    for (const h of forwardHeaders) {
      const val = upstream.headers.get(h);
      if (val) resHeaders[h] = val;
    }

    // Force download atau inline tergantung parameter
    const filename = req.query?.filename || parsedUrl.pathname.split("/").pop() || "file";
    const mode = req.query?.mode || "inline"; // inline = play di browser, attachment = download
    resHeaders["Content-Disposition"] = `${mode}; filename="${decodeURIComponent(filename)}"`;

    res.writeHead(upstream.status, resHeaders);

    // Stream response langsung ke client
    if (upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: false, message: err.message || "Gagal proxy file." }));
    }
  }
}
