import universe from "../universe/idx.json" with { type: "json" };
import { CONFIG as C } from "../config.js";
import { fetchDaily } from "../providers/yahoo.js";
import { evaluateWithReasons } from "../rules/evaluate.js";
import { sleep } from "../utils/time.js";
import { evaluateWeeklyCandidate } from "../watchlist/evaluate-weekly.js";
import type { Candle, WeeklyCandidate } from "../engine/types.js";

interface TradeResult {
  ticker: string;
  entryDate: string;
  exitDate: string;
  r: number;
  holdDays: number;
}

/**
 * ISO week key (mis. "2026-W25") agar boundary minggu konsisten dengan
 * resample mingguan yang dipakai engine.
 */
function isoWeekKey(t: number): string {
  const d = new Date(t);
  const day = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+day - +yearStart) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${week}`;
}

/** Jumlah candle dengan t <= cutoff (binary search, candles terurut naik). */
function countUpTo(times: number[], cutoff: number): number {
  let lo = 0;
  let hi = times.length;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const value = times[mid];

    if (value != null && value <= cutoff) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return lo;
}

/**
 * Simulasi keluar posisi long. Sadar-gap (eksekusi di open bila harga
 * melompati level), prioritas konservatif stop-dulu saat satu bar menyentuh
 * stop dan target sekaligus, lalu kurangi biaya roundtrip dalam satuan R.
 */
function resolveTrade(
  signal: { ticker: string; entry: number; stop: number; target: number },
  entryIndex: number,
  candles: Candle[],
): TradeResult | null {
  const entryCandle = candles[entryIndex];

  if (!entryCandle) {
    return null;
  }

  const { entry, stop, target } = signal;
  const riskPct = ((entry - stop) / entry) * 100;

  if (!Number.isFinite(riskPct) || riskPct <= 0) {
    return null;
  }

  const lastIndex = Math.min(candles.length, entryIndex + 1 + C.backtest.maxHoldDays);

  for (let i = entryIndex + 1; i < lastIndex; i += 1) {
    const candle = candles[i];

    if (!candle) {
      continue;
    }

    let exit: number | null = null;

    if (candle.open <= stop) {
      exit = candle.open;
    } else if (candle.open >= target) {
      exit = candle.open;
    } else if (candle.low <= stop) {
      exit = stop;
    } else if (candle.high >= target) {
      exit = target;
    }

    if (exit == null) {
      continue;
    }

    const returnPct = ((exit - entry) / entry) * 100;
    const r = (returnPct - C.backtest.costPct) / riskPct;

    return {
      ticker: signal.ticker,
      entryDate: entryCandle.date,
      exitDate: candle.date,
      r,
      holdDays: i - entryIndex,
    };
  }

  return null;
}

function maxDrawdown(equityCurve: number[]): number {
  let peak = 0;
  let drawdown = 0;

  for (const equity of equityCurve) {
    peak = Math.max(peak, equity);
    drawdown = Math.min(drawdown, equity - peak);
  }

  return drawdown;
}

interface Series {
  ticker: string;
  candles: Candle[];
  times: number[];
}

async function loadUniverse(): Promise<Series[]> {
  const series: Series[] = [];

  for (const ticker of universe as string[]) {
    try {
      const candles = await fetchDaily(ticker, C.backtest.years);

      if (candles.length) {
        series.push({
          ticker,
          candles,
          times: candles.map((candle) => candle.t),
        });
      }
    } catch (error) {
      console.error(`load skip ${ticker}:`, (error as Error).message);
    }

    await sleep(C.requestDelayMs);
  }

  return series;
}

async function backtest(): Promise<void> {
  const series = await loadUniverse();

  // Daftar tanggal perdagangan unik (gabungan semua ticker), terurut naik.
  const allDates = [
    ...new Set(series.flatMap((s) => s.times)),
  ].sort((a, b) => a - b);

  const trades: TradeResult[] = [];
  const weeklyRejects: Record<string, number> = {};
  const dailyRejects: Record<string, number> = {};
  const perTicker = new Map<string, { trades: number; sumR: number }>();

  const cooldownMs = C.daily.cooldownDays * 24 * 60 * 60 * 1000;
  const lastSignalT = new Map<string, number>();
  let currentWeek: string | null = null;
  let weeklySet = new Set<string>();
  let weeklySelections = 0;
  let weeksProcessed = 0;
  let dailySignals = 0;
  let unresolved = 0;

  for (const dayT of allDates) {
    const weekKey = isoWeekKey(dayT);

    // Boundary minggu baru: bangun ulang weekly watchlist memakai data
    // sebelum hari ini (as-of close terakhir minggu lalu), persis seperti
    // build-weekly yang jalan Senin pra-market dengan data Jumat.
    if (weekKey !== currentWeek) {
      currentWeek = weekKey;
      const candidates: WeeklyCandidate[] = [];

      for (const s of series) {
        const count = countUpTo(s.times, dayT - 1);

        if (count < C.weekly.minHistoryDays) {
          continue;
        }

        const result = evaluateWeeklyCandidate(s.ticker, s.candles.slice(0, count));

        if (result.candidate) {
          candidates.push(result.candidate);
        } else if (result.rejectReason) {
          weeklyRejects[result.rejectReason] =
            (weeklyRejects[result.rejectReason] ?? 0) + 1;
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      const selected = candidates.slice(0, C.weekly.topN);
      weeklySet = new Set(selected.map((candidate) => candidate.ticker));
      weeklySelections += weeklySet.size;
      weeksProcessed += 1;
    }

    if (!weeklySet.size) {
      continue;
    }

    for (const s of series) {
      if (!weeklySet.has(s.ticker)) {
        continue;
      }

      const count = countUpTo(s.times, dayT);
      const entryIndex = count - 1;
      const entryCandle = s.candles[entryIndex];

      // Hanya proses bila bar terakhir tepat hari ini (ticker diperdagangkan).
      if (entryIndex < C.backtest.warmupDays || entryCandle?.t !== dayT) {
        continue;
      }

      const daily = evaluateWithReasons(s.ticker, s.candles.slice(0, count));

      if (!daily.signal) {
        const reason = daily.rejectReason ?? "unknown";
        dailyRejects[reason] = (dailyRejects[reason] ?? 0) + 1;
        continue;
      }

      // De-dup: cermin cooldown live, jangan hitung ulang setup yang sama.
      const last = lastSignalT.get(s.ticker);

      if (last != null && dayT - last < cooldownMs) {
        dailyRejects.cooldown = (dailyRejects.cooldown ?? 0) + 1;
        continue;
      }

      lastSignalT.set(s.ticker, dayT);
      dailySignals += 1;
      const trade = resolveTrade(daily.signal, entryIndex, s.candles);

      if (trade) {
        trades.push(trade);
        const summary = perTicker.get(s.ticker) ?? { trades: 0, sumR: 0 };
        summary.trades += 1;
        summary.sumR += trade.r;
        perTicker.set(s.ticker, summary);
      } else {
        unresolved += 1;
      }
    }
  }

  const wins = trades.filter((trade) => trade.r > 0).length;
  const losses = trades.filter((trade) => trade.r <= 0).length;
  const sumR = trades.reduce((sum, trade) => sum + trade.r, 0);
  const avgHold = trades.length
    ? trades.reduce((sum, trade) => sum + trade.holdDays, 0) / trades.length
    : 0;
  const equityCurve = trades.reduce<number[]>((curve, trade) => {
    const previous = curve.at(-1) ?? 0;
    curve.push(previous + trade.r);
    return curve;
  }, []);
  const tradeCount = trades.length;

  console.log({
    universe: series.length,
    weeksProcessed,
    avgWeeklyWatchlist: weeksProcessed
      ? (weeklySelections / weeksProcessed).toFixed(1)
      : "0",
    weeklyRejects,
    dailySignals,
    dailyRejects,
    trades: tradeCount,
    wins,
    losses,
    unresolved,
    avgHoldDays: avgHold.toFixed(1),
    winRate: tradeCount ? `${((wins / tradeCount) * 100).toFixed(1)}%` : "0%",
    expectancyR: tradeCount ? (sumR / tradeCount).toFixed(2) : "0.00",
    totalR: sumR.toFixed(2),
    maxDrawdownR: maxDrawdown(equityCurve).toFixed(2),
    costPct: C.backtest.costPct,
    topTickers: [...perTicker.entries()]
      .map(([ticker, summary]) => ({
        ticker,
        trades: summary.trades,
        expectancyR: (summary.sumR / summary.trades).toFixed(2),
      }))
      .sort((a, b) => b.trades - a.trades)
      .slice(0, 10),
  });
}

backtest().catch((error: unknown) => {
  console.error("backtest_failed", error);
  process.exitCode = 1;
});
