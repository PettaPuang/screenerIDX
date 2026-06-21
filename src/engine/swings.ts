import type { Candle } from "./types.js";

export function detectSwings(candles: Candle[], k = 3): number[] {
  const out: number[] = [];

  for (let i = k; i < candles.length - k; i += 1) {
    const candle = candles[i];

    if (!candle) {
      continue;
    }

    let isHigh = true;
    let isLow = true;

    for (let j = i - k; j <= i + k; j += 1) {
      const other = candles[j];

      if (j === i || !other) {
        continue;
      }

      if (other.high >= candle.high) {
        isHigh = false;
      }

      if (other.low <= candle.low) {
        isLow = false;
      }
    }

    if (isHigh) {
      out.push(candle.high);
    }

    if (isLow) {
      out.push(candle.low);
    }
  }

  return out;
}

export function clusterLevels(
  levels: number[],
  tolPct = 0.7,
): Array<{ price: number; strength: number }> {
  if (!levels.length) {
    return [];
  }

  const sorted = [...levels].sort((a, b) => a - b);
  const zones: number[][] = [];
  let bucket = [sorted[0]].filter((x): x is number => x != null);

  for (let i = 1; i < sorted.length; i += 1) {
    const level = sorted[i];

    if (level == null) {
      continue;
    }

    const ref = bucket.reduce((sum, x) => sum + x, 0) / bucket.length;

    if (Math.abs(level - ref) / ref <= tolPct / 100) {
      bucket.push(level);
    } else {
      zones.push(bucket);
      bucket = [level];
    }
  }

  zones.push(bucket);

  return zones
    .map((zone) => ({
      price: zone.reduce((sum, x) => sum + x, 0) / zone.length,
      strength: zone.length,
    }))
    .filter((zone) => zone.strength >= 2);
}
