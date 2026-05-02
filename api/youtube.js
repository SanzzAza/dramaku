/**
 * YouTube Downloader API — via Cobalt API
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 * GET /api/youtube?url=...&quality=360|480|720|1080|1440|2160
 * GET /api/youtube?url=...&audio_only=true
 * GET /api/youtube?url=...&audio_format=mp3|wav|ogg|opus|flac&audio_bitrate=128|192|320
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Cobalt instances — dicoba berurutan
const COBALT_INSTANCES = [
  "https://cobalt.api.timelessnesses.me",
  "https://co.wuk.sh",
  "https://cobalt.floofy.dev",
  "https://cobalt.drgns.space",
  "https://cobalt.darkness.services",
];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const url          = req.query.url          || req.body?.url;
  const quality      = req.query.quality      || req.body?.quality      || "720";
  const audioOnly    = req.query.audio_only   === "true" || req.body?.audio_only === true;
  const audioFormat  = req.query.audio_format || req.body?.audio_format || "mp3";
  const audioBitrate = req.query.audio_bitrate|| req.body?.audio_bitrate|| "128";

  if (!url) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  }

  const ytRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts|embed)|youtu\.be)\/.+/i;
  if (!ytRegex.test(url)) {
    return res.status(400).json({
      status: false, code: 400,
      message: "URL tidak valid. Masukkan link YouTube, YouTube Shorts, atau youtu.be.",
    });
  }

  try {
    const result = await fetchYoutube(url, quality, audioOnly, audioFormat, audioBitrate);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[YouTube]", err.message);
    return res.status(500).json({
      status: false, code: 500,
      message: err.message || "Gagal mengambil media.",
    });
  }
}

async function callCobalt(instanceUrl, body) {
  const resp = await fetch(instanceUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });

  // Follow jika ada redirect
  if (!resp.ok) throw new Error(`${resp.status}`);

  const json = await resp.json();
  return json;
}

async function fetchWithFallback(body) {
  let lastError = "Semua instance gagal.";

  for (const instance of COBALT_INSTANCES) {
    try {
      const data = await callCobalt(instance, body);

      // Cobalt v9+ response
      if (data?.status === "tunnel" || data?.status === "redirect" || data?.url) {
        return data;
      }

      // Cobalt v10+ response
      if (data?.status === "stream" && data?.url) {
        return data;
      }

      // Error dari cobalt
      if (data?.status === "error") {
        lastError = data?.error?.code || data?.text || "Error dari cobalt instance.";
        continue;
      }

    } catch (e) {
      lastError = e.message;
      continue;
    }
  }

  throw new Error(lastError);
}

async function fetchYoutube(url, quality, audioOnly, audioFormat, audioBitrate) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts  = /\/shorts\//i.test(url);
  const thumbHQ   = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbMQ   = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Build cobalt request body
  const cobaltBody = audioOnly
    ? {
        url,
        downloadMode: "audio",
        audioFormat: audioFormat || "mp3",
        audioBitrate: String(audioBitrate || "128"),
      }
    : {
        url,
        downloadMode: "auto",
        videoQuality: String(quality),
      };

  const cobaltData = await fetchWithFallback(cobaltBody);
  const mediaUrl   = cobaltData.url || null;

  if (!mediaUrl) throw new Error("Gagal mendapatkan URL media dari cobalt.");

  // Ambil metadata dari YouTube oEmbed
  let title = null, author = null;
  try {
    const oe = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (oe.ok) {
      const d = await oe.json();
      title  = d.title       || null;
      author = d.author_name || null;
    }
  } catch { /* optional */ }

  const safeTitle = (title || `youtube_${videoId}`)
    .slice(0, 50)
    .replace(/[\\/:*?"<>|]/g, "_");

  const ext = audioOnly ? (audioFormat || "mp3") : "mp4";

  return {
    status: true, code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: author || null,
      avatar: null,
      channel_url: null,
    },
    video: {
      id: videoId,
      title: title || null,
      duration: null,
      type: isShorts ? "shorts" : "video",
      quality: audioOnly ? null : quality,
      play: audioOnly ? null : mediaUrl,
      audio_only: audioOnly ? mediaUrl : null,
      cover: thumbHQ,
      filename: `${safeTitle}.${ext}`,
    },
    audio: {
      play: audioOnly ? mediaUrl : null,
      format: audioOnly ? audioFormat : null,
      bitrate: audioOnly ? audioBitrate : null,
      author: author || null,
    },
    stats: {
      view_count: null,
      like_count: null,
      comment_count: null,
    },
    meta: {
      video_id: videoId,
      source_url: sourceUrl,
      thumbnail_hq: thumbHQ,
      thumbnail_mq: thumbMQ,
      is_shorts: isShorts,
      provider: "cobalt",
      cobalt_status: cobaltData.status,
    },
  };
}
