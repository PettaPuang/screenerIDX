import { CONFIG as C } from "../config.js";
import { sleep } from "../utils/time.js";
import type { Candle } from "../engine/types.js";

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: Error = new Error("provider_unknown");

  for (let attempt = 0; attempt <= C.provider.maxRetries; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });

      if (res.ok) {
        return res;
      }

      // 429/5xx transien: layak retry. 4xx lain: gagal permanen.
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`provider_http_${res.status}`);
      }

      lastError = new Error(`provider_http_${res.status}`);
    } catch (error) {
      lastError = error as Error;

      if (lastError.message.startsWith("provider_http_4")) {
        throw lastError;
      }
    }

    if (attempt < C.provider.maxRetries) {
      const backoff =
        C.provider.retryBaseMs * 2 ** attempt + Math.floor(Math.random() * 250);
      await sleep(backoff);
    }
  }

  throw lastError;
}

interface YahooChartResult {
  meta?: {
    shortName?: string;
    longName?: string;
  };
  timestamp?: number[];
  indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
  };
}

export function chartDisplayName(meta?: YahooChartResult["meta"]): string | null {
  const raw = meta?.shortName ?? meta?.longName;
  if (!raw) return null;

  const cleaned = raw
    .replace(/^PT\s+/i, "")
    .replace(/\s+Tbk\.?$/i, "")
    .trim();

  return cleaned || null;
}

function toYahooSymbol(ticker: string): string {
  const normalized = ticker.trim().toUpperCase();

  if (normalized.startsWith("^") || normalized.includes(".")) {
    return normalized;
  }

  return `${normalized}.JK`;
}

function parseChartCandles(result: YahooChartResult, adjusted: boolean): Candle[] {
  if (!result.timestamp?.length) {
    throw new Error("provider_no_data");
  }

  const quote = result.indicators?.quote?.[0] ?? {};
  const adjcloseArr = result.indicators?.adjclose?.[0]?.adjclose;
  const out: Candle[] = [];

  for (let i = 0; i < result.timestamp.length; i += 1) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i] ?? 0;

    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    const timestamp = result.timestamp[i];

    if (timestamp == null) {
      continue;
    }

    // Sesuaikan OHLC dengan faktor adjclose/close agar split & dividen
    // tidak menciptakan level S/R atau RSI palsu di histori. Bar terbaru
    // berfaktor ~1 sehingga harga sinyal tetap sama dengan harga nyata.
    const adjClose = adjusted ? adjcloseArr?.[i] : null;
    const factor =
      adjClose != null && Number.isFinite(adjClose) && close > 0
        ? adjClose / close
        : 1;

    const t = timestamp * 1000;
    out.push({
      date: new Date(t).toISOString().slice(0, 10),
      open: open * factor,
      high: high * factor,
      low: low * factor,
      close: close * factor,
      volume: factor > 0 ? volume / factor : volume,
      t,
    });
  }

  out.sort((a, b) => a.t - b.t);
  return out;
}

async function fetchChartResult(
  ticker: string,
  range: string,
): Promise<YahooChartResult> {
  const sym = toYahooSymbol(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sym,
  )}?interval=1d&range=${encodeURIComponent(range)}`;

  const res = await fetchWithRetry(url);
  const body = (await res.json()) as YahooChartResponse;
  const result = body.chart?.result?.[0];

  if (!result?.timestamp?.length) {
    throw new Error("provider_no_data");
  }

  return result;
}

export async function fetchDaily(
  ticker: string,
  range = "2y",
  adjusted = true,
): Promise<Candle[]> {
  const result = await fetchChartResult(ticker, range);
  return parseChartCandles(result, adjusted);
}

export async function fetchDailyWithMeta(
  ticker: string,
  range = "2y",
  adjusted = true,
): Promise<{ candles: Candle[]; displayName: string | null }> {
  const result = await fetchChartResult(ticker, range);

  return {
    candles: parseChartCandles(result, adjusted),
    displayName: chartDisplayName(result.meta),
  };
}
