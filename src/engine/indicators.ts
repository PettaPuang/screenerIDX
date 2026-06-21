export function sma(values: number[], period: number): number | null {
  if (values.length < period) {
    return null;
  }

  return values.slice(-period).reduce((sum, x) => sum + x, 0) / period;
}

export function rsiSeries(closes: number[], period = 14): number[] {
  const out = Array<number>(closes.length).fill(Number.NaN);

  if (closes.length <= period) {
    return out;
  }

  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i += 1) {
    const current = closes[i];
    const previous = closes[i - 1];

    if (current == null || previous == null) {
      continue;
    }

    const diff = current - previous;
    if (diff >= 0) {
      gain += diff;
    } else {
      loss -= diff;
    }
  }

  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);

  for (let i = period + 1; i < closes.length; i += 1) {
    const current = closes[i];
    const previous = closes[i - 1];

    if (current == null || previous == null) {
      continue;
    }

    const diff = current - previous;
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;

    gain = (gain * (period - 1) + up) / period;
    loss = (loss * (period - 1) + down) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }

  return out;
}

export function stochastic(
  candles: Array<{ high: number; low: number; close: number }>,
  period = 14,
): number | null {
  if (candles.length < period) {
    return null;
  }

  const slice = candles.slice(-period);
  const high = Math.max(...slice.map((x) => x.high));
  const low = Math.min(...slice.map((x) => x.low));
  const last = candles.at(-1);

  if (!last) {
    return null;
  }

  return high === low ? 50 : ((last.close - low) / (high - low)) * 100;
}

export function atrPct(
  candles: Array<{ high: number; low: number; close: number }>,
  period = 14,
): number | null {
  if (candles.length <= period) {
    return null;
  }

  const trueRanges: number[] = [];

  for (let i = candles.length - period; i < candles.length; i += 1) {
    const candle = candles[i];
    const previous = candles[i - 1];

    if (!candle || !previous) {
      continue;
    }

    trueRanges.push(
      Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previous.close),
        Math.abs(candle.low - previous.close),
      ),
    );
  }

  const last = candles.at(-1);

  if (!last || !trueRanges.length) {
    return null;
  }

  const atr = trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
  return (atr / last.close) * 100;
}
