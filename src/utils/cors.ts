import { env } from "cloudflare:workers";
import type { HTTPEvent } from "nitro/h3";

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const ALLOWED_METHODS = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";
const DEFAULT_ALLOWED_HEADERS = "accept, content-type, authorization, x-request-id";
const EXPOSED_HEADERS =
  "x-request-id, retry-after, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function configuredOrigins(): string[] {
  const configured = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => trimTrailingSlash(origin.trim()))
    .filter(Boolean);

  if (!import.meta.dev) return configured;

  return [...configured, ...DEV_ORIGINS];
}

function allowedOrigin(origin: string): string | undefined {
  const origins = configuredOrigins();

  if (origins.includes("*")) return "*";

  const normalized = trimTrailingSlash(origin);
  return origins.includes(normalized) ? origin : undefined;
}

function appendVary(headers: Headers, value: string) {
  const current = headers.get("vary");

  if (!current) {
    headers.set("vary", value);
    return;
  }

  const values = current.split(",").map((item) => item.trim().toLowerCase());
  if (!values.includes(value.toLowerCase())) headers.set("vary", `${current}, ${value}`);
}

export function resolveCors(event: HTTPEvent): Headers | undefined {
  const origin = event.req.headers.get("origin");
  if (!origin) return undefined;

  const allowed = allowedOrigin(origin);
  if (!allowed) return undefined;

  const headers = new Headers({
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": ALLOWED_METHODS,
    "access-control-allow-headers":
      event.req.headers.get("access-control-request-headers") ?? DEFAULT_ALLOWED_HEADERS,
    "access-control-expose-headers": EXPOSED_HEADERS,
    "access-control-max-age": "86400",
  });

  if (allowed !== "*") {
    headers.set("access-control-allow-credentials", "true");
    appendVary(headers, "Origin");
  }

  return headers;
}
