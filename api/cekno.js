/**
 * Cek Nomor HP Indonesia — pure prefix logic, no external API
 * GET /api/cekno?no=08123456789
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const PREFIX_MAP = [
  // Telkomsel
  { prefix: ["0811","0812","0813","0821","0822","0823","0851","0852","0853"], operator: "Telkomsel", brand: "simpati / kartu AS / by.U" },
  // Indosat Ooredoo
  { prefix: ["0814","0815","0816","0855","0856","0857","0858"], operator: "Indosat Ooredoo Hutchison", brand: "IM3 / Mentari" },
  // XL Axiata
  { prefix: ["0817","0818","0819","0859","0877","0878"], operator: "XL Axiata", brand: "XL" },
  // Axis
  { prefix: ["0831","0832","0833","0838"], operator: "XL Axiata", brand: "Axis" },
  // Tri (3)
  { prefix: ["0895","0896","0897","0898","0899"], operator: "Hutchison 3 Indonesia", brand: "Tri (3)" },
  // Smartfren
  { prefix: ["0881","0882","0883","0884","0885","0886","0887","0888","0889"], operator: "Smartfren", brand: "Smartfren" },
  // Telkom (PSTN/rumah)
  { prefix: ["021","022","024","031"], operator: "Telkom Indonesia", brand: "Telepon Rumah" },
];

function detectOperator(no) {
  // Normalisasi: hapus spasi, dash, +62
  let normalized = no.replace(/[\s\-().]/g, "");
  if (normalized.startsWith("+62")) normalized = "0" + normalized.slice(3);
  if (normalized.startsWith("62"))  normalized = "0" + normalized.slice(2);

  if (!/^0\d{8,13}$/.test(normalized)) return null;

  for (const entry of PREFIX_MAP) {
    for (const p of entry.prefix) {
      if (normalized.startsWith(p)) {
        return { ...entry, normalized, prefix: p };
      }
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(200, CORS_HEADERS); return res.end(); }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (!["GET","POST"].includes(req.method)) return res.status(405).json({ status:false, code:405, message:"Method Not Allowed." });

  const no = req.query.no || req.body?.no;

  if (!no) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'no' wajib diisi.",
      example: "/api/cekno?no=08123456789",
    });
  }

  const result = detectOperator(no);

  if (!result) {
    return res.status(200).json({
      creator: "@SanzXD",
      status: true, code: 200,
      message: "Nomor tidak dikenali sebagai nomor HP Indonesia.",
      result: {
        nomor_asli: no,
        nomor_normalized: null,
        valid: false,
        operator: null,
        brand: null,
        prefix: null,
        tipe: null,
      },
    });
  }

  const tipe = ["021","022","024","031"].some(p => result.normalized.startsWith(p))
    ? "Telepon Rumah" : "Seluler";

  return res.status(200).json({
    creator: "@SanzXD",
    status: true, code: 200,
    message: "Nomor berhasil diidentifikasi.",
    result: {
      nomor_asli: no,
      nomor_normalized: result.normalized,
      valid: true,
      operator: result.operator,
      brand: result.brand,
      prefix: result.prefix,
      tipe,
    },
  });
}
