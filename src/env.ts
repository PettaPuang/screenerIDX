import { z } from "zod";

const telegramEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
});

const emailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  MAIL_FROM: z.string().min(1),
  MAIL_TO: z.string().min(1),
});

export function getTelegramEnv(): z.infer<typeof telegramEnvSchema> {
  return telegramEnvSchema.parse(process.env);
}

export function getEmailEnv(): z.infer<typeof emailEnvSchema> {
  return emailEnvSchema.parse(process.env);
}
