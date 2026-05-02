/**
 * Instagram Downloader API — Primary: sssinstagram.com
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
    { name: "sssinstagram", fn: () => fetchViaSSSInstagram(url) },
    { name: "snapinsta",    fn: () => fetchViaSnapinsta(url) },
    { name: "saveig",       fn: () => fetchViaSaveIG(url) },
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

// ── SOURCE 1: sssinstagram.com ───────────────────────────────
async function fetchViaSSSInstagram(url) {
  const resp = await fetch("https://sssinstagram.com/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA_DESKTOP,
      "Referer": "https://sssinstagram.com/",
      "Origin": "https://sssinstagram.com",
    },
    body: JSON.stringify({ link: url, auto_proxy: 0 }),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const json = await resp.json();

  if (!json?.status || !json?.result) {
    throw new Error(json?.message || "Respons tidak valid");
  }

  const r = json.result;

  // Tentukan tipe: video atau image
  const isVideo = Array.isArray(r.videos) && r.videos.length > 0;
  const isImage = Array.isArray(r.images) && r.images.length > 0;

  if (isVideo) {
    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: "video",
        url: r.videos[0],
        download_url: r.videos[0],
        thumbnail: r.thumb || null,
        username: r.username || null,
        // Audio (mp3) jika ada
        audio: r.mp3?.[0]?.url || null,
      },
    };
  }

  if (isImage) {
    // Bisa multi-image (carousel)
    return {
      status: true,
      code: 200,
      message: "Berhasil mengambil data media.",
      result: {
        type: "image",
        url: r.images[0],
        download_url: r.images[0],
        // Kalau carousel, kasih semua
        images: r.images.length > 1 ? r.images : undefined,
        thumbnail: r.thumb || null,
        username: r.username || null,
      },
    };
  }

  throw new Error("Tidak ada video atau gambar dalam respons");
}

// ── SOURCE 2: snapinsta.app ──────────────────────────────────
async function fetchViaSnapinsta(url) {
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

// ── SOURCE 3: saveig.app ─────────────────────────────────────
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
