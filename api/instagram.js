/**
 * Instagram Downloader API
 * Pakai: cheerio (HTML parser) + Instagram embed endpoint
 *
 * GET /api/instagram?url=https://www.instagram.com/reel/...
 */

import * as cheerio from "cheerio";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/instagram?url=https://www.instagram.com/reel/ABC123/",
    });
  }

  const igRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\/.+/i;
  if (!igRegex.test(url)) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "URL tidak valid. Masukkan link Instagram Post, Reel, atau IGTV.",
    });
  }

  try {
    const result = await fetchViaEmbed(url);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Instagram]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mengambil data media.",
    });
  }
}

async function fetchViaEmbed(url) {
  // Normalisasi: buang query string, pastikan tidak ada trailing slash ganda
  const cleanUrl = url.split("?")[0].replace(/\/$/, "");
  const embedUrl = `${cleanUrl}/embed/captioned/`;

  const resp = await fetch(embedUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.instagram.com/",
    },
  });

  if (!resp.ok) throw new Error(`Instagram embed HTTP ${resp.status}`);

  const html = await resp.text();
  const $ = cheerio.load(html);

  // ── Cari video ──────────────────────────────────────────
  // 1. video_url di dalam JSON (paling reliable)
  let videoUrl = null;
  const scriptTags = $("script").toArray();
  for (const script of scriptTags) {
    const content = $(script).html() || "";
    const match = content.match(/"video_url"\s*:\s*"([^"]+)"/);
    if (match) {
      videoUrl = decodeUnicode(match[1]);
      break;
    }
  }

  // 2. <video src> atau <source src>
  if (!videoUrl) {
    videoUrl = $("video source").attr("src") || $("video").attr("src") || null;
  }

  // 3. href ke .mp4
  if (!videoUrl) {
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes(".mp4")) { videoUrl = href; return false; }
    });
  }

  if (videoUrl) {
    const thumbnail =
      $("video").attr("poster") ||
      extractFromScript(scriptTags, $, "thumbnail_url") ||
      null;

    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: "video",
        url: videoUrl,
        download_url: videoUrl,
        thumbnail: thumbnail ? decodeUnicode(thumbnail) : null,
      },
    };
  }

  // ── Cari image ──────────────────────────────────────────
  // 1. display_url di script
  let imgUrl = extractFromScript(scriptTags, $, "display_url");

  // 2. .EmbeddedMediaImage
  if (!imgUrl) {
    imgUrl = $("img.EmbeddedMediaImage").attr("src") || null;
  }

  // 3. img src terbesar
  if (!imgUrl) {
    $("img[src]").each((_, el) => {
      const src = $(el).attr("src") || "";
      if (src.startsWith("https://") && !src.includes("profile")) {
        imgUrl = src;
        return false;
      }
    });
  }

  if (imgUrl) {
    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: "image",
        url: decodeUnicode(imgUrl),
        download_url: decodeUnicode(imgUrl),
        thumbnail: null,
      },
    };
  }

  throw new Error("Media tidak ditemukan di embed Instagram. Pastikan postingan bersifat publik.");
}

function extractFromScript(scriptTags, $, key) {
  for (const script of scriptTags) {
    const content = $(script).html() || "";
    const match = content.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
    if (match) return match[1];
  }
  return null;
}

function decodeUnicode(str) {
  return str
    .replace(/\\u0026/g, "&")
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}
