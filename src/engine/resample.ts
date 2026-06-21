import type { Candle } from "./types.js";

type Timeframe = "D" | "W" | "M";

function key(date: string, timeframe: Exclude<Timeframe, "D">): string {
  const x = new Date(date);

  if (timeframe === "M") {
    return `${x.getUTCFullYear()}-${x.getUTCMonth()}`;
  }

  const t = new Date(
    Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()),
  );
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+t - +yearStart) / 86_400_000 + 1) / 7);

  return `${t.getUTCFullYear()}-W${week}`;
}

export function resample(candles: Candle[], timeframe: Timeframe): Candle[] {
  if (timeframe === "D") {
    return candles;
  }

  const groups = new Map<string, Candle[]>();

  for (const candle of candles) {
    const k = key(candle.date, timeframe);
    const group = groups.get(k) ?? [];
    group.push(candle);
    groups.set(k, group);
  }

  const out: Candle[] = [];

  for (const group of groups.values()) {
    const first = group[0];
    const last = group.at(-1);

    if (!first || !last) {
      continue;
    }

    out.push({
      date: last.date,
      open: first.open,
      high: Math.max(...group.map((x) => x.high)),
      low: Math.min(...group.map((x) => x.low)),
      close: last.close,
      volume: group.reduce((sum, x) => sum + x.volume, 0),
      t: last.t,
    });
  }

  out.sort((a, b) => a.t - b.t);
  return out;
}
