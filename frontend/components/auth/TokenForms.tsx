"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client-api";

const card = "panel w-full max-w-md space-y-4 p-6 sm:p-8";
const input = "panel-inset h-11 w-full rounded-xl px-3 font-body outline-none focus:border-copper/60";
const btn = "focus-ring h-11 w-full rounded-full bg-copper font-body text-sm font-semibold text-bg hover:bg-copper-soft disabled:opacity-60";

export function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function go() {
    setState("busy");
    try {
      await api("/api/auth/verify", { body: { token } });
      setState("done");
    } catch (err) {
      setMsg(errorMessage(err));
      setState("error");
    }
  }
  return (
    <div className={card}>
      <h1 className="font-display text-2xl font-semibold">Confirm your email</h1>
      {state === "done" ? (
        <><p className="font-body text-ink-dim">You&apos;re verified. Thanks!</p><Link href="/feed" className={`${btn} flex items-center justify-center`}>Go to your feed</Link></>
      ) : (
        <>
          <p className="font-body text-sm text-muted">One click and you can post and start communities.</p>
          {state === "error" && <p role="alert" className="font-body text-sm text-danger">{msg}</p>}
          <button className={btn} onClick={go} disabled={!token || state === "busy"}>{state === "busy" ? "Confirming…" : "Confirm email"}</button>
        </>
      )}
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={card}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/api/auth/password/forgot", { body: { email } });
          setSent(true);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
      {sent ? (
        <p className="font-body text-ink-dim">If an account uses that address, a reset link is on its way. It expires in an hour.</p>
      ) : (
        <>
          <label className="block"><span className="label-engraved">Email</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={`${input} mt-2`} /></label>
          {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
          <button className={btn} disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </>
      )}
      <p className="text-center font-body text-sm text-muted"><Link href="/login" className="text-signal">Back to sign in</Link></p>
    </form>
  );
}

export function ResetPassword({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={card}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/api/auth/password/reset", { body: { token, password } });
          setDone(true);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
      {done ? (
        <><p className="font-body text-ink-dim">Password changed. You&apos;ve been signed out everywhere else.</p><Link href="/login" className={`${btn} flex items-center justify-center`}>Sign in</Link></>
      ) : (
        <>
          <label className="block"><span className="label-engraved">New password (8+ characters)</span><input type="password" required minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={`${input} mt-2`} /></label>
          {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
          <button className={btn} disabled={busy || !token}>{busy ? "Saving…" : "Set password"}</button>
        </>
      )}
    </form>
  );
}

export function ResendVerification() {
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await api("/api/auth/verify/request", { method: "POST" });
          setState("sent");
        } catch {
          setState("error");
        }
      }}
      className="font-body text-sm text-copper hover:underline"
    >
      {state === "sent" ? "Sent. Check your inbox." : state === "error" ? "Couldn't send. Try later." : "Resend verification email"}
    </button>
  );
}
