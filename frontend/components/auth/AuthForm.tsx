"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        setError("That email and password combination doesn't match.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
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

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className="focus-ring mt-6 w-full rounded-full border border-white/10 bg-white/[0.03] py-3 font-body text-sm font-medium transition hover:bg-white/[0.08]"
      >
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-mono text-[11px] text-muted">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {mode === "signup" && (
        <label className="mb-4 block">
          <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-muted">
            Name
          </span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 font-body text-sm outline-none"
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 font-body text-sm outline-none"
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 font-body text-sm outline-none"
          placeholder="••••••••"
        />
      </label>

      {error && <p className="mt-3 font-body text-sm text-danger">{error}</p>}

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

      <p className="mt-6 text-center font-body text-sm text-muted">
        {mode === "login" ? (
          <>
            Don't have an account?{" "}
            <a href="/signup" className="text-signal">
              Sign up
            </a>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <a href="/login" className="text-signal">
              Sign in
            </a>
          </>
        )}
      </p>
    </motion.form>
  );
}
