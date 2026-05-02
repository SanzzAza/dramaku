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

  // â”€â”€ Mock req/res for API handlers â”€â”€
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

  // â”€â”€ Route API â”€â”€
  const apiMap = {
    "/api/tiktok":    "./api/tiktok.js",
    "/api/instagram": "./api/instagram.js",
    "/api/youtube":   "./api/youtube.js",
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

  // â”€â”€ Serve static files â”€â”€
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
  console.log(`\nðŸš€ Server running at http://localhost:${PORT}`);
  console.log(`   TikTok   â†’ http://localhost:${PORT}/api/tiktok?url=...`);
  console.log(`   Instagramâ†’ http://localhost:${PORT}/api/instagram?url=...`);
  console.log(`   YouTube  â†’ http://localhost:${PORT}/api/youtube?url=...`);
  console.log("\n   Press Ctrl+C to stop\n");
});
