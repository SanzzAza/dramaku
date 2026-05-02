/**
 * Instagram Downloader API — via Instagram internal GraphQL API
 * Sama seperti yang dipakai browser Instagram, tanpa auth
 * GET /api/instagram?url=https://www.instagram.com/reel/...
 */

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
  // Ekstrak shortcode dari URL
  const shortcode = url.match(/\/(p|reel|tv|stories)\/([^/?]+)/)?.[2];
  if (!shortcode) throw new Error("Tidak dapat mengambil shortcode dari URL.");

  // Step 1: Ambil csrf token dari halaman Instagram
  const pageResp = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
    },
  });

  const html = await pageResp.text();

  // Ambil csrf token dari cookies atau HTML
  let csrfToken = "missing";
  const csrfMatch = html.match(/"csrf_token"\s*:\s*"([^"]+)"/);
  if (csrfMatch) csrfToken = csrfMatch[1];

  // Ambil cookies dari response
  const setCookie = pageResp.headers.get("set-cookie") || "";
  const cookieHeader = setCookie
    .split(",")
    .map(c => c.split(";")[0].trim())
    .join("; ");

  // Step 2: Hit Instagram GraphQL API
  const variables = JSON.stringify({ shortcode });
  const payload = `variables=${encodeURIComponent(variables)}&doc_id=24368985919464652`;

  const gqlResp = await fetch("https://www.instagram.com/graphql/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "X-CSRFToken": csrfToken,
      "X-IG-App-ID": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `https://www.instagram.com/p/${shortcode}/`,
      "Origin": "https://www.instagram.com",
      "Cookie": cookieHeader || `csrftoken=${csrfToken}`,
    },
    body: payload,
  });

  if (!gqlResp.ok) {
    throw new Error(`Instagram GraphQL responded ${gqlResp.status}`);
  }

  const gql = await gqlResp.json();

  // Parse response
  const items = gql?.data?.xdt_api__v1__media__shortcode__web_info?.items;
  if (!items || items.length === 0) {
    throw new Error("Media tidak ditemukan. Pastikan link public dan valid.");
  }

  const item = items[0];

  // Pilih video URL kualitas terbaik
  const videoVersions = item.video_versions || [];
  const bestVideo = videoVersions.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  const videoUrl = bestVideo?.url || null;

  // Thumbnail
  const imageVersions = item.image_versions2?.candidates || [];
  const bestThumb = imageVersions.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  const thumbUrl = bestThumb?.url || null;

  // Caption
  const caption = item.caption?.text || null;

  // User info
  const user = item.user || {};

  // Handle carousel (multi-media post)
  let mediaItems = null;
  if (item.carousel_media && item.carousel_media.length > 0) {
    mediaItems = item.carousel_media.map((m, i) => {
      const vUrl = m.video_versions?.[0]?.url || null;
      const iUrl = m.image_versions2?.candidates?.[0]?.url || null;
      return {
        index: i + 1,
        type: vUrl ? "video" : "image",
        url: vUrl || iUrl,
        thumb: m.image_versions2?.candidates?.[0]?.url || null,
      };
    });
  }

  return {
    author: "@SanzXD",
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    author: {
      username: user.username || null,
      full_name: user.full_name || null,
      avatar: user.profile_pic_url || null,
      verified: user.is_verified || false,
    },
    video: {
      play: videoUrl,
      hdplay: videoUrl,
      wmplay: null,
      cover: thumbUrl,
      title: caption ? caption.slice(0, 150) : null,
      duration: item.video_duration || null,
      width: bestVideo?.width || null,
      height: bestVideo?.height || null,
      filename: `instagram_${shortcode}.mp4`,
    },
    audio: {
      play: null,
      title: item.music_metadata?.music_info?.music_asset_info?.title
          || item.clips_metadata?.original_sound_info?.original_audio_title
          || null,
      author: item.music_metadata?.music_info?.music_asset_info?.display_artist
           || item.clips_metadata?.original_sound_info?.ig_artist?.username
           || user.username
           || null,
      cover: item.music_metadata?.music_info?.music_asset_info?.cover_artwork_uri
          || null,
    },
    stats: {
      play_count: item.play_count || null,
      like_count: item.like_count || null,
      comment_count: item.comment_count || null,
      share_count: null,
    },
    ...(mediaItems ? { items: mediaItems } : {}),
    meta: {
      shortcode,
      source_url: url,
      thumbnail: thumbUrl,
      media_type: item.media_type === 2 ? "video" : item.media_type === 8 ? "carousel" : "image",
      provider: "instagram-graphql",
    },
  };
}
