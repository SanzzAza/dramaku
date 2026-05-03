/**
 * Downloader API — YouTube, TikTok, Instagram, Facebook, Pinterest, Twitter/X, Threads
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const platform = (req.query.platform || req.body?.platform || "").toLowerCase();
  const url = req.query.url || req.body?.url;

  if (!platform) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'platform' wajib diisi.",
      available: ["youtube", "tiktok", "instagram", "facebook", "pinterest", "twitter", "threads"],
      example: "/api/downloader?platform=tiktok&url=https://vt.tiktok.com/...",
    });
  }

  if (!url) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: `/api/downloader?platform=${platform}&url=https://...`,
    });
  }

  try {
    switch (platform) {
      case "youtube":   return res.status(200).json(await fetchYoutube(req, url));
      case "tiktok":    return res.status(200).json(await fetchTikTok(url));
      case "instagram": return res.status(200).json(await fetchInstagram(url));
      case "facebook":  return res.status(200).json(await fetchFacebook(url));
      case "pinterest": return res.status(200).json(await fetchPinterest(url));
      case "twitter":
      case "x":         return res.status(200).json(await fetchTwitter(url));
      case "threads":   return res.status(200).json(await fetchThreads(url));
      default:
        return res.status(400).json({
          status: false, code: 400,
          message: `Platform '${platform}' tidak didukung.`,
          available: ["youtube", "tiktok", "instagram", "facebook", "pinterest", "twitter", "threads"],
        });
    }
  } catch (err) {
    console.error(`[Downloader:${platform}]`, err.message);
    return res.status(500).json({ status: false, code: 500, message: err.message || "Gagal mengambil media." });
  }
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

const YT_API_SUBMIT = "https://hub.ytconvert.org/api/download";
const YT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://ytconvert.org/",
  "Origin": "https://ytconvert.org",
  "Content-Type": "application/json",
  "Accept": "application/json",
};

// Client IOS — URL stream tidak diencrypt, paling reliable
const YT_IOS_CLIENT = {
  clientName: "IOS",
  clientVersion: "19.29.1",
  deviceModel: "iPhone16,2",
  userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
  hl: "en",
  gl: "US",
};

async function fetchYoutube(req, url) {
  const format  = (req.query.format  || req.body?.format  || "mp3").toLowerCase();
  const quality = req.query.quality  || req.body?.quality || (format === "mp4" ? "360" : "128");

  const ytRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts|embed)|youtu\.be)\/.+/i;
  if (!ytRegex.test(url)) throw new Error("URL tidak valid. Masukkan link YouTube, YouTube Shorts, atau youtu.be.");

  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts  = /\/shorts\//i.test(url);
  const thumbHQ   = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbMQ   = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (format === "mp4") {
    return await fetchYoutubeMP4({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, quality });
  }
  return await fetchYoutubeAudio({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality });
}

// ================================================
// yt2mp3.gs helpers (converted from Python)
// ================================================
function yt2Authorization() {
  const arr0 = [103,70,105,57,109,74,124,112,71,105,98,62,121,84,65,125,55,110,98,89];
  const arr2 = [6,13,1,4,11,15,4,6,12,1,3,15,15,8,4,0,6,5,13,6];
  let result = "";
  for (let t = 0; t < arr0.length; t++) {
    result += String.fromCharCode(arr0[t] - arr2[arr2.length - (t + 1)]);
  }
  if (result.length > 32) result = result.slice(0, 32);
  return result;
}

async function yt2GetCookies() {
  const r = await fetch("https://yt2mp3.gs/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,*/*",
    },
    signal: AbortSignal.timeout(15_000),
  });
  const raw = r.headers.get("set-cookie") || "";
  return raw.split(",").map(c => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

async function yt2Initialize(cookies) {
  const token = yt2Authorization();
  const param = String.fromCharCode(110); // 'n'
  const ts = Math.floor(Date.now() / 1000);
  const url = `https://yt2mp3.gs/~i/?${param}=${encodeURIComponent(token)}&t=${ts}`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://yt2mp3.gs/",
      "Accept": "application/json, */*",
      "Cookie": cookies,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`yt2 init gagal (${r.status})`);
  return r.json();
}

async function yt2Convert(convertUrl, videoId, fmt, cookies, attempt = 0) {
  const ts = Math.floor(Date.now() / 1000);
  const base = convertUrl.includes("&v=") ? convertUrl.split("&v=")[0] : convertUrl;
  const url = `${base}&v=${videoId}&f=${fmt}&t=${ts}`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://yt2mp3.gs/",
      "Accept": "application/json, */*",
      "Cookie": cookies,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`yt2 convert gagal (${r.status})`);
  const data = await r.json();
  if (data?.redirect === 1 && attempt === 0) {
    return yt2Convert(data.redirectURL, videoId, fmt, cookies, 1);
  }
  return data;
}

async function yt2Progress(progressUrl, downloadUrl, cookies) {
  for (let i = 0; i < 20; i++) {
    const ts = Math.floor(Date.now() / 1000);
    const r = await fetch(`${progressUrl}&t=${ts}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://yt2mp3.gs/",
        "Accept": "application/json, */*",
        "Cookie": cookies,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (r.status === 429) { await new Promise(res => setTimeout(res, 15_000)); continue; }
    if (!r.ok) break;
    const data = await r.json();
    if (String(data?.error ?? "0") !== "0") throw new Error(`yt2 progress error: ${data.error}`);
    if (parseInt(data?.progress ?? 0) >= 3) return data?.url || data?.downloadURL || downloadUrl;
    await new Promise(res => setTimeout(res, 5_000));
  }
  return downloadUrl;
}

async function fetchYoutubeMP4({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, quality }) {
  const fmt = "mp4";

  const cookies = await yt2GetCookies();

  const initData = await yt2Initialize(cookies);
  if (String(initData?.error ?? "1") !== "0") throw new Error("yt2 init gagal.");
  const convertUrl = initData?.convertURL;
  if (!convertUrl) throw new Error("yt2 convertURL tidak ditemukan.");

  const convData = await yt2Convert(convertUrl, videoId, fmt, cookies);
  if (String(convData?.error ?? "1") !== "0") throw new Error("yt2 convert gagal.");

  const downloadUrl = convData?.downloadURL;
  const progressUrl = convData?.progressURL;
  const title       = convData?.title || null;

  let finalUrl = downloadUrl;
  if (progressUrl) finalUrl = await yt2Progress(progressUrl, downloadUrl, cookies);
  if (!finalUrl) throw new Error("URL download tidak ditemukan dari yt2mp3.gs.");

  const dlUrl = `${finalUrl}&s=2&v=${videoId}&f=${fmt}`;

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil data video YouTube.",
    result: {
      title, duration: null,
      type: isShorts ? "shorts" : "video",
      quality: quality ? `${quality}p` : "360p",
      video_url: dlUrl,
      audio_url: null,
      combined: true,
      note: null,
      cover: thumbHQ, thumbnail_mq: thumbMQ,
      filename: `${(title || videoId).slice(0, 80).replace(/[\\/:*?"<>|]/g, "_")}.mp4`,
      format: "mp4",
    },
    meta: { video_id: videoId, source_url: sourceUrl, is_shorts: isShorts, provider: "yt2mp3.gs" },
  };
}
async function fetchYoutubeAudio({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality }) {
  const payload = {
    url: sourceUrl,
    output: { type: "audio", format, quality },
  };

  const MAX_SUBMIT_RETRIES = 4;
  let submitData = null;
  let lastError  = null;

  for (let attempt = 1; attempt <= MAX_SUBMIT_RETRIES; attempt++) {
    try {
      const submitResp = await fetch(YT_API_SUBMIT, {
        method: "POST",
        headers: YT_HEADERS,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await submitResp.json();

      if (data?.error?.code === "INTERNAL_ERROR" || !submitResp.ok) {
        lastError = data?.error?.message ?? `HTTP ${submitResp.status}`;
        if (attempt < MAX_SUBMIT_RETRIES) await sleep(800);
        continue;
      }
      if (data?.statusUrl) { submitData = data; break; }
      if (data?.downloadUrl || data?.status === "completed") {
        return buildYTResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly: true, data });
      }
      lastError = "Response tidak valid.";
      if (attempt < MAX_SUBMIT_RETRIES) await sleep(800);
    } catch (err) {
      lastError = err.message;
      if (attempt < MAX_SUBMIT_RETRIES) await sleep(800);
    }
  }

  if (!submitData) throw new Error(`Submit gagal setelah ${MAX_SUBMIT_RETRIES}x retry. Error: ${lastError}`);

  for (let i = 0; i < 7; i++) {
    await sleep(2_000);
    try {
      const statusResp = await fetch(submitData.statusUrl, {
        headers: { ...YT_HEADERS, "Content-Type": undefined },
        signal: AbortSignal.timeout(8_000),
      });
      if (!statusResp.ok) continue;
      const statusData = await statusResp.json();
      const status = statusData?.status;
      if (status === "completed" && statusData?.downloadUrl) {
        return buildYTResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly: true, data: { ...submitData, ...statusData } });
      }
      if (status === "failed" || status === "error") throw new Error(statusData?.message || "Konversi gagal di server.");
    } catch (err) {
      if (err.message.includes("Konversi gagal")) throw err;
    }
  }
  throw new Error("Timeout: konversi memakan waktu terlalu lama. Coba lagi.");
}

function buildYTResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly, data }) {
  const title    = data?.title    ?? null;
  const duration = data?.duration ?? null;
  const fileSize = data?.fileSize ?? null;
  const safeTitle = (title || `youtube_${videoId}`).slice(0, 80).replace(/[\\/:*?"<>|]/g, "_").trim();
  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil data media.",
    author: { username: null, avatar: null, channel_url: null },
    video: {
      id: videoId, title, duration,
      type: isShorts ? "shorts" : "video",
      quality: audioOnly ? null : `${quality}p`,
      play: audioOnly ? null : data?.downloadUrl,
      audio_only: audioOnly ? data?.downloadUrl : null,
      cover: thumbHQ,
      filename: `${safeTitle}.${format}`,
      file_size: fileSize,
    },
    audio: { play: audioOnly ? data?.downloadUrl : null, quality: audioOnly ? `${quality}kbps` : null, author: null },
    stats: { view_count: null, like_count: null, comment_count: null },
    meta: { video_id: videoId, source_url: sourceUrl, thumbnail_hq: thumbHQ, thumbnail_mq: thumbMQ, is_shorts: isShorts, format, quality, provider: "hub.ytconvert.org" },
  };
}

// ─── TikTok ───────────────────────────────────────────────────────────────────

async function fetchTikTok(url) {
  const tiktokRegex = /^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\/.+/i;
  if (!tiktokRegex.test(url)) throw new Error("URL tidak valid. Masukkan link TikTok yang benar.");

  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
  const resp = await fetch(apiUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; TikTokDL/1.0)" } });
  if (!resp.ok) throw new Error(`tikwm responded ${resp.status}`);

  const json = await resp.json();
  if (!json || json.code !== 0) throw new Error(json?.msg || "Video tidak ditemukan atau link expired.");

  const d = json.data;
  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil data video.",
    author: { id: d.author?.id || null, username: d.author?.unique_id || null, nickname: d.author?.nickname || null, avatar: d.author?.avatar || null, verified: d.author?.verified || false },
    video: { id: d.id || null, title: d.title || null, duration: d.duration || null, cover: d.cover || null, origin_cover: d.origin_cover || null, play: d.play || null, hdplay: d.hdplay || null, wmplay: d.wmplay || null, size: d.size || null, hd_size: d.hd_size || null, wm_size: d.wm_size || null },
    audio: { play: d.music || null, title: d.music_info?.title || null, author: d.music_info?.author || null, cover: d.music_info?.cover || null, duration: d.music_info?.duration || null, original: d.music_info?.original || false },
    stats: { play_count: d.play_count || null, like_count: d.digg_count || null, comment_count: d.comment_count || null, share_count: d.share_count || null, download_count: d.download_count || null },
  };
}

// ─── Instagram ────────────────────────────────────────────────────────────────

const IG_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchInstagram(url) {
  const igRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\/.+/i;
  if (!igRegex.test(url)) throw new Error("URL tidak valid. Masukkan link Instagram Post, Reel, atau IGTV.");

  const shortcode = url.match(/\/(p|reel|tv|stories)\/([^/?]+)/)?.[2];
  if (!shortcode) throw new Error("Tidak dapat mengambil shortcode dari URL.");

  const pageResp = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
    headers: { "User-Agent": IG_UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "none" },
  });
  const html = await pageResp.text();

  let csrfToken = "missing";
  const csrfMatch = html.match(/"csrf_token"\s*:\s*"([^"]+)"/);
  if (csrfMatch) csrfToken = csrfMatch[1];

  const setCookie = pageResp.headers.get("set-cookie") || "";
  const cookieHeader = setCookie.split(",").map(c => c.split(";")[0].trim()).join("; ");

  const variables = JSON.stringify({ shortcode });
  const payload = `variables=${encodeURIComponent(variables)}&doc_id=24368985919464652`;

  const gqlResp = await fetch("https://www.instagram.com/graphql/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": IG_UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9",
      "X-CSRFToken": csrfToken, "X-IG-App-ID": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `https://www.instagram.com/p/${shortcode}/`,
      "Origin": "https://www.instagram.com",
      "Cookie": cookieHeader || `csrftoken=${csrfToken}`,
    },
    body: payload,
  });

  if (!gqlResp.ok) throw new Error(`Instagram GraphQL responded ${gqlResp.status}`);
  const gql = await gqlResp.json();

  const items = gql?.data?.xdt_api__v1__media__shortcode__web_info?.items;
  if (!items || items.length === 0) throw new Error("Media tidak ditemukan. Pastikan link public dan valid.");

  const item = items[0];
  const bestVideo = (item.video_versions || []).sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  const videoUrl  = bestVideo?.url || null;
  const bestThumb = (item.image_versions2?.candidates || []).sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  const thumbUrl  = bestThumb?.url || null;
  const caption   = item.caption?.text || null;
  const user      = item.user || {};

  let mediaItems = null;
  if (item.carousel_media?.length > 0) {
    mediaItems = item.carousel_media.map((m, i) => {
      const vUrl = m.video_versions?.[0]?.url || null;
      const iUrl = m.image_versions2?.candidates?.[0]?.url || null;
      return { index: i + 1, type: vUrl ? "video" : "image", url: vUrl || iUrl, thumb: m.image_versions2?.candidates?.[0]?.url || null };
    });
  }

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil data media.",
    author: { username: user.username || null, full_name: user.full_name || null, avatar: user.profile_pic_url || null, verified: user.is_verified || false },
    video: { play: videoUrl, hdplay: videoUrl, wmplay: null, cover: thumbUrl, title: caption ? caption.slice(0, 150) : null, duration: item.video_duration || null, width: bestVideo?.width || null, height: bestVideo?.height || null, filename: `instagram_${shortcode}.mp4` },
    audio: { play: null, title: item.music_metadata?.music_info?.music_asset_info?.title || item.clips_metadata?.original_sound_info?.original_audio_title || null, author: item.music_metadata?.music_info?.music_asset_info?.display_artist || item.clips_metadata?.original_sound_info?.ig_artist?.username || user.username || null, cover: item.music_metadata?.music_info?.music_asset_info?.cover_artwork_uri || null },
    stats: { play_count: item.play_count || null, like_count: item.like_count || null, comment_count: item.comment_count || null, share_count: null },
    ...(mediaItems ? { items: mediaItems } : {}),
    meta: { shortcode, source_url: url, thumbnail: thumbUrl, media_type: item.media_type === 2 ? "video" : item.media_type === 8 ? "carousel" : "image", provider: "instagram-graphql" },
  };
}

// ─── Facebook ─────────────────────────────────────────────────────────────────

const FB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchFacebook(url) {
  const fbRegex = /^https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\/.+/i;
  if (!fbRegex.test(url)) throw new Error("URL tidak valid. Masukkan link Facebook yang benar.");

  // Step 1: Ambil cookie dari facebook.com dulu
  let cookieJar = "locale=en_US; wd=1920x1080";
  try {
    const initResp = await fetch("https://www.facebook.com/", {
      headers: { "User-Agent": FB_UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(10_000),
    });
    const rawCookies = initResp.headers.get("set-cookie") || "";
    const parsed = rawCookies.split(/,(?=[^ ][^=]+=)/).map(c => c.split(";")[0].trim()).filter(c => c.includes("=")).join("; ");
    if (parsed) cookieJar = parsed + "; locale=en_US; wd=1920x1080";
  } catch { /* pakai default */ }

  // Step 2: Resolve short URL
  let finalUrl = url;
  try {
    const resolveResp = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": FB_UA, "Cookie": cookieJar },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    finalUrl = resolveResp.url || url;
  } catch { finalUrl = url; }

  // Step 3: Fetch halaman video dengan cookie + header lengkap
  const pageResp = await fetch(finalUrl, {
    headers: {
      "User-Agent": FB_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      "Cookie": cookieJar,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!pageResp.ok) throw new Error(`Gagal mengakses halaman Facebook (${pageResp.status}). Pastikan video bersifat publik.`);
  const html = await pageResp.text();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s*[\|\-]\s*Facebook.*$/i, "").trim() : "No video title";

  const hdUrl = extractFbVideo(html, ["hd_src", "playable_url_quality_hd", "browser_native_hd_url"]);
  const sdUrl = extractFbVideo(html, ["sd_src", "playable_url", "browser_native_sd_url"]);

  if (!hdUrl && !sdUrl) {
    const allMp4 = [...html.matchAll(/https:\\\/\\\/video[-\w.]+\.fbcdn\.net\\\/[^"' \\]+/g)]
      .map(m => m[0].replace(/\\\//g, "/").replace(/\\u0026/g, "&"));
    if (allMp4.length > 0) {
      return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil mengambil data video Facebook.", data: { title, description: null, sd: allMp4[0], hd: allMp4[1] || allMp4[0] } };
    }
    throw new Error("Video tidak ditemukan. Pastikan video bersifat publik dan tidak dibatasi.");
  }

  return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil mengambil data video Facebook.", data: { title, description: null, sd: sdUrl || hdUrl, hd: hdUrl || sdUrl } };
}

function extractFbVideo(html, keys) {
  for (const key of keys) {
    const re1 = new RegExp(`"${key}"\\s*:\\s*"(https:[^"]+)"`, "i");
    const m1  = html.match(re1);
    if (m1) { const u = m1[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/"); if (u.includes("fbcdn.net") || u.includes(".mp4")) return u; }
    const re2 = new RegExp(`${key}:"(https:[^"]+)"`, "i");
    const m2  = html.match(re2);
    if (m2) { const u = m2[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/"); if (u.includes("fbcdn.net") || u.includes(".mp4")) return u; }
  }
  return null;
}

// ─── Pinterest ────────────────────────────────────────────────────────────────

const PIN_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

async function fetchPinterest(url) {
  const pinRegex = /^https?:\/\/(www\.|id\.|in\.)?pinterest\.(com|co\.uk|co\.id)\/pin\/.+/i;
  const shortRegex = /^https?:\/\/pin\.it\/[a-zA-Z0-9]+/i;

  // Resolve pin.it short URL dulu
  let resolvedUrl = url;
  if (shortRegex.test(url)) {
    const r = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": PIN_UA },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    resolvedUrl = r.url || url;
  }

  if (!pinRegex.test(resolvedUrl)) throw new Error("URL tidak valid. Masukkan link Pinterest pin atau pin.it yang benar.");

  const resp = await fetch(resolvedUrl, {
    headers: { "User-Agent": PIN_UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!resp.ok) throw new Error(`Pinterest merespons ${resp.status}.`);
  const html = await resp.text();

  const getMeta = (prop) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]+)"`, "i"))
      || html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="${prop}"`, "i"));
    return m ? m[1] : null;
  };

  const videoUrl = getMeta("og:video") || getMeta("og:video:url");
  const imageUrl = getMeta("og:image");
  const title    = getMeta("og:title");

  if (!videoUrl && !imageUrl) throw new Error("Media tidak ditemukan di pin ini.");

  // Build medias array
  const medias = [];
  if (videoUrl) {
    medias.push({ type: "video", extension: "mp4", quality: "HD Video", url: videoUrl });
  }
  if (imageUrl) {
    // Upgrade ke HD: ganti /236x/, /474x/, /736x/ dengan /originals/
    const hdImage = imageUrl.replace(/\/\d+x\//, "/originals/");
    medias.push({ type: "image", extension: "jpg", quality: "HD Image", url: hdImage });
  }

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil media Pinterest.",
    result: {
      title: title || null,
      duration: null,
      thumbnail: imageUrl || null,
      medias,
    },
  };
}


// ─── Twitter/X ────────────────────────────────────────────────────────────────

async function fetchTwitter(url) {
  const twitterRegex = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  if (!twitterRegex.test(url)) throw new Error("URL tidak valid. Masukkan link tweet yang benar.");

  // Pakai fxtwitter API — JSON langsung, tidak butuh scraping
  const tweetId = url.match(/status\/(\d+)/)?.[1];
  if (!tweetId) throw new Error("Tidak bisa ekstrak tweet ID.");

  const apiUrl = `https://api.fxtwitter.com/status/${tweetId}`;
  const resp = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SanzXD/1.0)",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`fxtwitter merespons ${resp.status}.`);
  const data = await resp.json();

  if (data?.code !== 200) throw new Error(data?.message || "Gagal mengambil data tweet.");

  const tweet = data?.tweet;
  const title = tweet?.author?.name ? `@${tweet.author.screen_name}: ${tweet.text?.slice(0, 100)}` : null;
  const thumbnail = tweet?.thumbnail?.url || null;

  const medias = [];
  const media = tweet?.media;

  if (media?.videos?.length > 0) {
    for (const vid of media.videos) {
      // Ambil semua variants/kualitas
      if (vid.variants?.length > 0) {
        for (const v of vid.variants) {
          medias.push({
            type: "video",
            extension: "mp4",
            quality: v.content_type === "video/mp4" ? (v.bitrate ? `${Math.round(v.bitrate/1000)}kbps` : "HD") : "m3u8",
            url: v.url,
          });
        }
      } else {
        medias.push({ type: "video", extension: "mp4", quality: "HD", url: vid.url });
      }
    }
  }

  if (media?.photos?.length > 0) {
    for (const photo of media.photos) {
      medias.push({ type: "image", extension: "jpg", quality: "HD Image", url: photo.url });
    }
  }

  if (media?.gifs?.length > 0) {
    for (const gif of media.gifs) {
      medias.push({ type: "gif", extension: "mp4", quality: "GIF", url: gif.url });
    }
  }

  if (medias.length === 0) throw new Error("Media tidak ditemukan di tweet ini. Pastikan tweet mengandung video atau gambar.");

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil media Twitter/X.",
    result: { title, thumbnail, medias },
  };
}

// ─── Threads ──────────────────────────────────────────────────────────────────

async function fetchThreads(url) {
  // Support URL dengan query params seperti ?xmt=...
  const threadsRegex = /^https?:\/\/(www\.)?threads\.net\/@?[\w.]+\/post\/[a-zA-Z0-9_-]+/i;
  const cleanUrl = url.split("?")[0]; // hapus query params untuk validasi
  if (!threadsRegex.test(cleanUrl)) throw new Error("URL tidak valid. Masukkan link post Threads yang benar.");

  // Fetch halaman Threads dengan user-agent mobile
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      "Accept": "text/html,application/xhtml+xml,*/*",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`Threads merespons ${resp.status}.`);
  const html = await resp.text();

  const getMeta = (prop) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]+)"`, "i"))
      || html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="${prop}"`, "i"));
    return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"') : null;
  };

  const videoUrl   = getMeta("og:video") || getMeta("og:video:secure_url") || getMeta("og:video:url");
  const imageUrl   = getMeta("og:image");
  const title      = getMeta("og:title") || getMeta("og:description");
  const thumbnail  = imageUrl;

  // Coba juga ambil dari JSON LD atau script tag
  let extraVideo = null;
  const scriptMatch = html.match(/"video_url":"([^"]+)"/);
  if (scriptMatch) extraVideo = scriptMatch[1].replace(/\\u0026/g, "&").replace(/\\/g, "");

  const finalVideo = videoUrl || extraVideo;

  if (!finalVideo && !imageUrl) throw new Error("Media tidak ditemukan. Post mungkin privat atau tidak mengandung media.");

  const medias = [];
  if (finalVideo) medias.push({ type: "video", extension: "mp4", quality: "HD Video", url: finalVideo });
  if (imageUrl)   medias.push({ type: "image", extension: "jpg", quality: "HD Image", url: imageUrl });

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil media Threads.",
    result: { title, thumbnail, medias },
  };
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
