# S/R Headless Screener — Spesifikasi Build (untuk dieksekusi via Cursor)

> **Apa ini:** screener saham IDX **tanpa UI**. Berjalan otomatis tiap hari kerja sebelum pasar buka, memindai *watchlist* yang sudah Anda saring fundamental, menerapkan aturan trading yang sudah disempurnakan, lalu **mengirim 3–5 sinyal ke Telegram + Email**.
> **Bukan aplikasi** — cuma satu script TypeScript + penjadwal. Tidak perlu komputer Anda menyala.
> **Stack:** Node.js + TypeScript · dijadwalkan via **GitHub Actions** (default) atau Vercel Cron · notifikasi **Telegram Bot API + Resend**.
> **Cara pakai dokumen:** taruh sebagai `SPEC.md` di repo baru, paste "Prompt pembuka" (Bagian 5) ke Cursor, eksekusi per *Step*, tes tiap step.

---

## 1. Latar Belakang & Tujuan

Tujuan tunggal: **tiap weekday pra-market, terima shortlist sinyal** (3–5 saham) lengkap dengan entry, stop, target, dan rasio risk/reward — langsung di Telegram dan inbox. Tanpa membuka aplikasi apa pun, tanpa UI.

**Non-tujuan:** bukan auto-order ke broker; bukan jaminan profit; tidak memindai seluruh bursa (hanya watchlist tervetted — lihat §3.0); tidak memodelkan ARA/ARB (lihat Batasan).

---

## 2. Catatan jujur sebelum mulai (jangan dilewati)

1. **Sumber data tidak resmi** (Yahoo `.JK`) — bisa berubah/diblokir, ToS abu-abu, dan **delay** (bukan real-time). Cukup untuk screening pra-market berbasis *close kemarin*; verifikasi harga live di broker.
2. **Oversold di downtrend itu jebakan** — sudah dimitigasi: sinyal hanya keluar bila oversold **bertepatan dengan support kuat** (idealnya + divergence). Tidak dihilangkan total. Tetap waspada saat pasar waterfall.
3. **ARA/ARB tidak dimodelkan** — stop Anda bisa tidak tereksekusi kalau saham kena auto-reject bawah. Ini risiko nyata di IDX.
4. **Backtest dulu** — angka ambang di config adalah *titik awal*, bukan angka sakti. Modul backtest disertakan justru agar Anda menguji & menyetelnya sebelum percaya uang.
5. **Bukan nasihat keuangan.**

---

## 3. Konsep & Aturan (sudah dikoreksi)

### 3.0 Universe
Bukan seluruh IDX. Pakai **watchlist tervetted fundamental** (`watchlist.json`, 20–40 nama). Refresh manual **per kuartal** setelah laporan keuangan, bukan harian.

### 3.1 Indikator yang dihitung (per saham, dari data harian)
- **RSI(14)** harian (Wilder) — untuk oversold + divergence.
- **Stochastic** (opsional, konfirmasi tambahan).
- **SMA20 / SMA50** — konteks tren.
- **Pivot klasik** Daily/Weekly/Monthly (W/M dari resample harian).
- **Zona swing** (fractal + cluster, di-ranking by sentuhan).
- **ADV** (average daily value) = rata-rata `close×volume` 20 hari — filter likuiditas.

### 3.2 Gerbang (gates) — kandidat ditolak jika gagal salah satu
1. **Likuiditas:** `ADV ≥ MIN_ADV_IDR` (buang yang tipis, agar bisa keluar & hindari ARB lock).
2. **Di support:** harga berada **dekat support kuat** (≤ `NEAR_SUPPORT_PCT` dari swing-support / pivot S1–S2).
3. **Oversold:** `RSI ≤ RSI_OVERSOLD`.
4. **Risk/Reward layak:** `RR ≥ MIN_RR` (lihat 3.3).

### 3.3 Perhitungan posisi
- **Entry** = close terakhir (harga sinyal). Disiplin: idealnya tunggu konfirmasi reversal LTF saat eksekusi nyata.
- **Stop** = sedikit di bawah support yang ditaruhkan (`support × (1 − STOP_BUFFER_PCT)`). Titik invalidasi.
- **Target** = resistance terdekat di atas (swing/pivot R1), **dibatasi** `MAX_TP_PCT` (default 5%). Jadi `TP = min(resistance, +5%)`.
- **RR** = `(target − entry) / (entry − stop)`.
- **Sizing (informasional):** `risk_rupiah = CAPITAL × RISK_PER_TRADE_PCT`; `lot = floor( risk_rupiah / (entry − stop) / 100 )` (1 lot = 100 lembar).

### 3.4 Skor & ranking
Skor tertimbang (bobot di config): `RR` + ada/tidaknya **divergence bullish** + jumlah **konfluensi** support + kedalaman oversold + likuiditas. Ambil **top 3–5** yang lolos semua gerbang. Kalau tidak ada yang lolos, kirim pesan "tidak ada setup hari ini" (kosong = informasi, bukan error).

### 3.5 Saklar rezim (penting)
Sebelum mengirim, cek arah IHSG (atau proksi). Jika sedang turun tajam, beri **peringatan di header pesan** ("rezim risk-off — perkecil ukuran/berhenti"). Mean-reversion berdarah di pasar trending turun.

---

## 4. Arsitektur

### 4.1 Alur
```
[GitHub Actions cron · weekday ~01:00 UTC = 08:00 WIB / 09:00 WITA]
        │  jalankan: node dist/index.js
        ▼
[index.ts]
  load watchlist + config
        │  untuk tiap ticker (dengan jeda kecil, error per-ticker diisolasi):
        ▼
  [providers/yahoo] → candles harian (2y)
        ▼
  [engine] resample → indikator (RSI/SMA/Stoch) → pivots → swings → divergence
        ▼
  [rules] gates → entry/stop/TP/RR → sizing → score
        ▼
  rank top 3–5  →  format report
        ▼
  [notify] kirim Telegram  ✦  kirim Email (Resend)   (paralel, error terpisah)
```

### 4.2 Struktur folder
```
sr-screener/
  src/
    index.ts                 # runner utama
    config.ts                # ambang, kapital, risiko, bobot skor
    watchlist.json           # daftar saham tervetted
    providers/yahoo.ts
    engine/
      types.ts
      resample.ts
      indicators.ts          # rsi, sma, stochastic
      pivots.ts
      swings.ts
      divergence.ts
    rules/evaluate.ts        # gates + sizing + score
    report/format.ts         # bikin teks Telegram + HTML email
    notify/telegram.ts
    notify/email.ts
    notify/index.ts          # notifyAll()
    backtest/backtest.ts     # validasi historis
  .github/workflows/screener.yml
  package.json · tsconfig.json · .env.example
```

### 4.3 Env / secrets
```
# data — Yahoo tidak butuh key
# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
# Email (Resend)
RESEND_API_KEY=...
MAIL_FROM="Screener <screener@domainanda.com>"
MAIL_TO="anda@email.com"
```
Di GitHub: simpan semua ini di **Settings → Secrets and variables → Actions**.

---

## 5. Step by Step (Cursor)

### Prompt pembuka (paste dulu)
> Saya punya `SPEC.md`. Bangun proyek Node + TypeScript "sr-screener" sesuai SPEC, **per Step di Bagian 5**, jangan lompat. Setelah tiap step tampilkan file & tunggu saya bilang "lanjut". Patuhi struktur folder, gates, dan rumus di SPEC. Jangan tambah dependency di luar yang disebut tanpa konfirmasi. Tulis kode defensif: error per-ticker tidak boleh menghentikan seluruh run.

### Step 0 — Init
```bash
mkdir sr-screener && cd sr-screener && npm init -y
npm i -D typescript tsx @types/node
npm i zod
npx tsc --init
```
`package.json` scripts:
```json
{ "scripts": { "dev": "tsx src/index.ts", "backtest": "tsx src/backtest/backtest.ts", "build": "tsc", "start": "node dist/index.js" } }
```

### Step 1 — Config + watchlist + types
```ts
// src/config.ts
export const CONFIG = {
  rangeYears: "2y",
  rsiPeriod: 14,
  rsiOversold: 35,
  nearSupportPct: 3,     // harga ≤3% di atas support
  stopBufferPct: 1.5,    // stop 1.5% di bawah support
  maxTpPct: 5,
  minRR: 1.5,
  minAdvIdr: 5_000_000_000, // Rp5 M/hari — TUNE via backtest
  capital: 100_000_000,     // modal Anda
  riskPerTradePct: 1,       // 1% modal per trade
  topN: 5,
  swingK: 3,
  swingTolPct: 0.7,
  divWindow: 40,
  weights: { rr: 2, divergence: 1.5, confluence: 1, oversold: 0.05, liquidity: 0.0000000005 },
  requestDelayMs: 400,   // jeda antar panggilan Yahoo
};
```
```json
// src/watchlist.json
["TPIA","BBCA","BMRI","BBRI","TLKM","ASII","ANTM","ADRO","UNVR","ICBP"]
```
```ts
// src/engine/types.ts
export interface Candle { date:string; open:number; high:number; low:number; close:number; volume:number; t:number; }
export interface Pivots { R3:number;R2:number;R1:number;PP:number;S1:number;S2:number;S3:number; }
export interface Signal {
  ticker:string; price:number; entry:number; stop:number; target:number;
  rr:number; riskPct:number; targetPct:number; lots:number;
  rsi:number; divergence:boolean; confluence:number; score:number;
  nearestSupport:number; nearestResistance:number; biasHTF:string;
}
```

### Step 2 — Provider (`src/providers/yahoo.ts`)
```ts
import type { Candle } from "../engine/types";
export async function fetchDaily(ticker:string, range="2y"):Promise<Candle[]> {
  const sym = ticker.includes(".") ? ticker : `${ticker.toUpperCase()}.JK`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${range}`;
  const res = await fetch(url, { headers:{ "User-Agent":"Mozilla/5.0" }});
  if (!res.ok) throw new Error(`provider_http_${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error("provider_no_data");
  const q = r.indicators?.quote?.[0] ?? {};
  const out:Candle[] = [];
  for (let i=0;i<r.timestamp.length;i++){
    const o=q.open?.[i],h=q.high?.[i],l=q.low?.[i],c=q.close?.[i],v=q.volume?.[i];
    if ([o,h,l,c].some(x=>x==null)) continue;
    const t=r.timestamp[i]*1000;
    out.push({ date:new Date(t).toISOString().slice(0,10), open:o,high:h,low:l,close:c,volume:v??0,t });
  }
  out.sort((a,b)=>a.t-b.t);
  return out;
}
```

### Step 3 — Engine
```ts
// src/engine/resample.ts
import type { Candle } from "./types";
function key(d:string,m:"W"|"M"){const x=new Date(d);if(m==="M")return `${x.getUTCFullYear()}-${x.getUTCMonth()}`;
  const t=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth(),x.getUTCDate()));const day=t.getUTCDay()||7;
  t.setUTCDate(t.getUTCDate()+4-day);const ys=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  const w=Math.ceil(((+t-+ys)/864e5+1)/7);return `${t.getUTCFullYear()}-W${w}`;}
export function resample(c:Candle[],m:"D"|"W"|"M"):Candle[]{
  if(m==="D")return c;const g=new Map<string,Candle[]>();
  for(const x of c){const k=key(x.date,m);(g.get(k)??g.set(k,[]).get(k)!).push(x);}
  const out:Candle[]=[];for(const a of g.values())out.push({date:a.at(-1)!.date,open:a[0].open,
    high:Math.max(...a.map(z=>z.high)),low:Math.min(...a.map(z=>z.low)),close:a.at(-1)!.close,volume:a.reduce((s,z)=>s+z.volume,0),t:a.at(-1)!.t});
  out.sort((a,b)=>a.t-b.t);return out;}
```
```ts
// src/engine/indicators.ts
export function sma(v:number[],n:number){return v.length<n?null:v.slice(-n).reduce((s,x)=>s+x,0)/n;}
export function rsiSeries(closes:number[],period=14):number[]{
  const out:number[]=Array(closes.length).fill(NaN);
  if(closes.length<=period)return out;
  let g=0,l=0;
  for(let i=1;i<=period;i++){const d=closes[i]-closes[i-1];d>=0?g+=d:l-=d;}
  g/=period;l/=period;
  out[period]=l===0?100:100-100/(1+g/l);
  for(let i=period+1;i<closes.length;i++){
    const d=closes[i]-closes[i-1];const up=d>0?d:0,dn=d<0?-d:0;
    g=(g*(period-1)+up)/period;l=(l*(period-1)+dn)/period;
    out[i]=l===0?100:100-100/(1+g/l);
  }
  return out;
}
export function stochastic(c:{high:number;low:number;close:number}[],n=14){
  if(c.length<n)return null;const s=c.slice(-n);
  const hh=Math.max(...s.map(x=>x.high)),ll=Math.min(...s.map(x=>x.low));
  return hh===ll?50:((c.at(-1)!.close-ll)/(hh-ll))*100;
}
```
```ts
// src/engine/pivots.ts
import type { Candle, Pivots } from "./types";
export function classicPivots(c?:Candle):Pivots|null{
  if(!c)return null;const{high:H,low:L,close:C}=c;const PP=(H+L+C)/3;
  return{R3:H+2*(PP-L),R2:PP+(H-L),R1:2*PP-L,PP,S1:2*PP-H,S2:PP-(H-L),S3:L-2*(H-PP)};
}
```
```ts
// src/engine/swings.ts
import type { Candle } from "./types";
export function detectSwings(c:Candle[],k=3):number[]{
  const out:number[]=[];
  for(let i=k;i<c.length-k;i++){let hi=true,lo=true;
    for(let j=i-k;j<=i+k;j++){if(j===i)continue;if(c[j].high>=c[i].high)hi=false;if(c[j].low<=c[i].low)lo=false;}
    if(hi)out.push(c[i].high);if(lo)out.push(c[i].low);}
  return out;
}
export function clusterLevels(lv:number[],tolPct=0.7){
  if(!lv.length)return [] as {price:number;strength:number}[];
  const s=[...lv].sort((a,b)=>a-b);const zones:number[][]=[];let b=[s[0]];
  for(let i=1;i<s.length;i++){const ref=b.reduce((x,y)=>x+y,0)/b.length;
    Math.abs(s[i]-ref)/ref<=tolPct/100?b.push(s[i]):(zones.push(b),b=[s[i]]);}
  zones.push(b);
  return zones.map(z=>({price:z.reduce((x,y)=>x+y,0)/z.length,strength:z.length})).filter(z=>z.strength>=2);
}
```
```ts
// src/engine/divergence.ts  — bullish: harga lower-low, RSI higher-low
export function bullishDivergence(closes:number[],rsi:number[],window=40):boolean{
  const n=closes.length;if(n<window)return false;
  const seg=closes.slice(-window);
  // dua lembah harga terbaru (lokal min sederhana)
  const mins:number[]=[];
  for(let i=2;i<seg.length-2;i++)
    if(seg[i]<seg[i-1]&&seg[i]<seg[i-2]&&seg[i]<seg[i+1]&&seg[i]<seg[i+2])mins.push(n-window+i);
  if(mins.length<2)return false;
  const [a,b]=[mins.at(-2)!,mins.at(-1)!];
  return closes[b]<closes[a] && rsi[b]>rsi[a]; // harga turun, RSI naik
}
```

### Step 4 — Rules (`src/rules/evaluate.ts`)
```ts
import type { Candle, Signal } from "../engine/types";
import { resample } from "../engine/resample";
import { classicPivots } from "../engine/pivots";
import { detectSwings, clusterLevels } from "../engine/swings";
import { rsiSeries, sma } from "../engine/indicators";
import { bullishDivergence } from "../engine/divergence";
import { CONFIG as C } from "../config";

export function evaluate(ticker:string, candles:Candle[]):Signal|null{
  if(candles.length<60) return null;
  const price=candles.at(-1)!.close;
  const closes=candles.map(c=>c.close);
  const rsiArr=rsiSeries(closes,C.rsiPeriod);
  const rsi=rsiArr.at(-1)!;
  const s20=sma(closes,20), s50=sma(closes,50);
  const adv=candles.slice(-20).reduce((s,c)=>s+c.close*c.volume,0)/20;

  const wk=resample(candles,"W"), mo=resample(candles,"M");
  const pD=classicPivots(candles.at(-1)!), pW=classicPivots(wk.at(-1)!), pM=classicPivots(mo.at(-1)!);
  const zones=clusterLevels(detectSwings(candles,C.swingK),C.swingTolPct);

  const supports=[...zones.map(z=>z.price), pD?.S1,pD?.S2,pW?.S1].filter((x):x is number=>!!x&&x<price);
  const resis  =[...zones.map(z=>z.price), pD?.R1,pD?.R2,pW?.R1].filter((x):x is number=>!!x&&x>price);
  if(!supports.length||!resis.length) return null;
  const nearestSupport=Math.max(...supports);
  const nearestResistance=Math.min(...resis);

  // GATES
  if(adv < C.minAdvIdr) return null;
  const distSup=(price-nearestSupport)/price*100;
  if(distSup > C.nearSupportPct) return null;
  if(rsi > C.rsiOversold) return null;

  const entry=price;
  const stop=nearestSupport*(1-C.stopBufferPct/100);
  const rawTpPct=(nearestResistance-price)/price*100;
  const targetPct=Math.min(rawTpPct, C.maxTpPct);
  const target=price*(1+targetPct/100);
  const rr=(target-entry)/(entry-stop);
  if(!Number.isFinite(rr)||rr < C.minRR) return null;

  const divergence=bullishDivergence(closes,rsiArr,C.divWindow);
  const confluence=supports.filter(s=>Math.abs(s-nearestSupport)/nearestSupport<=0.01).length;
  const riskPct=(entry-stop)/entry*100;
  const lots=Math.floor((C.capital*C.riskPerTradePct/100)/(entry-stop)/100);
  const biasHTF=(pW&&price>pW.PP&&s20&&s50&&s20>s50)?"Bullish":(pW&&price<pW.PP)?"Bearish":"Transisi";

  const score = C.weights.rr*rr + C.weights.divergence*(divergence?1:0)
    + C.weights.confluence*confluence + C.weights.oversold*(C.rsiOversold-rsi)
    + C.weights.liquidity*adv;

  return {ticker,price,entry,stop,target,rr,riskPct,targetPct,lots,rsi,divergence,confluence,score,nearestSupport,nearestResistance,biasHTF};
}
```

### Step 5 — Report (`src/report/format.ts`)
```ts
import type { Signal } from "../engine/types";
const rp=(n:number)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(n);
export function buildText(sigs:Signal[], regimeWarn:string){
  const d=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"});
  if(!sigs.length) return `📊 *Screener ${d}*\n${regimeWarn}\nTidak ada setup yang lolos kriteria hari ini.`;
  const rows=sigs.map((s,i)=>
    `*${i+1}. ${s.ticker}* ${s.divergence?"🔵div":""} (${s.biasHTF})\n`+
    `   Entry ${rp(s.entry)} · Stop ${rp(s.stop)} (−${s.riskPct.toFixed(1)}%) · TP ${rp(s.target)} (+${s.targetPct.toFixed(1)}%)\n`+
    `   RR ${s.rr.toFixed(2)} · RSI ${s.rsi.toFixed(0)} · ~${s.lots} lot`).join("\n\n");
  return `📊 *Screener ${d}*\n${regimeWarn}\n\n${rows}\n\n_Bukan nasihat keuangan. Verifikasi harga live & konfirmasi entry._`;
}
export function buildHtml(sigs:Signal[], regimeWarn:string){
  const head=`<h2>Screener IDX</h2><p>${regimeWarn}</p>`;
  if(!sigs.length) return head+`<p>Tidak ada setup yang lolos hari ini.</p>`;
  const tr=sigs.map((s,i)=>`<tr><td>${i+1}</td><td><b>${s.ticker}</b>${s.divergence?" 🔵":""}</td>
    <td>${rp(s.entry)}</td><td>${rp(s.stop)}</td><td>${rp(s.target)}</td><td>${s.rr.toFixed(2)}</td>
    <td>${s.rsi.toFixed(0)}</td><td>${s.lots}</td></tr>`).join("");
  return head+`<table border="1" cellpadding="6" style="border-collapse:collapse">
    <tr><th>#</th><th>Saham</th><th>Entry</th><th>Stop</th><th>TP</th><th>RR</th><th>RSI</th><th>Lot</th></tr>
    ${tr}</table><p style="color:#888">Bukan nasihat keuangan.</p>`;
}
```

### Step 6 — Notify (dua kanal)
```ts
// src/notify/telegram.ts
export async function sendTelegram(text:string){
  const t=process.env.TELEGRAM_BOT_TOKEN, c=process.env.TELEGRAM_CHAT_ID;
  if(!t||!c) throw new Error("telegram_env_missing");
  const r=await fetch(`https://api.telegram.org/bot${t}/sendMessage`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({chat_id:c,text,parse_mode:"Markdown"})});
  if(!r.ok) throw new Error(`telegram_${r.status}`);
}
```
```ts
// src/notify/email.ts
export async function sendEmail(subject:string,html:string){
  const k=process.env.RESEND_API_KEY;
  if(!k) throw new Error("resend_env_missing");
  const r=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{Authorization:`Bearer ${k}`,"Content-Type":"application/json"},
    body:JSON.stringify({from:process.env.MAIL_FROM,to:process.env.MAIL_TO,subject,html})});
  if(!r.ok) throw new Error(`resend_${r.status}`);
}
```
```ts
// src/notify/index.ts — kirim dua-duanya, error terisolasi
import { sendTelegram } from "./telegram";
import { sendEmail } from "./email";
export async function notifyAll(text:string, html:string, subject:string){
  const res = await Promise.allSettled([ sendTelegram(text), sendEmail(subject,html) ]);
  res.forEach((r,i)=>{ if(r.status==="rejected") console.error(`notify_${i}_failed`, r.reason); });
}
```

### Step 7 — Runner (`src/index.ts`)
```ts
import watchlist from "./watchlist.json";
import { CONFIG as C } from "./config";
import { fetchDaily } from "./providers/yahoo";
import { evaluate } from "./rules/evaluate";
import { buildText, buildHtml } from "./report/format";
import { notifyAll } from "./notify";
import type { Signal } from "./engine/types";

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function regimeWarning():Promise<string>{
  try{ // proksi: IHSG (^JKSE)
    const c=await fetchDaily("^JKSE","3mo");
    const last=c.at(-1)!.close, ma20=c.slice(-20).reduce((s,x)=>s+x.close,0)/20;
    return last<ma20 ? "⚠️ Rezim risk-off (IHSG < MA20) — perkecil ukuran / pertimbangkan berhenti." : "Rezim normal.";
  }catch{ return "Rezim: tidak terbaca."; }
}

async function main(){
  const signals:Signal[]=[];
  for(const t of watchlist as string[]){
    try{ const c=await fetchDaily(t, C.rangeYears); const s=evaluate(t,c); if(s)signals.push(s); }
    catch(e){ console.error(`skip ${t}:`, (e as Error).message); }
    await sleep(C.requestDelayMs);
  }
  signals.sort((a,b)=>b.score-a.score);
  const top=signals.slice(0, C.topN);
  const warn=await regimeWarning();
  await notifyAll(buildText(top,warn), buildHtml(top,warn), `Screener IDX — ${top.length} sinyal`);
  console.log(`done: ${top.length} sinyal terkirim`);
}
main();
```

### Step 8 — Penjadwalan (GitHub Actions) `.github/workflows/screener.yml`
```yaml
name: SR Screener
on:
  schedule:
    - cron: "0 1 * * 1-5"   # 01:00 UTC = 08:00 WIB / 09:00 WITA, Senin–Jumat
  workflow_dispatch: {}      # bisa dijalankan manual untuk tes
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npx tsx src/index.ts
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID:   ${{ secrets.TELEGRAM_CHAT_ID }}
          RESEND_API_KEY:     ${{ secrets.RESEND_API_KEY }}
          MAIL_FROM:          ${{ secrets.MAIL_FROM }}
          MAIL_TO:            ${{ secrets.MAIL_TO }}
```
**Catatan GitHub Actions:** waktu cron **tidak presisi detik** (bisa molor saat beban tinggi) — pasang lebih awal dari open. Scheduled workflow **dinonaktifkan otomatis jika repo tak ada aktivitas ~60 hari** — commit berkala atau jalankan `workflow_dispatch`. Hari libur bursa belum ditangani (jalan Sen–Jum apa adanya; kalau libur, anggap saja laporan diabaikan — atau tambah cek kalender libur sebagai enhancement).

**Alternatif (stack Anda):** Vercel Cron memanggil route handler yang menjalankan `main()`, atau Upstash QStash schedule → endpoint. Sama saja; GitHub Actions dipilih karena paling lepas dari infra dan gratis.

### Step 9 — Backtest dulu (`src/backtest/backtest.ts`)
Sebelum percaya: replay aturan ini ke histori tiap saham watchlist. Untuk tiap hari t, hitung sinyal pakai data **hingga t** (hati-hati lookahead), simulasikan entry di close t, exit saat kena TP atau Stop di hari-hari berikut, catat hasil. Output: jumlah trade, **win rate**, rata-rata RR terealisasi, **expectancy**, max drawdown.
```ts
// kerangka — Cursor lengkapi
import watchlist from "../watchlist.json";
import { fetchDaily } from "../providers/yahoo";
import { evaluate } from "../rules/evaluate";
async function backtest(){
  let wins=0,losses=0,sumR=0;
  for(const t of watchlist as string[]){
    const all=await fetchDaily(t,"5y");
    for(let i=120;i<all.length-30;i++){
      const sig=evaluate(t, all.slice(0,i+1)); if(!sig)continue;
      // cari mana lebih dulu kena di all[i+1..]: target (menang) atau stop (kalah)
      for(let j=i+1;j<Math.min(all.length,i+30);j++){
        if(all[j].low<=sig.stop){losses++;sumR-=1;break;}
        if(all[j].high>=sig.target){wins++;sumR+=sig.rr;break;}
      }
    }
  }
  const n=wins+losses;
  console.log({trades:n, winRate:(wins/n*100).toFixed(1)+"%", expectancyR:(sumR/n).toFixed(2)});
}
backtest();
```
**Batasan backtest ini (jujur):** belum memasukkan slippage, biaya, gap, dan ARA/ARB; entry diasumsikan ter-fill di close; tidak menangani survivorship. Hasilnya **optimistis** — jadikan saringan kasar, bukan janji.

### Step 10 — Tes & nyalakan
```bash
# lokal (isi .env dulu)
npm run dev          # harus mengirim pesan tes ke TG + email Anda
npm run backtest     # lihat win rate / expectancy
```
Lalu push ke GitHub, isi Secrets, dan picu `workflow_dispatch` sekali untuk memastikan jalan di cloud.

---

## 6. Setup kanal (sekali saja)

**Telegram:** chat ke **@BotFather** → `/newbot` → dapat `TELEGRAM_BOT_TOKEN`. Kirim satu pesan ke bot Anda, lalu buka `https://api.telegram.org/bot<TOKEN>/getUpdates` untuk membaca `chat.id` Anda → itu `TELEGRAM_CHAT_ID`.

**Email (Resend):** pakai akun Resend Anda, buat API key → `RESEND_API_KEY`. `MAIL_FROM` harus dari domain terverifikasi di Resend (Anda sudah set domain cnnct.app). `MAIL_TO` = email Anda.

---

## 7. Batasan (tetap sadari)
Data tidak resmi & delay · oversold-di-downtrend dimitigasi bukan dihilangkan · ARA/ARB & hari libur belum dimodelkan · backtest optimistis · **bukan nasihat keuangan**. Otomatisasi rapi ≠ strategi untung — validasi dulu, mulai ukuran kecil.

---

## 8. Pengembangan V2 — Weekly Watchlist Pipeline

Versi awal memakai `watchlist.json` sebagai daftar saham final. Untuk pengembangan berikutnya, watchlist tidak lagi harus statis: sistem membentuk **watchlist mingguan** dari universe lokal saham IDX, lalu menjalankan strategi S/R harian hanya pada saham yang masuk watchlist mingguan tersebut.

Alur baru:

```
[src/universe/idx.json]
        │  weekly screening: likuiditas + tren + support + volatilitas
        ▼
[data/watchlist.generated.json]
        │  daily screening: support + RSI oversold + RR
        ▼
[Telegram + Email]
```

Prinsipnya:

1. **Weekly builder** memilih saham yang layak dipantau minggu ini, bukan langsung memberi sinyal entry.
2. **Daily screener** tetap memakai strategi utama: dekat support, oversold, RR layak, ranking top signal.
3. **Backtest** harus berkembang dari sekadar win rate menjadi evaluasi diagnostik: berapa kandidat mingguan, berapa sinyal harian, dan alasan saham ditolak/lolos.

Batasan V2: universe masih file lokal dan filter mingguan masih teknikal + likuiditas. Data fundamental otomatis belum masuk; jika nanti dibutuhkan, tambahkan sumber data fundamental yang jelas sebelum rule fundamental dijadikan gate utama.
