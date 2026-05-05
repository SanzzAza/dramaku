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

  const mockReq = {
    method: req.method,
    query,
    body: null,
    url: req.url,
  };

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

  const apiMap = {
    "/api/downloader": "./api/downloader.js",
    "/api/tools":      "./api/tools.js",
    "/api/proxy":      "./api/proxy.js",
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

  // ── /api/drama router (GoodShort · DramaBox · Melolo) ─────────────────────
  if (pathname === "/api/drama") {
    try {
      const {
        gsHome, gsSearch, gsDetail, gsStream, gsStreamFast, gsUnlockAll,
        dbHome, dbRank, dbSearch, dbDetail, dbEpisodes,
        mlHome, mlSearch, mlDetail, mlVideo,
      } = await import("./api/drama.js");

      const q      = mockReq.query;
      const source = (q.source || "goodshort").toLowerCase();
      const action = (q.action || "home").toLowerCase();

      // ── GoodShort ──────────────────────────────────────────────────────────
      if (source === "goodshort") {
        let result;
        const page    = parseInt(q.page)    || 1;
        const channel = q.channel           || "id";
        const bid     = q.id                || q.bookId || "";
        const ep      = parseInt(q.ep)      || 1;
        const quality = q.quality           || "720p";

        if      (action === "home"    || action === "foryou" || action === "trending")
          result = await gsHome(page, channel);
        else if (action === "search")
          result = await gsSearch(q.query || q.q || "", page);
        else if (action === "detail")
          result = await gsDetail(bid);
        else if (action === "stream")
          result = await gsStream(bid, ep, quality);
        else if (action === "stream_fast" || action === "episode")
          result = await gsStreamFast(bid, ep, quality);
        else if (action === "unlock")
          result = await gsUnlockAll(bid, quality);
        else
          result = { status: false, code: 400, message: `Unknown action '${action}' for goodshort` };

        mockRes.json(result);
        return;
      }

      // ── DramaBox ───────────────────────────────────────────────────────────
      if (source === "dramabox") {
        let result;
        const page = parseInt(q.page) || 1;
        const size = parseInt(q.size) || 10;
        const lang = q.lang || "in";
        const did  = q.id   || q.bookId || "";
        const ep   = parseInt(q.ep) || 1;

        if      (action === "home" || action === "foryou")
          result = await dbHome(page, size, lang);
        else if (action === "rank" || action === "trending")
          result = await dbRank(lang);
        else if (action === "search")
          result = await dbSearch(q.query || q.keyword || "", page, lang);
        else if (action === "detail")
          result = await dbDetail(did, q.lang || "en");
        else if (action === "episodes" || action === "episode")
          result = await dbEpisodes(did, lang);
        else
          result = { status: false, code: 400, message: `Unknown action '${action}' for dramabox` };

        mockRes.json(result);
        return;
      }

      // ── Melolo ─────────────────────────────────────────────────────────────
      if (source === "melolo") {
        let result;
        const lang   = q.lang   || "id";
        const offset = parseInt(q.offset) || 0;
        const did    = q.id     || "";
        const ep     = parseInt(q.ep) || 1;

        if      (action === "home" || action === "foryou" || action === "trending")
          result = await mlHome(lang, offset);
        else if (action === "search")
          result = await mlSearch(q.query || q.q || "", lang);
        else if (action === "detail")
          result = await mlDetail(did, lang);
        else if (action === "video" || action === "episode")
          result = await mlVideo(did, ep);
        else
          result = { status: false, code: 400, message: `Unknown action '${action}' for melolo` };

        mockRes.json(result);
        return;
      }

      mockRes.json({ status: false, code: 400, message: `Unknown source '${source}'. Use: goodshort | dramabox | melolo` });
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: false, code: 500, message: err.message }));
    }
    return;
  }

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
  console.log(`   Lirik     → http://localhost:${PORT}/api/tools?tool=lirik&artist=queen&title=bohemian rhapsody`);
  console.log(`   Film      → http://localhost:${PORT}/api/tools?tool=film&action=search&query=avengers`);
  console.log(`   Sholat    → http://localhost:${PORT}/api/tools?tool=sholat&kota=Jakarta`);
  console.log(`   Resi      → http://localhost:${PORT}/api/tools?tool=resi&resi=JD0123456789&kurir=jne`);
  console.log(`   Bola      → http://localhost:${PORT}/api/tools?tool=bola&action=live`);
  console.log(`   Manga     → http://localhost:${PORT}/api/tools?tool=manga&action=search&query=naruto`);

  console.log(`\n  🎬 DRAMA (GoodShort · DramaBox · Melolo)`);
  console.log(`\n   ── GoodShort ──`);
  console.log(`   Home      → http://localhost:${PORT}/api/drama?action=home&source=goodshort&channel=id`);
  console.log(`   Search    → http://localhost:${PORT}/api/drama?action=search&source=goodshort&query=cinta`);
  console.log(`   Detail    → http://localhost:${PORT}/api/drama?action=detail&source=goodshort&id=31001345248`);
  console.log(`   Stream    → http://localhost:${PORT}/api/drama?action=episode&source=goodshort&id=31001345248&ep=1`);
  console.log(`   Unlock    → http://localhost:${PORT}/api/drama?action=unlock&source=goodshort&id=31001345248`);
  console.log(`\n   ── DramaBox ──`);
  console.log(`   Home      → http://localhost:${PORT}/api/drama?action=home&source=dramabox&lang=in`);
  console.log(`   Rank      → http://localhost:${PORT}/api/drama?action=rank&source=dramabox&lang=in`);
  console.log(`   Search    → http://localhost:${PORT}/api/drama?action=search&source=dramabox&query=cinta`);
  console.log(`   Detail    → http://localhost:${PORT}/api/drama?action=detail&source=dramabox&id=42000002888`);
  console.log(`   Episodes  → http://localhost:${PORT}/api/drama?action=episode&source=dramabox&id=42000002888`);
  console.log(`\n   ── Melolo ──`);
  console.log(`   Home      → http://localhost:${PORT}/api/drama?action=home&source=melolo&lang=id`);
  console.log(`   Search    → http://localhost:${PORT}/api/drama?action=search&source=melolo&query=cinta`);
  console.log(`   Detail    → http://localhost:${PORT}/api/drama?action=detail&source=melolo&id=7614440427814390837`);
  console.log(`   Video     → http://localhost:${PORT}/api/drama?action=episode&source=melolo&id=7614440427814390837&ep=1`);

  console.log(`\n  📰 NEWS`);
  console.log(`   Latest    → http://localhost:${PORT}/api/news?source=detik`);
  console.log(`   Category  → http://localhost:${PORT}/api/news?source=cnn&category=teknologi`);
  console.log(`   Search    → http://localhost:${PORT}/api/news?action=search&query=ekonomi`);
  console.log(`   Multi     → http://localhost:${PORT}/api/news?action=multi&sources=detik,cnn,kompas`);
  console.log(`   Sources   → http://localhost:${PORT}/api/news?action=sources`);

  console.log("\n   Press Ctrl+C to stop\n");
});
