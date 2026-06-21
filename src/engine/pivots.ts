import type { Candle, Pivots } from "./types.js";

export function classicPivots(candle?: Candle): Pivots | null {
  if (!candle) {
    return null;
  }

  const { high, low, close } = candle;
  const PP = (high + low + close) / 3;

  return {
    R3: high + 2 * (PP - low),
    R2: PP + (high - low),
    R1: 2 * PP - low,
    PP,
    S1: 2 * PP - high,
    S2: PP - (high - low),
    S3: low - 2 * (high - PP),
  };
}
