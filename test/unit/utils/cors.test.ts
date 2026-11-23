import { mockEvent } from "nitro/h3";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCors } from "@src/utils/cors";

function setCorsOrigins(value: string) {
  Reflect.set(env, "CORS_ORIGINS", value);
}

function origin(originHeader: string, extraHeaders: Record<string, string> = {}) {
  return mockEvent("/api/posts", {
    headers: { origin: originHeader, ...extraHeaders },
  });
}

afterEach(() => {
  setCorsOrigins("");
});

describe("resolveCors", () => {
  it("returns undefined when the request has no Origin", () => {
    expect(resolveCors(mockEvent("/api/posts"))).toBeUndefined();
  });

  it("allows a configured origin and enables credentials", () => {
    setCorsOrigins("https://desa.example");

    const headers = resolveCors(origin("https://desa.example"))!;

    expect(headers.get("access-control-allow-origin")).toBe("https://desa.example");
    expect(headers.get("access-control-allow-credentials")).toBe("true");
    expect(headers.get("vary")).toBe("Origin");
    expect(headers.get("access-control-allow-methods")).toContain("PATCH");
    expect(headers.get("access-control-expose-headers")).toContain("x-ratelimit-remaining");
  });

  it("normalizes trailing slashes in configured and requested origins", () => {
    setCorsOrigins(" https://desa.example/ , https://admin.example ");

    const headers = resolveCors(origin("https://desa.example"))!;

    expect(headers.get("access-control-allow-origin")).toBe("https://desa.example");
  });

  it("does not allow an origin that is not configured", () => {
    setCorsOrigins("https://desa.example");

    expect(resolveCors(origin("https://evil.example"))).toBeUndefined();
  });

  it("allows every origin with a * wildcard but drops credentials", () => {
    setCorsOrigins("*");

    const headers = resolveCors(origin("https://anything.example"))!;

    expect(headers.get("access-control-allow-origin")).toBe("*");
    expect(headers.get("access-control-allow-credentials")).toBeNull();
    expect(headers.get("vary")).toBeNull();
  });

  it("echoes requested headers, falling back to the default list", () => {
    setCorsOrigins("*");

    const withRequested = resolveCors(
      origin("https://desa.example", { "access-control-request-headers": "x-custom" }),
    )!;
    const withDefaults = resolveCors(origin("https://desa.example"))!;

    expect(withRequested.get("access-control-allow-headers")).toBe("x-custom");
    expect(withDefaults.get("access-control-allow-headers")).toContain("content-type");
  });
});
