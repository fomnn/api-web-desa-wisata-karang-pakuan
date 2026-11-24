import { env } from "cloudflare:workers";
import { mockEvent } from "nitro/h3";
import { afterEach, describe, expect, it } from "vitest";
import { mediaUrl } from "@src/utils/media";

function setMediaBaseUrl(value: string) {
  Reflect.set(env, "MEDIA_BASE_URL", value);
}

afterEach(() => {
  setMediaBaseUrl("");
});

describe("mediaUrl", () => {
  it("follows the request origin when MEDIA_BASE_URL is empty", () => {
    expect(mediaUrl(mockEvent("https://api.test/api/posts"), "media/a.jpg")).toBe(
      "https://api.test/media/a.jpg",
    );
  });

  it("uses MEDIA_BASE_URL when configured", () => {
    setMediaBaseUrl("https://media.example.com");

    expect(mediaUrl(mockEvent("https://api.test/api/posts"), "media/a.jpg")).toBe(
      "https://media.example.com/media/a.jpg",
    );
  });

  it("trims trailing slashes from MEDIA_BASE_URL", () => {
    setMediaBaseUrl("https://media.example.com///");

    expect(mediaUrl(mockEvent("/api/posts"), "media/a.jpg")).toBe(
      "https://media.example.com/media/a.jpg",
    );
  });
});
