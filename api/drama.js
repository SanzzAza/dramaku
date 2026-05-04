/**
 * Drama API — ForYou, Trending, Search, Detail, Episode
 * 
 * Platform dari Vyreels (Primary - search/trending lebih lengkap):
 *   shortmax, melolo, flickreels, stardusttv, idrama, netshort,
 *   freereels, rapidtv, flickshort, dramawave, reelshort
 *
 * Platform dari Dracinku (Fallback):
 *   goodshort, dramamax, radreels, chill, dramarush, animev2, movie, tv,
 *   drakor, bjav, microdrama, cubetv, dramadash
 *
 * GET /api/drama?action=foryou&source=shortmax&page=1
 * GET /api/drama?action=trending&source=shortmax&page=1
 * GET /api/drama?action=search&source=shortmax&query=cinta&page=1
 * GET /api/drama?action=detail&source=shortmax&slug=xxxxx
 * GET /api/drama?action=episode&source=shortmax&slug=xxxxx&ep=1
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type"                : "application/json",
};

// ─── VYREELS API (Primary - untuk platform: shortmax, melolo, flickreels, dll) ───
const VYREELS_BASE = "https://vyreels.xydevs.com";
const VYREELS_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json, text/plain, */*",
  "Referer": VYREELS_BASE,
  "Origin": VYREELS_BASE,
};

// ─── DRACINKU API (Fallback untuk platform lainnya) ───
const DRACINKU_API = "https://api.dracinku.site";
const DRACINKU_KEY = "dracinku";
const DRACINKU_HEADERS = {
  "X-API-Key"   : DRACINKU_KEY,
  "User-Agent"  : "Mozilla/5.0",
  "Accept"      : "application/json",
  "Content-Type": "application/json",
  "Origin"      : "https://dracinku.site",
  "Referer"     : "https://dracinku.site/",
};

// Platform yang support Vyreels (Primary)
const VYREELS_PLATFORMS = {
  shortmax   : { search: true, trending: true },
  melolo     : { search: true, trending: true },
  flickreels : { search: true, trending: true },
  stardusttv : { search: true, trending: true },
  idrama     : { search: true, trending: true },
  netshort   : { search: true, trending: true },
  freereels  : { search: true, trending: true },
  rapidtv    : { search: true, trending: true },
  flickshort : { search: true, trending: true },
  dramawave  : { search: true, trending: true },
  reelshort  : { search: true, trending: true },
};

// Platform dari Dracinku (Fallback)
const DRACINKU_PLATFORMS = {
  goodshort : { search: true,  tabfeed: false },
  dramamax  : { search: true,  tabfeed: true  },
  radreels  : { search: true,  tabfeed: false },
  chill     : { search: true,  tabfeed: true  },
  dramarush : { search: true,  tabfeed: false },
  animev2   : { search: true,  tabfeed: false },
  movie     : { search: true,  tabfeed: false },
  tv        : { search: true,  tabfeed: false },
  drakor    : { search: true,  tabfeed: false },
  bjav      : { search: true,  tabfeed: true  },
  microdrama: { search: true,  tabfeed: true  },
  cubetv    : { search: true,  tabfeed: false },
  dramadash : { search: true,  tabfeed: false },
};

// Gabungan
const PLATFORMS = { ...VYREELS_PLATFORMS, ...DRACINKU_PLATFORMS };
const VALID_SOURCES = Object.keys(PLATFORMS);
const VALID_ACTIONS = ["foryou", "trending", "search", "detail", "episode"];

// ─── Main Handler ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (![\"GET\", \"POST\"].includes(req.method)) {
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
        foryou  : "/api/drama?action=foryou&source=shortmax&page=1",
        trending: "/api/drama?action=trending&source=shortmax&page=1",
        search  : "/api/drama?action=search&source=shortmax&query=cinta&page=1",
        detail  : "/api/drama?action=detail&source=shortmax&slug=xxxxx",
        episode : "/api/drama?action=episode&source=shortmax&slug=xxxxx&ep=1",
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

  const isVyreels = source in VYREELS_PLATFORMS;
  const cfg = PLATFORMS[source];

  try {
    let result;

    switch (action) {
      case "foryou": {
        result = isVyreels
          ? await vyForYou(source, page)
          : await dracinku_ForYou(source, cfg, page);
        break;
      }

      case "trending": {
        result = isVyreels
          ? await vyTrending(source, page)
          : await dracinku_Trending(source, cfg, page);
        break;
      }

      case "search": {
        const query = req.query.query || req.body?.query;
        if (!query) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'query' wajib diisi untuk action search.",
            example: `/api/drama?action=search&source=${source}&query=cinta`,
          });
        }
        result = isVyreels
          ? await vySearch(source, query, page)
          : await dracinku_Search(source, query, page);
        break;
      }

      case "detail": {
        const slug = req.query.slug || req.body?.slug;
        const id = req.query.id || req.body?.id; // fallback untuk dracinku
        const dramaid = slug || id;
        if (!dramaid) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'slug' (atau 'id' untuk dracinku) wajib diisi untuk action detail.",
            example: `/api/drama?action=detail&source=${source}&slug=xxxxx`,
          });
        }
        result = isVyreels
          ? await vyDetail(source, slug)
          : await dracinku_Detail(source, id);
        break;
      }

      case "episode": {
        const slug = req.query.slug || req.body?.slug;
        const id = req.query.id || req.body?.id;
        const ep = parseInt(req.query.ep || req.body?.ep || "1");
        const dramaid = slug || id;
        if (!dramaid) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'slug' (atau 'id' untuk dracinku) wajib diisi untuk action episode.",
            example: `/api/drama?action=episode&source=${source}&slug=xxxxx&ep=1`,
          });
        }
        result = isVyreels
          ? await vyEpisode(source, slug, ep)
          : await dracinku_Episode(source, id, ep);
        break;
      }
    }

    return res.status(200).json({
      creator: "@ChatGPT + @SanzXD",
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

// ═══════════════════════════════════════════════════════════════════════════
// VYREELS API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function vyApiGet(path, params = {}) {
  try {
    const url = new URL(`${VYREELS_BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
    });
    const r = await fetch(url.toString(), {
      headers: VYREELS_HEADERS,
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    return d.success ? d : null;
  } catch (err) {
    console.error(`[vyApiGet] ${path}:`, err.message);
    return null;
  }
}

function vyCleanHtml(t) {
  return t ? String(t).replace(/<[^>]+>/g, "").trim() : "";
}

function vyFmtBook(b) {
  if (!b || typeof b !== "object") return {};
  const slug = String(b.slug || b.id || "");
  const cover = b.cover || b.coverImage || "";
  return {
    id: slug,
    slug: slug,
    dramaId: slug,
    externalId: String(b.externalId || ""),
    platform: b.platform || "",
    title: vyCleanHtml(b.title || "Unknown"),
    synopsis: vyCleanHtml(b.synopsis || ""),
    cover: cover,
    posterImg: cover,
    views: b.views || 0,
    rating: b.rating || "",
    year: b.year || "",
    totalEpisodes: b.totalEpisodes || 0,
    freeEpisodes: b.freeEpisodes || 0,
    isVip: Boolean(b.isVip),
  };
}

async function vyForYou(src, page = 1) {
  const r = await vyApiGet("/api/dramas/trending", { platform: src, page });
  if (!r) throw new Error(`ForYou ${src} gagal`);

  const data = r.data || {};
  const dramas = Array.isArray(data.dramas) ? data.dramas : [];
  const items = dramas.map(vyFmtBook);

  return {
    code: 200,
    msg: "SUCCESS",
    page,
    platform: src,
    items,
    rows: items,
    total: items.length,
  };
}

async function vyTrending(src, page = 1) {
  const r = await vyApiGet("/api/dramas/trending", { platform: src, page });
  if (!r) throw new Error(`Trending ${src} gagal`);

  const data = r.data || {};
  const dramas = Array.isArray(data.dramas) ? data.dramas : [];
  const items = dramas.map(vyFmtBook);

  return {
    code: 200,
    msg: "SUCCESS",
    page,
    platform: src,
    items,
    rows: items,
    total: items.length,
  };
}

async function vySearch(src, keyword, page = 1) {
  if (!keyword) throw new Error("Keyword kosong");

  const r = await vyApiGet("/api/dramas/search", { q: keyword, platform: src, page });
  if (!r) throw new Error(`Search '${keyword}' di ${src} gagal`);

  const data = r.data || {};
  const dramas = Array.isArray(data.dramas) ? data.dramas : [];
  const total = data.total || 0;
  const items = dramas.map(vyFmtBook);

  return {
    code: 200,
    msg: "SUCCESS",
    keyword,
    platform: src,
    items,
    rows: items,
    total,
  };
}

async function vyDetail(src, slug) {
  if (!slug) throw new Error("Slug kosong");

  const r = await vyApiGet(`/api/dramas/${slug}`);
  if (!r) throw new Error(`Detail ${slug} tidak ditemukan`);

  const data = r.data || {};
  
  // Ambil episodes
  const epsR = await vyApiGet(`/api/dramas/${slug}/episodes`);
  const eps = [];
  
  if (epsR) {
    const epsData = epsR.data || {};
    const epsList = Array.isArray(epsData.episodes) ? epsData.episodes : [];
    
    // Fetch video untuk semua episodes PARALEL (max 10)
    const promises = epsList.map((ep, i) => {
      const epNum = ep.episodeNumber || i + 1;
      const locked = ep.locked || false;
      return vyFetchVideo(slug, epNum, locked);
    });
    
    const results = await Promise.all(promises);
    eps.push(...results);
  }

  const book = vyFmtBook(data);
  book.episodes = eps;
  book.totalEpisodes = eps.length || book.totalEpisodes || 0;

  return {
    code: 200,
    msg: "SUCCESS",
    data: book,
  };
}

async function vyFetchVideo(slug, epNum, locked) {
  try {
    const vr = await vyApiGet(`/api/dramas/${slug}/video`, { episode: epNum });
    
    let videoUrl = "";
    let videoId = "";
    let duration = 0;
    let qualities = {};
    let ql = [];

    if (vr) {
      const vdata = vr.data || {};
      videoUrl = vdata.videoUrl || "";
      videoId = vdata.videoId || "";
      qualities = vdata.qualities || {};
      const epInfo = vdata.episode || {};
      duration = epInfo.duration || 0;

      for (const [label, url] of Object.entries(qualities)) {
        if (url) {
          const kind = String(url).includes(".m3u8") ? "hls" : String(url).includes(".mp4") ? "mp4" : "other";
          ql.push({ label, url, type: kind });
        }
      }
      if (!ql && videoUrl) {
        const kind = videoUrl.includes(".m3u8") ? "hls" : videoUrl.includes(".mp4") ? "mp4" : "other";
        ql = [{ label: "Auto", url: videoUrl, type: kind }];
      }
    }

    return {
      number: epNum,
      episodeNumber: epNum,
      title: `Episode ${epNum}`,
      episodeTitle: `Episode ${epNum}`,
      locked: Boolean(locked),
      videoUrl: locked ? "" : videoUrl,
      videoId,
      duration,
      qualityList: ql,
      qualities,
    };
  } catch (err) {
    console.error(`[vyFetchVideo] ${slug}:${epNum}`, err.message);
    return {
      number: epNum,
      episodeNumber: epNum,
      title: `Episode ${epNum}`,
      episodeTitle: `Episode ${epNum}`,
      locked: Boolean(locked),
      videoUrl: "",
      videoId: "",
      duration: 0,
      qualityList: [],
      qualities: {},
    };
  }
}

async function vyEpisode(src, slug, number) {
  if (!slug) throw new Error("Slug kosong");
  if (!number) throw new Error("Episode number kosong");

  const r = await vyApiGet(`/api/dramas/${slug}/video`, { episode: number });
  if (!r) throw new Error(`Video episode ${number} tidak ditemukan`);

  const data = r.data || {};
  const videoUrl = data.videoUrl || "";
  const qualities = data.qualities || {};
  const episodeInfo = data.episode || {};

  let ql = [];
  for (const [label, url] of Object.entries(qualities)) {
    if (url) {
      const kind = String(url).includes(".m3u8") ? "hls" : String(url).includes(".mp4") ? "mp4" : "other";
      ql.push({ label, url, type: kind });
    }
  }
  if (!ql && videoUrl) {
    const kind = videoUrl.includes(".m3u8") ? "hls" : videoUrl.includes(".mp4") ? "mp4" : "other";
    ql = [{ label: "Auto", url: videoUrl, type: kind }];
  }

  return {
    code: 200,
    msg: "SUCCESS",
    episodeNumber: number,
    number,
    locked: false,
    qualityList: ql,
    videoUrl,
    videoId: data.videoId || "",
    duration: episodeInfo.duration || 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DRACINKU API FUNCTIONS (Fallback)
// ═══════════════════════════════════════════════════════════════════════════

async function dracinku_ApiGet(path, params = {}) {
  try {
    const url = new URL(`${DRACINKU_API}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
    });
    const r = await fetch(url.toString(), {
      headers: DRACINKU_HEADERS,
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    return d?.success ? d : null;
  } catch (err) {
    console.error(`[dracinku_ApiGet] ${path}:`, err.message);
    return null;
  }
}

async function dracinku_ApiPost(path, body = {}, params = {}) {
  try {
    const url = new URL(`${DRACINKU_API}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
    });
    const r = await fetch(url.toString(), {
      method: "POST",
      headers: DRACINKU_HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    return d?.success ? d : null;
  } catch (err) {
    console.error(`[dracinku_ApiPost] ${path}:`, err.message);
    return null;
  }
}

function dracinku_CleanHtml(str) {
  return String(str || "").replace(/<[^>]+>/g, "").trim();
}

function dracinku_FmtBook(b) {
  if (!b || typeof b !== "object") return {};
  const sid = String(b.id || b.dramaId || "");
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
    title          : dracinku_CleanHtml(b.title || b.name || "Unknown"),
    totalEpisodes  : b.totalEpisodes || b.chapterCount || 0,
    viewCount      : b.viewCount || b.playCount || 0,
  };
}

async function dracinku_ForYou(src, cfg, page = 1) {
  let books = [], hasMore = false;

  if (cfg.tabfeed) {
    const tabsR = await dracinku_ApiGet(`/${src}/tablist`, { lang: "id" });
    const tabs = tabsR?.data;
    if (Array.isArray(tabs) && tabs.length > 0) {
      const t = tabs[0];
      const r = await dracinku_ApiPost(
        `/${src}/tabfeed`,
        { lang: "id", tab_key: t.tab_key, type: t.type || "", page },
        { lang: "id" }
      );
      if (r) {
        const d = r.data;
        if (d && typeof d === "object") {
          books = Array.isArray(d.book) ? d.book : [];
          hasMore = d.isMore ?? d.has_more ?? false;
        }
      }
    }
  }

  if (books.length === 0 && cfg.search) {
    const r = await dracinku_ApiPost(
      `/${src}/search`,
      { lang: "id", keyword: "a", page },
      { lang: "id" }
    );
    if (r) {
      const d = r.data;
      if (d && typeof d === "object") {
        books = Array.isArray(d.book) ? d.book : [];
        hasMore = d.isMore ?? false;
      }
    }
  }

  const items = books.map(dracinku_FmtBook);
  return { code: 200, hasMore, items, msg: "SUCCESS", rows: items, total: items.length };
}

async function dracinku_Trending(src, cfg, page = 1) {
  let books = [], hasMore = false;

  if (cfg.tabfeed) {
    const tabsR = await dracinku_ApiGet(`/${src}/tablist`, { lang: "id" });
    const tabs = tabsR?.data;
    if (Array.isArray(tabs) && tabs.length > 0) {
      const target = tabs.find(t => /trend|tren|popular|populer|hot|top/i.test(t.name || "")) || tabs[0];
      const r = await dracinku_ApiPost(
        `/${src}/tabfeed`,
        { lang: "id", tab_key: target.tab_key, type: target.type || "", page },
        { lang: "id" }
      );
      if (r) {
        const d = r.data;
        if (d && typeof d === "object") {
          books = Array.isArray(d.book) ? d.book : [];
          hasMore = d.isMore ?? d.has_more ?? false;
        }
      }
    }
  }

  if (books.length === 0 && cfg.search) {
    const r = await dracinku_ApiPost(
      `/${src}/search`,
      { lang: "id", keyword: "a", page },
      { lang: "id" }
    );
    if (r) {
      const d = r.data;
      if (d && typeof d === "object") {
        books = Array.isArray(d.book) ? d.book : [];
        hasMore = d.isMore ?? false;
      }
    }
  }

  const items = books.map(dracinku_FmtBook);
  return { code: 200, hasMore, items, msg: "SUCCESS", rows: items, total: items.length };
}

async function dracinku_Search(src, keyword, page = 1) {
  const r = await dracinku_ApiPost(
    `/${src}/search`,
    { lang: "id", keyword, page },
    { lang: "id" }
  );
  if (!r) throw new Error(`Search '${keyword}' di ${src} gagal`);

  const d = r.data ?? {};
  const books = Array.isArray(d.book) ? d.book : [];
  const hasMore = d.isMore ?? false;
  const items = books.map(dracinku_FmtBook);

  return { code: 200, hasMore, items, msg: "SUCCESS", rows: items, total: items.length };
}

async function dracinku_Detail(src, dramaId) {
  let r = await dracinku_ApiGet(`/${src}/series/${dramaId}`, { lang: "id" });
  if (!r) r = await dracinku_ApiGet(`/cache/series/${dramaId}`);
  if (!r) throw new Error(`Drama ID '${dramaId}' tidak ditemukan`);

  const d = r.data ?? {};
  const book = (d.book && typeof d.book === "object") ? d.book : {};
  const chs = Array.isArray(d.chapters) ? d.chapters : [];

  const cover = book.cover || book.posterImg || "";
  const title = dracinku_CleanHtml(book.name || book.title || "Unknown");
  const synopsis = book.introduction || book.synopsis || book.description || "";
  const tags = Array.isArray(book.tags)
    ? book.tags
    : (Array.isArray(book.categoryNames) ? book.categoryNames : []);
  const eps = chs.map((ch, i) => dracinku_FmtEp(ch, i + 1));

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

async function dracinku_Episode(src, dramaId, number) {
  const det = await dracinku_Detail(src, dramaId);
  const eps = det.data.episodes;

  let found = eps.find(ep => ep.number === number);
  if (!found && number >= 1 && number <= eps.length) {
    found = eps[number - 1];
  }
  if (!found) throw new Error(`Episode ${number} tidak ditemukan`);

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

function dracinku_FmtEp(ch, idx = 1) {
  if (!ch || typeof ch !== "object") return {};

  let n = idx;
  const eps = ch.eps || "";
  const fromEps = parseInt(String(eps).replace(/EP[-\\s]?/i, "").trim());
  if (!isNaN(fromEps)) {
    n = fromEps;
  } else {
    const fromIdx = parseInt(ch.index);
    if (!isNaN(fromIdx)) n = fromIdx + 1;
  }

  const video = ch.videoPath || ch.videoUrl || "";
  const locked = Boolean(ch.isLock ?? ch.locked ?? false);
  const subs = Array.isArray(ch.subtitle)
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
