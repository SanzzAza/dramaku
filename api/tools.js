/**
 * Tools API — AI Image, Anime, Cek Nomor, Cuaca, Kurs, QR Code, Quote, Screenshot, Short URL, TTS
 *
 * GET /api/tools?tool=aiimage&prompt=a cat in space
 * GET /api/tools?tool=anime&type=neko
 * GET /api/tools?tool=cekno&no=08123456789
 * GET /api/tools?tool=cuaca&kota=Jakarta
 * GET /api/tools?tool=kurs&dari=USD&ke=IDR&jumlah=100
 * GET /api/tools?tool=qrcode&text=https://example.com
 * GET /api/tools?tool=quote&lang=id
 * GET /api/tools?tool=screenshot&url=https://example.com
 * GET /api/tools?tool=shorturl&url=https://example.com/very/long/url
 * GET /api/tools?tool=tts&text=Halo&voice=id-ID-Wavenet-A
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: false, code: 405, message: "Method Not Allowed." });
  }

  const tool = (req.query.tool || req.body?.tool || "").toLowerCase();

  if (!tool) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'tool' wajib diisi.",
      available: ["aiimage", "anime", "cekno", "cuaca", "kurs", "qrcode", "quote", "screenshot", "shorturl", "tts", "lirik", "film", "sholat", "resi", "bola", "manga"],
      example: "/api/tools?tool=cuaca&kota=Jakarta",
    });
  }

  try {
    switch (tool) {
      case "aiimage":    return res.status(200).json(await toolAiImage(req));
      case "anime":      return res.status(200).json(await toolAnime(req));
      case "cekno":      return res.status(200).json(await toolCekNo(req));
      case "cuaca":      return res.status(200).json(await toolCuaca(req));
      case "kurs":       return res.status(200).json(await toolKurs(req));
      case "qrcode":     return res.status(200).json(await toolQRCode(req));
      case "quote":      return res.status(200).json(await toolQuote(req));
      case "screenshot": return res.status(200).json(await toolScreenshot(req));
      case "shorturl":   return res.status(200).json(await toolShortUrl(req));
      case "tts":        return res.status(200).json(await toolTTS(req));
      case "lirik":      return res.status(200).json(await toolLirik(req));
      case "film":       return res.status(200).json(await toolFilm(req));
      case "sholat":     return res.status(200).json(await toolSholat(req));
      case "resi":       return res.status(200).json(await toolResi(req));
      case "bola":       return res.status(200).json(await toolBola(req));
      case "manga":      return res.status(200).json(await toolManga(req));
      default:
        return res.status(400).json({
          status: false, code: 400,
          message: `Tool '${tool}' tidak didukung.`,
          available: ["aiimage", "anime", "cekno", "cuaca", "kurs", "qrcode", "quote", "screenshot", "shorturl", "tts", "lirik", "film", "sholat", "resi", "bola", "manga"],
        });
    }
  } catch (err) {
    console.error(`[Tools:${tool}]`, err.message);
    return res.status(500).json({ status: false, code: 500, message: err.message || "Terjadi kesalahan." });
  }
}

// ─── AI Image ────────────────────────────────────────────────────────────────

const VALID_MODELS = ["flux", "flux-realism", "flux-anime", "flux-3d", "turbo"];

async function toolAiImage(req) {
  const prompt = req.query.prompt || req.body?.prompt;
  const width  = parseInt(req.query.width  || req.body?.width  || "1024");
  const height = parseInt(req.query.height || req.body?.height || "1024");
  const model  = req.query.model  || req.body?.model  || "flux";
  const seed   = req.query.seed   || req.body?.seed   || Math.floor(Math.random() * 999999);

  if (!prompt) throw new Error("Parameter 'prompt' wajib diisi. Contoh: /api/tools?tool=aiimage&prompt=a cat astronaut");
  if (!VALID_MODELS.includes(model)) throw new Error(`Model tidak valid. Pilih: ${VALID_MODELS.join(", ")}.`);
  if (width < 128 || width > 1440 || height < 128 || height > 1440) throw new Error("Width dan height harus antara 128 dan 1440.");

  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true`;
  const check = await fetch(imageUrl, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
  if (!check.ok) throw new Error(`Pollinations AI merespons ${check.status}.`);

  return { creator: "@SanzXD", status: true, code: 200, message: "Gambar AI berhasil dibuat.", result: { url: imageUrl, prompt, model, width, height, seed: Number(seed), format: "JPEG", provider: "pollinations.ai" } };
}

// ─── Anime ────────────────────────────────────────────────────────────────────

const NEKOS_TYPES = ["neko","kitsune","husbando","waifu"];
const WAIFU_TYPES = ["waifu","neko","shinobu","megumin","bully","cuddle","cry","hug","awoo","kiss","lick","pat","smug","bonk","yeet","blush","smile","wave","highfive","handhold","nom","bite","glomp","slap","kick","happy","wink","poke","dance","cringe"];
const ALL_TYPES = [...new Set([...NEKOS_TYPES, ...WAIFU_TYPES])];

async function toolAnime(req) {
  const type = (req.query.type || req.body?.type || "neko").toLowerCase();
  if (!ALL_TYPES.includes(type)) throw new Error(`Type '${type}' tidak valid. Available: ${ALL_TYPES.join(", ")}`);

  // Coba nekos.best dulu (lebih reliable di Vercel)
  if (NEKOS_TYPES.includes(type)) {
    try {
      const resp = await fetch(`https://nekos.best/api/v2/${type}`, { signal: AbortSignal.timeout(10_000) });
      if (resp.ok) {
        const data = await resp.json();
        const item = data?.results?.[0];
        if (item?.url) {
          return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil mengambil gambar anime.", result: { url: item.url, type, artist_name: item.artist_name || null, anime_name: item.anime_name || null, category: "sfw", provider: "nekos.best" } };
        }
      }
    } catch { /* fallback */ }
  }

  // Fallback ke waifu.pics
  const waifuType = WAIFU_TYPES.includes(type) ? type : "waifu";
  const resp2 = await fetch(`https://api.waifu.pics/sfw/${waifuType}`, { signal: AbortSignal.timeout(10_000) });
  if (!resp2.ok) throw new Error(`Gagal mengambil gambar anime (${resp2.status}). Coba type lain.`);
  const data2 = await resp2.json();
  if (!data2.url) throw new Error("Gagal mendapatkan URL gambar.");

  return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil mengambil gambar anime.", result: { url: data2.url, type: waifuType, category: "sfw", provider: "waifu.pics" } };
}

// ─── Cek Nomor ────────────────────────────────────────────────────────────────

const PREFIX_MAP = [
  { prefix: ["0811","0812","0813","0821","0822","0823","0851","0852","0853"], operator: "Telkomsel", brand: "simpati / kartu AS / by.U" },
  { prefix: ["0814","0815","0816","0855","0856","0857","0858"], operator: "Indosat Ooredoo Hutchison", brand: "IM3 / Mentari" },
  { prefix: ["0817","0818","0819","0859","0877","0878"], operator: "XL Axiata", brand: "XL" },
  { prefix: ["0831","0832","0833","0838"], operator: "XL Axiata", brand: "Axis" },
  { prefix: ["0895","0896","0897","0898","0899"], operator: "Hutchison 3 Indonesia", brand: "Tri (3)" },
  { prefix: ["0881","0882","0883","0884","0885","0886","0887","0888","0889"], operator: "Smartfren", brand: "Smartfren" },
  { prefix: ["021","022","024","031"], operator: "Telkom Indonesia", brand: "Telepon Rumah" },
];

async function toolCekNo(req) {
  const no = req.query.no || req.body?.no;
  if (!no) throw new Error("Parameter 'no' wajib diisi. Contoh: /api/tools?tool=cekno&no=08123456789");

  let normalized = no.replace(/[\s\-().]/g, "");
  if (normalized.startsWith("+62")) normalized = "0" + normalized.slice(3);
  if (normalized.startsWith("62"))  normalized = "0" + normalized.slice(2);

  if (!/^0\d{8,13}$/.test(normalized)) {
    return { creator: "@SanzXD", status: true, code: 200, message: "Nomor tidak dikenali sebagai nomor HP Indonesia.", result: { nomor_asli: no, nomor_normalized: null, valid: false, operator: null, brand: null, prefix: null, tipe: null } };
  }

  let found = null;
  for (const entry of PREFIX_MAP) {
    for (const p of entry.prefix) {
      if (normalized.startsWith(p)) { found = { ...entry, normalized, prefix: p }; break; }
    }
    if (found) break;
  }

  if (!found) {
    return { creator: "@SanzXD", status: true, code: 200, message: "Nomor tidak dikenali sebagai nomor HP Indonesia.", result: { nomor_asli: no, nomor_normalized: normalized, valid: false, operator: null, brand: null, prefix: null, tipe: null } };
  }

  const tipe = ["021","022","024","031"].some(p => normalized.startsWith(p)) ? "Telepon Rumah" : "Seluler";
  return { creator: "@SanzXD", status: true, code: 200, message: "Nomor berhasil diidentifikasi.", result: { nomor_asli: no, nomor_normalized: normalized, valid: true, operator: found.operator, brand: found.brand, prefix: found.prefix, tipe } };
}

// ─── Cuaca ────────────────────────────────────────────────────────────────────

const WMO_CODES = {
  0:"Cerah",1:"Cerah Berawan",2:"Berawan Sebagian",3:"Mendung",
  45:"Berkabut",48:"Kabut Beku",
  51:"Gerimis Ringan",53:"Gerimis Sedang",55:"Gerimis Lebat",
  61:"Hujan Ringan",63:"Hujan Sedang",65:"Hujan Lebat",
  71:"Salju Ringan",73:"Salju Sedang",75:"Salju Lebat",
  80:"Hujan Lokal Ringan",81:"Hujan Lokal Sedang",82:"Hujan Lokal Lebat",
  95:"Badai Petir",96:"Badai Petir + Hujan Es",99:"Badai Petir Lebat",
};

async function toolCuaca(req) {
  const kota = req.query.kota || req.body?.kota;
  const lat  = req.query.lat  || req.body?.lat;
  const lon  = req.query.lon  || req.body?.lon;
  if (!kota && (!lat || !lon)) throw new Error("Parameter 'kota' atau 'lat' & 'lon' wajib diisi.");

  let latitude = lat, longitude = lon, namaKota = kota;
  if (kota) {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(kota)}&count=1&language=id`);
    const geoData = await geo.json();
    if (!geoData.results?.length) throw new Error(`Kota '${kota}' tidak ditemukan.`);
    latitude  = geoData.results[0].latitude;
    longitude = geoData.results[0].longitude;
    namaKota  = geoData.results[0].name + (geoData.results[0].country ? `, ${geoData.results[0].country}` : "");
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Asia%2FJakarta&forecast_days=3`;
  const resp = await fetch(url);
  const data = await resp.json();
  const c = data.current;
  const d = data.daily;

  const forecast = d.time.map((t, i) => ({ tanggal: t, cuaca: WMO_CODES[d.weather_code[i]] || "Tidak diketahui", suhu_max: d.temperature_2m_max[i], suhu_min: d.temperature_2m_min[i], hujan_mm: d.precipitation_sum[i] }));

  return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil mengambil data cuaca.", result: { kota: namaKota, koordinat: { lat: latitude, lon: longitude }, sekarang: { suhu: c.temperature_2m, suhu_terasa: c.apparent_temperature, kelembaban: c.relative_humidity_2m, cuaca: WMO_CODES[c.weather_code] || "Tidak diketahui", kecepatan_angin: c.wind_speed_10m, arah_angin: c.wind_direction_10m }, prakiraan_3_hari: forecast, satuan: { suhu: "°C", angin: "km/h", hujan: "mm" }, provider: "open-meteo.com" } };
}

// ─── Kurs ─────────────────────────────────────────────────────────────────────

async function toolKurs(req) {
  const dari   = (req.query.dari   || req.body?.dari   || "USD").toUpperCase();
  const ke     = (req.query.ke     || req.body?.ke     || "IDR").toUpperCase();
  const jumlah = parseFloat(req.query.jumlah || req.body?.jumlah || 1);
  if (isNaN(jumlah) || jumlah <= 0) throw new Error("Parameter 'jumlah' harus angka positif.");

  const resp = await fetch(`https://open.er-api.com/v6/latest/${dari}`, { signal: AbortSignal.timeout(10_000) });
  const data = await resp.json();
  if (data.result !== "success") throw new Error(`Mata uang '${dari}' tidak valid atau tidak didukung.`);
  if (!data.rates[ke]) throw new Error(`Mata uang tujuan '${ke}' tidak ditemukan.`);

  const rate  = data.rates[ke];
  const hasil = jumlah * rate;
  const fmt   = (n) => n.toLocaleString("id-ID", { maximumFractionDigits: 4 });

  return { creator: "@SanzXD", status: true, code: 200, message: "Konversi berhasil.", result: { dari, ke, jumlah, rate, hasil, hasil_formatted: `${ke} ${fmt(hasil)}`, last_update: data.time_last_update_utc, provider: "open.er-api.com" } };
}

// ─── QR Code ─────────────────────────────────────────────────────────────────

async function toolQRCode(req) {
  const text  = req.query.text  || req.body?.text;
  const size  = parseInt(req.query.size  || req.body?.size  || "300");
  const color = (req.query.color || req.body?.color || "000000").replace("#", "");
  const bg    = (req.query.bg   || req.body?.bg    || "ffffff").replace("#", "");
  if (!text) throw new Error("Parameter 'text' wajib diisi. Contoh: /api/tools?tool=qrcode&text=https://example.com");
  if (size < 50 || size > 1000) throw new Error("Parameter 'size' harus antara 50 dan 1000.");

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=${color}&bgcolor=${bg}&format=png`;
  const check = await fetch(qrUrl, { method: "HEAD" });
  if (!check.ok) throw new Error("QR service tidak merespons.");

  return { creator: "@SanzXD", status: true, code: 200, message: "QR Code berhasil dibuat.", result: { url: qrUrl, text, size: `${size}x${size}`, color: `#${color}`, background: `#${bg}`, format: "PNG" } };
}

// ─── Quote ────────────────────────────────────────────────────────────────────

async function toolQuote(req) {
  const tag  = req.query.tag  || req.body?.tag  || "";
  const lang = (req.query.lang || req.body?.lang || "en").toLowerCase();

  // Coba quotable.kurokeita.dev
  let content = null, author = null, quoteId = null, tags = [];
  try {
    let url = "https://api.quotable.kurokeita.dev/api/quotes/random";
    if (tag) url += `?tags=${encodeURIComponent(tag)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (resp.ok) {
      const data = await resp.json();
      // Handle berbagai kemungkinan struktur response
      const quote = Array.isArray(data?.data) ? data.data[0] : (data?.data || data);
      content = quote?.content || quote?.body || quote?.quote || null;
      author  = quote?.author?.name || quote?.author || quote?.authorName || null;
      quoteId = quote?._id || quote?.id || null;
      tags    = quote?.tags || [];
    }
  } catch { /* fallback */ }

  // Fallback ke quotable.io jika gagal
  if (!content) {
    try {
      let url2 = "https://api.quotable.io/random";
      if (tag) url2 += `?tags=${encodeURIComponent(tag)}`;
      const resp2 = await fetch(url2, { signal: AbortSignal.timeout(10_000) });
      if (resp2.ok) {
        const data2 = await resp2.json();
        content = data2?.content || null;
        author  = data2?.author  || null;
        quoteId = data2?._id     || null;
        tags    = data2?.tags    || [];
      }
    } catch { /* fallback 2 */ }
  }

  // Fallback ke zenquotes.io
  if (!content) {
    const resp3 = await fetch("https://zenquotes.io/api/random", { signal: AbortSignal.timeout(10_000) });
    if (!resp3.ok) throw new Error("Semua sumber quote tidak tersedia.");
    const data3 = await resp3.json();
    content = data3?.[0]?.q || null;
    author  = data3?.[0]?.a || null;
    if (!content) throw new Error("Gagal mengambil quote dari semua sumber.");
  }

  let translated = null;
  if (lang === "id" && content) {
    try {
      const tr = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(content)}&langpair=en|id`, { signal: AbortSignal.timeout(8_000) });
      const trData = await tr.json();
      translated = trData?.responseData?.translatedText || null;
    } catch { /* translate gagal */ }
  }

  return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil mengambil quote.", result: { quote: content, quote_id: quoteId, author: author || "Unknown", tags, ...(lang === "id" && translated ? { quote_translated: translated } : {}), provider: "quotable.kurokeita.dev" } };
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

async function toolScreenshot(req) {
  const url    = req.query.url    || req.body?.url;
  const width  = parseInt(req.query.width  || req.body?.width  || "1280");
  const height = parseInt(req.query.height || req.body?.height || "720");
  const delay  = parseInt(req.query.delay  || req.body?.delay  || "0");
  if (!url) throw new Error("Parameter 'url' wajib diisi. Contoh: /api/tools?tool=screenshot&url=https://example.com");
  if (!/^https?:\/\/.+\..+/i.test(url)) throw new Error("URL tidak valid.");
  if (width < 320 || width > 1920 || height < 240 || height > 1080) throw new Error("Width: 320-1920, Height: 240-1080.");

  const thumUrl = `https://image.thum.io/get/width/${width}/crop/${height}/noanimate/${encodeURIComponent(url)}`;
  const check = await fetch(thumUrl, { method: "HEAD", signal: AbortSignal.timeout(12_000) });
  if (!check.ok) throw new Error("Screenshot service tidak merespons.");

  const fallbackUrl = `https://api.screenshotmachine.com/?url=${encodeURIComponent(url)}&dimension=${width}x${height}&delay=${delay * 1000}&format=png`;
  return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil membuat screenshot URL.", result: { source_url: url, screenshot_url: thumUrl, fallback_url: fallbackUrl, width, height, format: "PNG", provider: "thum.io" } };
}

// ─── Short URL ────────────────────────────────────────────────────────────────

async function toolShortUrl(req) {
  const url   = req.query.url   || req.body?.url;
  const alias = req.query.alias || req.body?.alias || "";
  if (!url) throw new Error("Parameter 'url' wajib diisi. Contoh: /api/tools?tool=shorturl&url=https://example.com/long/path");
  if (!/^https?:\/\/.+\..+/i.test(url)) throw new Error("URL tidak valid. Pastikan diawali dengan http:// atau https://");

  const apiUrl = new URL("https://is.gd/create.php");
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("url", url);
  if (alias) apiUrl.searchParams.set("shorturl", alias);

  const resp = await fetch(apiUrl.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; SanzXD-API/1.0)" }, signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error(`is.gd merespons ${resp.status}.`);
  const data = await resp.json();
  if (data.errorcode) throw new Error(data.errormessage || "Gagal mempersingkat URL.");

  const shortUrl = data.shorturl;
  if (!shortUrl) throw new Error("Gagal mendapatkan short URL.");
  const saved = url.length - shortUrl.length;

  return { creator: "@SanzXD", status: true, code: 200, message: "URL berhasil dipersingkat.", result: { original_url: url, short_url: shortUrl, alias: shortUrl.split("/").pop(), chars_saved: saved > 0 ? saved : 0, provider: "is.gd" } };
}

// ─── TTS ─────────────────────────────────────────────────────────────────────

const TTS_VOICES_ID = ["id-ID-Standard-A","id-ID-Standard-B","id-ID-Standard-C","id-ID-Standard-D","id-ID-Wavenet-A","id-ID-Wavenet-B","id-ID-Wavenet-C","id-ID-Wavenet-D"];
const TTS_VOICES_EN = ["Brian","Amy","Emma","Joey","Justin","Matthew","Ivy","Kendra","Kimberly","Salli","Joanna"];
const VALID_VOICES  = [...TTS_VOICES_ID, ...TTS_VOICES_EN, "Linda", "Filiz", "Tatyana", "Maxim", "Marlene", "Hans", "Mizuki", "Liv"];

async function toolTTS(req) {
  const text  = req.query.text  || req.body?.text;
  const voice = req.query.voice || req.body?.voice || "Brian";
  if (!text) throw new Error("Parameter 'text' wajib diisi. Contoh: /api/tools?tool=tts&text=Halo+selamat+datang");
  if (text.length > 500) throw new Error("Teks maksimal 500 karakter.");

  // Coba TikTok TTS (tidak butuh auth)
  try {
    const tiktokVoice = voice.startsWith("id-") ? "id_001" : "en_us_006";
    const tiktokResp = await fetch("https://tiktok-tts.weilbyte.dev/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: tiktokVoice }),
      signal: AbortSignal.timeout(12_000),
    });
    if (tiktokResp.ok) {
      const tiktokData = await tiktokResp.json();
      if (tiktokData?.data) {
        const audioUrl = `data:audio/mpeg;base64,${tiktokData.data}`;
        return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil membuat audio TTS.", result: { text, voice: tiktokVoice, audio_url: audioUrl, audio_base64: tiktokData.data, content_type: "audio/mpeg", chars: text.length, provider: "tiktok-tts.weilbyte.dev" } };
      }
    }
  } catch { /* fallback */ }

  // Fallback: Google Translate TTS (tidak butuh auth, max 200 char)
  const shortText = text.slice(0, 200);
  const lang = voice.startsWith("id-") ? "id" : "en";
  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(shortText)}`;
  const check = await fetch(googleTtsUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
    method: "HEAD",
    signal: AbortSignal.timeout(10_000),
  });
  if (!check.ok) throw new Error("TTS service tidak tersedia saat ini. Coba lagi nanti.");

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil membuat audio TTS.",
    result: {
      text: shortText, voice: `${lang}-Google-TTS`, audio_url: googleTtsUrl,
      content_type: "audio/mpeg", chars: shortText.length,
      note: text.length > 200 ? `Teks dipotong ke 200 karakter karena keterbatasan provider.` : undefined,
      voices_indonesia: ["id-ID-Wavenet-A (Female)", "id-ID-Wavenet-B (Male)", "id-ID-Wavenet-C (Female)", "id-ID-Wavenet-D (Male)"],
      provider: "translate.google.com",
    },
  };
}

// ─── Lirik Lagu ───────────────────────────────────────────────────────────────

async function toolLirik(req) {
  const action = (req.query.action || req.body?.action || "get").toLowerCase();
  const query  = req.query.query  || req.body?.query  || "";
  const artist = req.query.artist || req.body?.artist || "";
  const title  = req.query.title  || req.body?.title  || "";

  if (action === "search") {
    if (!query) throw new Error("Parameter 'query' wajib diisi. Contoh: /api/tools?tool=lirik&action=search&query=bohemian rhapsody");
    const resp = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}&limit=10`, {
      headers: { "User-Agent": "SanzXD-API/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error("Gagal mencari lagu. Coba lagi nanti.");
    const data = await resp.json();
    if (!data.length) throw new Error(`Lagu '${query}' tidak ditemukan.`);
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: `Ditemukan ${data.length} lagu.`,
      result: data.slice(0, 10).map(s => ({
        id: s.id,
        title: s.trackName,
        artist: s.artistName,
        album: s.albumName,
        duration: s.duration,
        has_synced: s.syncedLyrics ? true : false,
        has_plain: s.plainLyrics ? true : false,
      })),
    };
  }

  // action = get
  let q = "";
  if (artist && title) q = `artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
  else if (query)      q = `q=${encodeURIComponent(query)}`;
  else throw new Error("Parameter 'artist' & 'title' atau 'query' wajib diisi. Contoh: /api/tools?tool=lirik&artist=queen&title=bohemian rhapsody");

  // Coba get langsung dulu
  let song = null;
  if (artist && title) {
    try {
      const r = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`, {
        headers: { "User-Agent": "SanzXD-API/1.0" }, signal: AbortSignal.timeout(10_000),
      });
      if (r.ok) song = await r.json();
    } catch { /* fallback ke search */ }
  }

  // Fallback ke search
  if (!song) {
    const r2 = await fetch(`https://lrclib.net/api/search?${q}&limit=1`, {
      headers: { "User-Agent": "SanzXD-API/1.0" }, signal: AbortSignal.timeout(10_000),
    });
    if (!r2.ok) throw new Error("Gagal mengambil lirik. Coba lagi nanti.");
    const arr = await r2.json();
    if (!arr.length) throw new Error("Lirik tidak ditemukan. Coba cari dengan kata kunci lain.");
    song = arr[0];
  }

  const lirik = song.syncedLyrics || song.plainLyrics;
  if (!lirik) throw new Error("Lirik untuk lagu ini belum tersedia.");

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil lirik lagu.",
    result: {
      id: song.id,
      title: song.trackName,
      artist: song.artistName,
      album: song.albumName || null,
      duration: song.duration || null,
      lirik: song.plainLyrics || null,
      lirik_synced: song.syncedLyrics || null,
      provider: "lrclib.net",
    },
  };
}

// ─── Info Film / Series ───────────────────────────────────────────────────────

async function toolFilm(req) {
  const action = (req.query.action || req.body?.action || "search").toLowerCase();
  const query  = req.query.query  || req.body?.query  || "";
  const id     = req.query.id     || req.body?.id     || "";
  const type   = (req.query.type  || req.body?.type   || "movie").toLowerCase(); // movie | tv
  const lang   = req.query.lang   || req.body?.lang   || "id-ID";

  const TMDB_KEY = "b3fd6185a9d2f78740e9deec9d51c9e3";
  const BASE     = "https://api.themoviedb.org/3";
  const IMG      = "https://image.tmdb.org/t/p/w500";

  const headers  = { "Authorization": `Bearer ${TMDB_KEY}`, "accept": "application/json" };

  if (action === "search") {
    if (!query) throw new Error("Parameter 'query' wajib diisi. Contoh: /api/tools?tool=film&query=avengers&type=movie");
    const url = `${BASE}/search/${type === "tv" ? "tv" : "movie"}?query=${encodeURIComponent(query)}&language=${lang}&page=1`;
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mencari film. Coba lagi nanti.");
    const data = await resp.json();
    if (!data.results?.length) throw new Error(`Film/series '${query}' tidak ditemukan.`);
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: `Ditemukan ${data.total_results} hasil.`,
      result: data.results.slice(0, 10).map(f => ({
        id: f.id,
        title: f.title || f.name,
        type: type === "tv" ? "series" : "movie",
        release_date: f.release_date || f.first_air_date || null,
        rating: f.vote_average ? Math.round(f.vote_average * 10) / 10 : null,
        votes: f.vote_count,
        overview: f.overview || null,
        poster: f.poster_path ? IMG + f.poster_path : null,
        backdrop: f.backdrop_path ? IMG + f.backdrop_path : null,
        popularity: f.popularity,
      })),
    };
  }

  if (action === "detail") {
    if (!id) throw new Error("Parameter 'id' wajib diisi. Contoh: /api/tools?tool=film&action=detail&id=299536&type=movie");
    const endpoint = type === "tv" ? "tv" : "movie";
    const url = `${BASE}/${endpoint}/${id}?language=${lang}&append_to_response=credits,videos,similar`;
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`Film dengan ID '${id}' tidak ditemukan.`);
    const f = await resp.json();

    const trailer = f.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
    const cast    = f.credits?.cast?.slice(0, 10).map(c => ({ name: c.name, character: c.character, photo: c.profile_path ? IMG + c.profile_path : null }));
    const similar = f.similar?.results?.slice(0, 5).map(s => ({ id: s.id, title: s.title || s.name, rating: s.vote_average, poster: s.poster_path ? IMG + s.poster_path : null }));

    return {
      creator: "@SanzXD", status: true, code: 200,
      message: "Berhasil mengambil detail film/series.",
      result: {
        id: f.id,
        title: f.title || f.name,
        tagline: f.tagline || null,
        type: type === "tv" ? "series" : "movie",
        status: f.status,
        release_date: f.release_date || f.first_air_date || null,
        runtime: f.runtime || (f.episode_run_time?.[0]) || null,
        rating: f.vote_average ? Math.round(f.vote_average * 10) / 10 : null,
        votes: f.vote_count,
        genres: f.genres?.map(g => g.name) || [],
        overview: f.overview || null,
        poster: f.poster_path ? IMG + f.poster_path : null,
        backdrop: f.backdrop_path ? IMG + f.backdrop_path : null,
        trailer_youtube: trailer ? `https://youtube.com/watch?v=${trailer.key}` : null,
        ...(type === "tv" ? { seasons: f.number_of_seasons, episodes: f.number_of_episodes } : {}),
        production: f.production_companies?.slice(0, 3).map(p => p.name) || [],
        cast, similar,
        provider: "themoviedb.org",
      },
    };
  }

  if (action === "trending") {
    const period = req.query.period || req.body?.period || "week"; // day | week
    const url = `${BASE}/trending/${type === "tv" ? "tv" : "movie"}/${period}?language=${lang}`;
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mengambil trending. Coba lagi nanti.");
    const data = await resp.json();
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: `Film/series trending ${period === "day" ? "hari ini" : "minggu ini"}.`,
      result: data.results.slice(0, 10).map(f => ({
        id: f.id,
        title: f.title || f.name,
        type: f.media_type,
        release_date: f.release_date || f.first_air_date || null,
        rating: f.vote_average ? Math.round(f.vote_average * 10) / 10 : null,
        overview: f.overview || null,
        poster: f.poster_path ? IMG + f.poster_path : null,
      })),
    };
  }

  throw new Error("Action tidak valid. Gunakan: search, detail, trending. Contoh: /api/tools?tool=film&action=search&query=avengers");
}

// ─── Jadwal Sholat ────────────────────────────────────────────────────────────

async function toolSholat(req) {
  const action = (req.query.action || req.body?.action || "jadwal").toLowerCase();
  const kota   = req.query.kota   || req.body?.kota   || "";
  const lat    = req.query.lat    || req.body?.lat    || "";
  const lon    = req.query.lon    || req.body?.lon    || "";
  const tanggal = req.query.tanggal || req.body?.tanggal || "";
  const method  = parseInt(req.query.method || req.body?.method || "11"); // 11 = KEMENAG Indonesia

  if (action === "kota") {
    // Cari city ID dari nama kota
    const resp = await fetch(`https://api.aladhan.com/v1/cityInfo?city=${encodeURIComponent(kota || "Jakarta")}&country=ID`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await resp.json();
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: "Info kota.",
      result: data.data || data,
    };
  }

  // Resolve koordinat dari nama kota jika perlu
  let latitude = lat, longitude = lon, namaKota = kota;
  if (kota && (!lat || !lon)) {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(kota)}&count=1&language=id`, {
      signal: AbortSignal.timeout(8_000),
    });
    const geoData = await geo.json();
    if (!geoData.results?.length) throw new Error(`Kota '${kota}' tidak ditemukan. Coba nama kota lain.`);
    latitude  = geoData.results[0].latitude;
    longitude = geoData.results[0].longitude;
    namaKota  = geoData.results[0].name;
  }

  if (!latitude || !longitude) throw new Error("Parameter 'kota' atau 'lat' & 'lon' wajib diisi. Contoh: /api/tools?tool=sholat&kota=Jakarta");

  // Build tanggal
  const now = new Date();
  const tgl = tanggal || `${String(now.getDate()).padStart(2,"0")}-${String(now.getMonth()+1).padStart(2,"0")}-${now.getFullYear()}`;

  const url = `https://api.aladhan.com/v1/timings/${tgl}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error("Gagal mengambil jadwal sholat. Coba lagi nanti.");
  const data = await resp.json();

  if (data.code !== 200) throw new Error(data.data || "Gagal mengambil jadwal sholat.");

  const t = data.data.timings;
  const d = data.data.date;

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil mengambil jadwal sholat.",
    result: {
      kota: namaKota || `${latitude}, ${longitude}`,
      koordinat: { lat: latitude, lon: longitude },
      tanggal: {
        masehi: d.readable,
        hijriah: `${d.hijri.day} ${d.hijri.month.en} ${d.hijri.year} H`,
      },
      jadwal: {
        imsak:   t.Imsak,
        subuh:   t.Fajr,
        terbit:  t.Sunrise,
        dhuha:   t.Dhuha,
        dzuhur:  t.Dhuhr,
        ashar:   t.Asr,
        maghrib: t.Maghrib,
        isya:    t.Isha,
        tengah_malam: t.Midnight,
      },
      metode: `KEMENAG Indonesia (method ${method})`,
      provider: "aladhan.com",
    },
  };
}

// ─── Cek Nomor Resi ───────────────────────────────────────────────────────────

async function toolResi(req) {
  const resi     = req.query.resi     || req.body?.resi     || "";
  const kurir    = (req.query.kurir   || req.body?.kurir    || "").toLowerCase();

  if (!resi) throw new Error("Parameter 'resi' wajib diisi. Contoh: /api/tools?tool=resi&resi=JD0123456789&kurir=jne");

  const VALID_KURIR = ["jne","jnt","sicepat","anteraja","ninja","lion","tiki","pos","wahana","dakses"];

  if (kurir && !VALID_KURIR.includes(kurir)) throw new Error(`Kurir '${kurir}' tidak didukung. Pilih: ${VALID_KURIR.join(", ")}`);

  // Binderbyte API (free tier tersedia)
  const apiKey = "3dcdfdf5e1cebd98c5b2aaec0a48d42de4d6b97c09b14a9e43bf80c2f0b285e2";
  const kurirParam = kurir || "jne";
  const url = `https://api.binderbyte.com/v1/track?api_key=${apiKey}&courier=${kurirParam}&awb=${encodeURIComponent(resi)}`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) throw new Error("Layanan pelacakan tidak merespons. Coba lagi nanti.");
  const data = await resp.json();

  if (data.status !== 200) throw new Error(data.message || `Resi '${resi}' tidak ditemukan untuk kurir ${kurirParam.toUpperCase()}.`);

  const summary = data.data?.summary;
  const history = data.data?.history || [];

  return {
    creator: "@SanzXD", status: true, code: 200,
    message: "Berhasil melacak paket.",
    result: {
      resi,
      kurir: kurirParam.toUpperCase(),
      status: summary?.status || "Tidak diketahui",
      pengirim: summary?.shipper || null,
      penerima: summary?.receiver || null,
      asal: summary?.origin || null,
      tujuan: summary?.destination || null,
      berat: summary?.weight || null,
      tanggal_kirim: summary?.date || null,
      tanggal_terima: summary?.waybill_date || null,
      deskripsi: summary?.desc || null,
      riwayat: history.slice(0, 10).map(h => ({
        tanggal: h.date,
        keterangan: h.desc,
        lokasi: h.location || null,
      })),
      provider: "binderbyte.com",
    },
  };
}

// ─── Jadwal & Skor Bola ───────────────────────────────────────────────────────

async function toolBola(req) {
  const action  = (req.query.action  || req.body?.action  || "live").toLowerCase();
  const liga    = (req.query.liga    || req.body?.liga    || "").toLowerCase();
  const tim     = req.query.tim      || req.body?.tim     || "";
  const matchId = req.query.id       || req.body?.id      || "";

  // Liga IDs di TheSportsDB (gratis)
  const LIGA_MAP = {
    "epl":           "4328", "premier league": "4328",
    "laliga":        "4335", "la liga":        "4335",
    "bundesliga":    "4331",
    "serie a":       "4332", "seriea":         "4332",
    "ligue 1":       "4334", "ligue1":         "4334",
    "liga indonesia":"4364", "bri liga 1":     "4364",
    "champions":     "4480", "ucl":            "4480",
    "world cup":     "4429",
  };

  const BASE = "https://www.thesportsdb.com/api/v1/json/3";

  if (action === "live") {
    const resp = await fetch(`${BASE}/livescore.php?s=Soccer`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mengambil data live score.");
    const data = await resp.json();
    const matches = data.events || [];
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: matches.length ? `${matches.length} pertandingan sedang berlangsung.` : "Tidak ada pertandingan live saat ini.",
      result: matches.map(m => ({
        id: m.idEvent,
        liga: m.strLeague,
        home: m.strHomeTeam,
        away: m.strAwayTeam,
        skor: `${m.intHomeScore ?? "-"} - ${m.intAwayScore ?? "-"}`,
        menit: m.strProgress || null,
        venue: m.strVenue || null,
      })),
    };
  }

  if (action === "jadwal") {
    const ligaId = LIGA_MAP[liga] || liga;
    if (!ligaId) throw new Error(`Parameter 'liga' tidak valid. Pilih: ${Object.keys(LIGA_MAP).filter((_, i) => i % 2 === 0).join(", ")}`);
    const resp = await fetch(`${BASE}/eventsnextleague.php?id=${ligaId}`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mengambil jadwal.");
    const data = await resp.json();
    const matches = data.events || [];
    if (!matches.length) throw new Error("Jadwal tidak tersedia saat ini.");
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: `${matches.length} pertandingan mendatang.`,
      result: matches.slice(0, 15).map(m => ({
        id: m.idEvent,
        liga: m.strLeague,
        home: m.strHomeTeam,
        away: m.strAwayTeam,
        tanggal: m.dateEvent,
        waktu: m.strTime || null,
        venue: m.strVenue || null,
      })),
    };
  }

  if (action === "hasil") {
    const ligaId = LIGA_MAP[liga] || liga;
    if (!ligaId) throw new Error(`Parameter 'liga' tidak valid. Pilih: ${Object.keys(LIGA_MAP).filter((_, i) => i % 2 === 0).join(", ")}`);
    const resp = await fetch(`${BASE}/eventspastleague.php?id=${ligaId}`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mengambil hasil pertandingan.");
    const data = await resp.json();
    const matches = (data.events || []).reverse();
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: `${matches.length} hasil pertandingan terakhir.`,
      result: matches.slice(0, 15).map(m => ({
        id: m.idEvent,
        liga: m.strLeague,
        home: m.strHomeTeam,
        away: m.strAwayTeam,
        skor: `${m.intHomeScore ?? "-"} - ${m.intAwayScore ?? "-"}`,
        tanggal: m.dateEvent,
        venue: m.strVenue || null,
      })),
    };
  }

  if (action === "detail") {
    if (!matchId) throw new Error("Parameter 'id' wajib diisi. Gunakan action=jadwal atau action=hasil untuk dapat ID.");
    const resp = await fetch(`${BASE}/lookupevent.php?id=${matchId}`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mengambil detail pertandingan.");
    const data = await resp.json();
    const m = data.events?.[0];
    if (!m) throw new Error(`Pertandingan ID '${matchId}' tidak ditemukan.`);
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: "Detail pertandingan.",
      result: {
        id: m.idEvent,
        liga: m.strLeague,
        musim: m.strSeason,
        home: m.strHomeTeam,
        away: m.strAwayTeam,
        skor: `${m.intHomeScore ?? "-"} - ${m.intAwayScore ?? "-"}`,
        tanggal: m.dateEvent,
        waktu: m.strTime || null,
        venue: m.strVenue || null,
        kota: m.strCity || null,
        highlight: m.strVideo || null,
        thumbnail: m.strThumb || null,
        deskripsi: m.strDescriptionEN || null,
      },
    };
  }

  if (action === "cari") {
    if (!tim) throw new Error("Parameter 'tim' wajib diisi. Contoh: /api/tools?tool=bola&action=cari&tim=manchester united");
    const resp = await fetch(`${BASE}/searchteams.php?t=${encodeURIComponent(tim)}`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mencari tim.");
    const data = await resp.json();
    const teams = data.teams || [];
    if (!teams.length) throw new Error(`Tim '${tim}' tidak ditemukan.`);
    const t = teams[0];
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: `Info tim ${t.strTeam}.`,
      result: {
        id: t.idTeam,
        nama: t.strTeam,
        liga: t.strLeague,
        negara: t.strCountry,
        berdiri: t.intFormedYear,
        stadion: t.strStadium,
        kapasitas: t.intStadiumCapacity,
        deskripsi: t.strDescriptionEN?.slice(0, 300) || null,
        logo: t.strTeamBadge || null,
        jersey: t.strTeamJersey || null,
        website: t.strWebsite || null,
      },
    };
  }

  throw new Error("Action tidak valid. Gunakan: live, jadwal, hasil, detail, cari. Contoh: /api/tools?tool=bola&action=jadwal&liga=epl");
}

// ─── Baca Manga / Komik ───────────────────────────────────────────────────────

async function toolManga(req) {
  const action  = (req.query.action  || req.body?.action  || "search").toLowerCase();
  const query   = req.query.query    || req.body?.query   || "";
  const id      = req.query.id       || req.body?.id      || "";
  const chapter = req.query.chapter  || req.body?.chapter || "";
  const lang    = req.query.lang     || req.body?.lang    || "id"; // id | en
  const limit   = Math.min(parseInt(req.query.limit || req.body?.limit || "10"), 20);

  const BASE = "https://api.mangadex.org";
  const IMG  = "https://uploads.mangadex.org/covers";

  if (action === "search") {
    if (!query) throw new Error("Parameter 'query' wajib diisi. Contoh: /api/tools?tool=manga&action=search&query=naruto");
    const params = new URLSearchParams({
      title: query,
      limit: String(limit),
      "availableTranslatedLanguage[]": lang,
      "includes[]": "cover_art",
      order: "relevance",
    });
    const resp = await fetch(`${BASE}/manga?${params}`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mencari manga. Coba lagi nanti.");
    const data = await resp.json();
    if (!data.data?.length) throw new Error(`Manga '${query}' tidak ditemukan.`);

    return {
      creator: "@SanzXD", status: true, code: 200,
      message: `Ditemukan ${data.total} manga.`,
      result: data.data.map(m => {
        const cover = m.relationships?.find(r => r.type === "cover_art");
        const coverUrl = cover?.attributes?.fileName ? `${IMG}/${m.id}/${cover.attributes.fileName}` : null;
        return {
          id: m.id,
          title: m.attributes.title?.en || m.attributes.title?.id || Object.values(m.attributes.title)[0] || "Untitled",
          alt_titles: m.attributes.altTitles?.slice(0, 2).map(t => Object.values(t)[0]) || [],
          status: m.attributes.status,
          year: m.attributes.year || null,
          rating: m.attributes.contentRating,
          genres: m.attributes.tags?.filter(t => t.attributes.group === "genre").map(t => t.attributes.name.en).slice(0, 5) || [],
          cover: coverUrl,
          desc: m.attributes.description?.id || m.attributes.description?.en || null,
        };
      }),
    };
  }

  if (action === "detail") {
    if (!id) throw new Error("Parameter 'id' wajib diisi. Gunakan action=search untuk dapat ID manga.");
    const resp = await fetch(`${BASE}/manga/${id}?includes[]=cover_art&includes[]=author`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`Manga ID '${id}' tidak ditemukan.`);
    const { data: m } = await resp.json();

    const cover  = m.relationships?.find(r => r.type === "cover_art");
    const author = m.relationships?.find(r => r.type === "author");
    const coverUrl = cover?.attributes?.fileName ? `${IMG}/${m.id}/${cover.attributes.fileName}` : null;

    // Ambil total chapter
    const chapResp = await fetch(`${BASE}/manga/${id}/aggregate?translatedLanguage[]=${lang}`, { signal: AbortSignal.timeout(8_000) });
    const chapData = chapResp.ok ? await chapResp.json() : {};
    const volumes  = chapData.volumes ? Object.keys(chapData.volumes).length : null;
    const chapters = chapData.volumes ? Object.values(chapData.volumes).reduce((acc, v) => acc + Object.keys(v.chapters || {}).length, 0) : null;

    return {
      creator: "@SanzXD", status: true, code: 200,
      message: "Detail manga.",
      result: {
        id: m.id,
        title: m.attributes.title?.en || m.attributes.title?.id || Object.values(m.attributes.title)[0],
        author: author?.attributes?.name || null,
        status: m.attributes.status,
        year: m.attributes.year || null,
        rating: m.attributes.contentRating,
        genres: m.attributes.tags?.filter(t => t.attributes.group === "genre").map(t => t.attributes.name.en) || [],
        themes: m.attributes.tags?.filter(t => t.attributes.group === "theme").map(t => t.attributes.name.en) || [],
        cover: coverUrl,
        volumes_available: volumes,
        chapters_available: chapters,
        desc: m.attributes.description?.id || m.attributes.description?.en || null,
        links: m.attributes.links || {},
        provider: "mangadex.org",
      },
    };
  }

  if (action === "chapters") {
    if (!id) throw new Error("Parameter 'id' wajib diisi. Contoh: /api/tools?tool=manga&action=chapters&id=MANGA_ID&lang=id");
    const params = new URLSearchParams({
      manga: id,
      "translatedLanguage[]": lang,
      order: "chapter",
      limit: String(limit),
      "includes[]": "scanlation_group",
    });
    const resp = await fetch(`${BASE}/chapter?${params}`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mengambil daftar chapter.");
    const data = await resp.json();
    if (!data.data?.length) throw new Error(`Chapter bahasa '${lang}' tidak tersedia. Coba lang=en.`);
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: `${data.total} chapter tersedia.`,
      result: data.data.map(c => ({
        id: c.id,
        chapter: c.attributes.chapter || "Oneshot",
        title: c.attributes.title || null,
        lang: c.attributes.translatedLanguage,
        pages: c.attributes.pages,
        published: c.attributes.publishAt?.slice(0, 10),
        group: c.relationships?.find(r => r.type === "scanlation_group")?.attributes?.name || null,
      })),
    };
  }

  if (action === "read") {
    if (!chapter) throw new Error("Parameter 'chapter' (chapter ID) wajib diisi. Gunakan action=chapters untuk dapat ID chapter.");
    const resp = await fetch(`${BASE}/at-home/server/${chapter}`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`Chapter ID '${chapter}' tidak ditemukan.`);
    const data = await resp.json();
    const base  = data.baseUrl;
    const hash  = data.chapter?.hash;
    const pages = data.chapter?.data || [];
    const pagesSaver = data.chapter?.dataSaver || [];

    return {
      creator: "@SanzXD", status: true, code: 200,
      message: `${pages.length} halaman tersedia.`,
      result: {
        chapter_id: chapter,
        total_pages: pages.length,
        pages: pages.map((p, i) => ({
          page: i + 1,
          url: `${base}/data/${hash}/${p}`,
          url_saver: pagesSaver[i] ? `${base}/data-saver/${hash}/${pagesSaver[i]}` : null,
        })),
        provider: "mangadex.org",
      },
    };
  }

  if (action === "trending") {
    const params = new URLSearchParams({
      limit: "10",
      "includes[]": "cover_art",
      order: "followedCount",
      "availableTranslatedLanguage[]": lang,
      contentRating: "safe",
    });
    const resp = await fetch(`${BASE}/manga?${params}`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error("Gagal mengambil manga trending.");
    const data = await resp.json();
    return {
      creator: "@SanzXD", status: true, code: 200,
      message: "Manga populer.",
      result: data.data.map(m => {
        const cover = m.relationships?.find(r => r.type === "cover_art");
        const coverUrl = cover?.attributes?.fileName ? `${IMG}/${m.id}/${cover.attributes.fileName}` : null;
        return {
          id: m.id,
          title: m.attributes.title?.en || Object.values(m.attributes.title)[0],
          status: m.attributes.status,
          cover: coverUrl,
          genres: m.attributes.tags?.filter(t => t.attributes.group === "genre").map(t => t.attributes.name.en).slice(0, 4) || [],
        };
      }),
    };
  }

  throw new Error("Action tidak valid. Gunakan: search, detail, chapters, read, trending. Contoh: /api/tools?tool=manga&action=search&query=naruto");
}
