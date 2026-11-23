import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "@src/utils/security-headers";

describe("applySecurityHeaders", () => {
  it("sets the baseline security headers", () => {
    const headers = new Headers();

    applySecurityHeaders(headers);

    expect(Object.fromEntries(headers)).toEqual({
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-resource-policy": "same-site",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    });
  });
});
