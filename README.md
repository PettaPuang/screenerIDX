# S/R Headless Screener

Screener saham IDX tanpa UI. Script berjalan pra-market, membaca watchlist saham, menghitung area support/resistance dan indikator teknikal, lalu mengirim shortlist sinyal ke Telegram dan email.

Spesifikasi lengkap ada di `docs/SPEC-sr-headless-screener.md`.

Alur saat ini terdiri dari dua tahap:

1. Weekly watchlist builder membaca universe lokal di `src/universe/idx.json`, menyaring saham berdasarkan likuiditas, struktur teknikal, support, dan volatilitas, lalu menghasilkan `data/watchlist.generated.json`.
2. Daily screener membaca generated watchlist tersebut, lalu menerapkan strategi S/R harian untuk mencari sinyal entry.

Catatan perilaku:

- Harga dari provider sudah disesuaikan (adjusted) terhadap split/dividen agar level S/R dan RSI tidak palsu.
- Daily screener menolak saham yang jatuh jauh di bawah SMA50 (anti-waterfall) dan butuh konfirmasi reversal sebelum memberi sinyal (`config.daily`).
- Sinyal yang sama tidak dikirim ulang dalam masa cooldown (`config.daily.cooldownDays`); state disimpan di `data/signal-state.json`.
- Ticker yang tidak diperdagangkan pada sesi pasar terakhir (suspend/halt/data tertinggal) dilewati; tiap run dicatat ke `data/run-log.jsonl`.
- Backtest mereplikasi pipeline live (weekly funnel as-of tanggal lalu daily signal) dengan eksekusi sadar-gap dan biaya (`config.backtest.costPct`).

## Setup

```bash
npm install
cp .env.example .env
```

Isi `.env`:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
RESEND_API_KEY=
MAIL_FROM="Screener <screener@example.com>"
MAIL_TO="you@example.com"
```

## Commands

```bash
npm run dev       # jalankan screener lokal
npm run weekly    # bangun watchlist mingguan dari universe lokal
npm run weekly:ensure # bangun watchlist hanya jika belum ada/kedaluwarsa
npm run backtest  # replay aturan ke histori watchlist
npm run build     # compile TypeScript ke dist/
npm start         # jalankan dist/index.js
```

## Deployment

GitHub Actions menjalankan `.github/workflows/screener.yml`:

- Senin lebih awal untuk refresh weekly watchlist.
- Weekday pra-market untuk menjalankan daily screener dan mengirim notifikasi.

Simpan secret Telegram dan Resend di GitHub Actions secrets sebelum mengaktifkan workflow.

Data Yahoo Finance bersifat tidak resmi dan delay. Hasil screener bukan nasihat keuangan; selalu verifikasi harga live di broker.
