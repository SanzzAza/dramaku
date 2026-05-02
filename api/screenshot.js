/**
 * Screenshot Web API — via screenshotone.com (free tier, no key needed for basic)
 * Fallback: thum.io (no key)
 * GET /api/screenshot?url=https://example.com
 * GET /api/screenshot?url=...&width=1280&height=720&delay=1
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(200, CORS_HEADERS); return res.end(); }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (!["GET","POST"].includes(req.method)) return res.status(405).json({ status:false, code:405, message:"Method Not Allowed." });

  const url    = req.query.url    || req.body?.url;
  const width  = parseInt(req.query.width  || req.body?.width  || "1280");
  const height = parseInt(req.query.height || req.body?.height || "720");
  const delay  = parseInt(req.query.delay  || req.body?.delay  || "0");

  if (!url) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'url' wajib diisi.",
      example: "/api/screenshot?url=https://example.com&width=1280&height=720",
    });
  }

  const urlRegex = /^https?:\/\/.+\..+/i;
  if (!urlRegex.test(url)) {
    return res.status(400).json({ status:false, code:400, message:"URL tidak valid." });
  }

  if (width < 320 || width > 1920 || height < 240 || height > 1080) {
    return res.status(400).json({ status:false, code:400, message:"Width: 320-1920, Height: 240-1080." });
  }

  try {
    // Primary: thum.io — free, no key, no rate limit
    const thumUrl = `https://image.thum.io/get/width/${width}/crop/${height}/noanimate/${encodeURIComponent(url)}`;

    // Verify accessible
    const check = await fetch(thumUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(12_000),
    });

    if (!check.ok) throw new Error("Screenshot service tidak merespons.");

    // Fallback URL pakai screenshotmachine (no key, basic)
    const fallbackUrl = `https://api.screenshotmachine.com/?url=${encodeURIComponent(url)}&dimension=${width}x${height}&delay=${delay * 1000}&format=png`;

    return res.status(200).json({
      creator: "@SanzXD",
      status: true, code: 200,
      message: "Berhasil membuat screenshot URL.",
      result: {
        source_url: url,
        screenshot_url: thumUrl,
        fallback_url: fallbackUrl,
        width,
        height,
        format: "PNG",
        provider: "thum.io",
      },
    });
  } catch (err) {
    console.error("[Screenshot]", err.message);
    return res.status(500).json({ status:false, code:500, message: err.message });
  }
}
