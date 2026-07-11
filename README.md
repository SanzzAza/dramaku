# Dramaku - Streaming Drama & Film Terbaik

Nonton drama & film dari 9 platform sekaligus dalam 1 website / APK WebView.

## Platform
- Melolo, FreeReels, FlickReels, DramaNova, ReelShort
- NetShort, DramaBox, GoodShort, MovieBox

## Fitur Utama
- Home cinematic dengan Spotlight Harian, mood shortcut, rekomendasi, populer, dan terbaru
- Halaman detail ala aplikasi film: resume episode, info tiles, sinopsis, episode grid, favorit/share, dan rekomendasi mirip
- Player TikTok-style: scroll vertikal episode, full/asli fit toggle, seek bar drag, progress tersimpan, subtitle otomatis, dan double-tap like
- Search gabungan 9 platform dengan recent search dan filter platform
- Riwayat tontonan & Favorit via localStorage
- Cache API ringan untuk performa dan fallback saat koneksi tidak stabil
- Settings page, error reporting lokal, mode hemat data, dan kontrol cache
- Native splash screen, onboarding pertama kali, dan laporan episode bermasalah
- Crash-safe WebView recovery screen dengan reload dan clear cache
- Remote config untuk endpoint API, status platform, announcement, dan feature flag

## Branding
- Brand kit tersedia di folder `branding/`
- Launcher icon Android sudah diganti dengan monogram Dramaku baru
- Header, splash, favicon, dan app icon memakai identitas visual yang sama

## APK / WebView
- WebView native dengan JavaScript bridge
- Immersive fullscreen saat player aktif
- Keep screen awake saat nonton
- Back button Android menutup modal/player/detail sesuai state
- Native ExoPlayer activity untuk format video yang butuh player native
- Native bridge untuk haptic feedback, share sheet, versi APK, dan clear cache WebView

## Build APK
APK otomatis dibuild melalui GitHub Actions. Download di tab **Releases**.

Build lokal juga otomatis menyalin `index.html` dan `branding/` ke asset APK melalui task Gradle `copyIndexHtml`.

### Signed release APK
GitHub Actions otomatis membuat **signed release APK** jika secrets ini tersedia:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Jika secrets belum ada, workflow akan membuat debug APK fallback.

Panduan lengkap: [`docs/SIGNING.md`](docs/SIGNING.md).

## Remote Config
File default: [`remote-config.json`](remote-config.json).

Panduan: [`docs/REMOTE_CONFIG.md`](docs/REMOTE_CONFIG.md).

## Disclaimer
Semua konten milik platform masing-masing. Aplikasi ini hanya sebagai aggregator.
