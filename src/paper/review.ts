import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { CONFIG as C } from "../config.js";
import type { Candle } from "../engine/types.js";
import { fetchDaily } from "../providers/yahoo.js";
import { sleep } from "../utils/time.js";

interface PaperTrade {
  signalDate: string;
  ticker: string;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  triggers: string[];
  status: "open" | "win" | "loss" | "unresolved" | "invalid";
  exitDate?: string;
  r?: number;
}

async function loadLedger(path: string): Promise<PaperTrade[]> {
  try {
    const content = await readFile(path, "utf8");
    const records: PaperTrade[] = [];

    for (const line of content.split("\n")) {
      if (!line.trim()) {
        continue;
      }

      records.push(JSON.parse(line) as PaperTrade);
    }

    return records;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function resolveForwardTrade(record: PaperTrade, candles: Candle[]): PaperTrade {
  const riskPct = ((record.entry - record.stop) / record.entry) * 100;

  if (!Number.isFinite(riskPct) || riskPct <= 0) {
    return { ...record, status: "invalid" };
  }

  const forward = candles.filter((candle) => candle.date > record.signalDate);
  const maxHold = C.backtest.maxHoldDays;
  const limit = Math.min(forward.length, maxHold);

  for (let i = 0; i < limit; i += 1) {
    const candle = forward[i];

    if (!candle) {
      continue;
    }

    let exit: number | null = null;

    if (candle.open <= record.stop) {
      exit = candle.open;
    } else if (candle.open >= record.target) {
      exit = candle.open;
    } else if (candle.low <= record.stop) {
      exit = record.stop;
    } else if (candle.high >= record.target) {
      exit = record.target;
    }

    if (exit == null) {
      continue;
    }

    const returnPct = ((exit - record.entry) / record.entry) * 100;
    const r = (returnPct - C.backtest.costPct) / riskPct;

    return {
      ...record,
      status: r > 0 ? "win" : "loss",
      exitDate: candle.date,
      r,
    };
  }

  if (forward.length >= maxHold) {
    return { ...record, status: "unresolved" };
  }

  return record;
}

function summarizeResolved(records: PaperTrade[]): {
  count: number;
  winRate: string;
  expectancyR: string;
  totalR: string;
  perTrigger: Record<string, { trades: number; winRate: string; expectancyR: string }>;
  open: number;
  unresolved: number;
} {
  const resolved = records.filter(
    (record) => record.status === "win" || record.status === "loss",
  );
  const open = records.filter((record) => record.status === "open").length;
  const unresolved = records.filter((record) => record.status === "unresolved").length;

  if (!resolved.length) {
    return {
      count: 0,
      winRate: "0%",
      expectancyR: "0.00",
      totalR: "0.00",
      perTrigger: {},
      open,
      unresolved,
    };
  }

  const wins = resolved.filter((record) => (record.r ?? 0) > 0).length;
  const sumR = resolved.reduce((sum, record) => sum + (record.r ?? 0), 0);
  const perTrigger = new Map<string, { trades: number; wins: number; sumR: number }>();

  for (const record of resolved) {
    const r = record.r ?? 0;

    for (const trigger of record.triggers) {
      const summary = perTrigger.get(trigger) ?? { trades: 0, wins: 0, sumR: 0 };
      summary.trades += 1;
      summary.wins += r > 0 ? 1 : 0;
      summary.sumR += r;
      perTrigger.set(trigger, summary);
    }
  }

  return {
    count: resolved.length,
    winRate: `${((wins / resolved.length) * 100).toFixed(1)}%`,
    expectancyR: (sumR / resolved.length).toFixed(2),
    totalR: sumR.toFixed(2),
    perTrigger: Object.fromEntries(
      [...perTrigger.entries()].map(([trigger, summary]) => [
        trigger,
        {
          trades: summary.trades,
          winRate: `${((summary.wins / summary.trades) * 100).toFixed(1)}%`,
          expectancyR: (summary.sumR / summary.trades).toFixed(2),
        },
      ]),
    ),
    open,
    unresolved,
  };
}

async function main(): Promise<void> {
  const path = resolve(process.cwd(), C.paperTradesPath);
  const records = await loadLedger(path);
  const updated: PaperTrade[] = [];

  for (const record of records) {
    if (record.status !== "open") {
      updated.push(record);
      continue;
    }

    try {
      const candles = await fetchDaily(record.ticker, "6mo");
      updated.push(resolveForwardTrade(record, candles));
    } catch (error) {
      console.error(`review skip ${record.ticker}:`, (error as Error).message);
      updated.push(record);
    }

    await sleep(C.requestDelayMs);
  }

  if (records.length) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      `${updated.map((record) => JSON.stringify(record)).join("\n")}\n`,
      "utf8",
    );
  }

  console.log({
    ledgerPath: C.paperTradesPath,
    totalRecords: records.length,
    ...summarizeResolved(updated.length ? updated : records),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error("paper_review_failed", error);
    process.exitCode = 1;
  });
}
