/**
 * AI API — Powered by Groq (LLaMA)
 *
 * GET  /api/ai?tool=chat&prompt=Halo siapa kamu
 * POST /api/ai  { "tool": "chat", "prompt": "...", "history": [...] }
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL   = "llama-3.3-70b-versatile";
const GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Kamu adalah asisten AI yang cerdas, ramah, dan serba bisa.
Kamu menjawab dalam bahasa yang sama dengan pertanyaan pengguna (Indonesia atau Inggris).
Jawaban kamu singkat, jelas, dan mudah dipahami.
Nama kamu adalah SanzAI.`;

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

async function groqChat(prompt, history = []) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  const recentHistory = Array.isArray(history) ? history.slice(-20) : [];
  for (const msg of recentHistory) {
    if (!msg.role || !msg.text) continue;
    const role = msg.role === "model" || msg.role === "assistant" ? "assistant" : "user";
    messages.push({ role, content: String(msg.text) });
  }

  messages.push({ role: "user", content: String(prompt).trim() });

  const res = await fetch(GROQ_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      messages,
      temperature: 0.8,
      max_tokens:  2048,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Groq error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Response Groq kosong.");

  const usage = data?.usage || null;

  return {
    answer: text,
    model:  GROQ_MODEL,
    usage:  usage ? {
      prompt_tokens:   usage.prompt_tokens     || 0,
      response_tokens: usage.completion_tokens || 0,
      total_tokens:    usage.total_tokens       || 0,
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

  if (!GROQ_API_KEY) {
    return res.status(500).json(fail(tool, "GROQ_API_KEY belum di-set di environment variable.", 500));
  }

  if (tool !== "chat") {
    return res.status(400).json(fail(tool, `Tool '${tool}' tidak tersedia. Gunakan: chat`, 400));
  }

  if (!prompt || !prompt.trim()) {
    return res.status(400).json(fail(tool, "Parameter 'prompt' wajib diisi.", 400));
  }

  try {
    const result = await groqChat(prompt, history);
    return res.status(200).json(ok("chat", result));
  } catch (err) {
    return res.status(500).json(fail(tool, err.message || "Terjadi kesalahan pada server.", 500));
  }
}
