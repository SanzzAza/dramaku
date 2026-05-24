# Audit Kekurangan Repo `dramaku`

Dokumen ini merangkum hal-hal yang masih kurang agar repo lebih stabil, aman, dan mudah dikembangkan.

## 1) Dokumentasi belum sinkron dengan implementasi
- `README.md` masih menyebut struktur lama (`api/tiktok.js`) yang tidak ada di repo saat ini.
- Endpoint aktif jauh lebih banyak (`/api/drama`, `/api/news`, `/api/tools`, `/api/ai`, dll) namun belum terdokumentasi ringkas per-parameter.
- Tidak ada daftar environment variable yang wajib diisi (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CEREBRAS_API_KEY`).

## 2) Belum ada test otomatis
- `package.json` belum punya script `test` atau `lint`.
- Tidak ada smoke test endpoint untuk memastikan route utama tetap hidup setelah perubahan.

## 3) Observability minim
- Belum ada request logging terstruktur (mis. method/path/status/duration).
- Error handling masih basic; belum ada error ID/correlation ID untuk tracing produksi.

## 4) Security hardening masih dasar
- Banyak endpoint membuka CORS `*` (memang praktis, tapi sebaiknya dibatasi jika sudah jelas domain konsumennya).
- Belum terlihat rate limiting / anti-abuse untuk endpoint mahal (AI, downloader, scraping berita).
- Endpoint proxy sudah ada validasi domain, tapi masih layak ditambah limit dan monitoring abuse.

## 5) Konsistensi API response belum seragam
- Sebagian endpoint pakai format `{ status, code, message }`, sebagian langsung `{ status, result }`.
- Akan lebih mudah untuk client jika semua endpoint punya kontrak response yang seragam.

## 6) Maintenance dependencies
- `node_modules` ada di repo workspace lokal; idealnya di-ignore di Git agar repo tetap bersih.
- Tidak ada lockfile strategy/catatan update dependency berkala (security patch routine).

## 7) DX (Developer Experience)
- Belum ada `.env.example`.
- Belum ada `CONTRIBUTING.md` untuk standar coding/testing sebelum merge.
- Belum ada changelog atau release notes flow.

## Prioritas cepat (saran eksekusi)
1. Rapikan `README.md` + tambah `.env.example`.
2. Tambah `npm run lint` dan minimal smoke test endpoint.
3. Standarkan format response API.
4. Tambah rate limit sederhana di endpoint kritikal.
