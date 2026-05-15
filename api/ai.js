/**
 * AI API — Powered by Google Gemini
 *
 * GET  /api/ai?tool=chat&prompt=Halo siapa kamu
 * POST /api/ai  { "tool": "chat", "prompt": "...", "history": [...] }
 *
 * Multi-turn (simpan history di client):
 * POST /api/ai {
 *   "tool": "chat",
 *   "prompt": "Lanjut ceritanya dong",
 *   "history": [
 *     { "role": "user",  "text": "Ceritain tentang nasi goreng" },
 *     { "role": "model", "text": "Nasi goreng adalah..." }
 *   ]
 * }
 */

import axios from "axios";

// ── Konfigurasi ───────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL   = "gemini-2.0-flash";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(tool, result) {
  return { creator: "SanzzXD", status: true, code: 200, tool, result };
}

function fail(tool, message, code = 400) {
  return { creator: "SanzzXD", status: false, code, tool, message };
}

// ── Gemini Chat ───────────────────────────────────────────────────────────────

async function geminiChat(prompt, history = []) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY belum di-set di environment variable.");
  }

  if (!prompt || !prompt.trim()) {
    throw new Error("Parameter 'prompt' tidak boleh kosong.");
  }

  // Bangun contents dari history + prompt baru
  const contents = [];

  // Tambahkan history sebelumnya (max 20 pesan terakhir biar hemat token)
  const recentHistory = Array.isArray(history) ? history.slice(-20) : [];
  for (const msg of recentHistory) {
    if (!msg.role || !msg.text) continue;
    const role = msg.role === "model" || msg.role === "assistant" ? "model" : "user";
    contents.push({
      role,
      parts: [{ text: String(msg.text) }],
    });
  }

  // Tambahkan prompt saat ini
  contents.push({
    role: "user",
    parts: [{ text: prompt.trim() }],
  });

  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature:     0.8,
      topP:            0.95,
      topK:            40,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const res = await axios.post(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 30000,
  });

  const candidate = res.data?.candidates?.[0];
  if (!candidate) throw new Error("Tidak ada response dari Gemini.");

  // Cek finish reason
  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY") {
    throw new Error("Pertanyaan diblokir oleh filter keamanan. Coba ubah pertanyaanmu.");
  }

  const text = candidate.content?.parts?.map(p => p.text || "").join("").trim();
  if (!text) throw new Error("Response Gemini kosong.");

  // Hitung token usage kalau ada
  const usage = res.data?.usageMetadata || null;

  return {
    answer: text,
    model:  GEMINI_MODEL,
    usage:  usage
      ? {
          prompt_tokens:     usage.promptTokenCount     || 0,
          response_tokens:   usage.candidatesTokenCount || 0,
          total_tokens:      usage.totalTokenCount       || 0,
        }
      : null,
    // Kembalikan history terbaru (termasuk jawaban model) supaya client bisa simpan
    history: [
      ...recentHistory,
      { role: "user",  text: prompt.trim() },
      { role: "model", text },
    ],
  };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json(fail("ai", "Method Not Allowed. Gunakan GET atau POST.", 405));
  }

  // Ambil params dari query (GET) atau body (POST)
  const q       = req.query  || {};
  const body    = req.body   || {};
  const tool    = (q.tool    || body.tool    || "chat").toLowerCase().trim();
  const prompt  =  q.prompt  || body.prompt  || "";
  const history =  body.history || [];       // hanya bisa dikirim via POST

  // Validasi tool
  const TOOLS = ["chat"];
  if (!TOOLS.includes(tool)) {
    return res.status(400).json(
      fail(tool, `Tool '${tool}' tidak tersedia. Tool yang tersedia: ${TOOLS.join(", ")}`, 400)
    );
  }

  // Validasi prompt
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json(
      fail(tool, "Parameter 'prompt' wajib diisi.", 400)
    );
  }

  // Validasi API key
  if (!GEMINI_API_KEY) {
    return res.status(500).json(
      fail(tool, "Server belum dikonfigurasi. Hubungi admin (GEMINI_API_KEY missing).", 500)
    );
  }

  try {
    switch (tool) {
      case "chat": {
        const result = await geminiChat(String(prompt), history);
        return res.status(200).json(ok("chat", result));
      }
      default:
        return res.status(400).json(fail(tool, "Tool tidak dikenali.", 400));
    }
  } catch (err) {
    // Handle Gemini API error response
    const geminiMsg = err.response?.data?.error?.message;
    const message   = geminiMsg || err.message || "Terjadi kesalahan pada server.";
    const code      = err.response?.status || 500;
    return res.status(code).json(fail(tool, message, code));
  }
}
