// dramacina_multi.js - GoodShort + DramaBox + Melolo + DramaBite + DramaNova
// Dependencies: npm install axios

import axios from 'axios';

// ============================================================
// KONFIGURASI
// ============================================================

const GS_BASE  = "https://captain.sapimu.au/goodshort";
const DB_BASE  = "https://captain.sapimu.au/dramaboxv4";
const ML_BASE  = "https://melolo.dramabos.my.id";
const DBT_BASE = "https://captain.sapimu.au/dramabite";
const DNV_BASE = "https://captain.sapimu.au/dramanova";

const TOKEN_MAIN = "5a6df8230521283fad1e9d4590b619171793e8173953af434e478929c761b2ed";
const TOKEN_ML   = "04AA0FC87491A42A11A33C32610CD172";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept"    : "application/json, text/plain, */*",
    "Origin"    : "https://dramacina.vip",
    "Referer"   : "https://dramacina.vip/",
};

const AUTH_H = {
    "token": TOKEN_MAIN,
    "Authorization": `Bearer ${TOKEN_MAIN}`,
    "Content-Type": "application/json"
};

const ML_H = {
    "token": TOKEN_ML,
    "Authorization": `Bearer ${TOKEN_ML}`,
    "Content-Type": "application/json",
    "Origin": "https://melolo.dramabos.my.id",
    "Referer": "https://melolo.dramabos.my.id/",
    "Accept": "application/json, text/plain, */*",
};

const GS_CHANNELS = {
    "id": 562,
    "pt": 564,
    "kr": 565,
    "th": 568,
};

// ============================================================
// HELPERS
// ============================================================

function clean(t) {
    if (!t) return "";
    return String(t).replace(/<[^>]+>/g, "").trim();
}

function ok(action, source, result) {
    return { creator: "SanzzXD", status: true, code: 200, action, source, result };
}

function err(action, source, message) {
    return { creator: "SanzzXD", status: false, code: 400, action, source, message };
}

async function dx(url, params = {}, hdrs = {}) {
    try {
        const res = await axios.get(url, {
            params,
            headers: { ...HEADERS, ...hdrs },
            timeout: 20000,
            validateStatus: () => true,
            responseType: 'text'
        });
        if (res.status !== 200) return null;
        const raw = res.data;
        if (typeof raw === 'object') return raw;
        try { return JSON.parse(raw); } catch { return null; }
    } catch { return null; }
}

// ============================================================
// GOODSHORT
// ============================================================

async function gsHome(page = 1, channel = "id") {
    const channelId = GS_CHANNELS[channel] || 562;
    const r = await dx(`${GS_BASE}/api/v1/home`, { channelId, page, pageSize: 12, language: "id" }, AUTH_H);
    if (!r) return err("home", "goodshort", "gagal");

    const data = r.data || {};
    const records = data.records || [];
    const sections = [];
    const flatItems = [];
    const seen = new Set();

    for (const rec of records) {
        const sec = {
            channelId: rec.channelId || 0, columnId: rec.columnId || 0,
            name: rec.name || "", style: rec.style || "", more: rec.more || false, items: []
        };
        for (const x of (rec.items || [])) {
            const bid = String(x.bookId || x.action || "");
            const title = x.bookName || x.name || "";
            if (!bid) continue;
            const item = {
                id: bid, title, cover: x.cover || x.image || "",
                image: x.image || x.cover || "", introduction: clean(x.introduction || ""),
                labels: x.labels || [], labelInfos: x.labelInfos || [],
                viewCount: x.viewCount || 0, viewCountDisplay: x.viewCountDisplay || "",
                chapterCount: x.chapterCount || 0, firstChapterId: x.firstChapterId || 0,
                bookType: x.bookType || 0, grade: x.grade || "", ratings: x.ratings || 0,
                typeTwoNames: x.typeTwoNames || [], member: x.member || 0,
                columnStyle: x.columnStyle || "", fullHDEnable: x.fullHDEnable || false,
                downloadEnable: x.downloadEnable || false, platform: "goodshort"
            };
            if (x.scheduledReleaseDay) item.scheduledReleaseDay = x.scheduledReleaseDay;
            if (x.scheduledReleaseDayOfTime) item.scheduledReleaseDayOfTime = x.scheduledReleaseDayOfTime;
            sec.items.push(item);
            if (!seen.has(bid) && title) { seen.add(bid); flatItems.push(item); }
        }
        sections.push(sec);
    }

    return ok("home", "goodshort", {
        page: data.current || page, pageSize: data.size || 12,
        totalSections: data.total || records.length, channelId, channel,
        sections, items: flatItems, totalItems: flatItems.length
    });
}

async function gsSearch(kw, page = 1) {
    const r = await dx(`${GS_BASE}/api/v1/search`, { q: kw, language: "id", page, pageSize: 20 }, AUTH_H);
    if (!r) return err("search", "goodshort", "gagal");
    const sr = (r.data && r.data.searchResult) || {};
    const items = sr.records || [];
    const dramas = items.map(x => ({
        id: String(x.bookId || ""), title: x.bookName || x.name || "", cover: x.cover || "",
        introduction: clean(x.introduction || ""), labels: x.labels || [],
        viewCount: x.viewCount || 0, viewCountDisplay: x.viewCountDisplay || "",
        chapterCount: x.chapterCount || 0, firstChapterId: x.firstChapterId || 0,
        grade: x.grade || "", typeTwoNames: x.typeTwoNames || [], platform: "goodshort"
    }));
    return ok("search", "goodshort", { keyword: kw, items: dramas, total: dramas.length });
}

async function gsDetail(bid) {
    const r = await dx(`${GS_BASE}/api/v1/book/${bid}`, { language: "id" }, AUTH_H);
    if (!r) return err("detail", "goodshort", "gagal");
    const data = r.data || {};
    const book = data.book || {};
    const lst = data.list || [];
    const episodes = lst.map((ch, i) => {
        const chapterId = String(ch.id || "");
        const ql = [];
        for (const mv of (ch.multiVideos || [])) {
            const cdn = mv.cdnList || [];
            const qUrl = cdn.length ? cdn[0].videoPath : (mv.filePath || "");
            if (qUrl) ql.push({ label: mv.type || "", url: qUrl, type: "hls" });
        }
        const cdnUrls = (ch.cdnList || []).map(c => c.videoPath).filter(Boolean);
        return {
            episode: i + 1, chapterId, title: ch.chapterName || `Episode ${i + 1}`,
            locked: !!ch.charged, price: ch.price || 0, free: (ch.price || 0) === 0,
            playTime: ch.playTime || 0, playCount: ch.playCount || 0,
            playCountDisplay: ch.playCountDisplay || "", image: ch.image || "",
            buyWay: ch.buyWay || "", payWay: ch.payWay || "",
            cdnUrl: ch.cdn || "", cdnUrls, qualities: ql
        };
    });
    return ok("detail", "goodshort", { data: {
        id: String(book.bookId || bid), title: book.bookName || "", cover: book.cover || "",
        detailCover: book.bookDetailCover || "", synopsis: clean(book.introduction || ""),
        totalEpisodes: book.chapterCount || episodes.length,
        viewCount: book.viewCount || 0, viewCountDisplay: book.viewCountDisplay || "",
        ratings: book.ratings || 0, commentCount: book.commentCount || 0,
        followCount: book.followCount || 0, totalWords: book.totalWords || 0,
        tags: book.labels || [], labelInfos: book.labelInfos || [],
        status: book.writeStatus || "", language: book.languageDisplay || "",
        unit: book.unit || "", grade: book.grade || "",
        freeEpisodes: book.free || 0, memberEpisodes: book.member || 0,
        producer: book.producer || "", playwright: book.playwright || "",
        protagonist: book.protagonist || "", pseudonym: book.pseudonym || "",
        fullHDEnable: book.fullHDEnable || false, downloadEnable: book.downloadEnable || false,
        episodes, platform: "goodshort"
    }});
}

async function gsKey(bid, chapterId) {
    const r = await dx(`${GS_BASE}/api/v1/key`, { bookId: bid, chapterId }, AUTH_H);
    return r ? (r.key || "") : "";
}

async function gsStream(bid, ep = 1, quality = "720p") {
    const rd = await dx(`${GS_BASE}/api/v1/book/${bid}`, { language: "id" }, AUTH_H);
    if (!rd) return err("stream", "goodshort", "gagal ambil detail");
    const data = rd.data || {};
    const book = data.book || {};
    const lst = data.list || [];
    if (!lst.length) return err("stream", "goodshort", "tidak ada episode");
    const idx = Math.min(ep - 1, lst.length - 1);
    const ch = lst[idx];
    const chapterId = String(ch.id || "");
    if (!chapterId) return err("stream", "goodshort", "chapterId tidak ditemukan");
    const rp = await dx(`${GS_BASE}/api/v1/play/${bid}/${chapterId}`, { q: quality, language: "id" }, AUTH_H);
    if (!rp) return err("stream", "goodshort", "gagal ambil video");
    const m3u8 = rp.m3u8 || "";
    const aes = await gsKey(bid, chapterId);
    const ql = [];
    for (const mv of (ch.multiVideos || [])) {
        const cdn = mv.cdnList || [];
        const qUrl = cdn.length ? cdn[0].videoPath : (mv.filePath || "");
        if (qUrl) ql.push({ label: mv.type || "", url: qUrl, type: "hls" });
    }
    if (!ql.length && m3u8) ql.push({ label: quality, url: m3u8, type: "hls" });
    return ok("stream", "goodshort", {
        bookId: bid, chapterId, episode: idx + 1, totalEps: lst.length,
        title: book.bookName || "", epTitle: ch.chapterName || `Episode ${idx + 1}`,
        videoUrl: m3u8, quality, aesKey: aes, kEncrypted: rp.k || "", sSeed: rp.s || "",
        isLocked: !!ch.charged, isFree: !ch.charged, qualityList: ql
    });
}

async function gsStreamFast(bid, ep = 1, quality = "720p") {
    const r = await dx(`${GS_BASE}/api/v1/unlock/${bid}`, { q: quality }, AUTH_H);
    if (!r) return err("stream_fast", "goodshort", "gagal unlock");
    const videos = r.videos || [];
    const total = r.total || videos.length;
    if (!videos.length) return err("stream_fast", "goodshort", "tidak ada episode");
    const idx = Math.min(ep - 1, videos.length - 1);
    const target = videos[idx];
    const chapterId = String(target.id || "");
    const url = target.url || "";
    const aes = chapterId ? await gsKey(bid, chapterId) : "";
    const allEps = videos.map((v, i) => ({
        episode: i + 1, chapterId: String(v.id || ""), name: v.name || "", url: v.url || "", type: "hls"
    }));
    return ok("stream_fast", "goodshort", {
        bookId: bid, chapterId, episode: idx + 1, totalEps: total, videoUrl: url,
        quality, aesKey: aes, qualityList: url ? [{ label: quality, url, type: "hls" }] : [],
        allEpisodes: allEps
    });
}

async function gsUnlockAll(bid, quality = "720p") {
    const r = await dx(`${GS_BASE}/api/v1/unlock/${bid}`, { q: quality }, AUTH_H);
    if (!r) return err("unlock", "goodshort", "gagal");
    const videos = r.videos || [];
    const episodes = videos.map((v, i) => ({
        episode: i + 1, chapterId: String(v.id || ""), name: v.name || "", url: v.url || "", type: "hls"
    }));
    return ok("unlock", "goodshort", { bookId: bid, quality, total: r.total || videos.length, episodes });
}

// ============================================================
// DRAMABOX
// ============================================================

async function dbHome(page = 1, size = 10, lang = "in") {
    const r = await dx(`${DB_BASE}/api/home`, { page, size, lang }, AUTH_H);
    if (!r) return err("home", "dramabox", "gagal");
    const root = (r.data && r.data.data) || {};
    const sectionsRaw = root.sections || [];
    const sections = [];
    const flatItems = [];
    const seen = new Set();
    for (const sec of sectionsRaw) {
        const books = sec.books || [];
        const parsedBooks = [];
        for (const b of books) {
            const item = {
                id: String(b.bookId || ""), title: b.bookName || "", cover: b.coverWap || "",
                episodes: b.chapterCount || 0, synopsis: clean(b.introduction || ""),
                tags: b.tags || [], tagV3s: b.tagV3s || [], isEntry: b.isEntry || 0,
                index: b.index || 0, corner: b.corner || {}, dataFrom: b.dataFrom || "",
                cardType: b.cardType || 0, markNamesConnectKey: b.markNamesConnectKey || "",
                playCount: b.playCount || "", bookShelfTime: b.bookShelfTime || 0,
                shelfTime: b.shelfTime || "", inLibrary: b.inLibrary || false, platform: "dramabox"
            };
            parsedBooks.push(item);
            if (item.id && !seen.has(item.id)) { seen.add(item.id); flatItems.push(item); }
        }
        sections.push({
            id: sec.id || 0, title: sec.title || "", subTitle: sec.subTitle || "",
            style: sec.style || "", type: sec.type || "", books: parsedBooks
        });
    }
    return ok("home", "dramabox", {
        code: r.code || 0, message: r.message || "", page, size, lang,
        sections, items: flatItems, totalSections: sections.length, totalItems: flatItems.length
    });
}

async function dbRank(lang = "in") {
    const r = await dx(`${DB_BASE}/api/rank`, { lang }, AUTH_H);
    if (!r) return err("rank", "dramabox", "gagal");
    const root = (r.data && r.data.data) || {};
    const rankTypes = root.rankTypeVoList || [];
    const rankList = root.rankList || [];
    const items = rankList.map(x => ({
        id: String(x.bookId || ""), title: x.bookName || "", cover: x.coverWap || "",
        episodes: x.chapterCount || 0, synopsis: clean(x.introduction || ""),
        tags: x.tags || [], tagV3s: x.tagV3s || [], isEntry: x.isEntry || 0,
        index: x.index || 0, protagonist: x.protagonist || "", dataFrom: x.dataFrom || "",
        cardType: x.cardType || 0, rankVo: x.rankVo || {},
        markNamesConnectKey: x.markNamesConnectKey || "", playCount: x.playCount || "",
        bookShelfTime: x.bookShelfTime || 0, shelfTime: x.shelfTime || "",
        corner: x.corner || {}, inLibrary: x.inLibrary || false, platform: "dramabox"
    }));
    return ok("rank", "dramabox", {
        code: r.code || 0, message: r.message || "", lang, rankTypes, items, total: items.length
    });
}

async function dbSearch(keyword, page = 1, lang = "in") {
    const r = await dx(`${DB_BASE}/api/search`, { keyword, page, lang }, AUTH_H);
    if (!r) return err("search", "dramabox", "gagal");
    const root = (r.data && r.data.data) || {};
    const searchList = root.searchList || [];
    const items = searchList.map(x => ({
        id: String(x.bookId || ""), title: x.bookName || "", cover: x.cover || "",
        synopsis: clean(x.introduction || ""), author: x.author || "",
        inLibraryCount: x.inLibraryCount || 0, bookSource: x.bookSource || {},
        playCount: x.playCount || "", sort: x.sort || 0, protagonist: x.protagonist || "",
        tagNames: x.tagNames || [], corner: x.corner || {},
        markNamesConnectKey: x.markNamesConnectKey || "",
        algorithmRecomDot: x.algorithmRecomDot || "",
        inLibrary: x.inLibrary || false, platform: "dramabox"
    }));
    return ok("search", "dramabox", {
        code: r.code || 0, message: r.message || "", keyword: root.keyword || keyword,
        page, lang, items, total: items.length
    });
}

async function dbDetail(did, lang = "en") {
    const r = await dx(`${DB_BASE}/api/drama/${did}`, { lang }, AUTH_H);
    if (!r) return err("detail", "dramabox", "gagal");
    const root = (r.data && r.data.data) || {};
    const lst = root.list || [];
    const episodes = lst.map((ch, i) => ({
        episode: i + 1, chapterId: String(ch.chapterId || ""), chapterIndex: ch.chapterIndex || i,
        isCharge: ch.isCharge || 0, isPay: ch.isPay || 0, chapterSizeVoList: ch.chapterSizeVoList || []
    }));
    return ok("detail", "dramabox", {
        code: r.code || 0, message: r.message || "",
        data: {
            id: String(root.bookId || did), title: root.bookName || "",
            cover: root.coverWap || root.cover || "",
            synopsis: clean(root.introduction || "") || clean(root.description || ""),
            bookStatus: root.bookStatus || 0, corner: root.corner || {},
            crossChapter: root.crossChapter || false, crossChapterTips: root.crossChapterTips || "",
            episodes, totalEpisodes: episodes.length, platform: "dramabox"
        }
    });
}

async function dbEpisodes(did, lang = "in") {
    const r = await dx(`${DB_BASE}/api/drama/${did}/episodes`, { lang }, AUTH_H);
    if (!r) return err("episodes", "dramabox", "gagal");
    const root = r.data || {};
    const eps = root.episodes || [];
    const episodes = eps.map(e => {
        const qlabel = typeof e.quality === "number" ? `${e.quality}p` : String(e.quality || "Auto");
        const ql = e.url ? [{ label: qlabel, url: e.url, type: "mp4" }] : [];
        return {
            episode: e.episode || 0, chapterId: String(e.chapterId || ""),
            chapterName: e.chapterName || "", cover: e.cover || "",
            quality: e.quality || 0, url: e.url || "", subtitles: e.subtitles || [], qualityList: ql
        };
    });
    return ok("episodes", "dramabox", {
        code: r.code || 0, message: r.message || "", bookId: root.bookId || did,
        bookName: root.bookName || "", cover: root.cover || "",
        description: clean(root.description || ""), totalEpisodes: root.totalEpisodes || episodes.length,
        quality: root.quality || 0, episodes, platform: "dramabox"
    });
}

// ============================================================
// MELOLO
// ============================================================

async function mlHome(lang = "id", offset = 0) {
    const r = await dx(`${ML_BASE}/api/home`, { lang, offset }, ML_H);
    if (!r || r.code !== 0) return err("home", "melolo", "gagal");
    const items = r.data || [];
    const dramas = items.map(x => ({
        id: String(x.id || ""), title: x.name || "", cover: x.cover || "",
        episodes: x.episodes || 0, synopsis: clean(x.intro || ""), platform: "melolo"
    }));
    return ok("home", "melolo", { lang, offset, items: dramas, total: dramas.length });
}

async function mlSearch(kw, lang = "id") {
    const r = await dx(`${ML_BASE}/api/search`, { q: kw, lang }, ML_H);
    if (!r || r.code !== 0) return err("search", "melolo", "gagal");
    const items = r.data || [];
    const dramas = items.map(x => ({
        id: String(x.id || ""), title: x.name || "", cover: x.cover || "",
        episodes: x.episodes || 0, synopsis: clean(x.intro || ""),
        author: x.author || "", platform: "melolo"
    }));
    return ok("search", "melolo", { keyword: kw, lang, count: r.count || dramas.length, items: dramas, total: dramas.length });
}

async function mlDetail(did, lang = "id") {
    const r = await dx(`${ML_BASE}/api/detail/${did}`, { lang }, ML_H);
    if (!r || r.code !== 0) return err("detail", "melolo", "gagal");
    const videos = r.videos || [];
    const epList = videos.map(v => ({ episode: v.episode || 0, vid: String(v.vid || ""), duration: v.duration || 0 }));
    return ok("detail", "melolo", { data: {
        id: String(r.id || did), title: r.title || "", cover: r.cover || "",
        episodes: r.episodes || epList.length, synopsis: clean(r.intro || ""),
        videos: epList, platform: "melolo"
    }});
}

async function mlVideo(did, ep = 1) {
    try {
        const candidateIds = [String(did)];
        const detail = await dx(`${ML_BASE}/api/detail/${did}`, { lang: "id" }, ML_H);
        if (detail && detail.code === 0) {
            for (const v of (detail.videos || [])) {
                if (parseInt(v.episode) === parseInt(ep)) {
                    const vid = String(v.vid || "");
                    if (vid && !candidateIds.includes(vid)) candidateIds.push(vid);
                    break;
                }
            }
        }
        let lastError = "gagal";
        for (const currentId of candidateIds) {
            try {
                const res = await axios.get(`${ML_BASE}/api/video`, {
                    params: { id: currentId, ep, code: TOKEN_ML },
                    headers: { ...HEADERS, ...ML_H }, timeout: 20000, validateStatus: () => true
                });
                if (res.status !== 200) { lastError = `HTTP ${res.status}`; continue; }
                const data = res.data;
                if (data.code !== 200) { lastError = data.msg || data.message || `code=${data.code}`; continue; }
                const ql = (data.qualityList || []).map(q => ({ label: q.label || "", url: q.url || "", type: "mp4" }));
                return ok("video", "melolo", {
                    dramaId: did, usedId: currentId, episode: data.episodeNumber || ep,
                    number: data.number || ep, videoUrl: data.videoUrl || "",
                    locked: data.locked || false, qualityList: ql, platform: "melolo"
                });
            } catch (e) { lastError = e.message; continue; }
        }
        return err("video", "melolo", `${lastError} | tried=${JSON.stringify(candidateIds)}`);
    } catch (e) { return err("video", "melolo", e.message); }
}

// ============================================================
// DRAMABITE
// ============================================================

async function dbtDramas(lang = "id", page = 0) {
    const r = await dx(`${DBT_BASE}/api/v1/dramas`, { lang, page }, AUTH_H);
    if (r === null) return err("dramas", "dramabite", "gagal request");
    const items = Array.isArray(r) ? r : [];
    const dramas = items.filter(x => typeof x === 'object').map(x => ({
        id: String(x.id || ""), title: x.title || "", cover: x.cover || "",
        episodes: x.episodes || 0, platform: "dramabite"
    }));
    return ok("dramas", "dramabite", { lang, page, items: dramas, total: dramas.length, hasMore: dramas.length > 0 });
}

async function dbtForyou(lang = "id", page = 0) {
    const r = await dx(`${DBT_BASE}/api/v1/foryou`, { lang, page }, AUTH_H);
    if (r === null) return err("foryou", "dramabite", "gagal request");
    const items = Array.isArray(r) ? r : [];
    const dramas = items.filter(x => typeof x === 'object').map(x => ({
        id: String(x.id || ""), title: x.title || "", cover: x.cover || "",
        episodes: x.episodes || 0, platform: "dramabite"
    }));
    return ok("foryou", "dramabite", { lang, page, items: dramas, total: dramas.length, hasMore: dramas.length > 0 });
}

async function dbtHot(lang = "id") {
    const r = await dx(`${DBT_BASE}/api/v1/hot`, { lang }, AUTH_H);
    if (r === null) return err("hot", "dramabite", "gagal request");
    const items = Array.isArray(r) ? r : [];
    const keywords = items.filter(k => typeof k === 'object').map(k => ({
        keyword: k.title || "", dramaId: String(k.cid || "")
    }));
    return ok("hot", "dramabite", { lang, keywords, total: keywords.length });
}

async function dbtRecommend(lang = "id", page = 0) {
    const r = await dx(`${DBT_BASE}/api/v1/recommend`, { lang, page }, AUTH_H);
    if (r === null) return err("recommend", "dramabite", "gagal request");
    const items = Array.isArray(r) ? r : [];
    const dramas = items.filter(x => typeof x === 'object').map(x => ({
        id: String(x.id || ""), title: x.title || "", cover: x.cover || "",
        episodes: x.episodes || 0, platform: "dramabite"
    }));
    return ok("recommend", "dramabite", { lang, page, items: dramas, total: dramas.length });
}

async function dbtSearch(kw, lang = "id", limit = 20) {
    const r = await dx(`${DBT_BASE}/api/v1/search`, { q: kw, lang, limit }, AUTH_H);
    if (r === null) return err("search", "dramabite", "gagal request");
    const items = Array.isArray(r) ? r : [];
    const dramas = items.filter(x => typeof x === 'object').map(x => ({
        id: String(x.id || ""), title: x.title || "", cover: x.cover || "",
        episodes: x.episodes || 0, platform: "dramabite"
    }));
    return ok("search", "dramabite", { keyword: kw, lang, limit, items: dramas, total: dramas.length });
}

async function dbtDetail(did, lang = "id") {
    const r = await dx(`${DBT_BASE}/api/v1/drama/${did}`, { lang }, AUTH_H);
    if (r === null) return err("detail", "dramabite", "gagal request");
    if (typeof r !== 'object' || Array.isArray(r)) return err("detail", "dramabite", "response bukan dict");
    const epsRaw = r.episodes || [];
    const episodes = epsRaw.filter(ep => typeof ep === 'object').map(ep => ({
        episode: ep.number || ep.id || 0, id: ep.id || 0, title: ep.title || "",
        free: ep.free || false, locked: !ep.free
    }));
    return ok("detail", "dramabite", { data: {
        id: String(r.id || did), cover: r.cover || "", totalEpisodes: episodes.length,
        episodes, platform: "dramabite"
    }});
}

async function dbtLikes(did, lang = "id") {
    const r = await dx(`${DBT_BASE}/api/v1/drama/${did}/likes`, { lang }, AUTH_H);
    if (r === null) return err("likes", "dramabite", "gagal request");
    if (typeof r !== 'object' || Array.isArray(r)) return err("likes", "dramabite", "response bukan dict");
    return ok("likes", "dramabite", {
        dramaId: String(r.cid || did), likeCount: r.like_num || 0,
        shareCount: r.share_num || 0, collectCount: r.collected_num || 0, platform: "dramabite"
    });
}

async function dbtEpisode(did, ep, lang = "id", quality = "default") {
    const r = await dx(`${DBT_BASE}/api/v1/drama/${did}/episode/${ep}`, { lang, quality }, AUTH_H);
    if (r === null) return err("episode", "dramabite", "gagal request");
    if (typeof r !== 'object' || Array.isArray(r)) return err("episode", "dramabite", "response bukan dict");
    const videoUrl = r.video || "";
    const vidType = videoUrl.includes(".m3u8") ? "hls" : videoUrl.includes(".mp4") ? "mp4" : "hls";
    const qualityList = videoUrl ? [{ label: quality !== "default" ? quality : "auto", url: videoUrl, type: vidType }] : [];
    return ok("episode", "dramabite", {
        dramaId: did, episode: r.number || ep, id: r.id || 0,
        title: r.title || `Episode ${ep}`, videoUrl, quality,
        validFor: r.validFor || 0, qualityList, platform: "dramabite"
    });
}

// ============================================================
// DRAMANOVA (6 endpoint)
// ============================================================
// 1. /api/v1/dramas    → {total, rows: [{id, title, cover, episodes, description, isCompleted, viewCount, categoryNames}]}
// 2. /api/v1/drama/:id → {id, title, cover, description, totalEpisodes, episodes: [{id, number, title, fileId, free, subtitles}]}
// 3. /api/video        → {vid, duration, poster, videos: [{definition, main_url, backup_url, codec, width, height, ...}]}
// 4. /api/v1/search    → {total, rows: [{id, title, cover, description, episodes, categoryNames, viewCount, ...}]}
// 5. /api/v1/modules   → list[{categoryKey, categoryName, dramaCount}]
// 6. /api/v1/recommend → {category, categoryKey, dramas: [{id, title, cover, episodes, viewCount}]}

async function dnvDramas(lang = "in", page = 1, size = 20) {
    const r = await dx(`${DNV_BASE}/api/v1/dramas`, { lang, page, size }, AUTH_H);
    if (r === null) return err("dramas", "dramanova", "gagal request");
    if (typeof r !== 'object' || Array.isArray(r)) return err("dramas", "dramanova", "response bukan dict");
    const rows = r.rows || [];
    const dramas = rows.filter(x => typeof x === 'object').map(x => ({
        id: String(x.id || ""), title: x.title || "", cover: x.cover || "",
        episodes: x.episodes || 0, synopsis: clean(x.description || ""),
        isCompleted: x.isCompleted || false, viewCount: x.viewCount || 0,
        categoryNames: x.categoryNames || [], platform: "dramanova"
    }));
    return ok("dramas", "dramanova", {
        lang, page, size, items: dramas, total: r.total || dramas.length, hasMore: dramas.length >= size
    });
}

async function dnvDetail(did, lang = "in") {
    const r = await dx(`${DNV_BASE}/api/v1/drama/${did}`, { lang }, AUTH_H);
    if (r === null) return err("detail", "dramanova", "gagal request");
    if (typeof r !== 'object' || Array.isArray(r)) return err("detail", "dramanova", "response bukan dict");
    const epsRaw = r.episodes || [];
    const episodes = [];
    epsRaw.forEach((ep, i) => {
        if (typeof ep !== 'object') return;
        const subs = (ep.subtitles || []).filter(s => typeof s === 'object' && s.url).map(s => ({
            lang: s.lang || "", label: s.label || "", url: s.url || ""
        }));
        episodes.push({
            episode: ep.number || i + 1, id: String(ep.id || ""),
            title: ep.title || `Episode ${i + 1}`, fileId: String(ep.fileId || ""),
            cover: ep.cover || "", free: ep.free || false, locked: !ep.free, subtitles: subs
        });
    });
    return ok("detail", "dramanova", { data: {
        id: String(r.id || did), title: r.title || "", cover: r.cover || "",
        banner: r.banner || "", synopsis: clean(r.description || ""),
        totalEpisodes: r.totalEpisodes || episodes.length, isCompleted: r.isCompleted || false,
        viewCount: r.viewCount || 0, likeCount: r.likeCount || 0,
        publishedAt: r.publishedAt || "", episodes, platform: "dramanova"
    }});
}

async function dnvVideo(did, ep = 1, lang = "in") {
    // Step 1: ambil detail untuk dapat fileId
    const detailR = await dx(`${DNV_BASE}/api/v1/drama/${did}`, { lang }, AUTH_H);
    if (detailR === null) return err("video", "dramanova", "gagal ambil detail");
    if (typeof detailR !== 'object' || Array.isArray(detailR)) return err("video", "dramanova", "detail bukan dict");
    const epsRaw = detailR.episodes || [];
    if (!epsRaw.length) return err("video", "dramanova", "tidak ada episode");
    const idx = Math.min(ep - 1, epsRaw.length - 1);
    const target = epsRaw[idx];
    if (typeof target !== 'object') return err("video", "dramanova", "episode data invalid");
    const fileId = String(target.fileId || "");
    if (!fileId) return err("video", "dramanova", `fileId tidak ditemukan di episode ${ep}`);

    // Step 2: hit /api/video pakai fileId
    const r = await dx(`${DNV_BASE}/api/video`, { id: fileId }, AUTH_H);
    if (r === null) return err("video", "dramanova", "gagal request video");
    if (typeof r !== 'object' || Array.isArray(r)) return err("video", "dramanova", "video response bukan dict");
    const vids = r.videos || [];
    const qualityList = vids.filter(v => typeof v === 'object').map(v => {
        const mainUrl = v.main_url || "";
        const vidType = mainUrl.includes(".m3u8") ? "hls" : "mp4";
        return {
            label: v.definition || "auto", quality: v.quality || "", url: mainUrl,
            backupUrl: v.backup_url || "", type: vidType, codec: v.codec || "",
            width: v.width || 0, height: v.height || 0, bitrate: v.bitrate || 0,
            size: v.size || 0, duration: v.duration || 0
        };
    });
    const bestUrl = qualityList.length ? qualityList[qualityList.length - 1].url : "";
    const subs = (target.subtitles || []).filter(s => typeof s === 'object' && s.url).map(s => ({
        lang: s.lang || "", label: s.label || "", url: s.url || ""
    }));
    return ok("video", "dramanova", {
        dramaId: did, episode: target.number || idx + 1, totalEps: epsRaw.length,
        episodeId: String(target.id || ""), fileId, title: detailR.title || "",
        epTitle: target.title || `Episode ${idx + 1}`, poster: r.poster || "",
        duration: r.duration || 0, videoUrl: bestUrl, subtitles: subs,
        qualityList, free: target.free || false, locked: !target.free, platform: "dramanova"
    });
}

async function dnvSearch(kw, lang = "in") {
    const r = await dx(`${DNV_BASE}/api/v1/search`, { q: kw, lang }, AUTH_H);
    if (r === null) return err("search", "dramanova", "gagal request");
    if (typeof r !== 'object' || Array.isArray(r)) return err("search", "dramanova", "response bukan dict");
    const rows = r.rows || [];
    const dramas = rows.filter(x => typeof x === 'object').map(x => ({
        id: String(x.id || ""), title: x.title || "", cover: x.cover || "",
        episodes: x.episodes || 0, synopsis: clean(x.description || ""),
        categoryNames: x.categoryNames || [], viewCount: x.viewCount || 0,
        likeCount: x.likeCount || 0, favoriteCount: x.favoriteCount || 0,
        isCompleted: x.isCompleted || false, publishedAt: x.publishedAt || "",
        platform: "dramanova"
    }));
    return ok("search", "dramanova", { keyword: kw, lang, items: dramas, total: r.total || dramas.length });
}

async function dnvModules(lang = "in") {
    const r = await dx(`${DNV_BASE}/api/v1/modules`, { lang }, AUTH_H);
    if (r === null) return err("modules", "dramanova", "gagal request");
    const items = Array.isArray(r) ? r : [];
    const modules = items.filter(x => typeof x === 'object').map(x => ({
        categoryKey: x.categoryKey || "", categoryName: x.categoryName || "",
        dramaCount: x.dramaCount || 0
    }));
    return ok("modules", "dramanova", { lang, modules, total: modules.length });
}

async function dnvRecommend(lang = "in", categoryKey = "dramanova_hot", page = 1, size = 5, limit = 6) {
    const r = await dx(`${DNV_BASE}/api/v1/recommend`, { lang, categoryKey, page, size, limit }, AUTH_H);
    if (r === null) return err("recommend", "dramanova", "gagal request");
    if (typeof r !== 'object' || Array.isArray(r)) return err("recommend", "dramanova", "response bukan dict");
    const dramaList = r.dramas || [];
    const dramas = dramaList.filter(x => typeof x === 'object').map(x => ({
        id: String(x.id || ""), title: x.title || "", cover: x.cover || "",
        episodes: x.episodes || 0, viewCount: x.viewCount || 0, platform: "dramanova"
    }));
    return ok("recommend", "dramanova", {
        lang, category: r.category || categoryKey, categoryKey: r.categoryKey || categoryKey,
        page, size, limit, items: dramas, total: dramas.length
    });
}

// ============================================================
// VERCEL SERVERLESS HANDLER
// ============================================================

async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") { res.status(200).end(); return; }

    const q      = req.query || {};
    const source = (q.source || "goodshort").toLowerCase();
    const action = (q.action || "home").toLowerCase();

    let result;

    try {
        // ── GoodShort ──
        if (source === "goodshort") {
            const page    = parseInt(q.page)    || 1;
            const channel = q.channel           || "id";
            const bid     = q.id || q.bookId    || "";
            const ep      = parseInt(q.ep)      || 1;
            const quality = q.quality            || "720p";

            if      (action === "home" || action === "foryou" || action === "trending")
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
                result = err(action, "goodshort", `Unknown action '${action}'`);
        }

        // ── DramaBox ──
        else if (source === "dramabox") {
            const page = parseInt(q.page) || 1;
            const size = parseInt(q.size) || 10;
            const lang = q.lang || "in";
            const did  = q.id || q.bookId || "";

            if      (action === "home" || action === "foryou")
                result = await dbHome(page, size, lang);
            else if (action === "rank" || action === "trending")
                result = await dbRank(lang);
            else if (action === "search")
                result = await dbSearch(q.query || q.keyword || "", page, lang);
            else if (action === "detail")
                result = await dbDetail(did, q.lang || "en");
            else if (action === "episodes")
                result = await dbEpisodes(did, lang);
            else
                result = err(action, "dramabox", `Unknown action '${action}'`);
        }

        // ── Melolo ──
        else if (source === "melolo") {
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
                result = err(action, "melolo", `Unknown action '${action}'`);
        }

        // ── DramaBite ──
        else if (source === "dramabite") {
            const lang   = q.lang   || "id";
            const page   = parseInt(q.page) || 0;
            const did    = q.id     || "";
            const ep     = parseInt(q.ep) || 1;
            const limit  = parseInt(q.limit) || 20;
            const quality = q.quality || "default";

            if      (action === "dramas" || action === "home")
                result = await dbtDramas(lang, page);
            else if (action === "foryou")
                result = await dbtForyou(lang, page);
            else if (action === "hot" || action === "trending")
                result = await dbtHot(lang);
            else if (action === "recommend")
                result = await dbtRecommend(lang, page);
            else if (action === "search")
                result = await dbtSearch(q.query || q.q || "", lang, limit);
            else if (action === "detail")
                result = await dbtDetail(did, lang);
            else if (action === "likes")
                result = await dbtLikes(did, lang);
            else if (action === "episode" || action === "video")
                result = await dbtEpisode(did, ep, lang, quality);
            else
                result = err(action, "dramabite", `Unknown action '${action}'`);
        }

        // ── DramaNova ──
        else if (source === "dramanova") {
            const lang        = q.lang        || "in";
            const page        = parseInt(q.page) || 1;
            const size        = parseInt(q.size) || 20;
            const did         = q.id          || "";
            const ep          = parseInt(q.ep) || 1;
            const categoryKey = q.categoryKey || q.category || "dramanova_hot";
            const limit       = parseInt(q.limit) || 6;

            if      (action === "dramas" || action === "home")
                result = await dnvDramas(lang, page, size);
            else if (action === "detail")
                result = await dnvDetail(did, lang);
            else if (action === "video" || action === "episode" || action === "stream")
                result = await dnvVideo(did, ep, lang);
            else if (action === "search")
                result = await dnvSearch(q.query || q.q || "", lang);
            else if (action === "modules" || action === "categories")
                result = await dnvModules(lang);
            else if (action === "recommend")
                result = await dnvRecommend(lang, categoryKey, page, size, limit);
            else
                result = err(action, "dramanova", `Unknown action '${action}'`);
        }

        else {
            result = err(action, source, `Unknown source '${source}'. Use: goodshort | dramabox | melolo | dramabite | dramanova`);
        }

        res.status(result.code || 200).json(result);
    } catch (e) {
        res.status(500).json(err(action, source, `Server error: ${e.message}`));
    }
}

// ============================================================
// EXPORT
// ============================================================

export default handler;

export {
    // GoodShort
    gsHome, gsSearch, gsDetail, gsStream, gsStreamFast, gsUnlockAll,
    // DramaBox
    dbHome, dbRank, dbSearch, dbDetail, dbEpisodes,
    // Melolo
    mlHome, mlSearch, mlDetail, mlVideo,
    // DramaBite
    dbtDramas, dbtForyou, dbtHot, dbtRecommend, dbtSearch, dbtDetail, dbtLikes, dbtEpisode,
    // DramaNova
    dnvDramas, dnvDetail, dnvVideo, dnvSearch, dnvModules, dnvRecommend
};
