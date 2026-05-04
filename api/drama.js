/**
 * Drama API — ForYou, Trending, Search, Detail, Episode via Dracinku API
 *
 * Platform yang didukung:
 *   goodshort, netshort, freereels, dramamax, radreels, chill,
 *   dramarush, animev2, movie, tv, drakor, bjav, microdrama,
 *   rapidtv, cubetv, dramadash, shortmax
 *
 * GET /api/drama?action=foryou&source=goodshort&page=1
 * GET /api/drama?action=trending&source=dramamax&page=1
 * GET /api/drama?action=search&source=goodshort&query=cinta&page=1
 * GET /api/drama?action=detail&source=goodshort&id=31001345248
 * GET /api/drama?action=episode&source=goodshort&id=31001345248&ep=1
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type"                : "application/json",
};

const API     = "https://api.dracinku.site";
const KEY     = "dracinku";
const BASE_UA = "Mozilla/5.0";

const FETCH_HEADERS = {
  "X-API-Key"   : KEY,
  "User-Agent"  : BASE_UA,
  "Accept"      : "application/json",
  "Content-Type": "application/json",
  "Origin"      : "https://dracinku.site",
  "Referer"     : "https://dracinku.site/",
};

const PLATFORMS = {
  goodshort : { search: true,  tabfeed: false },
  netshort  : { search: true,  tabfeed: false },
  freereels : { search: true,  tabfeed: false },
  dramamax  : { search: true,  tabfeed: true  },
  radreels  : { search: true,  tabfeed: false },
  chill     : { search: false, tabfeed: true  },
  dramarush : { search: true,  tabfeed: false },
  animev2   : { search: true,  tabfeed: false },
  movie     : { search: true,  tabfeed: false },
  tv        : { search: true,  tabfeed: false },
  drakor    : { search: true,  tabfeed: false },
  bjav      : { search: false, tabfeed: true  },
  microdrama: { search: false, tabfeed: true  },
  rapidtv   : { search: true,  tabfeed: true  },
  cubetv    : { search: true,  tabfeed: false },
  dramadash : { search: true,  tabfeed: false },
  shortmax  : { search: true,  tabfeed: false },
};

const VALID_SOURCES = Object.keys(PLATFORMS);
const VALID_ACTIONS = ["foryou", "trending", "search", "detail", "episode"];

// ─── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const action = (req.query.action || req.body?.action || "").toLowerCase();
  const source = (req.query.source || req.body?.source || "").toLowerCase();
  const page   = parseInt(req.query.page || req.body?.page || "1");

  if (!action) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'action' wajib diisi.",
      available_actions: VALID_ACTIONS,
      available_sources: VALID_SOURCES,
      examples: {
        foryou  : "/api/drama?action=foryou&source=goodshort&page=1",
        trending: "/api/drama?action=trending&source=dramamax&page=1",
        search  : "/api/drama?action=search&source=goodshort&query=cinta&page=1",
        detail  : "/api/drama?action=detail&source=goodshort&id=31001345248",
        episode : "/api/drama?action=episode&source=goodshort&id=31001345248&ep=1",
      },
    });
  }

  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({
      status: false, code: 400,
      message: `Action '${action}' tidak didukung.`,
      available: VALID_ACTIONS,
    });
  }

  if (!source || !VALID_SOURCES.includes(source)) {
    return res.status(400).json({
      status: false, code: 400,
      message: source ? `Source '${source}' tidak didukung.` : "Parameter 'source' wajib diisi.",
      available: VALID_SOURCES,
    });
  }

  const cfg = PLATFORMS[source];

  try {
    let result;

    switch (action) {
      case "foryou": {
        result = await doForyou(source, cfg, page);
        break;
      }

      case "trending": {
        result = await doTrending(source, cfg, page);
        break;
      }

      case "search": {
        if (!cfg.search) {
          return res.status(400).json({
            status: false, code: 400,
            message: `Source '${source}' tidak mendukung search.`,
            sources_with_search: VALID_SOURCES.filter(s => PLATFORMS[s].search),
          });
        }
        const query = req.query.query || req.body?.query;
        if (!query) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'query' wajib diisi untuk action search.",
            example: `/api/drama?action=search&source=${source}&query=cinta`,
          });
        }
        result = await doSearch(source, query, page);
        break;
      }

      case "detail": {
        const id = req.query.id || req.body?.id;
        if (!id) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'id' wajib diisi untuk action detail.",
            example: `/api/drama?action=detail&source=${source}&id=31001345248`,
          });
        }
        result = await doDetail(source, id);
        break;
      }

      case "episode": {
        const id = req.query.id || req.body?.id;
        const ep = parseInt(req.query.ep || req.body?.ep || "1");
        if (!id) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'id' wajib diisi untuk action episode.",
            example: `/api/drama?action=episode&source=${source}&id=31001345248&ep=1`,
          });
        }
        result = await doEpisode(source, id, ep);
        break;
      }
    }

    return res.status(200).json({
      creator: "@SanzXD",
      status : true,
      code   : 200,
      action,
      source,
      result,
    });

  } catch (err) {
    console.error(`[Drama:${action}:${source}]`, err.message);
    return res.status(500).json({
      status : false,
      code   : 500,
      message: err.message || "Terjadi kesalahan.",
    });
  }
}

// ─── Action: ForYou ────────────────────────────────────────────────────────────

async function doForyou(src, cfg, page = 1) {
  let books = [], hasMore = false;

  if (cfg.tabfeed) {
    const tabsR = await apiGet(`/${src}/tablist`, { lang: "id" });
    const tabs  = tabsR?.data;
    if (Array.isArray(tabs) && tabs.length > 0) {
      const t = tabs[0];
      const r = await apiPost(`/${src}/tabfeed`,
        { lang: "id", tab_key: t.tab_key, type: t.type || "", page },
        { lang: "id" }
      );
      if (r) {
        const d = r.data;
        if (d && typeof d === "object") {
          books   = Array.isArray(d.book) ? d.book : [];
          hasMore = d.isMore ?? d.has_more ?? false;
        }
      }
    }
  }

  // Fallback ke search kalau tabfeed kosong
  if (books.length === 0 && cfg.search) {
    const r = await apiPost(`/${src}/search`,
      { lang: "id", keyword: "a", page },
      { lang: "id" }
    );
    if (r) {
      const d = r.data;
      if (d && typeof d === "object") {
        books   = Array.isArray(d.book) ? d.book : [];
        hasMore = d.isMore ?? false;
      }
    }
  }

  const items = books.map(fmtBook);
  return { code: 200, hasMore, items, msg: "SUCCESS", rows: items, total: items.length };
}

// ─── Action: Trending ──────────────────────────────────────────────────────────

async function doTrending(src, cfg, page = 1) {
  let books = [], hasMore = false;

  if (cfg.tabfeed) {
    const tabsR = await apiGet(`/${src}/tablist`, { lang: "id" });
    const tabs  = tabsR?.data;
    if (Array.isArray(tabs) && tabs.length > 0) {
      // Cari tab trending/popular, fallback ke tab pertama
      const target =
        tabs.find(t => /trend|tren|popular|populer|hot|top/i.test(t.name || "")) || tabs[0];
      const r = await apiPost(`/${src}/tabfeed`,
        { lang: "id", tab_key: target.tab_key, type: target.type || "", page },
        { lang: "id" }
      );
      if (r) {
        const d = r.data;
        if (d && typeof d === "object") {
          books   = Array.isArray(d.book) ? d.book : [];
          hasMore = d.isMore ?? d.has_more ?? false;
        }
      }
    }
  }

  // Fallback
  if (books.length === 0 && cfg.search) {
    const r = await apiPost(`/${src}/search`,
      { lang: "id", keyword: "a", page },
      { lang: "id" }
    );
    if (r) {
      const d = r.data;
      if (d && typeof d === "object") {
        books   = Array.isArray(d.book) ? d.book : [];
        hasMore = d.isMore ?? false;
      }
    }
  }

  const items = books.map(fmtBook);
  return { code: 200, hasMore, items, msg: "SUCCESS", rows: items, total: items.length };
}

// ─── Action: Search ────────────────────────────────────────────────────────────

async function doSearch(src, keyword, page = 1) {
  const r = await apiPost(`/${src}/search`,
    { lang: "id", keyword, page },
    { lang: "id" }
  );
  if (!r) throw new Error("Search gagal atau tidak ada hasil.");

  const d       = r.data ?? {};
  const books   = Array.isArray(d.book) ? d.book : [];
  const hasMore = d.isMore ?? false;
  const items   = books.map(fmtBook);

  return { code: 200, hasMore, items, msg: "SUCCESS", rows: items, total: items.length };
}

// ─── Action: Detail ────────────────────────────────────────────────────────────

async function doDetail(src, dramaId) {
  let r = await apiGet(`/${src}/series/${dramaId}`, { lang: "id" });
  if (!r) r = await apiGet(`/cache/series/${dramaId}`);
  if (!r) throw new Error(`Drama ID '${dramaId}' tidak ditemukan di source '${src}'.`);

  const d    = r.data ?? {};
  const book = (d.book && typeof d.book === "object") ? d.book : {};
  const chs  = Array.isArray(d.chapters) ? d.chapters : [];

  const cover    = book.cover || book.posterImg || "";
  const title    = cleanHtml(book.name || book.title || "Unknown");
  const synopsis = book.introduction || book.synopsis || book.description || "";
  const tags     = Array.isArray(book.tags)
    ? book.tags
    : (Array.isArray(book.categoryNames) ? book.categoryNames : []);
  const eps = chs.map((ch, i) => fmtEp(ch, i + 1));

  return {
    code: 200, msg: "SUCCESS",
    data: {
      categoryNames : tags,
      cover, posterImg: cover,
      description   : synopsis,
      synopsis,
      dramaId       : String(book.id || dramaId),
      id            : String(book.id || dramaId),
      title,
      episodes      : eps,
      totalEpisodes : book.chapterCount || eps.length,
      viewCount     : book.playCount || 0,
    },
  };
}

// ─── Action: Episode ───────────────────────────────────────────────────────────

async function doEpisode(src, dramaId, number) {
  const det = await doDetail(src, dramaId);
  const eps = det.data.episodes;

  let found = eps.find(ep => ep.number === number);
  if (!found && number >= 1 && number <= eps.length) {
    found = eps[number - 1];
  }
  if (!found) throw new Error(`Episode ${number} tidak ditemukan.`);

  const video = found.videoUrl || "";
  let ql = found.qualityList || [];

  if (ql.length === 0 && video) {
    const kind = video.includes(".m3u8") ? "hls" : video.includes(".mp4") ? "mp4" : "other";
    ql = [{ label: "Auto", url: video, type: kind }];
  }

  return {
    code         : 200,
    msg          : "SUCCESS",
    episodeNumber: found.number,
    number       : found.number,
    locked       : found.locked || false,
    qualityList  : ql,
    subtitles    : found.subtitles || [],
    videoUrl     : video,
    downLoadLink : found.downLoadLink || {},
  };
}

// ─── HTTP Helpers ──────────────────────────────────────────────────────────────

async function apiGet(path, params = {}) {
  try {
    const url = new URL(`${API}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const r = await fetch(url.toString(), {
      headers: FETCH_HEADERS,
      signal : AbortSignal.timeout(20_000),
    });
    const d = await r.json();
    return d?.success ? d : null;
  } catch {
    return null;
  }
}

async function apiPost(path, body = {}, params = {}) {
  try {
    const url = new URL(`${API}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const r = await fetch(url.toString(), {
      method : "POST",
      headers: FETCH_HEADERS,
      body   : JSON.stringify(body),
      signal : AbortSignal.timeout(20_000),
    });
    const d = await r.json();
    return d?.success ? d : null;
  } catch {
    return null;
  }
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function cleanHtml(str) {
  return String(str || "").replace(/<[^>]+>/g, "").trim();
}

function fmtBook(b) {
  if (!b || typeof b !== "object") return {};
  const sid   = String(b.id || b.dramaId || "");
  const cover = b.cover || b.posterImg || "";
  return {
    categoryNames  : b.categoryNames || b.tags || [],
    cover,
    defaultLanguage: b.defaultLanguage || "id",
    dramaId        : sid,
    episodes       : b.episodes || b.chapterCount || 0,
    favoriteCount  : b.favoriteCount || 0,
    id             : sid,
    isCompleted    : String(b.isCompleted || ""),
    likeCount      : b.likeCount || 0,
    posterImg      : cover,
    publishedAt    : b.publishedAt || "",
    title          : cleanHtml(b.title || b.name || "Unknown"),
    totalEpisodes  : b.totalEpisodes || b.chapterCount || 0,
    viewCount      : b.viewCount || b.playCount || 0,
  };
}

function fmtEp(ch, idx = 1) {
  if (!ch || typeof ch !== "object") return {};

  // Parse nomor episode
  let n = idx;
  const eps = ch.eps || "";
  const fromEps = parseInt(String(eps).replace(/EP[-\s]?/i, "").trim());
  if (!isNaN(fromEps)) {
    n = fromEps;
  } else {
    const fromIdx = parseInt(ch.index);
    if (!isNaN(fromIdx)) n = fromIdx + 1;
  }

  const video  = ch.videoPath || ch.videoUrl || "";
  const locked = Boolean(ch.isLock ?? ch.locked ?? false);
  const subs   = Array.isArray(ch.subtitle)
    ? ch.subtitle
    : (Array.isArray(ch.subtitles) ? ch.subtitles : []);

  return {
    episodeNumber: n,
    episodeTitle : `Episode ${n}`,
    locked,
    number       : n,
    title        : `Episode ${n}`,
    videoUrl     : locked ? "" : video,
    qualityList  : ch.qualityList || [],
    subtitles    : subs,
    downLoadLink : ch.downLoadLink || {},
  };
}
