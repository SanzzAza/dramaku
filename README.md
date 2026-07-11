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

## APK / WebView
- WebView native dengan JavaScript bridge
- Immersive fullscreen saat player aktif
- Keep screen awake saat nonton
- Back button Android menutup modal/player/detail sesuai state
- Native ExoPlayer activity untuk format video yang butuh player native
- Native bridge untuk haptic feedback, share sheet, versi APK, dan clear cache WebView

## Build APK
APK otomatis dibuild melalui GitHub Actions. Download di tab **Releases**.

Build lokal juga otomatis menyalin `index.html` ke asset APK melalui task Gradle `copyIndexHtml`.

## Disclaimer
Semua konten milik platform masing-masing. Aplikasi ini hanya sebagai aggregator.
