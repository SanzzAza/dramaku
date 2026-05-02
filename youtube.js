/**
 * YouTube Downloader API — via Cobalt (self-hosted on Railway)
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 */

const COBALT_URL = "https://cobalt-api-production-2914.up.railway.app";

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
  const quality = req.query.quality || req.body?.quality || "1080";
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
    const result = await fetchViaCobalt(url, quality, audioOnly);
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

async function fetchViaCobalt(url, quality, audioOnly) {
  const body = {
    url,
    videoQuality: quality,
    ...(audioOnly && { downloadMode: "audio" }),
  };

  const resp = await fetch(COBALT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) throw new Error(`Cobalt responded ${resp.status}`);

  const data = await resp.json();

  // Ekstrak video ID dari URL
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
  const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
  const isShorts = /\/shorts\//i.test(url);

  if (data.status === "tunnel" || data.status === "redirect") {
    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      video: {
        id: videoId,
        title: null,        // Cobalt tidak return title
        duration: null,
        type: isShorts ? "shorts" : "video",
        quality: quality,
        play: audioOnly ? null : data.url,
        audio_only: audioOnly ? data.url : null,
        cover: thumbnail,
        filename: data.filename ?? null,
      },
      audio: {
        play: audioOnly ? data.url : null,
        title: null,
        author: null,
      },
      author: {
        username: null,     // Cobalt tidak return metadata channel
        avatar: null,
      },
      stats: {
        view_count: null,
        like_count: null,
        comment_count: null,
      },
      meta: {
        video_id: videoId,
        source_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : url,
        thumbnail_hq: thumbnail,
        thumbnail_mq: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
        thumbnail_sq: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
        provider: "cobalt",
      },
    };
  }

  const errCode = data.error?.code ?? "unknown";
  throw new Error(`Cobalt error: ${errCode}`);
}
