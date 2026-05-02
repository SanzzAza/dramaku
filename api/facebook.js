/**
 * Facebook Downloader API — via getfvid.com scraping
 * GET /api/facebook?url=https://www.facebook.com/reel/...
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(200, CORS_HEADERS); return res.end(); }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (!["GET","POST"].includes(req.method)) return res.status(405).json({ status:false, code:405, message:"Method Not Allowed." });

  const url = req.query.url || req.body?.url;

  if (!url) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/facebook?url=https://www.facebook.com/reel/123456789",
    });
  }

  const fbRegex = /^https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\/.+/i;
  if (!fbRegex.test(url)) {
    return res.status(400).json({
      status: false, code: 400,
      message: "URL tidak valid. Masukkan link Facebook yang benar.",
    });
  }

  try {
    const result = await fetchFacebook(url);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Facebook]", err.message);
    return res.status(500).json({ status:false, code:500, message: err.message });
  }
}

async function fetchFacebook(url) {
  // Ambil token dari getfvid
  const pageResp = await fetch("https://getfvid.com/", {
    headers: { "User-Agent": UA, "Accept": "text/html" },
  });
  const pageHtml = await pageResp.text();

  const tokenMatch = pageHtml.match(/name="_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error("Gagal mendapatkan token dari server.");
  const token = tokenMatch[1];

  const cookies = (pageResp.headers.get("set-cookie") || "")
    .split(",").map(c => c.split(";")[0].trim()).join("; ");

  // Submit URL
  const formData = new URLSearchParams({ _token: token, url });
  const submitResp = await fetch("https://getfvid.com/downloader", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Referer": "https://getfvid.com/",
      "Origin": "https://getfvid.com",
      "Cookie": cookies,
    },
    body: formData.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  const html = await submitResp.text();

  // Parse video links
  const hdMatch  = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*HD/i);
  const sdMatch  = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*SD/i);
  const thumbMatch = html.match(/<img[^>]+src="(https:\/\/[^"]+)"[^>]*class="[^"]*thumb/i)
    || html.match(/og:image.*?content="([^"]+)"/i);

  const hdUrl = hdMatch ? decodeURIComponent(hdMatch[1]) : null;
  const sdUrl = sdMatch ? decodeURIComponent(sdMatch[1]) : null;

  if (!hdUrl && !sdUrl) throw new Error("Video tidak ditemukan. Pastikan video bersifat publik.");

  return {
    creator: "@SanzXD",
    status: true, code: 200,
    message: "Berhasil mengambil data video Facebook.",
    result: {
      source_url: url,
      video: {
        hd: hdUrl,
        sd: sdUrl,
        cover: thumbMatch ? thumbMatch[1] : null,
      },
      provider: "getfvid.com",
    },
  };
}
