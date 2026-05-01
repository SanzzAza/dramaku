const axios = require('axios');

async function instagramDL(url) {
  // Provider 1: instavideosave.com
  try {
    const res = await axios.post(
      'https://instavideosave.com/getLinks',
      { url },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://instavideosave.com/',
          'Origin': 'https://instavideosave.com'
        },
        timeout: 15000
      }
    );
    const d = res.data;
    if (d && (d.links || d.thumbnail)) {
      return {
        status: true,
        message: 'Success',
        thumbnail: d.thumbnail || '',
        download: Array.isArray(d.links)
          ? d.links.map((l, i) => ({ quality: l.quality || `video_${i + 1}`, url: l.link || l.url || l }))
          : []
      };
    }
  } catch (err) { /* lanjut */ }

  // Provider 2: saveinsta.app
  try {
    const res = await axios.post(
      'https://saveinsta.app/api/ajaxSearch',
      `q=${encodeURIComponent(url)}&lang=id`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://saveinsta.app/',
          'Origin': 'https://saveinsta.app'
        },
        timeout: 12000
      }
    );
    const d = res.data;
    if (d && d.status === 'ok') {
      // Parse HTML dari response untuk ambil link download
      const cheerio = require('cheerio');
      const $ = cheerio.load(d.data || '');
      const links = [];
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && (href.includes('cdninstagram') || href.includes('fbcdn') || href.includes('download'))) {
          links.push({ quality: text || 'video', url: href });
        }
      });
      const thumbnail = $('img').first().attr('src') || '';
      if (links.length > 0 || thumbnail) {
        return {
          status: true,
          message: 'Success',
          thumbnail,
          download: links
        };
      }
    }
  } catch (err) { /* lanjut */ }

  // Provider 3: igram.world
  try {
    const res = await axios.post(
      'https://igram.world/api/convert',
      { url, lang: 'id' },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://igram.world/',
          'Origin': 'https://igram.world'
        },
        timeout: 12000
      }
    );
    const d = res.data;
    if (d && d.url) {
      return {
        status: true,
        message: 'Success',
        thumbnail: d.thumbnail || '',
        download: Array.isArray(d.url)
          ? d.url.map((u, i) => ({ quality: u.quality || `video_${i + 1}`, url: u.url || u }))
          : [{ quality: 'video', url: d.url }]
      };
    }
  } catch (err) { /* lanjut */ }

  throw new Error('Semua provider gagal. Pastikan URL Instagram valid (post/reels/stories) dan coba lagi.');
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
    example: '/api/instagram?url=https://www.instagram.com/p/xxxxx'
  });

  if (!url.includes('instagram.com')) return res.status(400).json({
    status: false,
    message: 'URL harus dari Instagram'
  });

  try {
    const data = await instagramDL(url);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
