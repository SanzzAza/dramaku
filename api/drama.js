/**
 * Drama API — Search, Detail, Episode via Anichin API
 *
 * Source yang didukung:
 *   goodshort, dramabox, reelshort, shortmax, netshort, dramawave,
 *   flickreels, freereels, stardusttv, idrama, dramanova, starshort,
 *   dramabite, melolo, moboreels
 *
 * GET /api/drama?action=search&source=goodshort&query=cinta
 * GET /api/drama?action=trending&source=dramabox
 * GET /api/drama?action=foryou&source=melolo&page=1
 * GET /api/drama?action=detail&source=goodshort&id=31001345248
 * GET /api/drama?action=episode&source=goodshort&id=31001345248&ep=1
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type"                : "application/json",
};

const ANICHIN_BASE = "https://api.anichin.bio";
const ANICHIN_KEY  = "TRIAL-ANICHIN-2026";
const ANICHIN_UA   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const VALID_SOURCES = [
  "goodshort", "dramabox", "reelshort", "shortmax", "netshort",
  "dramawave", "flickreels", "freereels", "stardusttv", "idrama",
  "dramanova", "starshort", "dramabite", "melolo", "moboreels",
];

const VALID_ACTIONS = ["search", "trending", "foryou", "detail", "episode"];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const action = (req.query.action || req.body?.action || "").toLowerCase();
  const source = (req.query.source || req.body?.source || "goodshort").toLowerCase();

  // Validasi action
  if (!action) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'action' wajib diisi.",
      available_actions: VALID_ACTIONS,
      available_sources: VALID_SOURCES,
      examples: {
        search  : "/api/drama?action=search&source=goodshort&query=cinta",
        trending: "/api/drama?action=trending&source=dramabox",
        foryou  : "/api/drama?action=foryou&source=melolo&page=1",
        detail  : "/api/drama?action=detail&source=goodshort&id=31001345248",
        episode : "/api/drama?action=episode&source=goodshort&id=31001345248&ep=1",
      },
    });
  }

  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({
      status: false, code: 400,
      message: `Action '${action}' tidak didukung.`,
      available: VALID_ACTIONS,
    });
  }

  if (!VALID_SOURCES.includes(source)) {
    return res.status(400).json({
      status: false, code: 400,
      message: `Source '${source}' tidak didukung.`,
      available: VALID_SOURCES,
    });
  }

  try {
    let result;

    switch (action) {
      case "search": {
        const query = req.query.query || req.body?.query;
        if (!query) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'query' wajib diisi untuk action search.",
            example: `/api/drama?action=search&source=${source}&query=cinta`,
          });
        }
        result = await anichinFetch(`/${source}/search`, { query });
        break;
      }

      case "trending": {
        result = await anichinFetch(`/${source}/trending`);
        break;
      }

      case "foryou": {
        const page = req.query.page || req.body?.page || "1";
        result = await anichinFetch(`/${source}/foryou`, { page });
        break;
      }

      case "detail": {
        const id = req.query.id || req.body?.id;
        if (!id) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'id' wajib diisi untuk action detail.",
            example: `/api/drama?action=detail&source=${source}&id=31001345248`,
          });
        }
        result = await anichinFetch(`/${source}/detail`, { id });
        break;
      }

      case "episode": {
        const id = req.query.id || req.body?.id;
        const ep = req.query.ep || req.body?.ep || "1";
        if (!id) {
          return res.status(400).json({
            status: false, code: 400,
            message: "Parameter 'id' wajib diisi untuk action episode.",
            example: `/api/drama?action=episode&source=${source}&id=31001345248&ep=1`,
          });
        }
        result = await anichinFetch(`/${source}/episode`, { id, ep });
        break;
      }
    }

    return res.status(200).json({
      creator: "@SanzXD",
      status : true,
      code   : 200,
      action,
      source,
      result,
    });

  } catch (err) {
    console.error(`[Drama:${action}:${source}]`, err.message);
    return res.status(500).json({
      status : false,
      code   : 500,
      message: err.message || "Terjadi kesalahan.",
    });
  }
}

// ─── Anichin API fetch helper ─────────────────────────────────────────────────

async function anichinFetch(path, params = {}) {
  const url = new URL(`${ANICHIN_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const resp = await fetch(url.toString(), {
    headers: {
      "X-API-Key" : ANICHIN_KEY,
      "User-Agent": ANICHIN_UA,
      "Accept"    : "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) {
    throw new Error(`Anichin API error: ${resp.status} ${resp.statusText}`);
  }

  return await resp.json();
}
