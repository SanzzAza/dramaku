/**
 * Instagram Downloader API — No external dependencies
 * Supports: Post, Reel, IGTV
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

  const fetchers = [fetchViaCobaDL, fetchViaInstaAPI];

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
    message: "Gagal mengambil media. Coba lagi beberapa saat.",
  });
}

// FETCHER 1: cobalt (co.wuk.sh) - supports Instagram
async function fetchViaCobaDL(url) {
  const resp = await fetch("https://co.wuk.sh/api/json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      url,
      vCodec: "h264",
      vQuality: "720",
      aFormat: "mp3",
      filenamePattern: "classic",
      isAudioOnly: false,
      disableMetadata: false,
    }),
  });

  if (!resp.ok) throw new Error(`cobalt responded ${resp.status}`);

  const json = await resp.json();

  if (json.status === "error") throw new Error(json.text || "cobalt error");

  if (json.status === "picker") {
    const items = json.picker.map((item, i) => ({
      index: i + 1,
      type: item.type || "video",
      url: item.url,
      thumbnail: item.thumb || null,
    }));
    return buildResponse(url, items);
  }

  if (["stream", "redirect", "tunnel"].includes(json.status)) {
    return buildResponse(url, [{ index: 1, type: "video", url: json.url, thumbnail: null }]);
  }

  throw new Error(`Unknown cobalt status: ${json.status}`);
}

// FETCHER 2: Instagram internal API (mobile UA)
async function fetchViaInstaAPI(url) {
  const match = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("Cannot extract shortcode");
  const shortcode = match[2];

  const resp = await fetch(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`, {
    headers: {
      "User-Agent": "Instagram 275.0.0.27.98 Android",
      "Accept": "application/json",
      "x-ig-app-id": "936619743392459",
    },
  });

  if (!resp.ok) throw new Error(`Instagram API responded ${resp.status}`);

  const json = await resp.json();
  const media = json?.items?.[0] ?? json?.graphql?.shortcode_media;
  if (!media) throw new Error("No media in response");

  const items = [];

  if (media.carousel_media) {
    media.carousel_media.forEach((node, i) => {
      const isVid = node.media_type === 2;
      items.push({
        index: i + 1,
        type: isVid ? "video" : "image",
        url: isVid ? node.video_versions?.[0]?.url : node.image_versions2?.candidates?.[0]?.url,
        thumbnail: node.image_versions2?.candidates?.[0]?.url || null,
      });
    });
  } else {
    const isVid = media.media_type === 2;
    items.push({
      index: 1,
      type: isVid ? "video" : "image",
      url: isVid ? media.video_versions?.[0]?.url : media.image_versions2?.candidates?.[0]?.url,
      thumbnail: media.image_versions2?.candidates?.[0]?.url || null,
    });
  }

  if (!items[0]?.url) throw new Error("No URLs found");
  return buildResponse(url, items);
}

// BUILD RESPONSE
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
