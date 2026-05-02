/**
 * Downloader API — YouTube, TikTok, Instagram, Facebook, Pinterest
 *
 * GET /api/downloader?platform=youtube&url=...&format=mp3&quality=128
 * GET /api/downloader?platform=tiktok&url=...
 * GET /api/downloader?platform=instagram&url=...
 * GET /api/downloader?platform=facebook&url=...
 * GET /api/downloader?platform=pinterest&url=...
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

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

  const platform = (req.query.platform || req.body?.platform || "").toLowerCase();
  const url = req.query.url || req.body?.url;

  if (!platform) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'platform' wajib diisi.",
      available: ["youtube", "tiktok", "instagram", "facebook", "pinterest"],
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
      default:
        return res.status(400).json({
          status: false, code: 400,
          message: `Platform '${platform}' tidak didukung.`,
          available: ["youtube", "tiktok", "instagram", "facebook", "pinterest"],
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

async function fetchYoutube(req, url) {
  const format  = req.query.format  || req.body?.format  || "mp3";
  const quality = req.query.quality || req.body?.quality || "128";

  const ytRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts|embed)|youtu\.be)\/.+/i;
  if (!ytRegex.test(url)) throw new Error("URL tidak valid. Masukkan link YouTube, YouTube Shorts, atau youtu.be.");

  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts  = /\/shorts\//i.test(url);
  const thumbHQ   = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbMQ   = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const audioOnly = format !== "mp4";

  const payload = {
    url: sourceUrl,
    output: { type: audioOnly ? "audio" : "video", format, quality },
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
        return buildYTResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly, data });
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
        return buildYTResponse({ videoId, isShorts, thumbHQ, thumbMQ, sourceUrl, format, quality, audioOnly, data: { ...submitData, ...statusData } });
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

  const pageResp = await fetch("https://getfvid.com/", { headers: { "User-Agent": FB_UA, "Accept": "text/html" } });
  const pageHtml = await pageResp.text();

  const tokenMatch = pageHtml.match(/name="_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error("Gagal mendapatkan token dari server.");
  const token = tokenMatch[1];

  const cookies = (pageResp.headers.get("set-cookie") || "").split(",").map(c => c.split(";")[0].trim()).join("; ");

  const formData = new URLSearchParams({ _token: token, url });
  const submitResp = await fetch("https://getfvid.com/downloader", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": FB_UA, "Referer": "https://getfvid.com/", "Origin": "https://getfvid.com", "Cookie": cookies },
    body: formData.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  const html = await submitResp.text();
  const hdMatch    = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*HD/i);
  const sdMatch    = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*SD/i);
  const thumbMatch = html.match(/<img[^>]+src="(https:\/\/[^"]+)"[^>]*class="[^"]*thumb/i) || html.match(/og:image.*?content="([^"]+)"/i);

  const hdUrl = hdMatch ? decodeURIComponent(hdMatch[1]) : null;
  const sdUrl = sdMatch ? decodeURIComponent(sdMatch[1]) : null;
  if (!hdUrl && !sdUrl) throw new Error("Video tidak ditemukan. Pastikan video bersifat publik.");

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil data video Facebook.",
    result: { source_url: url, video: { hd: hdUrl, sd: sdUrl, cover: thumbMatch ? thumbMatch[1] : null }, provider: "getfvid.com" },
  };
}

// ─── Pinterest ────────────────────────────────────────────────────────────────

const PIN_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

async function fetchPinterest(url) {
  const pinRegex = /^https?:\/\/(www\.|id\.|in\.)?pinterest\.(com|co\.uk|co\.id)\/pin\/.+/i;
  if (!pinRegex.test(url)) throw new Error("URL tidak valid. Masukkan link Pinterest pin yang benar.");

  const resp = await fetch(url, {
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
  const desc     = getMeta("og:description");

  if (!videoUrl && !imageUrl) throw new Error("Media tidak ditemukan di pin ini.");

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil media Pinterest.",
    result: { source_url: url, type: videoUrl ? "video" : "image", title: title || null, description: desc || null, media: { url: videoUrl || imageUrl, video: videoUrl || null, image: imageUrl || null }, provider: "pinterest.com" },
  };
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
