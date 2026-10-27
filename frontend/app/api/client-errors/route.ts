import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { isNoise, parseClientError } from "@/lib/client-errors";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

/** Receives anonymous browser error reports and writes them to the server log. */
export const POST = route("client-errors", async (req) => {
  await enforceRateLimit("client-error", clientIp(req), RATE_LIMITS.clientError);
  const report = parseClientError(await readJson(req));
  if (report && !isNoise(report.message, report.stack)) console.error("[client-error]", JSON.stringify(report));
  return new NextResponse(null, { status: 204 });
});
