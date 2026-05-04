/**
 * Local Development Server
 * Run: node server.js
 * Open: http://localhost:3000
 */

import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";
import { fileURLToPath } from "url";
import { parse } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

const server = createServer(async (req, res) => {
  const { pathname, query } = parse(req.url, true);

  // ── Mock req/res for API handlers ──
  const mockReq = {
    method: req.method,
    query,
    body: null,
    url: req.url,
  };

  // Parse body for POST
  if (req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      mockReq.body = JSON.parse(Buffer.concat(chunks).toString());
    } catch { mockReq.body = {}; }
  }

  const mockRes = {
    _status: 200,
    _headers: {},
    status(code) { this._status = code; return this; },
    setHeader(k, v) { this._headers[k] = v; },
    writeHead(code, headers = {}) {
      this._status = code;
      Object.assign(this._headers, headers);
    },
    json(data) {
      this._headers["Content-Type"] = "application/json";
      res.writeHead(this._status, this._headers);
      res.end(JSON.stringify(data, null, 2));
    },
    end(data = "") {
      res.writeHead(this._status, this._headers);
      res.end(data);
    },
  };

  // ── Route API ──
  const apiMap = {
    "/api/downloader": "./api/downloader.js",
    "/api/tools":      "./api/tools.js",
    "/api/proxy":      "./api/proxy.js",
    "/api/drama":      "./api/drama.js",
    "/api/news":       "./api/news.js",
  };

  if (apiMap[pathname]) {
    try {
      const { default: handler } = await import(apiMap[pathname]);
      await handler(mockReq, mockRes);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: false, code: 500, message: err.message }));
    }
    return;
  }

  // ── Serve static files ──
  let filePath = pathname === "/" ? "/public/index.html" : pathname;
  filePath = join(__dirname, filePath);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`\n  📥 DOWNLOADER`);
  console.log(`   YouTube   → http://localhost:${PORT}/api/downloader?platform=youtube&url=...`);
  console.log(`   TikTok    → http://localhost:${PORT}/api/downloader?platform=tiktok&url=...`);
  console.log(`   Instagram → http://localhost:${PORT}/api/downloader?platform=instagram&url=...`);
  console.log(`   Facebook  → http://localhost:${PORT}/api/downloader?platform=facebook&url=...`);
  console.log(`   Pinterest → http://localhost:${PORT}/api/downloader?platform=pinterest&url=...`);
  console.log(`   Twitter/X → http://localhost:${PORT}/api/downloader?platform=twitter&url=...`);
  console.log(`   Threads   → http://localhost:${PORT}/api/downloader?platform=threads&url=...`);
  console.log(`   Terabox   → http://localhost:${PORT}/api/downloader?platform=terabox&url=...`);
  console.log(`\n  🛠️  TOOLS`);
  console.log(`   AI Image  → http://localhost:${PORT}/api/tools?tool=aiimage&prompt=...`);
  console.log(`   Anime     → http://localhost:${PORT}/api/tools?tool=anime&type=neko`);
  console.log(`   Cek No    → http://localhost:${PORT}/api/tools?tool=cekno&no=08123456789`);
  console.log(`   Cuaca     → http://localhost:${PORT}/api/tools?tool=cuaca&kota=Jakarta`);
  console.log(`   Kurs      → http://localhost:${PORT}/api/tools?tool=kurs&dari=USD&ke=IDR`);
  console.log(`   QR Code   → http://localhost:${PORT}/api/tools?tool=qrcode&text=https://example.com`);
  console.log(`   Quote     → http://localhost:${PORT}/api/tools?tool=quote&lang=id`);
  console.log(`   Screenshot→ http://localhost:${PORT}/api/tools?tool=screenshot&url=https://example.com`);
  console.log(`   Short URL → http://localhost:${PORT}/api/tools?tool=shorturl&url=https://example.com`);
  console.log(`   TTS       → http://localhost:${PORT}/api/tools?tool=tts&text=Halo`);
  console.log(`\n  📰 NEWS`);
  console.log(`   Latest    → http://localhost:${PORT}/api/news?source=detik`);
  console.log(`   Category  → http://localhost:${PORT}/api/news?source=cnn&category=teknologi`);
  console.log(`   Search    → http://localhost:${PORT}/api/news?action=search&query=ekonomi`);
  console.log(`   Multi     → http://localhost:${PORT}/api/news?action=multi&sources=detik,cnn,kompas`);
  console.log(`   Sources   → http://localhost:${PORT}/api/news?action=sources`);
  console.log("\n   Press Ctrl+C to stop\n");
});
