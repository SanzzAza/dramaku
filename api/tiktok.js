const axios = require('axios');

async function tiktokDL(url) {
  // Provider 1: tikwm.com
  try {
    const res = await axios.post(
      'https://www.tikwm.com/api/',
      `url=${encodeURIComponent(url)}&web=1&hd=1`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Referer': 'https://www.tikwm.com/',
          'Origin': 'https://www.tikwm.com'
        },
        timeout: 15000
      }
    );
    const d = res.data;
    if (d && d.code === 0 && d.data) {
      const v = d.data;
      return {
        status: true,
        message: 'Success',
        author: "SanzzXD" {
          id: v.author?.id || '',
          username: v.author?.unique_id || '',
          nickname: v.author?.nickname || '',
          avatar: v.author?.avatar ? `https://www.tikwm.com${v.author.avatar}` : ''
        },
        title: v.title || '',
        duration: (v.duration || 0) + 's',
        cover: v.cover ? `https://www.tikwm.com${v.cover}` : '',
        music: {
          title: v.music_info?.title || '',
          author: v.music_info?.author || '',
          url: v.music ? `https://www.tikwm.com${v.music}` : ''
        },
        stats: {
          play: v.play_count || 0,
          like: v.digg_count || 0,
          comment: v.comment_count || 0,
          share: v.share_count || 0
        },
        download: {
          no_watermark: v.play ? `https://www.tikwm.com${v.play}` : '',
          watermark: v.wmplay ? `https://www.tikwm.com${v.wmplay}` : '',
          audio: v.music ? `https://www.tikwm.com${v.music}` : ''
        }
      };
    }
  } catch (err) { /* lanjut */ }

  // Provider 2: savetik fallback
  try {
    const res = await axios.post(
      'https://savetik.co/api/ajaxSearch',
      `q=${encodeURIComponent(url)}&lang=id`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://savetik.co/'
        },
        timeout: 12000
      }
    );
    const d = res.data;
    if (d && d.status === 'ok') {
      return { status: true, message: 'Success', title: d.vid_title || '', thumbnail: d.thumbnail || '' };
    }
  } catch (err) { /* lanjut */ }

  throw new Error('Semua provider gagal. Pastikan URL TikTok valid dan coba lagi.');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = (req.query.url || '').trim();
  if (!url) return res.status(400).json({ status: false, message: 'Parameter url wajib diisi', example: '/api/tiktok?url=https://vt.tiktok.com/xxx' });
  if (!url.includes('tiktok')) return res.status(400).json({ status: false, message: 'URL harus dari TikTok' });

  try {
    const data = await tiktokDL(url);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
