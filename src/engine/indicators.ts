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

/**
 * Chaikin Money Flow: proksi tekanan beli/jual dari OHLCV. Tiap bar dibobot
 * posisi close dalam range (dekat high = serapan) dikali volume. Hasil di
 * rentang -1..+1; positif menandakan akumulasi, negatif distribusi.
 */
export function chaikinMoneyFlow(
  candles: Array<{ high: number; low: number; close: number; volume: number }>,
  period = 20,
): number | null {
  if (candles.length < period) {
    return null;
  }

  const slice = candles.slice(-period);
  let mfvSum = 0;
  let volumeSum = 0;

  for (const candle of slice) {
    const range = candle.high - candle.low;
    const multiplier =
      range === 0
        ? 0
        : (candle.close - candle.low - (candle.high - candle.close)) / range;
    mfvSum += multiplier * candle.volume;
    volumeSum += candle.volume;
  }

  return volumeSum === 0 ? 0 : mfvSum / volumeSum;
}

/** Rasio volume bar terakhir terhadap rata-rata `period` bar sebelumnya. */
export function volumeRatio(volumes: number[], period = 20): number | null {
  if (volumes.length < period + 1) {
    return null;
  }

  const prior = volumes.slice(-period - 1, -1);

  if (prior.length < period) {
    return null;
  }

  const avg = prior.reduce((sum, value) => sum + value, 0) / prior.length;
  const last = volumes.at(-1);

  if (last == null || avg <= 0) {
    return null;
  }

  return last / avg;
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
