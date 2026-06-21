import { getTelegramEnv } from "../env.js";

export async function sendTelegram(text: string): Promise<void> {
  const env = getTelegramEnv();
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`telegram_${res.status}`);
  }
}
