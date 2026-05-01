const axios = require('axios');

async function facebookDL(url) {
  // Provider 1: getfvid.com
  try {
    const res = await axios.post(
      'https://getfvid.com/downloader',
      `url=${encodeURIComponent(url)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://getfvid.com/',
          'Origin': 'https://getfvid.com'
        },
        timeout: 15000
      }
    );
    const d = res.data;
    if (d && (d.hd || d.sd)) {
      return {
        status: true,
        message: 'Success',
        title: d.title || '',
        thumbnail: d.thumbnail || '',
        download: {
          hd: d.hd || '',
          sd: d.sd || ''
        }
      };
    }
  } catch (err) { /* lanjut */ }

  // Provider 2: fdown.net
  try {
    const res = await axios.post(
      'https://fdown.net/download.php',
      `URLz=${encodeURIComponent(url)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://fdown.net/',
          'Origin': 'https://fdown.net'
        },
        timeout: 15000
      }
    );
    if (res.data) {
      const cheerio = require('cheerio');
      const $ = cheerio.load(res.data);
      const sd = $('#sdlink').attr('href') || $('a[id="sdlink"]').attr('href') || '';
      const hd = $('#hdlink').attr('href') || $('a[id="hdlink"]').attr('href') || '';
      const title = $('h2').first().text().trim() || '';
      const thumbnail = $('img.img-fluid').first().attr('src') || '';
      if (sd || hd) {
        return {
          status: true,
          message: 'Success',
          title,
          thumbnail,
          download: { hd, sd }
        };
      }
    }
  } catch (err) { /* lanjut */ }

  // Provider 3: savefrom style via snap.save.media API
  try {
    const res = await axios.get(
      `https://snapsave.app/action.php?lang=id&url=${encodeURIComponent(url)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://snapsave.app/',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 12000
      }
    );
    const d = res.data;
    if (d && d.data) {
      const cheerio = require('cheerio');
      const $ = cheerio.load(d.data);
      const links = [];
      $('a.button').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && href.startsWith('http')) {
          links.push({ quality: text || 'video', url: href });
        }
      });
      if (links.length > 0) {
        return {
          status: true,
          message: 'Success',
          title: '',
          thumbnail: $('img').first().attr('src') || '',
          download: {
            hd: links.find(l => l.quality.toLowerCase().includes('hd'))?.url || links[0]?.url || '',
            sd: links.find(l => l.quality.toLowerCase().includes('sd'))?.url || links[1]?.url || ''
          }
        };
      }
    }
  } catch (err) { /* lanjut */ }

  throw new Error('Semua provider gagal. Pastikan URL Facebook valid dan videonya tidak private.');
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
    example: '/api/facebook?url=https://www.facebook.com/watch?v=xxxxx'
  });

  const isFB = url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com');
  if (!isFB) return res.status(400).json({ status: false, message: 'URL harus dari Facebook' });

  try {
    const data = await facebookDL(url);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
