/**
 * YouTube Downloader API — via youtubei.js (no 3rd party services)
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 * GET /api/youtube?url=...&quality=720        (360, 480, 720, 1080)
 * GET /api/youtube?url=...&audio_only=true    (mp3/audio)
 */

import { Innertube } from "youtubei.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Singleton agar tidak init ulang tiap request
let _yt = null;
async function getInnertube() {
  if (!_yt) {
    _yt = await Innertube.create({
      retrieve_player: true,
      generate_session_locally: true,
    });
  }
  return _yt;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const url       = req.query.url       || req.body?.url;
  const quality   = req.query.quality   || req.body?.quality   || "720";
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

// ── Pilih format video terbaik sesuai quality yang diminta ──
function pickVideoFormat(formats, targetQuality) {
  const order = [targetQuality, "1080", "720", "480", "360", "240"];

  for (const q of order) {
    const label = `${q}p`;
    const match = formats.find(
      (f) =>
        f.quality_label === label &&
        f.url &&
        (f.mime_type?.includes("video/mp4") || f.mime_type?.includes("video/webm"))
    );
    if (match) return { format: match, resolvedQuality: q };
  }

  const fallback = formats.find((f) => f.mime_type?.includes("video") && f.url);
  return fallback
    ? { format: fallback, resolvedQuality: fallback.quality_label || "auto" }
    : { format: null, resolvedQuality: "auto" };
}

// ── Pilih format audio terbaik ──
function pickAudioFormat(adaptiveFormats) {
  return adaptiveFormats
    .filter((f) => f.mime_type?.includes("audio/") && f.url)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null;
}

async function fetchYoutube(url, quality, audioOnly) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts = /\/shorts\//i.test(url);

  const yt    = await getInnertube();
  const info  = await yt.getBasicInfo(videoId);
  const basic = info.basic_info;
  const streaming = info.streaming_data;

  if (!streaming) throw new Error("Streaming data tidak tersedia untuk video ini.");

  const formats         = streaming.formats         || [];
  const adaptiveFormats = streaming.adaptive_formats || [];

  // Thumbnail terbaik
  const thumbs    = basic.thumbnail || [];
  const bestThumb = thumbs.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  const thumbHQ   = bestThumb?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const channelId  = basic.channel_id || null;
  const channelUrl = channelId ? `https://www.youtube.com/channel/${channelId}` : null;

  const safeTitle = basic.title
    ? basic.title.slice(0, 50).replace(/[\\/:*?"<>|]/g, "_")
    : `youtube_${videoId}`;

  // ── Audio only ──
  if (audioOnly) {
    const audioFmt = pickAudioFormat(adaptiveFormats);
    if (!audioFmt?.url) throw new Error("Format audio tidak tersedia.");

    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      author: {
        username: basic.author || null,
        avatar: null,
        channel_url: channelUrl,
      },
      video: {
        id: videoId,
        title: basic.title || null,
        duration: basic.duration || null,
        type: isShorts ? "shorts" : "video",
        quality: null,
        play: null,
        audio_only: audioFmt.url,
        cover: thumbHQ,
        filename: `${safeTitle}.mp3`,
      },
      audio: {
        play: audioFmt.url,
        bitrate: audioFmt.bitrate || null,
        mime_type: audioFmt.mime_type || null,
        title: null,
        author: basic.author || null,
      },
      stats: {
        view_count: basic.view_count || null,
        like_count: basic.like_count || null,
        comment_count: null,
        is_live: basic.is_live || false,
      },
      meta: {
        video_id: videoId,
        source_url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail_hq: thumbHQ,
        thumbnail_mq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        is_shorts: isShorts,
        provider: "youtubei.js",
      },
    };
  }

  // ── Video mode: coba muxed dulu (video+audio 1 file) ──
  let videoUrl = null;
  let audioUrl = null;
  let resolvedQuality = quality;
  let note = "";

  const { format: muxedFmt, resolvedQuality: muxedQ } = pickVideoFormat(formats, quality);

  if (muxedFmt?.url) {
    videoUrl = muxedFmt.url;
    resolvedQuality = muxedQ;
    note = "muxed — video+audio dalam 1 file";
  } else {
    // Fallback adaptive (video dan audio terpisah)
    const { format: adaptiveVideo, resolvedQuality: adaptiveQ } = pickVideoFormat(adaptiveFormats, quality);
    const audioFmt = pickAudioFormat(adaptiveFormats);

    if (!adaptiveVideo?.url) throw new Error("Format video tidak tersedia.");

    videoUrl = adaptiveVideo.url;
    audioUrl = audioFmt?.url || null;
    resolvedQuality = adaptiveQ;
    note = "adaptive — video dan audio terpisah, perlu di-mux oleh client";
  }

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: basic.author || null,
      avatar: null,
      channel_url: channelUrl,
    },
    video: {
      id: videoId,
      title: basic.title || null,
      duration: basic.duration || null,
      type: isShorts ? "shorts" : "video",
      quality: resolvedQuality,
      play: videoUrl,
      audio_only: audioUrl,
      cover: thumbHQ,
      filename: `${safeTitle}.mp4`,
      note,
    },
    audio: {
      play: audioUrl,
      title: null,
      author: basic.author || null,
    },
    stats: {
      view_count: basic.view_count || null,
      like_count: basic.like_count || null,
      comment_count: null,
      is_live: basic.is_live || false,
    },
    meta: {
      video_id: videoId,
      source_url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail_hq: thumbHQ,
      thumbnail_mq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      is_shorts: isShorts,
      provider: "youtubei.js",
    },
  };
}
