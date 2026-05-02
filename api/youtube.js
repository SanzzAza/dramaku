/**
 * YouTube Downloader API — Multi-format via hub.ytconvert.org
 *
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 *
 * Fetch semua format secara paralel (mp3, mp4 360/720/1080p)
 * lalu return sekaligus dalam satu response.
 *
 * Filter opsional:
 *   &type=video|audio      → filter tipe
 *   &ext=mp3|mp4           → filter ekstensi
 *   &quality=720p|128kbps  → filter kualitas
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const API_BASE = "https://hub.ytconvert.org";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
  "User-Agent": UA,
  "Referer": "https://ytconvert.org/",
  "Origin": "https://ytconvert.org",
  "Content-Type": "application/json",
  "Accept": "application/json",
};

// Semua kombinasi format yang akan di-fetch paralel
const FORMAT_TARGETS = [
  { type: "audio", format: "mp3", quality: "128",  label: "mp3 (128kbps)",  ext: "mp3" },
  { type: "audio", format: "mp3", quality: "192",  label: "mp3 (192kbps)",  ext: "mp3" },
  { type: "audio", format: "mp3", quality: "320",  label: "mp3 (320kbps)",  ext: "mp3" },
  { type: "video", format: "mp4", quality: "360",  label: "mp4 (360p)",     ext: "mp4" },
  { type: "video", format: "mp4", quality: "480",  label: "mp4 (480p)",     ext: "mp4" },
  { type: "video", format: "mp4", quality: "720",  label: "mp4 (720p)",     ext: "mp4" },
  { type: "video", format: "mp4", quality: "1080", label: "mp4 (1080p)",    ext: "mp4" },
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
  const typeFilter = req.query.type    || req.body?.type    || null;
  const extFilter  = req.query.ext     || req.body?.ext     || null;
  const qualFilter = req.query.quality || req.body?.quality || null;

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      filters: "Opsional: &type=video|audio  &ext=mp3|mp4  &quality=720p|128kbps",
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

  // Tentukan targets berdasarkan filter (kalau ada filter, cuma fetch yang relevan)
  let targets = FORMAT_TARGETS;
  if (typeFilter) targets = targets.filter((t) => t.type === typeFilter);
  if (extFilter)  targets = targets.filter((t) => t.ext  === extFilter);
  if (qualFilter) {
    const q = qualFilter.toLowerCase().replace("p", "").replace("kbps", "");
    targets = targets.filter((t) => t.quality === q);
  }

  if (targets.length === 0) {
    throw new Error("Tidak ada format yang cocok dengan filter yang diberikan.");
  }

  // Fetch semua format secara paralel
  // Tiap format: submit job → polling status → return downloadUrl
  const results = await Promise.allSettled(
    targets.map((target) => fetchOneFormat(videoId, target))
  );

  // Kumpulkan yang berhasil
  let medias = [];
  let sharedMeta = null;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const t = targets[i];
    if (r.status === "fulfilled" && r.value) {
      const { meta, media } = r.value;
      if (!sharedMeta && meta) sharedMeta = meta;
      medias.push(media);
    } else {
      console.warn(`[YouTube] Format ${t.label} gagal:`, r.reason?.message ?? r.reason);
    }
  }

  if (medias.length === 0) {
    throw new Error("Semua format gagal diambil. Server mungkin sedang down atau URL tidak valid.");
  }

  const videoFormats = medias.filter((m) => m.type === "video");
  const audioFormats = medias.filter((m) => m.type === "audio");

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    video: {
      id:           videoId,
      title:        sharedMeta?.title    ?? null,
      author:       sharedMeta?.author   ?? null,
      duration:     sharedMeta?.duration ?? null,
      type:         isShorts ? "shorts" : "video",
      source_url:   sourceUrl,
      thumbnail_hq: thumbHQ,
      thumbnail_mq: thumbMQ,
      is_shorts:    isShorts,
    },
    summary: {
      total_formats:        medias.length,
      video_formats:        videoFormats.length,
      audio_formats:        audioFormats.length,
      qualities_available:  [...new Set(videoFormats.map((m) => m.qualityLabel).filter(Boolean))],
      extensions_available: [...new Set(medias.map((m) => m.extension).filter(Boolean))],
    },
    best: {
      video_1080p: videoFormats.find((m) => m.qualityLabel === "1080p") ?? null,
      video_720p:  videoFormats.find((m) => m.qualityLabel === "720p")  ?? null,
      video_360p:  videoFormats.find((m) => m.qualityLabel === "360p")  ?? null,
      audio_320:   audioFormats.find((m) => m.quality === "320kbps")    ?? null,
      audio_128:   audioFormats.find((m) => m.quality === "128kbps")    ?? null,
    },
    medias,
  };
}

// ─── Fetch satu format: submit + polling ──────────────────────────────────────

async function fetchOneFormat(videoId, target) {
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Step 1: Submit job
  const payload = {
    url: sourceUrl,
    output: {
      type: target.type,
      format: target.format,
      quality: target.quality,
    },
  };

  const submitResp = await fetch(`${API_BASE}/api/download`, {
    method: "POST",
    headers: FETCH_HEADERS,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000),
  });

  if (!submitResp.ok) {
    throw new Error(`Submit gagal (${target.label}): HTTP ${submitResp.status}`);
  }

  const submitData = await submitResp.json();

  // Kalau langsung completed
  if (submitData?.status === "completed" && submitData?.downloadUrl) {
    return buildFormatResult(target, submitData, submitData);
  }

  const statusUrl = submitData?.statusUrl;
  if (!statusUrl) {
    throw new Error(`Tidak ada statusUrl untuk format ${target.label}`);
  }

  // Step 2: Polling — max 6x × 1.5 detik = 9 detik per format
  // (paralel semua format, jadi total waktu ≈ waktu format terlama ≤ ~15 detik)
  const MAX_ATTEMPTS = 6;
  const POLL_DELAY   = 1_500;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_DELAY);

    const statusResp = await fetch(statusUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8_000),
    });

    if (!statusResp.ok) continue;

    const statusData = await statusResp.json();
    const status = statusData?.status;

    if (status === "completed" && statusData?.downloadUrl) {
      return buildFormatResult(target, submitData, statusData);
    }

    if (status === "failed" || status === "error") {
      throw new Error(`Konversi ${target.label} gagal: ${statusData?.message ?? "unknown"}`);
    }
  }

  throw new Error(`Timeout untuk format ${target.label}`);
}

// ─── Build normalized format object ──────────────────────────────────────────

function buildFormatResult(target, submitData, statusData) {
  const isAudio = target.type === "audio";
  const title   = submitData?.title ?? statusData?.title ?? null;

  return {
    meta: {
      title,
      author:   submitData?.author   ?? null,
      duration: submitData?.duration ?? null,
    },
    media: {
      type:         target.type,
      extension:    target.ext,
      format:       target.format,
      quality:      isAudio ? `${target.quality}kbps` : `${target.quality}p`,
      qualityLabel: isAudio ? `${target.quality}kbps` : `${target.quality}p`,
      label:        target.label,
      is_audio:     isAudio,
      file_size:    statusData?.fileSize ?? null,
      url:          statusData?.downloadUrl,
      filename: `${(title ?? "youtube").slice(0, 80).replace(/[\\/:*?"<>|]/g, "_")}.${target.ext}`,
    },
  };
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
