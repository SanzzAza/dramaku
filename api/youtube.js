/**
 * YouTube Downloader API — via yt5s / y2mate compatible endpoints
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 * GET /api/youtube?url=...&quality=720
 * GET /api/youtube?url=...&audio_only=true
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

  const url = req.query.url || req.body?.url;
  const quality = req.query.quality || req.body?.quality || "720";
  const audioOnly = req.query.audio_only === "true" || req.body?.audio_only === true;

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  }

  const ytRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts|embed)|youtu\.be)\/.+/i;
  if (!ytRegex.test(url)) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "URL tidak valid. Masukkan link YouTube, YouTube Shorts, atau youtu.be.",
    });
  }

  try {
    const result = await fetchYoutube(url, quality, audioOnly);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[YouTube]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mengambil media.",
    });
  }
}

async function fetchYoutube(url, quality, audioOnly) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
  const isShorts = /\/shorts\//i.test(url);
  const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

  // Step 1: Analyze video via yt5s
  const analyzeResp = await fetch("https://www.yt5s.io/api/ajaxSearch/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://www.yt5s.io/",
      "Origin": "https://www.yt5s.io",
    },
    body: new URLSearchParams({ q: url, vt: "home" }).toString(),
  });

  if (!analyzeResp.ok) throw new Error(`yt5s analyze responded ${analyzeResp.status}`);

  const analyzeJson = await analyzeResp.json();
  if (analyzeJson.status !== "ok") throw new Error("Gagal menganalisis video YouTube.");

  const vid = analyzeJson.vid || videoId;
  const title = analyzeJson.t || null;
  const links = analyzeJson.links || {};

  // Pick best matching format
  let mediaUrl = null;
  let resolvedQuality = quality;

  if (audioOnly) {
    // Get mp3 link
    const mp3 = links?.mp3?.mp3128 || links?.mp3?.mp3320 || Object.values(links?.mp3 || {})[0];
    if (mp3?.url) mediaUrl = mp3.url;
    else if (mp3?.k) mediaUrl = await convertYt5s(vid, mp3.k, "mp3128");
  } else {
    const qualityOrder = [quality, "720", "480", "360", "auto"];
    const mp4Links = links?.mp4 || {};
    for (const q of qualityOrder) {
      const match = mp4Links[`p${q}`] || mp4Links[q];
      if (match) {
        resolvedQuality = q;
        if (match.url) {
          mediaUrl = match.url;
        } else if (match.k) {
          mediaUrl = await convertYt5s(vid, match.k, `p${q}`);
        }
        if (mediaUrl) break;
      }
    }
    // Fallback: first available mp4
    if (!mediaUrl) {
      for (const [key, val] of Object.entries(mp4Links)) {
        if (val?.url) { mediaUrl = val.url; resolvedQuality = key; break; }
        if (val?.k) {
          mediaUrl = await convertYt5s(vid, val.k, key);
          if (mediaUrl) { resolvedQuality = key; break; }
        }
      }
    }
  }

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: { username: null, avatar: null, channel_url: null },
    video: {
      id: videoId,
      title,
      duration: null,
      type: isShorts ? "shorts" : "video",
      quality: resolvedQuality,
      play: audioOnly ? null : mediaUrl,
      audio_only: audioOnly ? mediaUrl : null,
      cover: thumb,
      filename: title ? `${title.slice(0, 50)}.mp4` : `youtube_${videoId}.mp4`,
    },
    audio: { play: audioOnly ? mediaUrl : null, title: null, author: null },
    stats: { view_count: null, like_count: null, comment_count: null },
    meta: {
      video_id: videoId,
      source_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : url,
      thumbnail_hq: thumb,
      thumbnail_mq: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
      provider: "yt5s",
    },
  };
}

async function convertYt5s(vid, k, ftype) {
  try {
    const resp = await fetch("https://www.yt5s.io/api/ajaxConvert/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.yt5s.io/",
        "Origin": "https://www.yt5s.io",
      },
      body: new URLSearchParams({ vid, k, ftype, fquality: ftype }).toString(),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    return json?.dlink || null;
  } catch {
    return null;
  }
}
