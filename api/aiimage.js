/**
 * AI Image Generator API — via Pollinations.ai (free, no key needed)
 * GET /api/aiimage?prompt=a cat in space
 * GET /api/aiimage?prompt=...&width=512&height=512&model=flux&seed=42
 *
 * Available models: flux (default), flux-realism, flux-anime, flux-3d, turbo
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const VALID_MODELS = ["flux", "flux-realism", "flux-anime", "flux-3d", "turbo"];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const prompt = req.query.prompt || req.body?.prompt;
  const width  = parseInt(req.query.width  || req.body?.width  || "1024");
  const height = parseInt(req.query.height || req.body?.height || "1024");
  const model  = req.query.model  || req.body?.model  || "flux";
  const seed   = req.query.seed   || req.body?.seed   || Math.floor(Math.random() * 999999);
  const nologo = true;

  if (!prompt) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'prompt' wajib diisi.",
      example: "/api/aiimage?prompt=a cat astronaut in space, realistic",
    });
  }

  if (!VALID_MODELS.includes(model)) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: `Model tidak valid. Pilih salah satu: ${VALID_MODELS.join(", ")}.`,
    });
  }

  if (width < 128 || width > 1440 || height < 128 || height > 1440) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Width dan height harus antara 128 dan 1440.",
    });
  }

  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=${nologo}`;

    // Verifikasi bahwa Pollinations bisa diakses
    const check = await fetch(imageUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(15_000),
    });

    if (!check.ok) throw new Error(`Pollinations AI merespons ${check.status}.`);

    return res.status(200).json({
      creator: "@SanzXD",
      status: true,
      code: 200,
      message: "Gambar AI berhasil dibuat.",
      result: {
        url: imageUrl,
        prompt,
        model,
        width,
        height,
        seed: Number(seed),
        format: "JPEG",
        provider: "pollinations.ai",
      },
    });
  } catch (err) {
    console.error("[AIImage]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal generate gambar.",
    });
  }
}
