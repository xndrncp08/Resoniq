import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit, type RateLimitRule } from "@/lib/rate-limit";

/**
 * Shared plumbing for API route handlers: auth guard, rate limiting, body
 * parsing, and error responses that never carry internal detail.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

/** The signed-in user's id, or an ApiError(401). */
export async function requireUserId(message = "Sign in required."): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new ApiError(401, message);
  return id;
}

export function enforceRateLimit(bucket: string, key: string, rule: RateLimitRule) {
  const result = rateLimit(bucket, key, rule);
  if (!result.ok) {
    throw new ApiError(429, "Too many requests. Try again later.", { "Retry-After": String(result.retryAfterS) });
  }
}

/** Parses a JSON object body, rejecting oversized or malformed input with a 4xx instead of a 500. */
export async function readJson(req: Request, maxBytes = 16 * 1024): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError(413, "Request body too large.");
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new ApiError(413, "Request body too large.");
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body === "object" && body !== null && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ApiError(400, "Invalid JSON body.");
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * Wraps a route handler: ApiErrors become their JSON response; anything
 * else is logged with its detail and returned as a generic 500.
 */
export function route<C = unknown>(name: string, handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return jsonError(err.status, err.message, err.headers);
      console.error(`[api] ${name} failed`, err);
      return jsonError(500, "Something went wrong. Try again.");
    }
  };
}
