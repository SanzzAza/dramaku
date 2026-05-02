/**
 * Instagram Downloader API — No external dependencies
 * Supports: Post, Reel, Story, IGTV
 * GET /api/instagram?url=https://www.instagram.com/p/...
 */

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

  if (!url) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/instagram?url=https://www.instagram.com/p/ABC123/",
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

  // Try each fetcher in order, return first success
  const fetchers = [fetchViaIgram, fetchViaSnapinsta];

  for (const fetcher of fetchers) {
    try {
      const data = await fetcher(url);
      if (data) return res.status(200).json(data);
    } catch (err) {
      console.warn(`[Instagram] ${fetcher.name} failed:`, err.message);
    }
  }

  return res.status(500).json({
    status: false,
    code: 500,
    message: "Semua sumber gagal. Pastikan link benar dan akun tidak private.",
  });
}

// ── FETCHER 1: igram.world ──
async function fetchViaIgram(url) {
  const apiUrl = "https://igram.world/api/convert";

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Origin": "https://igram.world",
      "Referer": "https://igram.world/",
    },
    body: new URLSearchParams({ url }),
  });

  if (!resp.ok) throw new Error(`igram responded ${resp.status}`);

  const json = await resp.json();

  if (!json || !json.items || json.items.length === 0) {
    throw new Error("No media found from igram");
  }

  const items = json.items.map((item, i) => ({
    index: i + 1,
    type: item.type === "video" ? "video" : "image",
    url: item.url || null,
    thumbnail: item.thumbnail || null,
  }));

  return buildResponse(url, items);
}

// ── FETCHER 2: snapinsta.app ──
async function fetchViaSnapinsta(url) {
  // Step 1: get token
  const homeResp = await fetch("https://snapinsta.app/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const homeHtml = await homeResp.text();
  const tokenMatch = homeHtml.match(/name="_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error("Token not found");

  const token = tokenMatch[1];

  // Step 2: POST with token
  const resp = await fetch("https://snapinsta.app/action.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Origin": "https://snapinsta.app",
      "Referer": "https://snapinsta.app/",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({ url, _token: token }),
  });

  if (!resp.ok) throw new Error(`snapinsta responded ${resp.status}`);

  const json = await resp.json();

  // Parse HTML response from snapinsta
  const html = json.data || "";
  const videoUrls = [...html.matchAll(/href="(https:\/\/[^"]+\.mp4[^"]*)"/g)].map(m => m[1]);
  const imageUrls = [...html.matchAll(/href="(https:\/\/[^"]+\.(jpg|jpeg|webp)[^"]*)"/g)].map(m => m[1]);

  const allUrls = videoUrls.length > 0 ? videoUrls : imageUrls;
  if (allUrls.length === 0) throw new Error("No media found from snapinsta");

  const items = allUrls.map((u, i) => ({
    index: i + 1,
    type: videoUrls.length > 0 ? "video" : "image",
    url: u,
    thumbnail: null,
  }));

  return buildResponse(url, items);
}

// ── BUILD UNIFIED RESPONSE ──
function buildResponse(sourceUrl, items) {
  const isVideo = items.some(i => i.type === "video");
  const isMulti = items.length > 1;

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    meta: {
      type: isMulti ? "carousel" : isVideo ? "video" : "image",
      total_media: items.length,
      source_url: sourceUrl,
    },
    media: items,
  };
}
