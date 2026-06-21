import { CONFIG as C } from "../config.js";
import { atrPct, sma } from "../engine/indicators.js";
import { classicPivots } from "../engine/pivots.js";
import { resample } from "../engine/resample.js";
import { clusterLevels, detectSwings } from "../engine/swings.js";
import type { Candle, WeeklyCandidate } from "../engine/types.js";

export type WeeklyRejectReason =
  | "data_insufficient"
  | "indicator_unavailable"
  | "liquidity"
  | "trend"
  | "volatility"
  | "support_unavailable"
  | "too_far_from_support";

export interface WeeklyEvaluation {
  ticker: string;
  candidate: WeeklyCandidate | null;
  rejectReason: WeeklyRejectReason | null;
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

function previousCompleted(candles: Candle[]): Candle | undefined {
  return candles.length >= 2 ? candles.at(-2) : candles.at(-1);
}

export function evaluateWeeklyCandidate(
  ticker: string,
  candles: Candle[],
): WeeklyEvaluation {
  if (candles.length < C.weekly.minHistoryDays) {
    return { ticker, candidate: null, rejectReason: "data_insufficient" };
  }

  const last = candles.at(-1);

  if (!last) {
    return { ticker, candidate: null, rejectReason: "data_insufficient" };
  }

  const price = last.close;
  const closes = candles.map((candle) => candle.close);
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const currentAtrPct = atrPct(candles, 14);

  if (s20 == null || s50 == null || currentAtrPct == null) {
    return { ticker, candidate: null, rejectReason: "indicator_unavailable" };
  }

  const adv20 = averageDailyValue(candles, 20);

  if (adv20 < C.weekly.minAdvIdr) {
    return { ticker, candidate: null, rejectReason: "liquidity" };
  }

  const maxBelowSma50 = s50 * (1 - C.weekly.maxBelowSma50Pct / 100);
  const trendOk = price >= s50 || (price >= maxBelowSma50 && s20 >= s50 * 0.98);

  if (!trendOk) {
    return { ticker, candidate: null, rejectReason: "trend" };
  }

  if (currentAtrPct > C.weekly.maxAtrPct) {
    return { ticker, candidate: null, rejectReason: "volatility" };
  }

  const weekly = resample(candles, "W");
  const monthly = resample(candles, "M");
  const pW = classicPivots(previousCompleted(weekly));
  const pM = classicPivots(previousCompleted(monthly));
  const zones = clusterLevels(detectSwings(candles, C.swingK), C.swingTolPct);
  const zonePrices = zones.map((zone) => zone.price);
  const supports = [
    ...zonePrices,
    pW?.S1,
    pW?.S2,
    pM?.S1,
    pM?.S2,
  ].filter((x): x is number => x != null && x < price);

  if (!supports.length) {
    return { ticker, candidate: null, rejectReason: "support_unavailable" };
  }

  const nearestSupport = Math.max(...supports);
  const distanceToSupportPct = ((price - nearestSupport) / price) * 100;

  const swingSupports = zones
    .filter((zone) => zone.price < price)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)
    .map((zone) => zone.price);
  const swingResistances = zones
    .filter((zone) => zone.price > price)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map((zone) => zone.price);

  if (distanceToSupportPct > C.weekly.nearSupportPct) {
    return { ticker, candidate: null, rejectReason: "too_far_from_support" };
  }

  const confluence = supports.filter(
    (support) => Math.abs(support - nearestSupport) / nearestSupport <= 0.015,
  ).length;
  const liquidityScore = Math.log10(Math.max(adv20, 1_000_000_000)) - 9;
  const trendScore = price >= s50 ? 1 : 0.4;
  const supportScore = Math.max(0, C.weekly.nearSupportPct - distanceToSupportPct);
  const volatilityScore = Math.max(0, C.weekly.maxAtrPct - currentAtrPct);
  const score =
    supportScore * 1.5 +
    confluence * 1.25 +
    trendScore +
    liquidityScore +
    volatilityScore * 0.25;

  return {
    ticker,
    rejectReason: null,
    candidate: {
      ticker,
      price,
      score,
      adv20,
      atrPct: currentAtrPct,
      sma20: s20,
      sma50: s50,
      nearestSupport,
      distanceToSupportPct,
      confluence,
      swingSupports,
      swingResistances,
      reasons: [
        `ADV20 ${adv20.toFixed(0)}`,
        `jarak support ${distanceToSupportPct.toFixed(1)}%`,
        `ATR ${currentAtrPct.toFixed(1)}%`,
      ],
    },
  };
}
