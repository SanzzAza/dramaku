/**
 * AI API — Multi-Provider (Groq + OpenRouter)
 *
 * Tools  : chat, code
 * Models : llama3, deepseek, qwen, gemma, llama4, nemotron, glm, minimax
 *
 * GET  /api/ai?tool=chat&prompt=Halo siapa kamu
 * GET  /api/ai?tool=chat&prompt=Halo&model=deepseek
 * GET  /api/ai?tool=code&prompt=Buatkan fungsi sorting di Python
 * GET  /api/ai?tool=code&prompt=REST API&lang=javascript&model=qwen
 * POST /api/ai  { "tool": "chat", "prompt": "...", "model": "gemma", "history": [...] }
 * POST /api/ai  { "tool": "code", "prompt": "...", "lang": "python" }
 *
 * Available models (value untuk param ?model=):
 *   llama3    → groq      : llama-3.3-70b-versatile             (default chat, cepat)
 *   deepseek  → openrouter: deepseek/deepseek-v4-0324:free      (reasoning & code)
 *   qwen      → openrouter: qwen/qwen3-coder-480b-a35b:free     (coding, multilingual)
 *   gemma     → openrouter: google/gemma-4-31b-it:free          (Google, general)
 *   llama4    → openrouter: meta-llama/llama-3.3-70b-instruct:free (Meta, general)
 *   nemotron  → openrouter: nvidia/nemotron-3-nano-30b-a3b:free (NVIDIA, ringan)
 *   glm       → openrouter: z-ai/glm-4.5-air:free               (ringan, cepat)
 *   minimax   → openrouter: minimax/minimax-m2.5:free           (SOTA, general)
 */

// ─── ENV ──────────────────────────────────────────────────────────────────────
const GROQ_API_KEY       = process.env.GROQ_API_KEY       || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// ─── PROVIDER CONFIG ──────────────────────────────────────────────────────────
const PROVIDERS = {
  groq: {
    url    : "https://api.groq.com/openai/v1/chat/completions",
    apiKey : () => GROQ_API_KEY,
    headers: (key) => ({
      "Content-Type" : "application/json",
      "Authorization": `Bearer ${key}`,
    }),
  },
  openrouter: {
    url    : "https://openrouter.ai/api/v1/chat/completions",
    apiKey : () => OPENROUTER_API_KEY,
    headers: (key) => ({
      "Content-Type" : "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer" : "https://dramafeed.vercel.app",
      "X-Title"      : "SanzXD API",
    }),
  },
};

// ─── MODEL REGISTRY ───────────────────────────────────────────────────────────
const MODELS = {
  llama3   : { provider: "groq",       id: "llama-3.3-70b-versatile",               label: "LLaMA 3.3 70B (Groq)"            },
  deepseek : { provider: "openrouter", id: "deepseek/deepseek-v4-0324:free",         label: "DeepSeek V4 Flash (OpenRouter)"  },
  qwen     : { provider: "openrouter", id: "qwen/qwen3-coder-480b-a35b:free",        label: "Qwen3 Coder 480B (OpenRouter)"   },
  gemma    : { provider: "openrouter", id: "google/gemma-4-31b-it:free",             label: "Gemma 4 31B (OpenRouter)"        },
  llama4   : { provider: "openrouter", id: "meta-llama/llama-3.3-70b-instruct:free", label: "LLaMA 3.3 70B (OpenRouter)"      },
  nemotron : { provider: "openrouter", id: "nvidia/nemotron-3-nano-30b-a3b:free",    label: "Nemotron 3 Nano 30B (OpenRouter)"},
  glm      : { provider: "openrouter", id: "z-ai/glm-4.5-air:free",                 label: "GLM 4.5 Air (OpenRouter)"        },
  minimax  : { provider: "openrouter", id: "minimax/minimax-m2.5:free",              label: "MiniMax M2.5 (OpenRouter)"       },
};

const DEFAULT_CHAT_MODEL = "llama3";
const DEFAULT_CODE_MODEL = "qwen";

// Urutan fallback kalau model utama gagal
const CHAT_FALLBACKS = ["gemma", "llama4", "glm", "minimax", "nemotron"];
const CODE_FALLBACKS = ["deepseek", "gemma", "llama4", "llama3"];

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────
const SYSTEM_CHAT = `Kamu adalah asisten AI yang cerdas, ramah, dan serba bisa bernama SanzAI.
Kamu menjawab dalam bahasa yang sama dengan pertanyaan pengguna (Indonesia atau Inggris).
Jawaban kamu singkat, jelas, dan mudah dipahami.`;

const buildSystemCode = (lang) =>
  `Kamu adalah expert programmer bernama SanzCode.
Tugas kamu hanya menghasilkan kode yang bersih, efisien, dan siap pakai.
${lang ? `Gunakan bahasa pemrograman: ${lang}.` : "Pilih bahasa yang paling tepat untuk tugas ini."}
Format respons:
1. Kode lengkap dalam code block (\`\`\`bahasa ... \`\`\`)
2. Penjelasan singkat (maks 3 kalimat) setelah kode
Jangan tambahkan basa-basi atau intro panjang.`;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type"                : "application/json",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function ok(tool, result)               { return { creator: "SanzzXD", status: true,  code: 200, tool, result  }; }
function fail(tool, message, code = 400){ return { creator: "SanzzXD", status: false, code,      tool, message }; }

function resolveModel(modelKey, defaultKey) {
  const key = (modelKey || "").toLowerCase().trim();
  return MODELS[key] || MODELS[defaultKey];
}

// ─── CORE COMPLETION ──────────────────────────────────────────────────────────
async function callAI(model, systemPrompt, messages) {
  const prov   = PROVIDERS[model.provider];
  const apiKey = prov.apiKey();

  if (!apiKey) throw new Error(`API key untuk provider '${model.provider}' belum di-set di environment variable.`);

  const res = await fetch(prov.url, {
    method : "POST",
    headers: prov.headers(apiKey),
    body   : JSON.stringify({
      model      : model.id,
      messages   : [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens : 2048,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `${model.provider} error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Respons AI kosong.");

  const usage = data?.usage || null;
  return {
    text,
    modelLabel: model.label,
    usage: usage ? {
      prompt_tokens  : usage.prompt_tokens     || 0,
      response_tokens: usage.completion_tokens || 0,
      total_tokens   : usage.total_tokens      || 0,
    } : null,
  };
}

// ─── FALLBACK COMPLETION ──────────────────────────────────────────────────────
async function callAIWithFallback(primaryModel, systemPrompt, messages, fallbackKeys = []) {
  try {
    return await callAI(primaryModel, systemPrompt, messages);
  } catch (primaryErr) {
    for (const key of fallbackKeys) {
      const fallback = MODELS[key];
      if (!fallback || fallback.id === primaryModel.id) continue;
      try {
        const result = await callAI(fallback, systemPrompt, messages);
        result.modelLabel = `${result.modelLabel} [auto-fallback]`;
        return result;
      } catch (_) {
        // coba model fallback berikutnya
      }
    }
    throw primaryErr;
  }
}

// ─── TOOL: CHAT ───────────────────────────────────────────────────────────────
async function toolChat(prompt, history = [], modelKey) {
  const model = resolveModel(modelKey, DEFAULT_CHAT_MODEL);

  const recentHistory = Array.isArray(history) ? history.slice(-20) : [];
  const messages = recentHistory
    .filter(m => m.role && m.text)
    .map(m => ({
      role   : (m.role === "model" || m.role === "assistant") ? "assistant" : "user",
      content: String(m.text),
    }));
  messages.push({ role: "user", content: String(prompt).trim() });

  const { text, modelLabel, usage } = await callAIWithFallback(model, SYSTEM_CHAT, messages, CHAT_FALLBACKS);

  return {
    answer : text,
    model  : modelLabel,
    usage,
    history: [
      ...recentHistory,
      { role: "user",  text: String(prompt).trim() },
      { role: "model", text },
    ],
  };
}

// ─── TOOL: CODE ───────────────────────────────────────────────────────────────
async function toolCode(prompt, lang = "", modelKey) {
  const model    = resolveModel(modelKey, DEFAULT_CODE_MODEL);
  const messages = [{ role: "user", content: String(prompt).trim() }];

  const { text, modelLabel, usage } = await callAIWithFallback(model, buildSystemCode(lang), messages, CODE_FALLBACKS);

  // Ekstrak code block jika ada
  const codeMatch    = text.match(/```[\w]*\n?([\s\S]*?)```/);
  const langMatch    = text.match(/```(\w+)/);
  const code         = codeMatch ? codeMatch[1].trim() : null;
  const detectedLang = lang || (langMatch ? langMatch[1] : "unknown");

  return {
    answer  : text,
    code,
    language: detectedLang,
    model   : modelLabel,
    usage,
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json(fail("ai", "Method Not Allowed.", 405));
  }

  const q        = req.query || {};
  const body     = req.body  || {};
  const tool     = String(q.tool   || body.tool   || "chat").toLowerCase().trim();
  const prompt   = String(q.prompt || body.prompt || "").trim();
  const modelKey = String(q.model  || body.model  || "").toLowerCase().trim();
  const history  = body.history || [];
  const lang     = String(q.lang   || body.lang   || "").trim();

  if (!prompt) {
    return res.status(400).json({
      ...fail(tool, "Parameter 'prompt' wajib diisi."),
      available_tools : ["chat", "code"],
      available_models: Object.entries(MODELS).map(([k, v]) => ({
        key     : k,
        label   : v.label,
        provider: v.provider,
      })),
      examples: [
        "GET /api/ai?tool=chat&prompt=Halo siapa kamu",
        "GET /api/ai?tool=chat&prompt=Halo&model=gemma",
        "GET /api/ai?tool=code&prompt=Buatkan REST API Express.js&lang=javascript",
        "GET /api/ai?tool=code&prompt=Sorting algorithm&model=deepseek",
      ],
    });
  }

  try {
    switch (tool) {
      case "chat": {
        const result = await toolChat(prompt, history, modelKey);
        return res.status(200).json(ok("chat", result));
      }
      case "code": {
        const result = await toolCode(prompt, lang, modelKey);
        return res.status(200).json(ok("code", result));
      }
      default:
        return res.status(400).json({
          ...fail(tool, `Tool '${tool}' tidak tersedia.`),
          available_tools: ["chat", "code"],
        });
    }
  } catch (err) {
    return res.status(500).json(fail(tool, err.message || "Terjadi kesalahan pada server.", 500));
  }
}
