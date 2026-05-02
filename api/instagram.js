/**
 * Instagram Downloader API — via Cobalt API (no binary needed, works on Vercel)
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
    const result = await fetchViaCobalt(url);
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

async function fetchViaCobalt(url) {
  const shortcode = url.match(/\/(p|reel|tv|stories)\/([^/?]+)/)?.[2] ?? null;

  // Cobalt API — free, no API key needed
  const cobaltRes = await fetch("https://api.cobalt.tools/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      url,
      downloadMode: "auto",
    }),
  });

  if (!cobaltRes.ok) {
    throw new Error(`Cobalt API responded ${cobaltRes.status}`);
  }

  const cobalt = await cobaltRes.json();

  if (cobalt.status === "error") {
    throw new Error(cobalt.error?.code || "Media tidak dapat diproses.");
  }

  // Cobalt bisa return "stream", "redirect", atau "picker" (carousel/multiple)
  let mediaUrl = null;
  let mediaItems = null;

  if (cobalt.status === "picker" && cobalt.picker?.length) {
    // Instagram carousel — return semua item
    mediaItems = cobalt.picker.map((item, i) => ({
      index: i + 1,
      type: item.type || "video",
      url: item.url || null,
      thumb: item.thumb || null,
    }));
    mediaUrl = cobalt.picker[0]?.url || null;
  } else {
    mediaUrl = cobalt.url || null;
  }

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: null,
      avatar: null,
      verified: null,
    },
    video: {
      play: mediaUrl,
      hdplay: mediaUrl,
      wmplay: null,
      cover: null,
      title: null,
      duration: null,
      filename: `instagram_${shortcode || "media"}.mp4`,
    },
    audio: {
      play: null,
      title: null,
      author: null,
    },
    stats: {
      play_count: null,
      like_count: null,
      comment_count: null,
      share_count: null,
    },
    // Untuk carousel/multi-media post
    ...(mediaItems ? { items: mediaItems } : {}),
    meta: {
      shortcode,
      source_url: url,
      thumbnail: null,
      provider: "cobalt",
    },
  };
}
