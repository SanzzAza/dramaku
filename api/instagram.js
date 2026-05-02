/**
 * Instagram Downloader API — Multi-source fallback
 * Primary  : snapinsta.app
 * Fallback 1: saveig.app
 * Fallback 2: downloadgram.org (format baru + lama)
 *
 * GET /api/instagram?url=https://www.instagram.com/reel/...
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const UA_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const UA_MOBILE =
  "Mozilla/5.0 (Android 13; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0";

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

  const sources = [
    { name: "snapinsta",    fn: () => fetchViaSnapinsta(url) },
    { name: "saveig",       fn: () => fetchViaSaveIG(url) },
    { name: "downloadgram", fn: () => fetchViaDownloadgram(url) },
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

// ── SOURCE 1: snapinsta.app ──────────────────────────────────
async function fetchViaSnapinsta(url) {
  // Ambil CSRF token dari halaman utama
  const homePage = await fetch("https://snapinsta.app/", {
    headers: { "User-Agent": UA_DESKTOP },
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
      "User-Agent": UA_MOBILE,
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

// ── SOURCE 2: saveig.app ─────────────────────────────────────
async function fetchViaSaveIG(url) {
  const body = new URLSearchParams({ q: url, t: "media", lang: "en" });

  const resp = await fetch("https://v3.saveig.app/api/ajaxSearch", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA_MOBILE,
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

// ── SOURCE 3: downloadgram.org ───────────────────────────────
async function fetchViaDownloadgram(url) {
  const body = new URLSearchParams({ url, v: "3", lang: "en" });

  const resp = await fetch("https://api.downloadgram.org/media", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA_MOBILE,
      "accept-language": "id-ID,id;q=0.9,en;q=0.8",
      "Referer": "https://downloadgram.org/",
      "Origin": "https://downloadgram.org",
    },
    body,
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const raw = await resp.text();

  // Format baru: JSON langsung
  if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
    try {
      const json = JSON.parse(raw);
      const mediaUrl = json?.url || json?.data?.url || json?.links?.[0]?.url || json?.result?.url;
      if (mediaUrl) {
        const isVideo = /\.mp4|video/i.test(mediaUrl);
        return buildResult(
          isVideo ? "video" : "image",
          mediaUrl,
          mediaUrl,
          json?.thumbnail || json?.cover || null
        );
      }
    } catch (_) {}
  }

  // Format lama: JS string ['innerHTML'] = '...'
  const innerMatch = raw.match(/\['innerHTML'\]\s*=\s*'([\s\S]+?)'\s*(?:,|;|$)/);
  if (innerMatch) {
    const html = innerMatch[1]
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "");
    return parseHtmlToResult(html);
  }

  // Format baru 2: response langsung HTML
  if (raw.includes("<video") || raw.includes("<img") || raw.includes("href=")) {
    return parseHtmlToResult(raw);
  }

  throw new Error(`Format response tidak dikenali. Snippet: ${raw.slice(0, 200)}`);
}

// ── PARSER HTML UNIVERSAL ─────────────────────────────────────
function parseHtmlToResult(html) {
  const sourceSrc   = html.match(/<source[^>]+src=["']([^"']+)["']/i)?.[1];
  const videoPoster = html.match(/<video[^>]+poster=["']([^"']+)["']/i)?.[1];
  const mp4Href     = html.match(/href=["'](https?:\/\/[^"']+\.mp4[^"']*?)["']/i)?.[1];
  const dlHref      = html.match(/<a[^>]+download[^>]*href=["']([^"']+)["']/i)?.[1]
                   || html.match(/href=["']([^"']+)["'][^>]*download/i)?.[1];
  const imgSrc      = html.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i)?.[1];

  const videoUrl = sourceSrc || mp4Href;

  if (videoUrl) {
    return buildResult(
      "video",
      clean(videoUrl),
      dlHref ? clean(dlHref) : clean(videoUrl),
      videoPoster ? clean(videoPoster) : null
    );
  }

  if (imgSrc) {
    return buildResult(
      "image",
      clean(imgSrc),
      dlHref ? clean(dlHref) : clean(imgSrc),
      null
    );
  }

  throw new Error(`Media tidak ditemukan dalam HTML. Snippet: ${html.slice(0, 200)}`);
}

function buildResult(type, url, download_url, thumbnail) {
  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    result: { type, url, download_url, thumbnail },
  };
}

function clean(str) {
  return str.replace(/\\"/g, "").replace(/\\\\"/g, "").trim();
}
