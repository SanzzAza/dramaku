/**
 * Random Quote API — via quotable.io (free, no key)
 * GET /api/quote
 * GET /api/quote?tag=motivation
 * GET /api/quote?lang=id  (translate via MyMemory)
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

  const tag  = req.query.tag  || req.body?.tag  || "";
  const lang = (req.query.lang || req.body?.lang || "en").toLowerCase();

  try {
    let url = "https://api.quotable.kurokeita.dev/api/quotes/random";
    if (tag) url += `?tags=${encodeURIComponent(tag)}`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mengambil quote.");
    const data = await resp.json();

    const quote = data?.data?.[0] || data;
    const content = quote.content || quote.body;
    const author  = quote.author?.name || quote.author || "Unknown";

    let translated = null;
    if (lang === "id") {
      try {
        const tr = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(content)}&langpair=en|id`, {
          signal: AbortSignal.timeout(8_000),
        });
        const trData = await tr.json();
        translated = trData?.responseData?.translatedText || null;
      } catch { /* translate gagal, lanjut tanpa translate */ }
    }

    return res.status(200).json({
      creator: "@SanzXD",
      status: true, code: 200,
      message: "Berhasil mengambil quote.",
      result: {
        quote: content,
        quote_id: quote._id || quote.id || null,
        author,
        tags: quote.tags || [],
        ...(translated ? { quote_id: translated } : {}),
        ...(lang === "id" && translated ? { quote_translated: translated } : {}),
        provider: "quotable.kurokeita.dev",
      },
    });
  } catch (err) {
    console.error("[Quote]", err.message);
    return res.status(500).json({ status:false, code:500, message: err.message });
  }
}
