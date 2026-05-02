/**
 * Random Anime Image API — via waifu.pics (free, no key)
 * GET /api/anime
 * GET /api/anime?type=waifu
 * GET /api/anime?type=neko&category=sfw
 *
 * SFW types: waifu, neko, shinobu, megumin, bully, cuddle, cry, hug,
 *            awoo, kiss, lick, pat, smug, bonk, yeet, blush, smile,
 *            wave, highfive, handhold, nom, bite, glomp, slap, kick,
 *            happy, wink, poke, dance, cringe
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const SFW_TYPES = [
  "waifu","neko","shinobu","megumin","bully","cuddle","cry","hug",
  "awoo","kiss","lick","pat","smug","bonk","yeet","blush","smile",
  "wave","highfive","handhold","nom","bite","glomp","slap","kick",
  "happy","wink","poke","dance","cringe"
];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(200, CORS_HEADERS); return res.end(); }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (!["GET","POST"].includes(req.method)) return res.status(405).json({ status:false, code:405, message:"Method Not Allowed." });

  const type = (req.query.type || req.body?.type || "waifu").toLowerCase();

  if (!SFW_TYPES.includes(type)) {
    return res.status(400).json({
      status: false, code: 400,
      message: `Type '${type}' tidak valid.`,
      available_types: SFW_TYPES,
      example: "/api/anime?type=neko",
    });
  }

  try {
    const resp = await fetch(`https://api.waifu.pics/sfw/${type}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`waifu.pics merespons ${resp.status}.`);

    const data = await resp.json();
    if (!data.url) throw new Error("Gagal mendapatkan URL gambar.");

    return res.status(200).json({
      creator: "@SanzXD",
      status: true, code: 200,
      message: "Berhasil mengambil gambar anime.",
      result: {
        url: data.url,
        type,
        category: "sfw",
        provider: "waifu.pics",
      },
    });
  } catch (err) {
    console.error("[Anime]", err.message);
    return res.status(500).json({ status:false, code:500, message: err.message });
  }
}
