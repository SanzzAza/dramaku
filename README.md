# MyAPI

REST API sederhana untuk TikTok Downloader (dan lebih banyak endpoint ke depannya).

## Struktur Folder

```
myapi/
├── api/
│   └── tiktok.js       ← endpoint GET /api/tiktok
├── public/
│   └── index.html      ← halaman dokumentasi interaktif
├── server.js           ← untuk local development
├── vercel.json         ← konfigurasi Vercel
└── package.json
```

## Cara Pakai API

```
GET /api/tiktok?url=https://vt.tiktok.com/xxxxx
```

**Contoh Response:**
```json
{
  "status": true,
  "message": "Success",
  "author": {
    "username": "akueja",
    "nickname": "akueja"
  },
  "title": "Judul video...",
  "download": {
    "no_watermark": "https://...",
    "watermark": "https://...",
    "audio": "https://..."
  }
}
```

## Deploy ke Vercel

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login Vercel
```bash
vercel login
```

### 3. Deploy
```bash
cd myapi
vercel
```

Ikuti instruksinya, pilih:
- Set up and deploy: **Y**
- Which scope: pilih akun kamu
- Link to existing project: **N**
- Project name: **myapi** (atau nama lain)
- Directory: **./** (enter saja)

### 4. Setelah deploy
Kamu akan dapat URL seperti: `https://myapi-xxx.vercel.app`

Buka `public/index.html`, ubah baris ini:
```js
const BASE_URL = '';
// Ganti jadi:
const BASE_URL = 'https://myapi-xxx.vercel.app';
```

Lalu deploy ulang:
```bash
vercel --prod
```

## Local Development

```bash
npm install
node server.js
# Buka http://localhost:3000
```
