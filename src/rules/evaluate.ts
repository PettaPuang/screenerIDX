import { CONFIG as C } from "../config.js";
import { bullishDivergence } from "../engine/divergence.js";
import { rsiSeries, sma } from "../engine/indicators.js";
import { classicPivots } from "../engine/pivots.js";
import { resample } from "../engine/resample.js";
import { clusterLevels, detectSwings } from "../engine/swings.js";
import type { Candle, Signal } from "../engine/types.js";

function previousCompleted(candles: Candle[]): Candle | undefined {
  return candles.length >= 2 ? candles.at(-2) : candles.at(-1);
}

function averageDailyValue(candles: Candle[], period = 20): number {
  const slice = candles.slice(-period);

  if (!slice.length) {
    return 0;
  }

  return (
    slice.reduce((sum, candle) => sum + candle.close * candle.volume, 0) /
    slice.length
  );
}

export type DailyRejectReason =
  | "data_insufficient"
  | "indicator_unavailable"
  | "support_or_resistance_unavailable"
  | "liquidity"
  | "support_distance"
  | "rsi"
  | "trend_waterfall"
  | "reversal_unconfirmed"
  | "rr";

export interface DailyEvaluation {
  ticker: string;
  signal: Signal | null;
  rejectReason: DailyRejectReason | null;
}

export function evaluateWithReasons(
  ticker: string,
  candles: Candle[],
): DailyEvaluation {
  if (candles.length < 60) {
    return { ticker, signal: null, rejectReason: "data_insufficient" };
  }

  const last = candles.at(-1);

  if (!last) {
    return { ticker, signal: null, rejectReason: "data_insufficient" };
  }

  const price = last.close;
  const closes = candles.map((candle) => candle.close);
  const rsiArr = rsiSeries(closes, C.rsiPeriod);
  const rsi = rsiArr.at(-1);

  if (rsi == null || !Number.isFinite(rsi)) {
    return { ticker, signal: null, rejectReason: "indicator_unavailable" };
  }

  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const adv = averageDailyValue(candles, 20);
  const weekly = resample(candles, "W");
  const monthly = resample(candles, "M");
  const pD = classicPivots(previousCompleted(candles));
  const pW = classicPivots(previousCompleted(weekly));
  const pM = classicPivots(previousCompleted(monthly));
  const zones = clusterLevels(detectSwings(candles, C.swingK), C.swingTolPct);
  const zonePrices = zones.map((zone) => zone.price);

  const supports = [
    ...zonePrices,
    pD?.S1,
    pD?.S2,
    pW?.S1,
    pW?.S2,
    pM?.S1,
  ].filter((x): x is number => x != null && x < price);

  const resistances = [
    ...zonePrices,
    pD?.R1,
    pD?.R2,
    pW?.R1,
    pM?.R1,
  ].filter((x): x is number => x != null && x > price);

  if (!supports.length || !resistances.length) {
    return {
      ticker,
      signal: null,
      rejectReason: "support_or_resistance_unavailable",
    };
  }

  const nearestSupport = Math.max(...supports);
  const nearestResistance = Math.min(...resistances);

  if (adv < C.minAdvIdr) {
    return { ticker, signal: null, rejectReason: "liquidity" };
  }

  const distSup = ((price - nearestSupport) / price) * 100;

  if (distSup > C.nearSupportPct) {
    return { ticker, signal: null, rejectReason: "support_distance" };
  }

  if (rsi > C.rsiOversold) {
    return { ticker, signal: null, rejectReason: "rsi" };
  }

  // Anti-waterfall: tolak saham yang sudah jatuh jauh di bawah SMA50.
  // "Dekat support" saat downtrend tajam adalah jebakan pisau jatuh.
  if (s50 != null && price < s50 * (1 - C.daily.maxBelowSma50Pct / 100)) {
    return { ticker, signal: null, rejectReason: "trend_waterfall" };
  }

  // Konfirmasi reversal: butuh tanda stabilisasi (candle hijau, RSI berbalik
  // naik, atau close naik dari kemarin) supaya tidak entry saat masih meluncur.
  if (C.daily.requireReversalConfirm) {
    const previous = candles.at(-2);
    const rsiPrev = rsiArr.at(-2);
    const greenCandle = last.close >= last.open;
    const rsiTurningUp =
      rsiPrev != null && Number.isFinite(rsiPrev) && rsi > rsiPrev;
    const closeUp = previous != null && last.close > previous.close;

    if (!greenCandle && !rsiTurningUp && !closeUp) {
      return { ticker, signal: null, rejectReason: "reversal_unconfirmed" };
    }
  }

  const entry = price;
  const stop = nearestSupport * (1 - C.stopBufferPct / 100);
  const rawTpPct = ((nearestResistance - price) / price) * 100;
  const targetPct = Math.min(rawTpPct, C.maxTpPct);
  const target = price * (1 + targetPct / 100);
  const rr = (target - entry) / (entry - stop);

  if (!Number.isFinite(rr) || rr < C.minRR) {
    return { ticker, signal: null, rejectReason: "rr" };
  }

  const divergence = bullishDivergence(closes, rsiArr, C.divWindow);
  const confluence = supports.filter(
    (support) => Math.abs(support - nearestSupport) / nearestSupport <= 0.01,
  ).length;
  const riskPct = ((entry - stop) / entry) * 100;
  const riskRupiah = C.capital * (C.riskPerTradePct / 100);
  const lots = Math.max(0, Math.floor(riskRupiah / (entry - stop) / 100));
  const biasHTF =
    pW && price > pW.PP && s20 != null && s50 != null && s20 > s50
      ? "Bullish"
      : pW && price < pW.PP
        ? "Bearish"
        : "Transisi";

  const score =
    C.weights.rr * rr +
    C.weights.divergence * (divergence ? 1 : 0) +
    C.weights.confluence * confluence +
    C.weights.oversold * (C.rsiOversold - rsi) +
    C.weights.liquidity * adv;

  return {
    ticker,
    rejectReason: null,
    signal: {
      ticker,
      price,
      entry,
      stop,
      target,
      rr,
      riskPct,
      targetPct,
      lots,
      rsi,
      divergence,
      confluence,
      score,
      nearestSupport,
      nearestResistance,
      biasHTF,
    },
  };
}

export function evaluate(ticker: string, candles: Candle[]): Signal | null {
  return evaluateWithReasons(ticker, candles).signal;
}
