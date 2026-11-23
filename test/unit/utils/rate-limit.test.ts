import { mockEvent } from "nitro/h3";
import { describe, expect, it } from "vitest";
import { getClientIp } from "@src/utils/rate-limit";

describe("getClientIp", () => {
  it("prefers cf-connecting-ip", () => {
    const event = mockEvent("/api/cms/posts", {
      headers: {
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "198.51.100.1, 198.51.100.2",
      },
    });
    event.context.clientAddress = "192.0.2.10";

    expect(getClientIp(event)).toBe("203.0.113.7");
  });

  it("falls back to the runtime client address", () => {
    const event = mockEvent("/api/cms/posts");
    event.context.clientAddress = "192.0.2.10";

    expect(getClientIp(event)).toBe("192.0.2.10");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    const event = mockEvent("/api/cms/posts", {
      headers: { "x-forwarded-for": " 198.51.100.1 , 198.51.100.2" },
    });

    expect(getClientIp(event)).toBe("198.51.100.1");
  });

  it("uses a stable placeholder when no address is known", () => {
    expect(getClientIp(mockEvent("/api/cms/posts"))).toBe("unknown");
  });
});
