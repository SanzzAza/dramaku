/**
 * AI API — Powered by Google Gemini
 *
 * GET  /api/ai?tool=chat&prompt=Halo siapa kamu
 * POST /api/ai  { "tool": "chat", "prompt": "...", "history": [...] }
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL   = "gemini-1.5-flash";
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `Kamu adalah asisten AI yang cerdas, ramah, dan serba bisa.
Kamu menjawab dalam bahasa yang sama dengan pertanyaan pengguna (Indonesia atau Inggris).
Jawaban kamu singkat, jelas, dan mudah dipahami.
Jangan sebut dirimu sebagai Google atau Gemini — kamu adalah SanzAI.`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

function ok(tool, result) {
  return { creator: "SanzzXD", status: true, code: 200, tool, result };
}

function fail(tool, message, code = 400) {
  return { creator: "SanzzXD", status: false, code, tool, message };
}

async function geminiChat(prompt, history = []) {
  const contents = [];

  const recentHistory = Array.isArray(history) ? history.slice(-20) : [];
  for (const msg of recentHistory) {
    if (!msg.role || !msg.text) continue;
    const role = msg.role === "model" || msg.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text: String(msg.text) }] });
  }

  contents.push({ role: "user", parts: [{ text: String(prompt).trim() }] });

  const payload = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.8, topP: 0.95, topK: 40, maxOutputTokens: 2048,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Gemini error ${res.status}`);
  }

  const data      = await res.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) throw new Error("Tidak ada response dari Gemini.");
  if (candidate.finishReason === "SAFETY") throw new Error("Pertanyaan diblokir safety filter.");

  const text = candidate.content?.parts?.map(p => p.text || "").join("").trim();
  if (!text) throw new Error("Response Gemini kosong.");

  const usage = data?.usageMetadata || null;

  return {
    answer: text,
    model:  GEMINI_MODEL,
    usage:  usage ? {
      prompt_tokens:   usage.promptTokenCount     || 0,
      response_tokens: usage.candidatesTokenCount || 0,
      total_tokens:    usage.totalTokenCount       || 0,
    } : null,
    history: [
      ...recentHistory,
      { role: "user",  text: String(prompt).trim() },
      { role: "model", text },
    ],
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json(fail("ai", "Method Not Allowed.", 405));
  }

  const q       = req.query || {};
  const body    = req.body  || {};
  const tool    = String(q.tool   || body.tool   || "chat").split(",")[0].toLowerCase().trim();
  const prompt  = String(q.prompt || body.prompt || "");
  const history = body.history || [];

  if (!GEMINI_API_KEY) {
    return res.status(500).json(fail(tool, "GEMINI_API_KEY belum di-set di environment variable.", 500));
  }

  if (tool !== "chat") {
    return res.status(400).json(fail(tool, `Tool '${tool}' tidak tersedia. Gunakan: chat`, 400));
  }

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json(fail(tool, "Parameter 'prompt' wajib diisi.", 400));
  }

  try {
    const result = await geminiChat(String(prompt), history);
    return res.status(200).json(ok("chat", result));
  } catch (err) {
    return res.status(500).json(fail(tool, err.message || "Terjadi kesalahan pada server.", 500));
  }
}
