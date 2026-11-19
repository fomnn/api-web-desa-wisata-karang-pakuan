import { definePlugin } from "nitro";
import { resolveCors } from "../utils/cors";
import { log } from "../utils/logger";
import { getRequestId, getRequestPath, getRequestStartedAt } from "../utils/request-context";
import { applySecurityHeaders } from "../utils/security-headers";

function errorStatus(error: unknown): number {
  if (typeof error !== "object" || error === null || !("status" in error)) return 500;

  const status = error.status;
  return typeof status === "number" ? status : 500;
}

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("response", (res, event) => {
    applySecurityHeaders(res.headers);

    const cors = resolveCors(event);
    if (cors) {
      for (const [name, value] of cors) {
        res.headers.set(name, value);
      }
    }

    const requestId = getRequestId(event);
    if (requestId) res.headers.set("x-request-id", requestId);

    const startedAt = getRequestStartedAt(event);
    if (startedAt === undefined) return;

    const status = res.status;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

    log(level, "request", {
      requestId,
      method: event.req.method,
      path: getRequestPath(event),
      status,
      durationMs: Date.now() - startedAt,
    });
  });

  nitroApp.hooks.hook("error", (error, context) => {
    if (!context.event) return;
    if (errorStatus(error) < 500) return;

    log("error", "unhandled error", {
      requestId: getRequestId(context.event),
      method: context.event.req.method,
      path: getRequestPath(context.event),
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  });
});
