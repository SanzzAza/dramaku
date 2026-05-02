/**
 * Instagram Downloader API — via downloadgram.org
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
    const result = await fetchViaDownloadgram(url);
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

async function fetchViaDownloadgram(url) {
  const body = new URLSearchParams();
  body.append("url", url);
  body.append("v", "3");
  body.append("lang", "en");

  const resp = await fetch("https://api.downloadgram.org/media", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Android 10; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
      "accept-language": "id-ID",
      "referer": "https://downloadgram.org/",
      "origin": "https://downloadgram.org",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
    },
    body,
  });

  if (!resp.ok) throw new Error(`downloadgram responded ${resp.status}`);

  const raw = await resp.text();

  // Response adalah JS string: ...['innerHTML']='<html here>'
  // Extract konten HTML dari dalam single-quoted string setelah innerHTML=
  const innerMatch = raw.match(/\['innerHTML'\]\s*=\s*'([\s\S]+?)'\s*(?:,|$)/);
  if (!innerMatch) {
    throw new Error(`Format response tidak dikenali. Snippet: ${raw.slice(0, 200)}`);
  }

  // Unescape JS string escapes: \' -> ' dan \\ -> \
  const html = innerMatch[1]
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "");

  console.log("[Instagram DEBUG] extracted HTML snippet:", html.slice(0, 300));

  const result = {};

  // Cek video
  const sourceSrc  = html.match(/<source[^>]+src=["']([^"']+)["']/i)?.[1];
  const videoPoster = html.match(/<video[^>]+poster=["']([^"']+)["']/i)?.[1];
  const mp4Href    = html.match(/href=["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i)?.[1];
  const dlHref     = html.match(/<a[^>]+download[^>]*href=["']([^"']+)["']/i)?.[1]
                  || html.match(/href=["']([^"']+)["'][^>]*download/i)?.[1];

  // Cek image
  const imgSrc = html.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i)?.[1];

  const videoUrl = sourceSrc || mp4Href;

  if (videoUrl) {
    result.type = "video";
    result.url = clean(videoUrl);
    result.download_url = dlHref ? clean(dlHref) : clean(videoUrl);
    result.thumbnail = videoPoster ? clean(videoPoster) : null;
  } else if (imgSrc) {
    result.type = "image";
    result.url = clean(imgSrc);
    result.download_url = dlHref ? clean(dlHref) : clean(imgSrc);
    result.thumbnail = null;
  } else {
    throw new Error(`Media tidak ditemukan dalam HTML. Snippet: ${html.slice(0, 200)}`);
  }

  return {
    status: true,
    code: 200,
    message: "Berhasil mengambil data media.",
    result,
  };
}

function clean(str) {
  return str.replace(/\\"/g, "").replace(/\\\\"/g, "").trim();
}
