import { sendEmail } from "./email.js";
import { sendTelegram } from "./telegram.js";

export async function notifyAll(
  text: string,
  html: string,
  subject: string,
): Promise<void> {
  const results = await Promise.allSettled([
    sendTelegram(text),
    sendEmail(subject, html),
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`notify_${index}_failed`, result.reason);
    }
  });
}
