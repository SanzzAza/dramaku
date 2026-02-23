export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { message } = req.body || {};
  if (!message) return res.status(200).send('OK');

  const BOT_TOKEN = '8451666477:AAGhNxMZHpjgVY2ToyclonTZI7NUNSA9EG0';
  const ADMIN_ID = '8126241407';
  const FIREBASE_KEY = 'AIzaSyD3q12Q3FD4Km7B0c0uCJeSXFB_2ZFdJkM';
  const PROJECT_ID = 'dramafeed-bf542';

  const chatId = String(message.chat?.id);
  const text = (message.text || '').trim();
  const parts = text.split(' ');
  const cmd = parts[0].toLowerCase();

  async function sendMsg(msg) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
    });
  }

  // Firestore REST API
  async function fsGet(docPath) {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?key=${FIREBASE_KEY}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.fields || null;
  }

  async function fsSet(docPath, fields) {
    // Convert plain object to Firestore fields format
    const fsFields = {};
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'boolean') fsFields[k] = { booleanValue: v };
      else if (typeof v === 'number') fsFields[k] = { integerValue: v };
      else if (typeof v === 'object' && v !== null) {
        const nested = {};
        for (const [k2, v2] of Object.entries(v)) {
          if (typeof v2 === 'boolean') nested[k2] = { booleanValue: v2 };
          else nested[k2] = { stringValue: String(v2) };
        }
        fsFields[k] = { mapValue: { fields: nested } };
      }
      else fsFields[k] = { stringValue: String(v) };
    }
    await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?key=${FIREBASE_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fsFields })
    });
  }

  if (chatId !== ADMIN_ID) {
    await sendMsg('❌ Kamu bukan admin!');
    return res.status(200).send('OK');
  }

  if (cmd === '/help' || cmd === '/start') {
    await sendMsg(
      `🎬 <b>DramaFeed Admin Bot</b>\n\n` +
      `▶️ /disable [platform] — matikan platform\n` +
      `/enable [platform] — aktifkan platform\n` +
      `/status — lihat status semua platform\n\n` +
      `📢 /broadcast [pesan] — notif ke semua user\n\n` +
      `🎨 /banner judul|isi|tombol|link — ganti banner\n` +
      `/clearbanner — hapus banner\n\n` +
      `💡 Platform: goodshort, melolo, freereels, dramabite, netshort, shortmax, dramawave, flextv, dramabox`
    );
  }

  else if (cmd === '/status') {
    const doc = await fsGet('admin/config');
    const disabled = doc?.disabledSources?.mapValue?.fields || {};
    const platforms = ['goodshort','melolo','freereels','dramabite','netshort','shortmax','dramawave','flextv','dramabox'];
    let msg = '📊 <b>Status Platform:</b>\n\n';
    platforms.forEach(p => {
      const isDisabled = disabled[p]?.booleanValue === true;
      msg += isDisabled ? `🔴 ${p} — MATI\n` : `🟢 ${p} — AKTIF\n`;
    });
    await sendMsg(msg);
  }

  else if (cmd === '/disable' && parts[1]) {
    const platform = parts[1].toLowerCase();
    const doc = await fsGet('admin/config');
    const existing = {};
    const disabledFields = doc?.disabledSources?.mapValue?.fields || {};
    for (const [k, v] of Object.entries(disabledFields)) {
      existing[k] = v.booleanValue || false;
    }
    existing[platform] = true;
    await fsSet('admin/config', { disabledSources: existing });
    await sendMsg(`🔴 Platform <b>${platform}</b> berhasil dimatikan!`);
  }

  else if (cmd === '/enable' && parts[1]) {
    const platform = parts[1].toLowerCase();
    const doc = await fsGet('admin/config');
    const existing = {};
    const disabledFields = doc?.disabledSources?.mapValue?.fields || {};
    for (const [k, v] of Object.entries(disabledFields)) {
      if (k !== platform) existing[k] = v.booleanValue || false;
    }
    await fsSet('admin/config', { disabledSources: existing });
    await sendMsg(`🟢 Platform <b>${platform}</b> berhasil diaktifkan!`);
  }

  else if (cmd === '/broadcast' && parts.length > 1) {
    const pesan = parts.slice(1).join(' ');
    await fsSet('admin/config', {
      broadcast: { message: pesan, active: true, timestamp: String(Date.now()) }
    });
    await sendMsg(`📢 Broadcast berhasil!\n\n<i>${pesan}</i>`);
  }

  else if (cmd === '/banner' && parts.length > 1) {
    const raw = parts.slice(1).join(' ');
    const [title, sub, btn, link] = raw.split('|').map(s => s?.trim() || '');
    await fsSet('admin/config', {
      banner: { title, sub, btn: btn||'Lihat', link: link||'#', active: true }
    });
    await sendMsg(`🎨 Banner diupdate!\n<b>${title}</b>\n${sub}`);
  }

  else if (cmd === '/clearbanner') {
    await fsSet('admin/config', { banner: { active: false, title: '', sub: '', btn: '', link: '' } });
    await sendMsg('🎨 Banner dihapus!');
  }

  else {
    await sendMsg('❓ Perintah tidak dikenal. Ketik /help');
  }

  return res.status(200).send('OK');
}
