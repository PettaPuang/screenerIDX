import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { CONFIG as C } from "./config.js";
import { fetchDaily } from "./providers/yahoo.js";
import { evaluateWithReasons, quickScan } from "./rules/evaluate.js";
import { notifyAll } from "./notify/index.js";
import { buildHtml, buildScanHtml, buildScanText, buildText, buildWeeklyHtml, buildWeeklyText } from "./report/format.js";
import { loadDailyWatchlist } from "./watchlist/load.js";
import {
  isOnCooldown,
  loadSignalState,
  saveSignalState,
} from "./state/signals.js";
import { sleep } from "./utils/time.js";
import type { Signal, TickerScan } from "./engine/types.js";

interface MarketContext {
  warn: string;
  referenceDate: string | null;
  stale: boolean;
}

async function marketContext(): Promise<MarketContext> {
  try {
    const candles = await fetchDaily("^JKSE", "3mo");
    const last = candles.at(-1);
    const ma20Slice = candles.slice(-20);

    if (!last || ma20Slice.length < 20) {
      return { warn: "Rezim: data IHSG belum cukup.", referenceDate: null, stale: false };
    }

    const ma20 =
      ma20Slice.reduce((sum, candle) => sum + candle.close, 0) /
      ma20Slice.length;

    const ageDays = (Date.now() - last.t) / (24 * 60 * 60 * 1000);
    const stale = ageDays > C.provider.maxStaleDays;
    const regime =
      last.close < ma20
        ? "Rezim risk-off (IHSG < MA20): perkecil ukuran atau pertimbangkan berhenti."
        : "Rezim normal.";
    const warn = stale
      ? `${regime} Data pasar terakhir ${last.date} (mungkin libur bursa / data tertunda).`
      : regime;

    return { warn, referenceDate: last.date, stale };
  } catch {
    return { warn: "Rezim: tidak terbaca.", referenceDate: null, stale: false };
  }
}

async function appendRunLog(entry: Record<string, unknown>): Promise<void> {
  try {
    const path = resolve(process.cwd(), C.runLogPath);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("run_log_failed", (error as Error).message);
  }
}

async function appendPaperTrades(signals: Signal[]): Promise<void> {
  try {
    const path = resolve(process.cwd(), C.paperTradesPath);
    const openTickers = new Set<string>();

    try {
      const existing = await readFile(path, "utf8");

      for (const line of existing.split("\n")) {
        if (!line.trim()) {
          continue;
        }

        const record = JSON.parse(line) as { ticker?: string; status?: string };

        if (record.status === "open" && record.ticker) {
          openTickers.add(record.ticker);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    const signalDate = new Date().toISOString().slice(0, 10);
    const lines: string[] = [];

    for (const signal of signals) {
      if (openTickers.has(signal.ticker)) {
        continue;
      }

      lines.push(
        `${JSON.stringify({
          signalDate,
          ticker: signal.ticker,
          entry: signal.entry,
          stop: signal.stop,
          target: signal.target,
          rr: signal.rr,
          triggers: signal.triggers,
          status: "open",
        })}\n`,
      );
    }

    if (!lines.length) {
      return;
    }

    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, lines.join(""), "utf8");
  } catch (error) {
    console.error("paper_ledger_failed", (error as Error).message);
  }
}

async function main(): Promise<void> {
  const signals: Signal[] = [];
  const scans: TickerScan[] = [];
  const watchlist = await loadDailyWatchlist();
  const market = await marketContext();

  console.log(
    `daily watchlist source=${watchlist.source} count=${watchlist.tickers.length} marketRef=${market.referenceDate ?? "n/a"}`,
  );

  let staleSkipped = 0;

  for (const ticker of watchlist.tickers) {
    try {
      const candles = await fetchDaily(ticker, C.rangeYears);
      const lastDate = candles.at(-1)?.date;

      // Lewati ticker yang tidak diperdagangkan di sesi pasar terakhir
      // (suspend/halt/data tertinggal) supaya sinyal tidak dari harga basi.
      if (
        market.referenceDate &&
        lastDate &&
        lastDate < market.referenceDate
      ) {
        staleSkipped += 1;
        continue;
      }

      const evaluation = evaluateWithReasons(ticker, candles);
      const scan = quickScan(
        ticker,
        candles,
        evaluation.rejectReason,
        evaluation.signal != null,
      );

      if (evaluation.signal) {
        signals.push(evaluation.signal);
      }

      scans.push(scan);
    } catch (error) {
      console.error(`skip ${ticker}:`, (error as Error).message);
    }

    await sleep(C.requestDelayMs);
  }

  const state = await loadSignalState();
  const now = Date.now();
  const fresh = signals.filter((signal) => !isOnCooldown(state, signal.ticker, now));
  const suppressed = signals.length - fresh.length;

  fresh.sort((a, b) => b.score - a.score);

  const top = fresh.slice(0, C.topN);
  const notes: string[] = [market.warn];

  if (watchlist.source === "seed") {
    notes.push(
      "Watchlist mingguan tidak tersedia, memakai daftar seed (jalankan ulang weekly builder).",
    );
  }

  const warn = notes.join("\n");
  const subject = `Screener IDX - ${top.length} sinyal`;

  const weeklyText = buildWeeklyText(watchlist.candidates);
  const scanText = buildScanText(scans);
  const dailyText = `${scanText}\n\n${buildText(top, warn)}`;
  const html = `${buildWeeklyHtml(watchlist.candidates)}${buildScanHtml(scans)}${buildHtml(top, warn)}`;

  await notifyAll(weeklyText, dailyText, html, subject);

  const today = new Date().toISOString();
  for (const signal of top) {
    state[signal.ticker] = today;
  }
  await saveSignalState(state);

  await appendRunLog({
    ts: today,
    watchlistSource: watchlist.source,
    watchlistCount: watchlist.tickers.length,
    marketReferenceDate: market.referenceDate,
    marketStale: market.stale,
    staleSkipped,
    candidates: signals.length,
    cooldownSuppressed: suppressed,
    sent: top.length,
    tickers: top.map((signal) => signal.ticker),
  });
  await appendPaperTrades(top);

  console.log(
    `done: ${top.length} sinyal terkirim (cooldown suppressed=${suppressed}, stale skip=${staleSkipped})`,
  );
}

main().catch((error: unknown) => {
  console.error("run_failed", error);
  process.exitCode = 1;
});
