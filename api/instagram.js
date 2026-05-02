/**
 * Instagram Downloader API
 * Primary  : Instagram /embed/captioned/ (resmi, tanpa pihak ketiga)
 * Fallback 1: snapinsta.app
 * Fallback 2: saveig.app
 *
 * GET /api/instagram?url=https://www.instagram.com/reel/...
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

  // Normalisasi URL — buang query string agar embed bekerja
  let cleanUrl;
  try {
    const u = new URL(url);
    cleanUrl = `${u.origin}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return res.status(400).json({ status: false, code: 400, message: "URL tidak valid." });
  }

  const igRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\/.+/i;
  if (!igRegex.test(cleanUrl)) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "URL tidak valid. Masukkan link Instagram Post, Reel, atau IGTV.",
    });
  }

  const sources = [
    { name: "instagram_embed", fn: () => fetchViaEmbed(cleanUrl) },
    { name: "snapinsta",       fn: () => fetchViaSnapinsta(url) },
    { name: "saveig",          fn: () => fetchViaSaveIG(url) },
  ];

  const errors = [];

  for (const src of sources) {
    try {
      const result = await src.fn();
      return res.status(200).json(result);
    } catch (err) {
      console.error(`[Instagram][${src.name}] ${err.message}`);
      errors.push(`${src.name}: ${err.message}`);
    }
  }

  return res.status(500).json({
    status: false,
    code: 500,
    message: "Gagal mengambil media dari semua sumber.",
    errors,
  });
}

// ── SOURCE 1: Instagram Embed (resmi, tanpa API key) ─────────
async function fetchViaEmbed(baseUrl) {
  const embedUrl = `${baseUrl}/embed/captioned/`;

  const resp = await fetch(embedUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Referer": "https://www.instagram.com/",
    },
  });

  if (!resp.ok) throw new Error(`Instagram embed HTTP ${resp.status}`);

  const html = await resp.text();

  // Cari video URL
  let videoUrl = null;

  // Format 1: video_url di dalam JSON/script tag
  const videoJsonMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
  if (videoJsonMatch) {
    videoUrl = videoJsonMatch[1].replace(/\\u0026/g, "&").replace(/\\/g, "");
  }

  // Format 2: src di dalam <video> tag
  if (!videoUrl) {
    const videoTagMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i);
    if (videoTagMatch) videoUrl = videoTagMatch[1];
  }

  // Format 3: href ke .mp4
  if (!videoUrl) {
    const mp4Match = html.match(/href=["'](https?:\/\/[^"']+\.mp4[^"']*?)["']/i);
    if (mp4Match) videoUrl = mp4Match[1];
  }

  if (videoUrl) {
    // Cari thumbnail
    const posterMatch =
      html.match(/<video[^>]+poster=["']([^"']+)["']/i)?.[1] ||
      html.match(/"thumbnail_url"\s*:\s*"([^"]+)"/)?.[1]?.replace(/\\u0026/g, "&").replace(/\\/g, "");

    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: "video",
        url: decodeHtml(videoUrl),
        download_url: decodeHtml(videoUrl),
        thumbnail: posterMatch ? decodeHtml(posterMatch) : null,
      },
    };
  }

  // Cari image URL
  const imgMatch =
    html.match(/class="EmbeddedMediaImage"[^>]+src=["']([^"']+)["']/i) ||
    html.match(/"display_url"\s*:\s*"([^"]+)"/);

  if (imgMatch) {
    const imgUrl = imgMatch[1].replace(/\\u0026/g, "&").replace(/\\/g, "");
    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: "image",
        url: decodeHtml(imgUrl),
        download_url: decodeHtml(imgUrl),
        thumbnail: null,
      },
    };
  }

  throw new Error("Media tidak ditemukan di embed Instagram");
}

// ── SOURCE 2: snapinsta.app ──────────────────────────────────
async function fetchViaSnapinsta(url) {
  const homePage = await fetch("https://snapinsta.app/", {
    headers: { "User-Agent": UA },
  });
  const homeHtml = await homePage.text();

  const tokenMatch = homeHtml.match(/name="_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error("token tidak ditemukan di snapinsta");
  const token = tokenMatch[1];

  const body = new URLSearchParams({ q: url, t: "media", lang: "en", _token: token });

  const resp = await fetch("https://snapinsta.app/action.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Referer": "https://snapinsta.app/",
      "Origin": "https://snapinsta.app",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const json = await resp.json();
  if (!json?.data) throw new Error("respons kosong");

  return parseHtmlToResult(json.data);
}

// ── SOURCE 3: saveig.app ─────────────────────────────────────
async function fetchViaSaveIG(url) {
  const body = new URLSearchParams({ q: url, t: "media", lang: "en" });

  const resp = await fetch("https://v3.saveig.app/api/ajaxSearch", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Referer": "https://saveig.app/",
      "Origin": "https://saveig.app",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const json = await resp.json();
  if (!json?.data) throw new Error("respons kosong");

  return parseHtmlToResult(json.data);
}

// ── HELPERS ──────────────────────────────────────────────────
function parseHtmlToResult(html) {
  const sourceSrc   = html.match(/<source[^>]+src=["']([^"']+)["']/i)?.[1];
  const videoPoster = html.match(/<video[^>]+poster=["']([^"']+)["']/i)?.[1];
  const mp4Href     = html.match(/href=["'](https?:\/\/[^"']+\.mp4[^"']*?)["']/i)?.[1];
  const dlHref      = html.match(/<a[^>]+download[^>]*href=["']([^"']+)["']/i)?.[1]
                   || html.match(/href=["']([^"']+)["'][^>]*download/i)?.[1];
  const imgSrc      = html.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i)?.[1];

  const videoUrl = sourceSrc || mp4Href;

  if (videoUrl) {
    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: "video",
        url: clean(videoUrl),
        download_url: dlHref ? clean(dlHref) : clean(videoUrl),
        thumbnail: videoPoster ? clean(videoPoster) : null,
      },
    };
  }

  if (imgSrc) {
    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: "image",
        url: clean(imgSrc),
        download_url: dlHref ? clean(dlHref) : clean(imgSrc),
        thumbnail: null,
      },
    };
  }

  throw new Error(`Media tidak ditemukan. Snippet: ${html.slice(0, 200)}`);
}

function clean(str) {
  return str.replace(/\\"/g, "").replace(/\\\\"/g, "").trim();
}

function decodeHtml(str) {
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}
