# Dramaku API

REST API gratis untuk **drama feed**, **downloader**, **tools**, **AI chat/code**, dan **berita**.

## Fitur Utama
- 🎬 Drama multi-source: GoodShort, DramaBox, Melolo, DramaBite, DramaNova.
- ⬇️ Downloader: TikTok, YouTube, Instagram, Facebook, Pinterest, X, Threads, Terabox.
- 🧰 Tools utility: cuaca, kurs, QR, quote, screenshot, short URL, TTS, dll.
- 🤖 AI endpoint: chat & code generator (Groq/OpenRouter/Cerebras).
- 📰 News aggregator portal Indonesia.
- ❤️ **Baru:** endpoint health-check `/api/status` untuk monitoring uptime dan daftar endpoint inti.

## Struktur Project

```txt
.
├── api/
│   ├── ai.js
│   ├── downloader.js
│   ├── drama.js
│   ├── news.js
│   ├── proxy.js
│   ├── sankanime.js
│   ├── status.js
│   └── tools.js
├── public/index.html
├── server.js
├── vercel.json
└── package.json
```

## Endpoint Ringkas
- `GET /api/status`
- `GET|POST /api/drama`
- `GET|POST /api/downloader`
- `GET|POST /api/tools`
- `GET|POST /api/ai`
- `GET|POST /api/news`
- `GET /api/sankanime`
- `GET /api/proxy`

## Environment Variables
Buat file `.env` (untuk local) dari contoh `.env.example`:

```bash
cp .env.example .env
```

Wajib diisi jika pakai endpoint AI:
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `CEREBRAS_API_KEY`

## Local Development

```bash
npm install
node server.js
# buka http://localhost:3000
```

## Deploy Vercel

```bash
npm i -g vercel
vercel
vercel --prod
```
