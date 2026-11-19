import { getRequestHeader, setResponseHeader, setResponseStatus, type H3Event } from "nitro/h3";

const encoder = new TextEncoder();

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function opaqueTag(tag: string): string {
  return tag.startsWith("W/") ? tag.slice(2) : tag;
}

function matchesIfNoneMatch(header: string, etag: string): boolean {
  const target = opaqueTag(etag);

  return header.split(",").some((part) => {
    const tag = part.trim();
    return tag === "*" || opaqueTag(tag) === target;
  });
}

/**
 * Adds `Cache-Control` and a content-derived `ETag` to a JSON response, and
 * answers `304 Not Modified` when the client already has the same body.
 */
export async function cachedJson<T>(event: H3Event, body: T, maxAge = 60): Promise<T | null> {
  const etag = `"${await digest(JSON.stringify(body))}"`;

  setResponseHeader(event, "cache-control", `public, max-age=${maxAge}`);
  setResponseHeader(event, "etag", etag);

  const ifNoneMatch = getRequestHeader(event, "if-none-match");

  if (ifNoneMatch && matchesIfNoneMatch(ifNoneMatch, etag)) {
    setResponseStatus(event, 304);
    return null;
  }

  return body;
}
