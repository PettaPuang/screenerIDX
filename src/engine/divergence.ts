export function bullishDivergence(
  closes: number[],
  rsi: number[],
  window = 40,
): boolean {
  const n = closes.length;

  if (n < window) {
    return false;
  }

  const segment = closes.slice(-window);
  const lows: number[] = [];

  for (let i = 2; i < segment.length - 2; i += 1) {
    const current = segment[i];
    const prev1 = segment[i - 1];
    const prev2 = segment[i - 2];
    const next1 = segment[i + 1];
    const next2 = segment[i + 2];

    if (
      current == null ||
      prev1 == null ||
      prev2 == null ||
      next1 == null ||
      next2 == null
    ) {
      continue;
    }

    if (
      current < prev1 &&
      current < prev2 &&
      current < next1 &&
      current < next2
    ) {
      lows.push(n - window + i);
    }
  }

  if (lows.length < 2) {
    return false;
  }

  const a = lows.at(-2);
  const b = lows.at(-1);

  if (a == null || b == null) {
    return false;
  }

  const closeA = closes[a];
  const closeB = closes[b];
  const rsiA = rsi[a];
  const rsiB = rsi[b];

  if (closeA == null || closeB == null || rsiA == null || rsiB == null) {
    return false;
  }

  return closeB < closeA && rsiB > rsiA;
}
