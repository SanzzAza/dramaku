/**
 * Instagram Downloader API — via igdl.me (same approach as tikwm for TikTok)
 * GET /api/instagram?url=https://www.instagram.com/reel/...
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
    const result = await fetchInstagram(url);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Instagram]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal mengambil media.",
    });
  }
}

async function fetchInstagram(url) {
  const shortcode = url.match(/\/(p|reel|tv|stories)\/([^/?]+)/)?.[2] ?? null;

  // igdl.me — free public API, no key needed
  const apiUrl = `https://v3.igdownloader.app/api/ajaxSearch`;
  const body = new URLSearchParams({ recaptchaToken: "", q: url, t: "media", lang: "id" });

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://igdownloader.app/",
      "Origin": "https://igdownloader.app",
    },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`igdownloader responded ${resp.status}`);

  const json = await resp.json();

  if (json.status !== "ok") {
    throw new Error(json.message || "Gagal memproses URL Instagram.");
  }

  // Parse HTML response to extract media URLs
  const html = json.data || "";
  const videoUrls = [...html.matchAll(/href="(https:\/\/[^"]+\.mp4[^"]*)"/g)].map(m => m[1]);
  const imageUrls = [...html.matchAll(/src="(https:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/g)].map(m => m[1]);

  const primaryUrl = videoUrls[0] || imageUrls[0] || null;

  // Build items for carousel
  const items = [];
  videoUrls.forEach((u, i) => items.push({ index: i + 1, type: "video", url: u }));
  if (videoUrls.length === 0) {
    imageUrls.forEach((u, i) => items.push({ index: i + 1, type: "image", url: u }));
  }

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: { username: null, avatar: null, verified: null },
    video: {
      play: primaryUrl,
      hdplay: primaryUrl,
      wmplay: null,
      cover: imageUrls[0] || null,
      title: null,
      duration: null,
      filename: `instagram_${shortcode || "media"}.mp4`,
    },
    audio: { play: null, title: null, author: null },
    stats: { play_count: null, like_count: null, comment_count: null, share_count: null },
    ...(items.length > 1 ? { items } : {}),
    meta: { shortcode, source_url: url, thumbnail: imageUrls[0] || null, provider: "igdownloader" },
  };
}
