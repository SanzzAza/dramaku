const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const FormData = require('form-data');
const { wrapper } = require('axios-cookiejar-support');

class SnapTikClient {
  constructor() {
    this.jar = new CookieJar();
    this.client = wrapper(axios.create({
      baseURL: 'https://snaptik.app',
      jar: this.jar,
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 9000,
    }));
  }

  async getToken() {
    const { data } = await this.client.get('/en2', {
      headers: { Referer: 'https://snaptik.app/en2' },
    });
    const $ = cheerio.load(data);
    const token = $('input[name="token"]').val();
    if (!token) throw new Error('Gagal mengambil token dari SnapTik.');
    return token;
  }

  async getHtml(url) {
    const token = await this.getToken();

    const form = new FormData();
    form.append('url', url);
    form.append('lang', 'en2');
    form.append('token', token);

    const { data } = await this.client.post('/abc2.php', form, {
      headers: {
        ...form.getHeaders(),
        referer: 'https://snaptik.app/en2',
        origin: 'https://snaptik.app',
      },
    });

    let html = '';

    // Pattern 1: decodeURIComponent(...)
    const m1 = data.match(/innerHTML\s*=\s*decodeURIComponent\(["']([\s\S]+?)["']\)/);
    if (m1) {
      try { html = decodeURIComponent(m1[1]); } catch {}
    }

    // Pattern 2: innerHTML = "..."
    if (!html) {
      const m2 = data.match(/innerHTML\s*=\s*["']([\s\S]+?)["'];/);
      if (m2) html = m2[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
    }

    // Pattern 3: ambil semua CDN link langsung dari script
    if (!html) {
      const links = [];
      const re = /https:\/\/[^"'\s\\]+(tikcdn|tiktokcdn|muscdn)[^"'\s\\]+/g;
      let m;
      while ((m = re.exec(data)) !== null) links.push(m[0]);
      if (links.length) {
        html = links.map((l, i) => `<div class="video-links"><a href="${l}">Download ${i + 1}</a></div>`).join('');
      }
    }

    if (!html) throw new Error('Gagal mengekstrak konten dari SnapTik. Format response mungkin berubah.');
    return html;
  }

  parseHtml(html) {
    const $ = cheerio.load(html);
    const title = $('.video-title').text().trim() || 'No Title';
    const author = $('.info span').text().trim() || 'Unknown';
    const thumbnail = $('.avatar').attr('src') || $('#thumbnail').attr('src') || null;

    const links = $('div.video-links a')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter(Boolean);

    if (!links.length) throw new Error('Link download tidak ditemukan di response SnapTik.');

    return {
      title,
      author,
      thumbnail,
      links: [...new Set(links)],
    };
  }

  async process(url) {
    const html = await this.getHtml(url);
    return this.parseHtml(html);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = (req.query.url || (req.body && req.body.url) || '').trim();

  if (!url) {
    return res.status(400).json({
      status: false,
      message: 'Parameter url wajib diisi',
      example: '/api/tiktok?url=https://vt.tiktok.com/xxx',
    });
  }

  try {
    const client = new SnapTikClient();
    const result = await client.process(url);
    return res.status(200).json({ status: true, message: 'Success', data: result });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
