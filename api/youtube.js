const axios = require('axios');

async function youtubeDL(url) {
  // Provider 1: yt-api.p.rapidapi (cobain via y2mate style)
  // Provider 1: cobain via yt5s.io
  try {
    const res = await axios.post(
      'https://yt5s.io/api/ajaxSearch',
      `q=${encodeURIComponent(url)}&vt=home`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://yt5s.io/',
          'Origin': 'https://yt5s.io'
        },
        timeout: 15000
      }
    );
    const d = res.data;
    if (d && d.status === 'ok' && d.vid) {
      const links = d.links || {};
      const mp4Links = links.mp4 || {};
      const mp3Links = links.mp3 || {};

      const videoFormats = Object.entries(mp4Links).map(([quality, info]) => ({
        quality,
        size: info.size || '',
        url: info.url || info.k || ''
      })).filter(f => f.url);

      const audioFormats = Object.entries(mp3Links).map(([quality, info]) => ({
        quality,
        size: info.size || '',
        url: info.url || info.k || ''
      })).filter(f => f.url);

      return {
        status: true,
        message: 'Success',
        id: d.vid,
        title: d.title || '',
        duration: d.t || '',
        thumbnail: d.thumb || `https://img.youtube.com/vi/${d.vid}/hqdefault.jpg`,
        download: {
          video: videoFormats,
          audio: audioFormats
        }
      };
    }
  } catch (err) { /* lanjut */ }

  // Provider 2: y2mate.guru fallback
  try {
    const res1 = await axios.post(
      'https://www.y2mate.com/mates/analyzeV2/ajax',
      `k_query=${encodeURIComponent(url)}&k_page=home&hl=id&q_auto=0`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.y2mate.com/'
        },
        timeout: 15000
      }
    );
    const d = res1.data;
    if (d && d.status === 'ok' && d.vid) {
      const links = d.links || {};
      const mp4 = links.mp4 || {};
      const mp3 = links.mp3 || {};

      const videoFormats = Object.values(mp4).map(info => ({
        quality: info.q || '',
        size: info.size || '',
        key: info.k || ''
      })).filter(f => f.quality && f.key);

      const audioFormats = Object.values(mp3).map(info => ({
        quality: info.q || '',
        size: info.size || '',
        key: info.k || ''
      })).filter(f => f.quality && f.key);

      return {
        status: true,
        message: 'Success (key only — gunakan endpoint convert y2mate untuk download link)',
        id: d.vid,
        title: d.title || '',
        duration: d.t || '',
        thumbnail: `https://img.youtube.com/vi/${d.vid}/hqdefault.jpg`,
        download: {
          video: videoFormats,
          audio: audioFormats
        }
      };
    }
  } catch (err) { /* lanjut */ }

  throw new Error('Semua provider gagal. Pastikan URL YouTube valid dan coba lagi.');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = (req.query.url || '').trim();
  if (!url) return res.status(400).json({
    status: false,
    message: 'Parameter url wajib diisi',
    example: '/api/youtube?url=https://youtu.be/xxxxx'
  });

  const isYT = url.includes('youtube.com') || url.includes('youtu.be');
  if (!isYT) return res.status(400).json({ status: false, message: 'URL harus dari YouTube' });

  try {
    const data = await youtubeDL(url);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
