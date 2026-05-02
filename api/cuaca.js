/**
 * Cuaca API — via Open-Meteo + Geocoding (free, no key)
 * GET /api/cuaca?kota=Jakarta
 * GET /api/cuaca?lat=-6.2&lon=106.8
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const WMO_CODES = {
  0:"Cerah",1:"Cerah Berawan",2:"Berawan Sebagian",3:"Mendung",
  45:"Berkabut",48:"Kabut Beku",
  51:"Gerimis Ringan",53:"Gerimis Sedang",55:"Gerimis Lebat",
  61:"Hujan Ringan",63:"Hujan Sedang",65:"Hujan Lebat",
  71:"Salju Ringan",73:"Salju Sedang",75:"Salju Lebat",
  80:"Hujan Lokal Ringan",81:"Hujan Lokal Sedang",82:"Hujan Lokal Lebat",
  95:"Badai Petir",96:"Badai Petir + Hujan Es",99:"Badai Petir Lebat",
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(200, CORS_HEADERS); return res.end(); }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (!["GET","POST"].includes(req.method)) return res.status(405).json({ status:false, code:405, message:"Method Not Allowed." });

  const kota = req.query.kota || req.body?.kota;
  const lat  = req.query.lat  || req.body?.lat;
  const lon  = req.query.lon  || req.body?.lon;

  if (!kota && (!lat || !lon)) {
    return res.status(400).json({
      status: false, code: 400,
      message: "Parameter 'kota' atau 'lat' & 'lon' wajib diisi.",
      example: "/api/cuaca?kota=Jakarta",
    });
  }

  try {
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

    const forecast = d.time.map((t, i) => ({
      tanggal: t,
      cuaca: WMO_CODES[d.weather_code[i]] || "Tidak diketahui",
      suhu_max: d.temperature_2m_max[i],
      suhu_min: d.temperature_2m_min[i],
      hujan_mm: d.precipitation_sum[i],
    }));

    return res.status(200).json({
      creator: "@SanzXD",
      status: true, code: 200,
      message: "Berhasil mengambil data cuaca.",
      result: {
        kota: namaKota,
        koordinat: { lat: latitude, lon: longitude },
        sekarang: {
          suhu: c.temperature_2m,
          suhu_terasa: c.apparent_temperature,
          kelembaban: c.relative_humidity_2m,
          cuaca: WMO_CODES[c.weather_code] || "Tidak diketahui",
          kecepatan_angin: c.wind_speed_10m,
          arah_angin: c.wind_direction_10m,
        },
        prakiraan_3_hari: forecast,
        satuan: { suhu:"°C", angin:"km/h", hujan:"mm" },
        provider: "open-meteo.com",
      },
    });
  } catch (err) {
    console.error("[Cuaca]", err.message);
    return res.status(500).json({ status:false, code:500, message: err.message });
  }
}
