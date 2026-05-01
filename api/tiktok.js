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
      timeout: 30000,
    }));
  }

  async getToken() {
    const { data } = await this.client.get('/en2', {
      headers: { Referer: 'https://snaptik.app/en2' },
    });
    const $ = cheerio.load(data);
    return $('input[name="token"]').val();
  }

  async getHtml(url) {
    const token = await this.getToken();
    if (!token) throw new Error('Gagal mengambil token dari SnapTik.');

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

    // Snaptik returns an obfuscated JS script that contains the HTML inside a string.
    // Instead of eval-ing it (blocked on Vercel), we extract the HTML with regex.
    // The script sets innerHTML to a base64-encoded or raw HTML string.
    
    // Try: extract HTML string passed to innerHTML
    let html = '';

    // Pattern 1: innerHTML = "..." or innerHTML = decodeURIComponent("...")
    const innerMatch = data.match(/innerHTML\s*=\s*decodeURIComponent\(["']([\s\S]+?)["']\)/);
    if (innerMatch) {
      try { html = decodeURIComponent(innerMatch[1]); } catch {}
    }

    if (!html) {
      const innerMatch2 = data.match(/innerHTML\s*=\s*["']([\s\S]+?)["'];/);
      if (innerMatch2) html = innerMatch2[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
    }

    // Pattern 2: extract all https links from the script (tikcdn/tiktok CDN links)
    if (!html) {
      const links = [];
      const linkRe = /https:\/\/[^"'\s\\]+tikcdn[^"'\s\\]+/g;
      let m;
      while ((m = linkRe.exec(data)) !== null) {
        links.push(m[0]);
      }
      if (links.length) {
        // Build fake html so parseHtml can work
        html = links.map((l, i) => `<div class="video-links"><a href="${l}">Download ${i + 1}</a></div>`).join('');
      }
    }

    if (!html) throw new Error('Gagal mengekstrak konten dari SnapTik.');
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

    if (!links.length) throw new Error('Link download tidak ditemukan.');

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
    return res.status(200).json({ status: true, data: result });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
