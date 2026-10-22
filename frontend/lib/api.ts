import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api-error";
import { getActor, requireActor } from "@/lib/authz";
import { rateLimit, type RateLimitRule } from "@/lib/rate-limit";
import { ValidationError } from "@/lib/validation";

export { ApiError };

/**
 * Shared plumbing for API route handlers: auth guard, rate limiting, body
 * parsing, and error responses that never carry internal detail.
 */

export function jsonError(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

/**
 * The signed-in user's id, or an ApiError: 401 signed out, 403 banned, and
 * 403 suspended when `write` is set. See lib/authz.ts.
 */
export async function requireUserId(message?: string, opts: { write?: boolean } = {}): Promise<string> {
  return (await requireActor({ ...opts, message })).id;
}

/** The viewer for public reads: signed-in and not banned, else null. */
export async function optionalActor() {
  const actor = await getActor();
  return actor && actor.status !== "BANNED" ? actor : null;
}

export function enforceRateLimit(bucket: string, key: string, rule: RateLimitRule) {
  const result = rateLimit(bucket, key, rule);
  if (!result.ok) {
    throw new ApiError(429, "Too many requests. Try again later.", { "Retry-After": String(result.retryAfterS) });
  }
}

/**
 * Parses a JSON object body, rejecting oversized or malformed input with a 4xx instead of a 500.
 * Requiring application/json also means a cross-site <form> can't post here
 * (it can't set that type without a CORS preflight, which this app never grants).
 */
export async function readJson(req: Request, maxBytes = 16 * 1024): Promise<Record<string, unknown>> {
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ApiError(415, "Expected an application/json body.");
  }
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError(413, "Request body too large.");
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new ApiError(413, "Request body too large.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body === "object" && body !== null && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ApiError(400, "Invalid JSON body.");
}

/**
 * Refuses state-changing requests whose Origin is another site. The session
 * cookie is SameSite=Lax, which already keeps it off cross-site POSTs; this
 * is the second layer. Requests without an Origin (curl, server-to-server)
 * pass, since they can't carry a victim's browser cookies.
 */
function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const configuredOrigin = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (configuredOrigin) {
    if (origin !== new URL(configuredOrigin).origin) throw new ApiError(403, "Cross-site request refused.");
    return;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // "null" or garbage: treat as cross-site
  }
  if (!host || originHost !== host) throw new ApiError(403, "Cross-site request refused.");
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * Wraps a route handler: ApiErrors become their JSON response; anything
 * else is logged with its detail and returned as a generic 500.
 */
export function route<C = unknown>(name: string, handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return jsonError(err.status, err.message, err.headers);
      if (err instanceof ValidationError) return jsonError(400, err.message);
      console.error(`[api] ${name} failed`, err);
      return jsonError(500, "Something went wrong. Try again.");
    }
  };
}
