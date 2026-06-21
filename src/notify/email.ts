import { getEmailEnv } from "../env.js";

export async function sendEmail(
  subject: string,
  html: string,
): Promise<void> {
  const env = getEmailEnv();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: env.MAIL_TO,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`resend_${res.status}`);
  }
}
