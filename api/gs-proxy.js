// Vercel serverless function: api/gs-proxy.js
// Usage: /api/gs-proxy?chapterId=16138329&bookId=31001241758&q=720p

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { chapterId, bookId, q = '720p' } = req.query;
  if (!chapterId || !bookId) return res.status(400).json({ error: 'Missing chapterId or bookId' });

  const TOKEN = '53d25de32c37b0fcd2b14a9f834050493cc044d5039b5aff3283da73a8ef761b';
  const BASE = 'https://captain.sapimu.au/goodshort/api/v1';

  try {
    // 1. Fetch /play to get m3u8 URL + AES key (field 'k')
    const playRes = await fetch(`${BASE}/play/${bookId}/${chapterId}?q=${q}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' }
    });
    const playData = await playRes.json();

    const m3u8Url = playData?.m3u8 || playData?.data?.m3u8 || playData?.url || '';
    const keyB64 = playData?.k || '';

    if (!m3u8Url) return res.status(404).json({ error: 'No m3u8 URL', raw: playData });

    // 2. Download the m3u8 playlist
    const m3u8Res = await fetch(m3u8Url);
    const m3u8Text = await m3u8Res.text();

    // 3. Get base URL for resolving relative .ts paths
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

    // 4. Rewrite m3u8
    const dataUri = keyB64 ? `data:text/plain;base64,${keyB64}` : '';
    const lines = m3u8Text.split('\n').map(line => {
      if (line.includes('URI="local://offline-key') && dataUri) {
        return line.replace(/URI="local:\/\/offline-key[^"]*"/, `URI="${dataUri}"`);
      }
      if (line.trim().endsWith('.ts') && !line.trim().startsWith('http')) {
        return baseUrl + line.trim();
      }
      return line;
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(lines.join('\n'));

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
