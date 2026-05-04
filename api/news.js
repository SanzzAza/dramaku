/**
 * News API — Berita terkini dari portal berita Indonesia via RSS Feed
 *
 * GET /api/news?source=detik
 * GET /api/news?source=cnn&category=teknologi&limit=5
 * GET /api/news?action=search&query=ekonomi
 * GET /api/news?action=multi&sources=detik,cnn,kompas&limit=10
 * GET /api/news?action=sources
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type"                : "application/json",
};

const SOURCES = {
  detik:     { name:"Detik",          website:"https://www.detik.com",          categories:{ utama:"https://news.detik.com/berita/rss", news:"https://news.detik.com/berita/rss", finance:"https://finance.detik.com/rss", hot:"https://hot.detik.com/rss", sport:"https://sport.detik.com/rss", teknologi:"https://inet.detik.com/rss", otomotif:"https://oto.detik.com/rss", travel:"https://travel.detik.com/rss", food:"https://food.detik.com/rss", health:"https://health.detik.com/rss" } },
  cnn:       { name:"CNN Indonesia",  website:"https://www.cnnindonesia.com",   categories:{ utama:"https://www.cnnindonesia.com/rss", nasional:"https://www.cnnindonesia.com/nasional/rss", internasional:"https://www.cnnindonesia.com/internasional/rss", ekonomi:"https://www.cnnindonesia.com/ekonomi/rss", olahraga:"https://www.cnnindonesia.com/olahraga/rss", teknologi:"https://www.cnnindonesia.com/teknologi/rss", hiburan:"https://www.cnnindonesia.com/hiburan/rss", gaya_hidup:"https://www.cnnindonesia.com/gaya-hidup/rss" } },
  kompas:    { name:"Kompas",         website:"https://www.kompas.com",         categories:{ utama:"https://rss.kompas.com/api/feed/social?apikey=bc58c81819dff4b8d5c53540a2fc7ffd83e6314a", nasional:"https://indeks.kompas.com/terbaru/xml/channel/nasional", regional:"https://indeks.kompas.com/terbaru/xml/channel/regional", ekonomi:"https://indeks.kompas.com/terbaru/xml/channel/ekonomi", olahraga:"https://indeks.kompas.com/terbaru/xml/channel/olahraga", teknologi:"https://indeks.kompas.com/terbaru/xml/channel/tekno", hiburan:"https://indeks.kompas.com/terbaru/xml/channel/entertainment", otomotif:"https://indeks.kompas.com/terbaru/xml/channel/otomotif", kesehatan:"https://indeks.kompas.com/terbaru/xml/channel/health" } },
  tempo:     { name:"Tempo",          website:"https://www.tempo.co",           categories:{ utama:"https://rss.tempo.co", nasional:"https://rss.tempo.co/nasional", bisnis:"https://rss.tempo.co/bisnis", olahraga:"https://rss.tempo.co/olahraga", dunia:"https://rss.tempo.co/dunia", teknologi:"https://rss.tempo.co/tekno", gaya_hidup:"https://rss.tempo.co/gaya-hidup", otomotif:"https://rss.tempo.co/otomotif" } },
  tribun:    { name:"Tribunnews",     website:"https://www.tribunnews.com",     categories:{ utama:"https://www.tribunnews.com/rss", nasional:"https://www.tribunnews.com/nasional/feed", regional:"https://www.tribunnews.com/regional/feed", internasional:"https://www.tribunnews.com/internasional/feed", olahraga:"https://www.tribunnews.com/sport/feed", bisnis:"https://www.tribunnews.com/bisnis/feed", seleb:"https://www.tribunnews.com/seleb/feed", techno:"https://www.tribunnews.com/techno/feed" } },
  liputan6:  { name:"Liputan6",       website:"https://www.liputan6.com",       categories:{ utama:"https://feed.liputan6.com/rss/news", news:"https://feed.liputan6.com/rss/news", bisnis:"https://feed.liputan6.com/rss/bisnis", bola:"https://feed.liputan6.com/rss/bola", tekno:"https://feed.liputan6.com/rss/tekno", showbiz:"https://feed.liputan6.com/rss/showbiz", otomotif:"https://feed.liputan6.com/rss/otomotif", health:"https://feed.liputan6.com/rss/health", global:"https://feed.liputan6.com/rss/global" } },
  antara:    { name:"Antara News",    website:"https://www.antaranews.com",     categories:{ utama:"https://www.antaranews.com/rss/terkini.xml", nasional:"https://www.antaranews.com/rss/nasional.xml", internasional:"https://www.antaranews.com/rss/internasional.xml", ekonomi:"https://www.antaranews.com/rss/ekonomi.xml", olahraga:"https://www.antaranews.com/rss/olahraga.xml", teknologi:"https://www.antaranews.com/rss/tekno.xml", hiburan:"https://www.antaranews.com/rss/hiburan.xml", humaniora:"https://www.antaranews.com/rss/humaniora.xml" } },
  republika: { name:"Republika",      website:"https://www.republika.co.id",    categories:{ utama:"https://www.republika.co.id/rss/nasional", nasional:"https://www.republika.co.id/rss/nasional/umum", internasional:"https://www.republika.co.id/rss/internasional/global", ekonomi:"https://www.republika.co.id/rss/ekonomi/keuangan", olahraga:"https://www.republika.co.id/rss/olahraga/sepakbola", teknologi:"https://www.republika.co.id/rss/seleb/teknoyeh", gaya_hidup:"https://www.republika.co.id/rss/gaya-hidup/wisata" } },
  cnbc:      { name:"CNBC Indonesia", website:"https://www.cnbcindonesia.com",  categories:{ utama:"https://www.cnbcindonesia.com/rss", market:"https://www.cnbcindonesia.com/market/rss", news:"https://www.cnbcindonesia.com/news/rss", tech:"https://www.cnbcindonesia.com/tech/rss", entrepreneur:"https://www.cnbcindonesia.com/entrepreneur/rss", lifestyle:"https://www.cnbcindonesia.com/lifestyle/rss", investment:"https://www.cnbcindonesia.com/investment/rss" } },
  merdeka:   { name:"Merdeka",        website:"https://www.merdeka.com",        categories:{ utama:"https://www.merdeka.com/feed/", politik:"https://www.merdeka.com/politik/feed/", teknologi:"https://www.merdeka.com/teknologi/feed/", olahraga:"https://www.merdeka.com/olahraga/feed/", gaya_hidup:"https://www.merdeka.com/gaya/feed/", otomotif:"https://www.merdeka.com/otomotif/feed/", dunia:"https://www.merdeka.com/dunia/feed/", uang:"https://www.merdeka.com/uang/feed/" } },
  okezone:   { name:"Okezone",        website:"https://www.okezone.com",        categories:{ utama:"https://sindikasi.okezone.com/index.php/rss/0/XML", news:"https://sindikasi.okezone.com/index.php/rss/1/XML", economy:"https://sindikasi.okezone.com/index.php/rss/2/XML", celebrity:"https://sindikasi.okezone.com/index.php/rss/3/XML", sports:"https://sindikasi.okezone.com/index.php/rss/4/XML", techno:"https://sindikasi.okezone.com/index.php/rss/5/XML", auto:"https://sindikasi.okezone.com/index.php/rss/6/XML", lifestyle:"https://sindikasi.okezone.com/index.php/rss/7/XML" } },
  viva:      { name:"Viva",           website:"https://www.viva.co.id",         categories:{ utama:"https://www.viva.co.id/get/all", nasional:"https://www.viva.co.id/get/nasional", dunia:"https://www.viva.co.id/get/dunia", bisnis:"https://www.viva.co.id/get/bisnis", bola:"https://www.viva.co.id/get/bola", teknologi:"https://www.viva.co.id/get/teknologi", otomotif:"https://www.viva.co.id/get/otomotif" } },
};

const VALID_SOURCES = Object.keys(SOURCES);

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(200, CORS_HEADERS); return res.end(); }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ status:false, code:405, message:"Method Not Allowed." });

  const action   = (req.query.action   || req.body?.action   || "latest").toLowerCase();
  const source   = (req.query.source   || req.body?.source   || "").toLowerCase();
  const category = (req.query.category || req.body?.category || "utama").toLowerCase();
  const limit    = Math.min(parseInt(req.query.limit || req.body?.limit || "10"), 30);

  if (action === "sources") {
    return res.status(200).json({
      creator:"@SanzXD", status:true, code:200,
      message:"Daftar sumber berita yang tersedia.",
      total: VALID_SOURCES.length,
      result: VALID_SOURCES.map(s => ({ source:s, name:SOURCES[s].name, website:SOURCES[s].website, categories:Object.keys(SOURCES[s].categories) })),
    });
  }

  try {
    let result;

    if (action === "latest") {
      if (!source) return res.status(400).json({ status:false, code:400, message:"Parameter 'source' wajib diisi.", available_sources:VALID_SOURCES, example:"/api/news?source=detik" });
      if (!VALID_SOURCES.includes(source)) return res.status(400).json({ status:false, code:400, message:"Source '"+source+"' tidak didukung.", available:VALID_SOURCES });
      const cfg = SOURCES[source];
      if (!cfg.categories[category]) return res.status(400).json({ status:false, code:400, message:"Kategori '"+category+"' tidak tersedia.", available_categories:Object.keys(cfg.categories) });

      // Pakai try/catch per-source supaya error satu sumber tidak hancurkan semua
      let articles = [];
      let fetchError = null;
      try {
        articles = await fetchRSS(cfg.categories[category], limit);
      } catch (e) {
        fetchError = e.message;
      }

      result = {
        source, name:cfg.name, website:cfg.website, category,
        total: articles.length,
        articles,
        ...(fetchError && articles.length === 0 ? { warning: "Gagal mengambil berita: " + fetchError } : {}),
      };

    } else if (action === "search") {
      const query = req.query.query || req.body?.query;
      if (!query) return res.status(400).json({ status:false, code:400, message:"Parameter 'query' wajib diisi.", example:"/api/news?action=search&query=ekonomi" });
      const targets = (source && VALID_SOURCES.includes(source)) ? [source] : ["detik","cnn","kompas","tempo","antara"];
      const fetched = await Promise.allSettled(targets.map(s => fetchRSS(SOURCES[s].categories["utama"], 20)));
      const ql = query.toLowerCase();
      const filtered = [];
      fetched.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        r.value.forEach(art => {
          if ((art.title + " " + art.description).toLowerCase().includes(ql))
            filtered.push({ ...art, _source:targets[i], _source_name:SOURCES[targets[i]].name });
        });
      });
      filtered.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      result = { query, sources_searched:targets, total:filtered.slice(0,limit).length, articles:filtered.slice(0,limit) };

    } else if (action === "multi") {
      const rawSources = req.query.sources || req.body?.sources || "detik,cnn,kompas";
      const multiList  = rawSources.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      const invalid    = multiList.filter(s => !VALID_SOURCES.includes(s));
      if (invalid.length) return res.status(400).json({ status:false, code:400, message:"Source tidak valid: "+invalid.join(", "), available:VALID_SOURCES });
      const perSource = Math.max(Math.ceil(limit / multiList.length), 3);
      const fetched   = await Promise.allSettled(multiList.map(s => fetchRSS(SOURCES[s].categories["utama"], perSource)));
      const merged    = [];
      fetched.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        r.value.forEach(art => merged.push({ ...art, _source:multiList[i], _source_name:SOURCES[multiList[i]].name }));
      });
      merged.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      result = { sources:multiList, total:merged.slice(0,limit).length, articles:merged.slice(0,limit) };

    } else {
      return res.status(400).json({ status:false, code:400, message:"Action '"+action+"' tidak didukung.", available:["latest","search","multi","sources"] });
    }

    return res.status(200).json({ creator:"@SanzXD", status:true, code:200, action, result });

  } catch (err) {
    console.error("[News:"+action+":"+source+"]", err.message);
    return res.status(500).json({ status:false, code:500, message:err.message || "Terjadi kesalahan." });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Coba beberapa User-Agent berbeda, karena beberapa portal blokir bot tertentu
const FETCH_HEADERS = [
  {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, application/json, */*",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
  },
  {
    "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Accept": "*/*",
  },
  {
    "User-Agent": "feedparser/6.0",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
  },
];

async function fetchRSS(url, limit) {
  let lastErr;
  for (const headers of FETCH_HEADERS) {
    try {
      const resp = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      if (!resp.ok) {
        lastErr = new Error("HTTP " + resp.status + " dari " + url);
        continue; // coba User-Agent berikutnya
      }
      const text = await resp.text();
      const articles = parseRSS(text);
      if (articles.length > 0) return articles.slice(0, limit);
      lastErr = new Error("Tidak ada artikel terparsing dari " + url);
    } catch (e) {
      lastErr = e;
      // kalau timeout atau network error, coba UA berikutnya
    }
  }
  throw lastErr || new Error("Gagal fetch RSS: " + url);
}

function parseRSS(xml) {
  const trimmed = xml.trim();

  // ── JSON format (e.g. Kompas) ──
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      // Kompas: { posts: [...] }, generic: { items/articles/data/results: [...] }, atau plain array
      const entries =
        data.posts || data.items || data.articles ||
        data.data  || data.result || data.results ||
        (Array.isArray(data) ? data : null);
      if (entries && Array.isArray(entries) && entries.length > 0) {
        return entries.map(e => ({
          title:        stripHtml(e.title || e.name || ""),
          link:         e.link || e.url || e.guid || e.permalink || "",
          description:  stripHtml(e.description || e.excerpt || e.summary || e.content || "").slice(0, 300),
          published_at: parseDate(e.pubDate || e.date || e.published || e.created_at || e.updated_at || ""),
          image:        e.thumbnail || e.image || e.featured_image || e.img || e.photo || null,
          author:       (typeof e.author === "string" ? e.author : e.author?.name) || e.byline || null,
        })).filter(e => e.title || e.link);
      }
    } catch (_) {}
  }

  // ── XML / RSS / Atom format ──
  const items = [];
  const re    = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const title = extractTag(b, "title");
    const link  = extractLink(b);
    const desc  = extractTag(b, "description") || extractTag(b, "summary") || extractTag(b, "content");
    const date  = extractTag(b, "pubDate") || extractTag(b, "published") || extractTag(b, "updated") || extractTag(b, "dc:date");
    const img   = extractImage(b);
    const auth  = extractTag(b, "author") || extractTag(b, "dc:creator");
    if (title || link) {
      items.push({
        title:        stripHtml(title || ""),
        link:         link || "",
        description:  stripHtml(desc || "").slice(0, 300),
        published_at: parseDate(date || ""),
        image:        img || null,
        author:       stripHtml(auth || "") || null,
      });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  const re1 = new RegExp("<" + tag + "[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/" + tag + ">", "i");
  const m1  = xml.match(re1);
  if (m1) return m1[1].trim();
  const re2 = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "i");
  const m2  = xml.match(re2);
  if (m2) return m2[1].trim();
  return "";
}

function extractLink(block) {
  const m1 = block.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (m1) return m1[1].trim();
  const m2 = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (m2) return m2[1].trim();
  const m3 = block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (m3 && m3[1].trim().startsWith("http")) return m3[1].trim();
  return "";
}

function extractImage(block) {
  const m1 = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) || block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (m1) return m1[1];
  const m2 = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i);
  if (m2) return m2[1];
  const m3 = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m3) return m3[1];
  return null;
}

function stripHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "").replace(/&[a-z]+;/g, "")
    .replace(/\s+/g, " ").trim();
}

function parseDate(raw) {
  if (!raw) return null;
  try { const d = new Date(raw); return isNaN(d.getTime()) ? null : d.toISOString(); }
  catch (_) { return null; }
}
