import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

import { CONFIG as C } from "../config.js";
import seedWatchlist from "../watchlist.json" with { type: "json" };

const generatedWatchlistSchema = z.union([
  z.array(z.string()),
  z.object({
    generatedAt: z.string().optional(),
    tickers: z.array(z.string()),
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
}> {
  const outputPath = resolve(process.cwd(), C.generatedWatchlistPath);

  try {
    const raw = await readFile(outputPath, "utf8");
    const parsed = generatedWatchlistSchema.parse(JSON.parse(raw));
    const tickers = Array.isArray(parsed) ? parsed : parsed.tickers;

    return {
      tickers: normalizeTickers(tickers),
      source: "generated",
    };
  } catch {
    return {
      tickers: normalizeTickers(seedWatchlist as string[]),
      source: "seed",
    };
  }
}
