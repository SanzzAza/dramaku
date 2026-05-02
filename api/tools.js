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
      available: ["aiimage", "anime", "cekno", "cuaca", "kurs", "qrcode", "quote", "screenshot", "shorturl", "tts"],
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
      default:
        return res.status(400).json({
          status: false, code: 400,
          message: `Tool '${tool}' tidak didukung.`,
          available: ["aiimage", "anime", "cekno", "cuaca", "kurs", "qrcode", "quote", "screenshot", "shorturl", "tts"],
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

const SFW_TYPES = ["waifu","neko","shinobu","megumin","bully","cuddle","cry","hug","awoo","kiss","lick","pat","smug","bonk","yeet","blush","smile","wave","highfive","handhold","nom","bite","glomp","slap","kick","happy","wink","poke","dance","cringe"];

async function toolAnime(req) {
  const type = (req.query.type || req.body?.type || "waifu").toLowerCase();
  if (!SFW_TYPES.includes(type)) throw new Error(`Type '${type}' tidak valid. Available: ${SFW_TYPES.join(", ")}`);

  const resp = await fetch(`https://api.waifu.pics/sfw/${type}`, { signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error(`waifu.pics merespons ${resp.status}.`);
  const data = await resp.json();
  if (!data.url) throw new Error("Gagal mendapatkan URL gambar.");

  return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil mengambil gambar anime.", result: { url: data.url, type, category: "sfw", provider: "waifu.pics" } };
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

  let url = "https://api.quotable.kurokeita.dev/api/quotes/random";
  if (tag) url += `?tags=${encodeURIComponent(tag)}`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error("Gagal mengambil quote.");
  const data = await resp.json();

  const quote   = data?.data?.[0] || data;
  const content = quote.content || quote.body;
  const author  = quote.author?.name || quote.author || "Unknown";

  let translated = null;
  if (lang === "id") {
    try {
      const tr = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(content)}&langpair=en|id`, { signal: AbortSignal.timeout(8_000) });
      const trData = await tr.json();
      translated = trData?.responseData?.translatedText || null;
    } catch { /* translate gagal, lanjut */ }
  }

  return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil mengambil quote.", result: { quote: content, quote_id: quote._id || quote.id || null, author, tags: quote.tags || [], ...(lang === "id" && translated ? { quote_translated: translated } : {}), provider: "quotable.kurokeita.dev" } };
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

const VALID_VOICES = ["id-ID-Wavenet-A","id-ID-Wavenet-B","id-ID-Wavenet-C","id-ID-Wavenet-D","Brian","Amy","Emma","Geraint","Russell","Nicole","Joey","Justin","Matthew","Ivy","Kendra","Kimberly","Salli","Joanna","Filiz","Tatyana","Maxim","Conchita","Enrique","Celine","Mathieu","Marlene","Hans","Dora","Karl","Carla","Giorgio","Mizuki","Liv","Lotte","Ruben","Ewa","Jacek","Jan","Maja","Ricardo","Vitoria","Cristiano","Ines","Carmen","Astrid","Vicki","Chantal","Penelope","Miguel","Mia"];

async function toolTTS(req) {
  const text  = req.query.text  || req.body?.text;
  const voice = req.query.voice || req.body?.voice || "id-ID-Wavenet-A";
  if (!text) throw new Error("Parameter 'text' wajib diisi. Contoh: /api/tools?tool=tts&text=Halo+selamat+datang");
  if (text.length > 500) throw new Error("Teks maksimal 500 karakter.");

  const audioUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
  const check = await fetch(audioUrl, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
  if (!check.ok) throw new Error(`TTS service merespons ${check.status}.`);

  return { creator: "@SanzXD", status: true, code: 200, message: "Berhasil membuat audio TTS.", result: { text, voice, audio_url: audioUrl, content_type: check.headers.get("content-type") || "audio/mpeg", chars: text.length, voices_indonesia: ["id-ID-Wavenet-A (Female)","id-ID-Wavenet-B (Male)","id-ID-Wavenet-C (Female)","id-ID-Wavenet-D (Male)"], provider: "streamelements.com" } };
}
