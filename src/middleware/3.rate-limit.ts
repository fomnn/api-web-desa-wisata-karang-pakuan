import { defineHandler } from "nitro";
import { tooManyRequests } from "@src/utils/http";
import { log } from "@src/utils/logger";
import { getRequestId } from "@src/utils/request-context";
import { consumeWriteLimit, getClientIp, sweepExpiredRateLimits } from "@src/utils/rate-limit";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default defineHandler(async (event) => {
  if (!WRITE_METHODS.has(event.req.method)) return;
  if (!event.url.pathname.startsWith("/api/")) return;

  const clientId = getClientIp(event);
  let result: Awaited<ReturnType<typeof consumeWriteLimit>>;

  try {
    result = await consumeWriteLimit(clientId);
  } catch (error) {
    // The limiter must not take the API down when D1 is unavailable.
    log("error", "rate limit check failed", {
      requestId: getRequestId(event),
      method: event.req.method,
      path: event.url.pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  event.res.headers.set("x-ratelimit-limit", String(result.limit));
  event.res.headers.set("x-ratelimit-remaining", String(result.remaining));
  event.res.headers.set("x-ratelimit-reset", String(Math.floor(result.resetAt.getTime() / 1000)));

  event.waitUntil(
    sweepExpiredRateLimits().catch((error: unknown) => {
      log("warn", "rate limit sweep failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }),
  );

  if (!result.allowed) throw tooManyRequests(result);
});
