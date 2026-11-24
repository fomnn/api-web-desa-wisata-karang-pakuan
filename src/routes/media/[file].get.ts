import { env } from "cloudflare:workers";
import { defineHandler, defineRouteMeta } from "nitro";
import { getRequestHeader, getRouterParam } from "nitro/h3";
import { notFound } from "@src/utils/http";
import { MEDIA_KEY_PATTERN } from "@src/validators/media";

defineRouteMeta({
  openAPI: {
    tags: ["Media"],
    summary: "Serve a stored media object",
    description:
      "Streams the R2 object behind a media key. Range requests are honoured so videos can be seeked, and a matching `If-None-Match` answers 304.",
    operationId: "getMediaObject",
    parameters: [
      {
        in: "path",
        name: "file",
        required: true,
        description: "File name of a media key, as returned by `POST /api/cms/media`",
        schema: { type: "string", example: "9f3c1b0e-8f0f-4f8f-9f0f-8f0f9f0f8f0f.jpg" },
      },
    ],
    responses: {
      200: {
        description: "The whole media object",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      206: {
        description: "The requested byte range of the media object",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      304: { description: "Not modified" },
      404: {
        description: "Media object not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
});

/**
 * `Content-Range` for a single `bytes=` request. R2 applies the same header we
 * forward, so the description matches what the returned body contains.
 */
function contentRange(header: string | undefined, size: number): string | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");

  if (!match) return null;

  const [, rawStart = "", rawEnd = ""] = match;

  if (rawStart === "" && rawEnd === "") return null;

  const start = rawStart === "" ? Math.max(size - Number(rawEnd), 0) : Number(rawStart);
  const end = rawStart === "" || rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);

  if (start >= size || start > end) return null;

  return `bytes ${start}-${end}/${size}`;
}

export default defineHandler(async (event) => {
  const file = getRouterParam(event, "file");
  const key = `media/${file ?? ""}`;

  if (!file || !MEDIA_KEY_PATTERN.test(key)) throw notFound("Media");

  const requestHeaders = event.req.headers;
  const object = await env.STORAGE.get(key, {
    onlyIf: requestHeaders,
    range: requestHeaders,
  });

  if (!object) throw notFound("Media");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");

  // A failed precondition returns metadata without a body.
  if (!("body" in object)) return new Response(null, { status: 304, headers });

  const range = contentRange(getRequestHeader(event, "range"), object.size);

  if (range) headers.set("content-range", range);

  return new Response(object.body, { status: range ? 206 : 200, headers });
});
