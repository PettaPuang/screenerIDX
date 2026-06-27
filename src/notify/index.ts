import { sendEmail } from "./email.js";
import { sendTelegram } from "./telegram.js";

const TELEGRAM_MAX_CHARS = 4096;

function chunkText(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_CHARS) return [text];

  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > TELEGRAM_MAX_CHARS) {
      if (current) chunks.push(current);
      current = line.slice(0, TELEGRAM_MAX_CHARS);
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function sendTelegramSequential(texts: string[]): Promise<void> {
  for (const text of texts) {
    for (const chunk of chunkText(text)) {
      await sendTelegram(chunk);
    }
  }
}

export async function notifyAll(
  dailyText: string,
  html: string,
  subject: string,
): Promise<void> {
  const results = await Promise.allSettled([
    sendTelegramSequential([dailyText]),
    sendEmail(subject, html),
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`notify_${index}_failed`, result.reason);
    }
  });
}
