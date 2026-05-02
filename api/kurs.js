/**
 * Konversi Mata Uang — via exchangerate-api.com (free, no key)
 * GET /api/kurs?dari=USD&ke=IDR&jumlah=100
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

  const dari   = (req.query.dari   || req.body?.dari   || "USD").toUpperCase();
  const ke     = (req.query.ke     || req.body?.ke     || "IDR").toUpperCase();
  const jumlah = parseFloat(req.query.jumlah || req.body?.jumlah || 1);

  if (isNaN(jumlah) || jumlah <= 0) {
    return res.status(400).json({ status:false, code:400, message:"Parameter 'jumlah' harus angka positif." });
  }

  try {
    const resp = await fetch(`https://open.er-api.com/v6/latest/${dari}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await resp.json();

    if (data.result !== "success") throw new Error(`Mata uang '${dari}' tidak valid atau tidak didukung.`);
    if (!data.rates[ke]) throw new Error(`Mata uang tujuan '${ke}' tidak ditemukan.`);

    const rate   = data.rates[ke];
    const hasil  = jumlah * rate;

    // Format angka
    const fmt = (n) => n.toLocaleString("id-ID", { maximumFractionDigits: 4 });

    return res.status(200).json({
      creator: "@SanzXD",
      status: true, code: 200,
      message: "Konversi berhasil.",
      result: {
        dari,
        ke,
        jumlah,
        rate,
        hasil,
        hasil_formatted: `${ke} ${fmt(hasil)}`,
        last_update: data.time_last_update_utc,
        provider: "open.er-api.com",
      },
    });
  } catch (err) {
    console.error("[Kurs]", err.message);
    return res.status(500).json({ status:false, code:500, message: err.message });
  }
}
