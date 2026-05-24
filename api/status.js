/**
 * Status API
 * GET /api/status
 *
 * Menampilkan health sederhana + katalog endpoint utama.
 */

const BOOT_TIME = Date.now();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const ENDPOINTS = {
  status: "/api/status",
  drama: "/api/drama?source=goodshort&action=home",
  downloader: "/api/downloader?tool=tiktok&url=https://vt.tiktok.com/...",
  tools: "/api/tools?tool=quote&lang=id",
  ai: "/api/ai?tool=chat&prompt=Halo",
  news: "/api/news?source=detik",
  sankanime: "/api/sankanime?action=latest&page=1",
  proxy: "/api/proxy?url=https://d8.freeterabox.com/file/...",
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  if (req.method !== "GET") {
    res.writeHead(405, CORS_HEADERS);
    return res.end(JSON.stringify({ status: false, code: 405, message: "Method Not Allowed" }));
  }

  const uptimeMs = Date.now() - BOOT_TIME;

  res.writeHead(200, CORS_HEADERS);
  return res.end(
    JSON.stringify(
      {
        creator: "@SanzXD",
        status: true,
        code: 200,
        message: "API is healthy",
        result: {
          service: "dramaku-api",
          now: new Date().toISOString(),
          uptime_ms: uptimeMs,
          uptime_sec: Math.floor(uptimeMs / 1000),
          runtime: process.release?.name || "node",
          node_version: process.version,
          endpoints: ENDPOINTS,
        },
      },
      null,
      2,
    ),
  );
}
