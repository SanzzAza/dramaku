// Vercel serverless: api/tg-webhook.js
// Setup: set webhook ke https://dramafeed.vercel.app/api/tg-webhook
// via: https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://dramafeed.vercel.app/api/tg-webhook

const BOT_TOKEN = process.env.TG_BOT_TOKEN || '8451666477:AAGhNxMZHpjgVY2ToyclonTZI7NUNSA9EG0';
const ADMIN_ID = '8126241407';
const FIREBASE_URL = 'https://dramafeed-bf542-default-rtdb.firebaseio.com'; // ganti dengan URL Firebase kamu

async function sendMsg(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

async function fbGet(path) {
  const r = await fetch(`${FIREBASE_URL}/${path}.json`);
  return r.json();
}

async function fbSet(path, data) {
  await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { message } = req.body || {};
  if (!message) return res.status(200).send('OK');

  const chatId = String(message.chat?.id);
  const text = message.text || '';

  // Hanya admin yang bisa kontrol
  if (chatId !== ADMIN_ID) {
    await sendMsg(chatId, '❌ Kamu bukan admin!');
    return res.status(200).send('OK');
  }

  const cmd = text.trim().toLowerCase();
  const parts = text.trim().split(' ');

  // /help
  if (cmd === '/help' || cmd === '/start') {
    await sendMsg(chatId,
      `🎬 <b>DramaFeed Admin Bot</b>\n\n` +
      `📋 <b>Perintah tersedia:</b>\n\n` +
      `▶️ <b>Platform:</b>\n` +
      `/disable [platform] — matikan platform\n` +
      `/enable [platform] — aktifkan platform\n` +
      `/status — lihat status semua platform\n\n` +
      `📢 <b>Broadcast:</b>\n` +
      `/broadcast [pesan] — kirim notif ke semua user\n\n` +
      `🎨 <b>Banner:</b>\n` +
      `/banner [judul]|[isi]|[tombol]|[link] — ganti banner\n` +
      `/clearbanner — hapus banner\n\n` +
      `📊 <b>Info:</b>\n` +
      `/stats — statistik Firebase\n\n` +
      `💡 Platform: goodshort, melolo, freereels, dramabite, netshort, shortmax, dramawave, flextv, dramabox`
    );
  }

  // /status
  else if (cmd === '/status') {
    const disabled = await fbGet('admin/disabledSources') || {};
    const platforms = ['goodshort','melolo','freereels','dramabite','netshort','shortmax','dramawave','flextv','dramabox'];
    let msg = '📊 <b>Status Platform:</b>\n\n';
    platforms.forEach(p => {
      msg += disabled[p] ? `🔴 ${p} — MATI\n` : `🟢 ${p} — AKTIF\n`;
    });
    await sendMsg(chatId, msg);
  }

  // /disable [platform]
  else if (parts[0] === '/disable' && parts[1]) {
    const platform = parts[1].toLowerCase();
    const disabled = await fbGet('admin/disabledSources') || {};
    disabled[platform] = true;
    await fbSet('admin/disabledSources', disabled);
    await sendMsg(chatId, `🔴 Platform <b>${platform}</b> berhasil dimatikan!\nUser tidak akan melihat drama dari platform ini.`);
  }

  // /enable [platform]
  else if (parts[0] === '/enable' && parts[1]) {
    const platform = parts[1].toLowerCase();
    const disabled = await fbGet('admin/disabledSources') || {};
    delete disabled[platform];
    await fbSet('admin/disabledSources', disabled);
    await sendMsg(chatId, `🟢 Platform <b>${platform}</b> berhasil diaktifkan!`);
  }

  // /broadcast [pesan]
  else if (parts[0] === '/broadcast' && parts.length > 1) {
    const pesan = parts.slice(1).join(' ');
    await fbSet('admin/broadcast', {
      message: pesan,
      timestamp: Date.now(),
      active: true
    });
    await sendMsg(chatId, `📢 Broadcast berhasil dikirim!\n\n<i>${pesan}</i>`);
  }

  // /banner judul|isi|tombol|link
  else if (parts[0] === '/banner' && parts.length > 1) {
    const raw = parts.slice(1).join(' ');
    const [title, sub, btn, link] = raw.split('|').map(s => s?.trim());
    await fbSet('admin/banner', {
      title: title || '',
      sub: sub || '',
      btn: btn || 'Lihat',
      link: link || '#',
      active: true
    });
    await sendMsg(chatId, `🎨 Banner berhasil diupdate!\n\n<b>${title}</b>\n${sub}\n[${btn}] → ${link}`);
  }

  // /clearbanner
  else if (cmd === '/clearbanner') {
    await fbSet('admin/banner', { active: false });
    await sendMsg(chatId, '🎨 Banner berhasil dihapus!');
  }

  // /stats
  else if (cmd === '/stats') {
    const reports = await fbGet('reports') || {};
    const reportCount = Object.keys(reports).length;
    await sendMsg(chatId,
      `📊 <b>Statistik DramaFeed</b>\n\n` +
      `🚨 Total laporan: ${reportCount}\n` +
      `\nCek Firebase Console untuk data lengkap.`
    );
  }

  else {
    await sendMsg(chatId, '❓ Perintah tidak dikenal. Ketik /help untuk daftar perintah.');
  }

  return res.status(200).send('OK');
}
