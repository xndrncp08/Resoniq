"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { motion, MotionConfig } from "motion/react";
import Feedback from "@/components/ui/Feedback";
import { spring } from "@/lib/motion";

const SIGN_IN_ERRORS: Record<string, string> = {
  rate_limited: "Too many sign-in attempts. Wait a few minutes and try again.",
  account_disabled: "This account has been disabled. If you think that's a mistake, contact support.",
  // Auth.js codes and our own redirects from the OAuth sign-in callback.
  OAuthAccountNotLinked: "An account with this email already exists. Sign in with its email and password instead.",
  email_unverified: "Google hasn't verified this email address, so it can't be used to sign in.",
  signups_closed: "New accounts are paused right now. Existing members can sign in.",
  AccessDenied: "Sign-in was refused.",
  Configuration: "Sign-in isn't configured correctly. Try again later.",
  OAuthCallbackError: "Google sign-in didn't complete. Try again.",
  OAuthSignin: "Google sign-in didn't complete. Try again.",
};

export default function AuthForm({
  mode,
  googleEnabled,
  passwordForm,
  passwordNote,
  forgotPassword = false,
  callbackUrl,
  initialError,
}: {
  mode: "login" | "signup";
  googleEnabled: boolean;
  /** Email/password fields: always for sign-in, only when email sign-up is open for sign-up. */
  passwordForm: boolean;
  passwordNote?: string | null;
  /** The reset link needs email delivery. */
  forgotPassword?: boolean;
  callbackUrl: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ? (SIGN_IN_ERRORS[initialError] ?? "Sign-in didn't complete. Try again.") : null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempts((n) => n + 1);
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "Something went wrong creating your account.");
          setLoading(false);
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          (result.code && SIGN_IN_ERRORS[result.code]) ??
            (mode === "signup"
              ? "Couldn't sign you in with those details. If you already have an account, sign in instead."
              : "That email and password combination doesn't match."),
        );
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user"><motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.enter}
      onSubmit={handleSubmit}
      className="glass w-full max-w-sm rounded-panel p-8"
    >
      <h1 className="font-display text-2xl font-semibold">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1.5 font-body text-sm text-muted">
        {mode === "login"
          ? "Sign in to get back to your tones."
          : "Free, no card required."}
      </p>

      {googleEnabled ? (
        <>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="focus-ring mt-6 w-full rounded-full border border-white/10 bg-white/[0.03] py-3 font-body text-sm font-medium transition hover:bg-white/[0.08]"
          >
            Continue with Google
          </button>

          {passwordForm && (
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-[11px] text-muted">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          )}
        </>
      ) : (
        <div className="mt-6" />
      )}

      {passwordForm ? (
        <>
          {mode === "signup" && (
            <label className="mb-4 block">
              <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-muted">
                Name
              </span>
              <input
                type="text"
                required
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 font-body text-base sm:text-sm outline-none"
                placeholder="Your name"
              />
            </label>
          )}

          <label className="mb-4 block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-muted">
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 font-body text-base sm:text-sm outline-none"
              placeholder="you@example.com"
            />
          </label>

          <label className="mb-2 block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-muted">
              Password
            </span>
            <input
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 font-body text-base sm:text-sm outline-none"
              placeholder="••••••••"
            />
          </label>
          {mode === "login" && forgotPassword && (
            <p className="text-right">
              <Link href="/forgot" className="focus-ring rounded font-body text-xs text-muted hover:text-ink">Forgot password?</Link>
            </p>
          )}


          <button
            type="submit"
            disabled={loading}
            className="focus-ring mt-6 w-full rounded-full bg-copper py-3 font-body text-sm font-semibold text-bg transition hover:bg-copper/90 disabled:opacity-60"
          >
            {loading
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </>
      ) : (
        passwordNote && <p className="mt-4 font-body text-sm text-muted">{passwordNote}</p>
      )}

      {error && (
        <Feedback tone="error" trigger={attempts} className="mt-3 font-body text-sm">
          {error}
        </Feedback>
      )}

      <p className="mt-6 text-center font-body text-sm text-muted">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="focus-ring rounded text-signal">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="focus-ring rounded text-signal">
              Sign in
            </Link>
          </>
        )}
      </p>
    </motion.form></MotionConfig>
  );
}
