/**
 * Text to Speech API — via StreamElements TTS (free, no key)
 * GET /api/tts?text=Halo selamat datang&voice=id-ID-Wavenet-A
 *
 * Voices Indonesia: id-ID-Wavenet-A (Female), id-ID-Wavenet-B (Male),
 *                   id-ID-Wavenet-C (Female), id-ID-Wavenet-D (Male)
 * Voices English: Brian, Amy, Emma, Geraint, Russell, Joey, Matthew, Ivy
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const VALID_VOICES = [
  // Indonesia
  "id-ID-Wavenet-A","id-ID-Wavenet-B","id-ID-Wavenet-C","id-ID-Wavenet-D",
  // English
  "Brian","Amy","Emma","Geraint","Russell","Nicole","Joey","Justin","Matthew","Ivy","Kendra","Kimberly","Salli","Joanna",
  // Other
  "Filiz","Tatyana","Maxim","Conchita","Enrique","Celine","Mathieu","Marlene","Hans","Dora","Karl","Carla","Giorgio","Mizuki","Liv","Lotte","Ruben","Ewa","Jacek","Jan","Maja","Ricardo","Vitoria","Cristiano","Ines","Carmen","Maxim","Tatyana","Astrid","Vicki","Chantal","Penelope","Miguel","Mia",
];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(200, CORS_HEADERS); return res.end(); }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (!["GET","POST"].includes(req.method)) return res.status(405).json({ status:false, code:405, message:"Method Not Allowed." });

  const text  = req.query.text  || req.body?.text;
  const voice = req.query.voice || req.body?.voice || "id-ID-Wavenet-A";

  if (!text) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'text' wajib diisi.",
      example: "/api/tts?text=Halo selamat datang&voice=id-ID-Wavenet-A",
    });
  }

  if (text.length > 500) {
    return res.status(400).json({ status:false, code:400, message:"Teks maksimal 500 karakter." });
  }

  try {
    // StreamElements TTS — free, no key, direct audio URL
    const audioUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;

    // Verifikasi bisa diakses
    const check = await fetch(audioUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(10_000),
    });

    if (!check.ok) throw new Error(`TTS service merespons ${check.status}.`);

    const contentType = check.headers.get("content-type") || "audio/mpeg";

    return res.status(200).json({
      creator: "@SanzXD",
      status: true, code: 200,
      message: "Berhasil membuat audio TTS.",
      result: {
        text,
        voice,
        audio_url: audioUrl,
        content_type: contentType,
        chars: text.length,
        voices_indonesia: ["id-ID-Wavenet-A (Female)","id-ID-Wavenet-B (Male)","id-ID-Wavenet-C (Female)","id-ID-Wavenet-D (Male)"],
        provider: "streamelements.com",
      },
    });
  } catch (err) {
    console.error("[TTS]", err.message);
    return res.status(500).json({ status:false, code:500, message: err.message });
  }
}
