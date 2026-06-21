import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";

import { CONFIG as C } from "../config.js";

const stateSchema = z.record(z.string(), z.string());

export type SignalState = Record<string, string>;

export async function loadSignalState(): Promise<SignalState> {
  try {
    const raw = await readFile(
      resolve(process.cwd(), C.signalStatePath),
      "utf8",
    );
    return stateSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function isOnCooldown(
  state: SignalState,
  ticker: string,
  now = Date.now(),
): boolean {
  const last = state[ticker];

  if (!last) {
    return false;
  }

  const ageMs = now - new Date(last).getTime();
  return ageMs >= 0 && ageMs < C.daily.cooldownDays * 24 * 60 * 60 * 1000;
}

export async function saveSignalState(state: SignalState): Promise<void> {
  const path = resolve(process.cwd(), C.signalStatePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
