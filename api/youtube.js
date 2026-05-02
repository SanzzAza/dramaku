/**
 * YouTube Downloader API — via youtubei.js
 * GET /api/youtube?url=https://www.youtube.com/watch?v=...
 * GET /api/youtube?url=...&quality=720        (360, 480, 720, 1080)
 * GET /api/youtube?url=...&audio_only=true
 */

import { Innertube, ClientType } from "youtubei.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

let _yt = null;
async function getInnertube() {
  if (!_yt) {
    _yt = await Innertube.create({
      retrieve_player: false,       // skip player JS fetch (yang sering 403)
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
    const result = await fetchYoutube(url, quality, audioOnly);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[YouTube]", err.message);
    return res.status(500).json({
      status: false, code: 500,
      message: err.message || "Gagal mengambil media.",
    });
  }
}

async function fetchYoutube(url, quality, audioOnly) {
  const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Tidak dapat mengambil video ID dari URL.");

  const isShorts = /\/shorts\//i.test(url);
  const yt = await getInnertube();

  // Gunakan ANDROID client — paling reliable untuk dapat streaming URL langsung
  const info = await yt.getBasicInfo(videoId, 'ANDROID');

  const basic     = info.basic_info;
  const streaming = info.streaming_data;

  // Jika ANDROID gagal, coba TV_EMBEDDED sebagai fallback
  if (!streaming) {
    const info2 = await yt.getBasicInfo(videoId, 'TV_EMBEDDED');
    if (!info2.streaming_data) {
      throw new Error("Streaming data tidak tersedia. Video mungkin private, region-locked, atau age-restricted.");
    }
    return buildResult({ videoId, isShorts, basic: info2.basic_info, streaming: info2.streaming_data, quality, audioOnly });
  }

  return buildResult({ videoId, isShorts, basic, streaming, quality, audioOnly });
}

function pickVideoFormat(formats, targetQuality) {
  const priorities = [targetQuality, "1080", "720", "480", "360", "240"];
  for (const q of priorities) {
    const match = formats.find(
      f => f.quality_label === `${q}p` && f.url &&
           (f.mime_type?.includes("video/mp4") || f.mime_type?.includes("video/webm"))
    );
    if (match) return { format: match, resolvedQuality: q };
  }
  const fallback = formats.find(f => f.mime_type?.includes("video") && f.url);
  return { format: fallback || null, resolvedQuality: fallback?.quality_label || "auto" };
}

function pickAudioFormat(formats) {
  return formats
    .filter(f => f.mime_type?.includes("audio/") && f.url)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null;
}

function buildResult({ videoId, isShorts, basic, streaming, quality, audioOnly }) {
  const formats         = streaming.formats         || [];
  const adaptiveFormats = streaming.adaptive_formats || [];

  const thumbs    = basic.thumbnail || [];
  const bestThumb = thumbs.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  const thumbHQ   = bestThumb?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const channelUrl = basic.channel_id
    ? `https://www.youtube.com/channel/${basic.channel_id}`
    : null;

  const safeTitle = (basic.title || `youtube_${videoId}`)
    .slice(0, 50)
    .replace(/[\\/:*?"<>|]/g, "_");

  const stats = {
    view_count:    basic.view_count    || null,
    like_count:    basic.like_count    || null,
    comment_count: null,
    is_live:       basic.is_live       || false,
  };

  const meta = {
    video_id:      videoId,
    source_url:    `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail_hq:  thumbHQ,
    thumbnail_mq:  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    is_shorts:     isShorts,
    provider:      "youtubei.js",
  };

  // ── Audio only ──
  if (audioOnly) {
    const audioFmt = pickAudioFormat(adaptiveFormats);
    if (!audioFmt?.url) throw new Error("Format audio tidak tersedia.");

    return {
      status: true, code: 200,
      message: "Berhasil mengambil data media.",
      author:  { username: basic.author || null, avatar: null, channel_url: channelUrl },
      video:   {
        id: videoId, title: basic.title || null, duration: basic.duration || null,
        type: isShorts ? "shorts" : "video", quality: null,
        play: null, audio_only: audioFmt.url, cover: thumbHQ,
        filename: `${safeTitle}.mp3`,
      },
      audio: { play: audioFmt.url, bitrate: audioFmt.bitrate || null, mime_type: audioFmt.mime_type || null, author: basic.author || null },
      stats, meta,
    };
  }

  // ── Video: coba muxed dulu ──
  const { format: muxed, resolvedQuality: muxedQ } = pickVideoFormat(formats, quality);

  if (muxed?.url) {
    return {
      status: true, code: 200,
      message: "Berhasil mengambil data media.",
      author:  { username: basic.author || null, avatar: null, channel_url: channelUrl },
      video: {
        id: videoId, title: basic.title || null, duration: basic.duration || null,
        type: isShorts ? "shorts" : "video", quality: muxedQ,
        play: muxed.url, audio_only: null, cover: thumbHQ,
        filename: `${safeTitle}.mp4`,
        note: "muxed — video+audio dalam 1 file",
      },
      audio: { play: null, author: basic.author || null },
      stats, meta,
    };
  }

  // ── Fallback adaptive ──
  const { format: adaptiveVideo, resolvedQuality: adaptiveQ } = pickVideoFormat(adaptiveFormats, quality);
  const audioFmt = pickAudioFormat(adaptiveFormats);

  if (!adaptiveVideo?.url) throw new Error("Format video tidak tersedia.");

  return {
    status: true, code: 200,
    message: "Berhasil mengambil data media.",
    author:  { username: basic.author || null, avatar: null, channel_url: channelUrl },
    video: {
      id: videoId, title: basic.title || null, duration: basic.duration || null,
      type: isShorts ? "shorts" : "video", quality: adaptiveQ,
      play: adaptiveVideo.url, audio_only: audioFmt?.url || null, cover: thumbHQ,
      filename: `${safeTitle}.mp4`,
      note: "adaptive — video dan audio terpisah",
    },
    audio: { play: audioFmt?.url || null, author: basic.author || null },
    stats, meta,
  };
}
