/**
 * Outbound email. Two transports, no SDK dependency:
 *   - Resend's HTTP API when RESEND_API_KEY and RESONIQ_EMAIL_FROM are set;
 *   - otherwise the console, which prints the message (and its links) to the
 *     server log. That is for development only: in production, without a key,
 *     verification and reset emails are never delivered.
 */
export type Mail = { to: string; subject: string; text: string };

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESONIQ_EMAIL_FROM;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error("[mail] RESEND_API_KEY / RESONIQ_EMAIL_FROM not set; dropped:", mail.subject);
      return;
    }
    console.log(`[mail:console] to=${mail.to}\nsubject: ${mail.subject}\n\n${mail.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.RESONIQ_EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
}

/** The public origin used in emailed links. */
export const appOrigin = () => (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
