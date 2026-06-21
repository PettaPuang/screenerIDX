import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

import { CONFIG as C } from "../config.js";
import seedWatchlist from "../watchlist.json" with { type: "json" };
import type { WeeklyCandidate } from "../engine/types.js";

const generatedWatchlistSchema = z.union([
  z.array(z.string()),
  z.object({
    generatedAt: z.string().optional(),
    tickers: z.array(z.string()),
    candidates: z.array(z.unknown()).optional(),
  }),
]);

function normalizeTickers(tickers: string[]): string[] {
  return [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()))].filter(
    Boolean,
  );
}

export async function loadDailyWatchlist(): Promise<{
  tickers: string[];
  source: "generated" | "seed";
  candidates: WeeklyCandidate[];
}> {
  const outputPath = resolve(process.cwd(), C.generatedWatchlistPath);

  try {
    const raw = await readFile(outputPath, "utf8");
    const parsed = generatedWatchlistSchema.parse(JSON.parse(raw));
    const tickers = Array.isArray(parsed) ? parsed : parsed.tickers;
    const candidates = Array.isArray(parsed)
      ? []
      : ((parsed.candidates ?? []) as WeeklyCandidate[]);

    return {
      tickers: normalizeTickers(tickers),
      source: "generated",
      candidates,
    };
  } catch {
    return {
      tickers: normalizeTickers(seedWatchlist as string[]),
      source: "seed",
      candidates: [],
    };
  }
}
