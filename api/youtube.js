/**
 * YouTube Downloader API — Multi-format, return semua stream sekaligus
 *
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 *
 * Response: semua format tersedia (video + audio) dalam array medias[]
 * Filter opsional:
 *   &type=video|audio          → filter berdasarkan tipe
 *   &ext=mp4|webm|m4a|opus     → filter berdasarkan ekstensi
 *   &quality=720p|1080p|...    → filter berdasarkan qualityLabel
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// ── Provider list (dicoba urut, fallback ke berikutnya jika gagal) ─────────────
// Keduanya pakai endpoint yang sudah ada di project, format response sama
const PROVIDERS = [
  {
    name: "ytdl.y2mp3.co",
    buildUrl: (videoId) => `https://ytdl.y2mp3.co/api/info?v=${videoId}`,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://ytconvert.org/",
      "Origin": "https://ytconvert.org",
      "Accept": "application/json",
    },
  },
  {
    name: "hub.ytconvert.org",
    buildUrl: (videoId) => `https://hub.ytconvert.org/api/info?v=${videoId}`,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://ytconvert.org/",
      "Origin": "https://ytconvert.org",
      "Accept": "application/json",
    },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const url        = req.query.url     || req.body?.url;
  const typeFilter = req.query.type    || req.body?.type    || null; // "video" | "audio"
  const extFilter  = req.query.ext     || req.body?.ext     || null; // "mp4" | "webm" | "m4a" | "opus"
  const qualFilter = req.query.quality || req.body?.quality || null; // "720p" | "1080p" | ...

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      filters: "Opsional: &type=video|audio  &ext=mp4|webm|m4a|opus  &quality=720p|1080p",
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
    const result = await fetchAllFormats(url, { typeFilter, extFilter, qualFilter });
    return res.status(200).json(result);
  } catch (err) {
    console.error("[YouTube]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mengambil data media.",
    });
  }
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function fetchAllFormats(url, { typeFilter, extFilter, qualFilter } = {}) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts  = /\/shorts\//i.test(url);
  const thumbHQ   = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbMQ   = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // ── Coba provider satu per satu ──
  let raw = null;
  let usedProvider = null;
  const errors = [];

  for (const provider of PROVIDERS) {
    try {
      const apiUrl = provider.buildUrl(videoId);
      console.log(`[YouTube] Trying ${provider.name}: ${apiUrl}`);

      const resp = await fetch(apiUrl, {
        headers: provider.headers,
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok) {
        errors.push(`${provider.name}: HTTP ${resp.status}`);
        continue;
      }

      const data = await resp.json();

      // Support dua format response:
      // 1. { result: { medias: [...] } }  ← format @shenira16x / ytdl.y2mp3.co
      // 2. { medias: [...] }              ← format flat
      const result = data?.result ?? data;
      const medias = result?.medias ?? result?.formats ?? [];

      if (!Array.isArray(medias) || medias.length === 0) {
        errors.push(`${provider.name}: medias kosong`);
        continue;
      }

      raw = { data, result, medias };
      usedProvider = provider.name;
      break;
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }

  if (!raw) {
    throw new Error(`Semua provider gagal. Detail: ${errors.join(" | ")}`);
  }

  const { result, medias } = raw;

  // ── Terapkan filter ──
  let filtered = medias;

  if (typeFilter) {
    filtered = filtered.filter((m) => m.type === typeFilter);
  }
  if (extFilter) {
    filtered = filtered.filter((m) => m.extension === extFilter);
  }
  if (qualFilter) {
    filtered = filtered.filter(
      (m) => m.qualityLabel?.toLowerCase() === qualFilter.toLowerCase()
    );
  }

  // ── Sort: kualitas tertinggi dulu, lalu bitrate ──
  const qualityOrder = [
    "QUALITY_ORDINAL_2160P",
    "QUALITY_ORDINAL_1440P",
    "QUALITY_ORDINAL_1080P",
    "QUALITY_ORDINAL_720P",
    "QUALITY_ORDINAL_480P",
    "QUALITY_ORDINAL_360P",
    "QUALITY_ORDINAL_240P",
    "QUALITY_ORDINAL_144P",
    "QUALITY_ORDINAL_UNKNOWN",
  ];

  filtered.sort((a, b) => {
    const ai = qualityOrder.indexOf(a.qualityOrdinal ?? "QUALITY_ORDINAL_UNKNOWN");
    const bi = qualityOrder.indexOf(b.qualityOrdinal ?? "QUALITY_ORDINAL_UNKNOWN");
    if (ai !== bi) return ai - bi;
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  });

  // ── Normalisasi tiap media item ──
  const normalizedMedias = filtered.map((m) => ({
    itag:           m.itag          ?? null,
    type:           m.type          ?? "unknown",
    extension:      m.extension     ?? null,
    mimeType:       m.mimeType      ?? null,
    quality:        m.quality       ?? m.qualityLabel ?? null,
    qualityLabel:   m.qualityLabel  ?? null,
    label:          m.label         ?? null,
    width:          m.width         ?? null,
    height:         m.height        ?? null,
    fps:            m.fps           ?? null,
    bitrate:        m.bitrate       ?? m.averageBitrate ?? null,
    // has_audio true = stream video yang sudah include audio (misal itag 18 = 360p+audio)
    has_audio:      m.is_audio      ?? false,
    // is_audio true = pure audio stream (m4a, opus, webm audio)
    is_audio:       m.type === "audio",
    audio_quality:  m.audioQuality  ?? null,
    audio_sample:   m.audioSampleRate ?? null,
    content_length: m.contentLength ?? null,
    duration_ms:    m.approxDurationMs ?? null,
    url:            m.url,
  }));

  // ── Summary ──
  const videoFormats = normalizedMedias.filter((m) => m.type === "video");
  const audioFormats = normalizedMedias.filter((m) => m.is_audio);

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil semua format media.",
    provider: usedProvider,
    video: {
      id:           videoId,
      title:        result?.title    ?? null,
      author:       result?.author   ?? null,
      duration:     result?.duration ?? null,
      type:         isShorts ? "shorts" : "video",
      source_url:   sourceUrl,
      thumbnail_hq: thumbHQ,
      thumbnail_mq: thumbMQ,
      is_shorts:    isShorts,
    },
    summary: {
      total_formats:        normalizedMedias.length,
      video_formats:        videoFormats.length,
      audio_formats:        audioFormats.length,
      qualities_available:  [...new Set(videoFormats.map((m) => m.qualityLabel).filter(Boolean))],
      extensions_available: [...new Set(normalizedMedias.map((m) => m.extension).filter(Boolean))],
    },
    // Shortcut format terbaik tiap kategori
    best: {
      video_1080p: videoFormats.find((m) => m.qualityLabel === "1080p" && m.extension === "mp4") ?? null,
      video_720p:  videoFormats.find((m) => m.qualityLabel === "720p"  && m.extension === "mp4") ?? null,
      video_360p:  videoFormats.find((m) => m.qualityLabel === "360p"  && m.extension === "mp4" && m.has_audio) ?? null,
      audio_m4a:   audioFormats.find((m) => m.extension === "m4a")  ?? null,
      audio_opus:  audioFormats.find((m) => m.extension === "opus") ?? null,
    },
    medias: normalizedMedias,
  };
}
