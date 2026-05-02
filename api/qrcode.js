/**
 * QR Code Generator API — via api.qrserver.com (free, no key)
 * GET /api/qrcode?text=https://example.com
 * GET /api/qrcode?text=Hello+World&size=300&color=ffffff&bg=000000
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

  const text  = req.query.text  || req.body?.text;
  const size  = parseInt(req.query.size  || req.body?.size  || "300");
  const color = (req.query.color || req.body?.color || "000000").replace("#", "");
  const bg    = (req.query.bg   || req.body?.bg    || "ffffff").replace("#", "");

  if (!text) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'text' wajib diisi.",
      example: "/api/qrcode?text=https://example.com&size=300",
    });
  }

  if (size < 50 || size > 1000) {
    return res.status(400).json({
      status: false,
      code: 400,
      message: "Parameter 'size' harus antara 50 dan 1000.",
    });
  }

  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=${color}&bgcolor=${bg}&format=png`;

    // Verifikasi URL bisa diakses
    const check = await fetch(qrUrl, { method: "HEAD" });
    if (!check.ok) throw new Error("QR service tidak merespons.");

    return res.status(200).json({
      creator: "@SanzXD",
      status: true,
      code: 200,
      message: "QR Code berhasil dibuat.",
      result: {
        url: qrUrl,
        text,
        size: `${size}x${size}`,
        color: `#${color}`,
        background: `#${bg}`,
        format: "PNG",
      },
    });
  } catch (err) {
    console.error("[QRCode]", err.message);
    return res.status(500).json({
      status: false,
      code: 500,
      message: err.message || "Gagal membuat QR Code.",
    });
  }
}
