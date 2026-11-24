import { env } from "cloudflare:workers";
import { getRequestURL, type H3Event } from "nitro/h3";

/**
 * Absolute URL of a stored object, served by the `GET /media/**` route.
 * `MEDIA_BASE_URL` points at a public bucket or CDN when one exists; without it
 * the URL follows the request origin, so local dev works without configuration.
 */
export function mediaUrl(event: H3Event, key: string): string {
  const base = (env.MEDIA_BASE_URL || getRequestURL(event).origin).replace(/\/+$/, "");

  return `${base}/${key}`;
}
