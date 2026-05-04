/**
 * News API — Berita terkini dari portal berita Indonesia via RSS Feed
 *
 * Sumber yang didukung:
 *   detik, cnn, kompas, tempo, tribun, liputan6, antara, republika,
 *   cnbc, jpnn, merdeka, sindonews, suara, okezone, viva
 *
 * GET /api/news?source=detik
 * GET /api/news?source=cnn&category=teknologi
 * GET /api/news?source=kompas&limit=5
 * GET /api/news?action=search&query=ekonomi
 * GET /api/news?action=multi&sources=detik,cnn,kompas&limit=5
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type"                : "application/json",
};

// ─── RSS Feed Sources ─────────────────────────────────────────────────────────

const SOURCES = {
  detik: {
    name    : "Detik",
    website : "https://www.detik.com",
    categories: {
      utama      : "https://rss.detik.com/index.php/detikcom",
      news       : "https://rss.detik.com/index.php/detikNews",
      finance    : "https://rss.detik.com/index.php/detikFinance",
      hot        : "https://rss.detik.com/index.php/detikhot",
      sport      : "https://rss.detik.com/index.php/detikSport",
      teknologi  : "https://rss.detik.com/index.php/detikInet",
      otomotif   : "https://rss.detik.com/index.php/detikOto",
      travel     : "https://rss.detik.com/index.php/detikTravel",
      food       : "https://rss.detik.com/index.php/detikFood",
      health     : "https://rss.detik.com/index.php/detikHealth",
    },
  },
  cnn: {
    name    : "CNN Indonesia",
    website : "https://www.cnnindonesia.com",
    categories: {
      utama      : "https://www.cnnindonesia.com/rss",
      nasional   : "https://www.cnnindonesia.com/nasional/rss",
      internasional : "https://www.cnnindonesia.com/internasional/rss",
      ekonomi    : "https://www.cnnindonesia.com/ekonomi/rss",
      olahraga   : "https://www.cnnindonesia.com/olahraga/rss",
      teknologi  : "https://www.cnnindonesia.com/teknologi/rss",
      hiburan    : "https://www.cnnindonesia.com/hiburan/rss",
      gaya_hidup : "https://www.cnnindonesia.com/gaya-hidup/rss",
    },
  },
  kompas: {
    name    : "Kompas",
    website : "https://www.kompas.com",
    categories: {
      utama      : "https://rss.kompas.com/rss/json/kompascom2008/latest/default",
      nasional   : "https://rss.kompas.com/rss/json/kompascom2008/news/nasional",
      regional   : "https://rss.kompas.com/rss/json/kompascom2008/news/regional",
      ekonomi    : "https://rss.kompas.com/rss/json/kompascom2008/news/ekonomi",
      olahraga   : "https://rss.kompas.com/rss/json/kompascom2008/news/olahraga",
      teknologi  : "https://rss.kompas.com/rss/json/kompascom2008/news/tekno",
      hiburan    : "https://rss.kompas.com/rss/json/kompascom2008/news/entertainment",
      otomotif   : "https://rss.kompas.com/rss/json/kompascom2008/news/otomotif",
      kesehatan  : "https://rss.kompas.com/rss/json/kompascom2008/news/health",
    },
  },
  tempo: {
    name    : "Tempo",
    website : "https://www.tempo.co",
    categories: {
      utama      : "https://rss.tempo.co",
      nasional   : "https://rss.tempo.co/nasional",
      bisnis     : "https://rss.tempo.co/bisnis",
      olahraga   : "https://rss.tempo.co/olahraga",
      dunia      : "https://rss.tempo.co/dunia",
      teknologi  : "https://rss.tempo.co/tekno",
      gaya_hidup : "https://rss.tempo.co/gaya-hidup",
      otomotif   : "https://rss.tempo.co/otomotif",
    },
  },
  tribun: {
    name    : "Tribunnews",
    website : "https://www.tribunnews.com",
    categories: {
      utama      : "https://www.tribunnews.com/rss",
      nasional   : "https://www.tribunnews.com/nasional/feed",
      regional   : "https://www.tribunnews.com/regional/feed",
      internasional : "https://www.tribunnews.com/internasional/feed",
      olahraga   : "https://www.tribunnews.com/sport/feed",
      bisnis     : "https://www.tribunnews.com/bisnis/feed",
      seleb      : "https://www.tribunnews.com/seleb/feed",
      techno     : "https://www.tribunnews.com/techno/feed",
    },
  },
  liputan6: {
    name    : "Liputan6",
    website : "https://www.liputan6.com",
    categories: {
      utama      : "https://www.liputan6.com/rss",
      news       : "https://www.liputan6.com/rss/news",
      bisnis     : "https://www.liputan6.com/rss/bisnis",
      bola       : "https://www.liputan6.com/rss/bola",
      tekno      : "https://www.liputan6.com/rss/tekno",
      showbiz    : "https://www.liputan6.com/rss/showbiz",
      otomotif   : "https://www.liputan6.com/rss/otomotif",
      health     : "https://www.liputan6.com/rss/health",
      global     : "https://www.liputan6.com/rss/global",
    },
  },
  antara: {
    name    : "Antara News",
    website : "https://www.antaranews.com",
    categories: {
      utama      : "https://www.antaranews.com/rss/terkini.xml",
      nasional   : "https://www.antaranews.com/rss/nasional.xml",
      internasional : "https://www.antaranews.com/rss/internasional.xml",
      ekonomi    : "https://www.antaranews.com/rss/ekonomi.xml",
      olahraga   : "https://www.antaranews.com/rss/olahraga.xml",
      teknologi  : "https://www.antaranews.com/rss/tekno.xml",
      hiburan    : "https://www.antaranews.com/rss/hiburan.xml",
      humaniora  : "https://www.antaranews.com/rss/humaniora.xml",
    },
  },
  republika: {
    name    : "Republika",
    website : "https://www.republika.co.id",
    categories: {
      utama      : "https://www.republika.co.id/rss",
      nasional   : "https://www.republika.co.id/rss/nasional/umum",
      internasional : "https://www.republika.co.id/rss/internasional/global",
      ekonomi    : "https://www.republika.co.id/rss/ekonomi/keuangan",
      olahraga   : "https://www.republika.co.id/rss/olahraga/sepakbola",
      teknologi  : "https://www.republika.co.id/rss/seleb/teknoyeh",
      gaya_hidup : "https://www.republika.co.id/rss/gaya-hidup/wisata",
    },
  },
  cnbc: {
    name    : "CNBC Indonesia",
    website : "https://www.cnbcindonesia.com",
    categories: {
      utama      : "https://www.cnbcindonesia.com/rss",
      market     : "https://www.cnbcindonesia.com/market/rss",
      news       : "https://www.cnbcindonesia.com/news/rss",
      tech       : "https://www.cnbcindonesia.com/tech/rss",
      entrepreneur: "https://www.cnbcindonesia.com/entrepreneur/rss",
      lifestyle  : "https://www.cnbcindonesia.com/lifestyle/rss",
      investment : "https://www.cnbcindonesia.com/investment/rss",
    },
  },
  merdeka: {
    name    : "Merdeka",
    website : "https://www.merdeka.com",
    categories: {
      utama      : "https://www.merdeka.com/feed/",
      politik    : "https://www.merdeka.com/politik/feed/",
      teknologi  : "https://www.merdeka.com/teknologi/feed/",
      olahraga   : "https://www.merdeka.com/olahraga/feed/",
      gaya_hidup : "https://www.merdeka.com/gaya/feed/",
      otomotif   : "https://www.merdeka.com/otomotif/feed/",
      dunia      : "https://www.merdeka.com/dunia/feed/",
      uang       : "https://www.merdeka.com/uang/feed/",
    },
  },
  okezone: {
    name    : "Okezone",
    website : "https://www.okezone.com",
    categories: {
      utama      : "https://sindikasi.okezone.com/index.php/rss/0/XML",
      news       : "https://sindikasi.okezone.com/index.php/rss/1/XML",
      economy    : "https://sindikasi.okezone.com/index.php/rss/2/XML",
      celebrity  : "https://sindikasi.okezone.com/index.php/rss/3/XML",
      sports     : "https://sindikasi.okezone.com/index.php/rss/4/XML",
      techno     : "https://sindikasi.okezone.com/index.php/rss/5/XML",
      auto       : "https://sindikasi.okezone.com/index.php/rss/6/XML",
      lifestyle  : "https://sindikasi.okezone.com/index.php/rss/7/XML",
    },
  },
  viva: {
    name    : "Viva",
    website : "https://www.viva.co.id",
    categories: {
      utama      : "https://www.viva.co.id/rss/rss2.xml",
      nasional   : "https://www.viva.co.id/rss/nasional.xml",
      dunia      : "https://www.viva.co.id/rss/dunia.xml",
      bisnis     : "https://www.viva.co.id/rss/bisnis.xml",
      bola       : "https://www.viva.co.id/rss/bola.xml",
      teknologi  : "https://www.viva.co.id/rss/teknologi.xml",
      otomotif   : "https://www.viva.co.id/rss/otomotif.xml",
    },
  },
};

const VALID_SOURCES  = Object.keys(SOURCES);
const VALID_ACTIONS  = ["latest", "search", "multi", "sources"];

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const action   = (req.query.action || req.body?.action || "latest").toLowerCase();
  const source   = (req.query.source || req.body?.source || "").toLowerCase();
  const category = (req.query.category || req.body?.category || "utama").toLowerCase();
  const limit    = Math.min(parseInt(req.query.limit || req.body?.limit || "10"), 30);

  // action=sources → tampilkan daftar sumber & kategori
  if (action === "sources") {
    const list = VALID_SOURCES.map((s) => ({
      source    : s,
      name      : SOURCES[s].name,
      website   : SOURCES[s].website,
      categories: Object.keys(SOURCES[s].categories),
    }));
    return res.status(200).json({
      creator: "@SanzXD",
      status : true,
      code   : 200,
      message: "Daftar sumber berita yang tersedia.",
      total  : list.length,
      result : list,
    });
  }

  try {
    let result;

    switch (action) {
      case "latest": {
        if (!source) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'source' wajib diisi untuk action latest.",
            available_sources: VALID_SOURCES,
            examples: {
              latest  : "/api/news?source=detik",
              category: "/api/news?source=cnn&category=teknologi",
              search  : "/api/news?action=search&query=ekonomi",
              multi   : "/api/news?action=multi&sources=detik,cnn&limit=5",
              sources : "/api/news?action=sources",
            },
          });
        }

        if (!VALID_SOURCES.includes(source)) {
          return res.status(400).json({
            status: false, code: 400,
            message: `Source '${source}' tidak didukung.`,
            available: VALID_SOURCES,
          });
        }

        const srcConfig = SOURCES[source];
        const catKeys   = Object.keys(srcConfig.categories);

        if (!srcConfig.categories[category]) {
          return res.status(400).json({
            status: false, code: 400,
            message: `Kategori '${category}' tidak tersedia untuk source '${source}'.`,
            available_categories: catKeys,
          });
        }

        const rssUrl = srcConfig.categories[category];
        const articles = await fetchRSS(rssUrl, limit);

        result = {
          source  : source,
          name    : srcConfig.name,
          website : srcConfig.website,
          category,
          total   : articles.length,
          articles,
        };
        break;
      }

      case "search": {
        const query = req.query.query || req.body?.query;
        if (!query) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'query' wajib diisi untuk action search.",
            example: "/api/news?action=search&query=ekonomi",
          });
        }

        // Cari di beberapa sumber sekaligus
        const searchSources = source ? [source] : ["detik", "cnn", "kompas", "tempo", "antara"];
        if (source && !VALID_SOURCES.includes(source)) {
          return res.status(400).json({
            status: false, code: 400,
            message: `Source '${source}' tidak didukung.`,
            available: VALID_SOURCES,
          });
        }

        const allArticles = await Promise.allSettled(
          searchSources.map((s) => fetchRSS(SOURCES[s].categories["utama"], 20))
        );

        const queryLower = query.toLowerCase();
        const filtered   = [];

        allArticles.forEach((r, i) => {
          if (r.status !== "fulfilled") return;
          const srcName = searchSources[i];
          r.value.forEach((art) => {
            const haystack = `${art.title} ${art.description}`.toLowerCase();
            if (haystack.includes(queryLower)) {
              filtered.push({ ...art, _source: srcName, _source_name: SOURCES[srcName].name });
            }
          });
        });

        // Sort by date terbaru
        filtered.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

        result = {
          query,
          sources_searched: searchSources,
          total  : filtered.slice(0, limit).length,
          articles: filtered.slice(0, limit),
        };
        break;
      }

      case "multi": {
        const rawSources = (req.query.sources || req.body?.sources || "detik,cnn,kompas");
        const multiList  = rawSources.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

        const invalid = multiList.filter((s) => !VALID_SOURCES.includes(s));
        if (invalid.length) {
          return res.status(400).json({
            status: false, code: 400,
            message: `Source tidak valid: ${invalid.join(", ")}`,
            available: VALID_SOURCES,
          });
        }

        const perSource = Math.max(Math.ceil(limit / multiList.length), 3);
        const fetched   = await Promise.allSettled(
          multiList.map((s) => fetchRSS(SOURCES[s].categories["utama"], perSource))
        );

        const merged = [];
        fetched.forEach((r, i) => {
          if (r.status !== "fulfilled") return;
          const srcName = multiList[i];
          r.value.forEach((art) => {
            merged.push({ ...art, _source: srcName, _source_name: SOURCES[srcName].name });
          });
        });

        merged.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

        result = {
          sources : multiList,
          total   : merged.slice(0, limit).length,
          articles: merged.slice(0, limit),
        };
        break;
      }

      default:
        return res.status(400).json({
          status : false, code: 400,
          message: `Action '${action}' tidak didukung.`,
          available: VALID_ACTIONS,
        });
    }

    return res.status(200).json({
      creator: "@SanzXD",
      status : true,
      code   : 200,
      action,
      result,
    });

  } catch (err) {
    console.error(`[News:${action}:${source}]`, err.message);
    return res.status(500).json({
      status : false,
      code   : 500,
      message: err.message || "Terjadi kesalahan saat mengambil berita.",
    });
  }
}

// ─── RSS Fetcher & Parser ─────────────────────────────────────────────────────

async function fetchRSS(url, limit = 10) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0; +https://dramaku.vercel.app)",
      "Accept"    : "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) throw new Error(`Gagal mengambil RSS dari ${url} (${resp.status})`);

  const xml  = await resp.text();
  const items = parseRSS(xml);

  return items.slice(0, limit);
}

function parseRSS(xml) {
  const items = [];

  // Coba JSON feed dulu (Kompas pakai ini)
  if (xml.trim().startsWith("{") || xml.trim().startsWith("[")) {
    try {
      const data = JSON.parse(xml);
      const entries = data?.posts || data?.items || data?.articles || (Array.isArray(data) ? data : []);
      return entries.map((e) => ({
        title       : stripHtml(e.title || e.name || ""),
        link        : e.link || e.url || e.guid || "",
        description : stripHtml(e.description || e.excerpt || e.summary || ""),
        published_at: parseDate(e.pubDate || e.date || e.published || e.created_at || ""),
        image       : e.thumbnail || e.image || e.featured_image || null,
        author      : e.author || e.byline || null,
      }));
    } catch { /* bukan JSON, lanjut parse XML */ }
  }

  // Extract semua <item> atau <entry> (Atom)
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title       = extractTag(block, "title");
    const link        = extractLink(block);
    const description = extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content");
    const pubDate     = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated") || extractTag(block, "dc:date");
    const image       = extractImage(block);
    const author      = extractTag(block, "author") || extractTag(block, "dc:creator");

    if (title || link) {
      items.push({
        title       : stripHtml(title || ""),
        link        : link || "",
        description : stripHtml(description || "").slice(0, 300),
        published_at: parseDate(pubDate || ""),
        image       : image || null,
        author      : stripHtml(author || "") || null,
      });
    }
  }

  return items;
}

// ─── XML Helper Functions ─────────────────────────────────────────────────────

function extractTag(xml, tag) {
  // CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Normal tag
  const normalRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const normalMatch = xml.match(normalRegex);
  if (normalMatch) return normalMatch[1].trim();

  return "";
}

function extractLink(block) {
  // <link>url</link>
  const tagMatch = block.match(/<link[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/link>/i)
    || block.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (tagMatch) return tagMatch[1].trim();

  // <link href="url" /> — format Atom
  const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (hrefMatch) return hrefMatch[1].trim();

  // <guid>url</guid>
  const guidMatch = block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (guidMatch) {
    const g = guidMatch[1].trim();
    if (g.startsWith("http")) return g;
  }

  return "";
}

function extractImage(block) {
  // <media:thumbnail url="...">
  const mediaMatch = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
    || block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch) return mediaMatch[1];

  // <enclosure url="..." type="image/...">
  const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i);
  if (enclosureMatch) return enclosureMatch[1];

  // <image><url>...</url></image>
  const imgUrlMatch = block.match(/<image[^>]*>[\s\S]*?<url>([^<]+)<\/url>/i);
  if (imgUrlMatch) return imgUrlMatch[1].trim();

  // <img src="..." /> dalam description
  const imgSrcMatch = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgSrcMatch) return imgSrcMatch[1];

  return null;
}

function stripHtml(html) {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(raw) {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}
