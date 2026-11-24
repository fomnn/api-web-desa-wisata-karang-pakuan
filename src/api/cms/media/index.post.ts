import { env } from "cloudflare:workers";
import { HTTPError, defineHandler, defineRouteMeta } from "nitro";
import { getRequestHeader, readFormData } from "nitro/h3";
import * as v from "valibot";
import { getDb } from "@src/db/client";
import { media } from "@src/db/schema";
import { badRequest, writeOrThrow } from "@src/utils/http";
import { mediaUrl } from "@src/utils/media";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MB,
  mediaType,
  mediaUploadFieldsSchema,
} from "@src/validators/media";

defineRouteMeta({
  openAPI: {
    tags: ["Media"],
    summary: "Upload an image or video",
    description: `Stores a JPEG, PNG, WebP, GIF or AVIF image (max ${MAX_IMAGE_MB} MB) or an MP4, WebM or MOV video (max ${MAX_VIDEO_MB} MB) in R2 and records it in media. The returned key identifies the stored object; url is where it is served from.`,
    operationId: "uploadMedia",
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["file", "uploadedBy"],
            properties: {
              file: {
                type: "string",
                format: "binary",
                description: `Media file: an image (JPEG, PNG, WebP, GIF or AVIF, max ${MAX_IMAGE_MB} MB) or a video (MP4, WebM or MOV, max ${MAX_VIDEO_MB} MB)`,
              },
              uploadedBy: {
                type: "integer",
                minimum: 1,
                description: "ID of the user who uploaded the file",
              },
              alt: {
                type: ["string", "null"],
                maxLength: 500,
                description: "Alternative text for the media",
              },
              caption: {
                type: ["string", "null"],
                maxLength: 1000,
                description: "Caption for the media",
              },
              width: {
                type: ["integer", "null"],
                minimum: 1,
                description: "Intrinsic width in pixels",
              },
              height: {
                type: ["integer", "null"],
                minimum: 1,
                description: "Intrinsic height in pixels",
              },
              durationSeconds: {
                type: ["integer", "null"],
                minimum: 1,
                description: "Duration in seconds; videos only",
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created media",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Media" },
          },
        },
      },
      400: {
        description: "Malformed body, missing file or invalid fields",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      413: {
        description: `Media exceeds the size limit (${MAX_IMAGE_MB} MB for images, ${MAX_VIDEO_MB} MB for videos)`,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      415: {
        description:
          "Body is not multipart/form-data or the file is not a supported image or video type",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      422: {
        description: "The uploadedBy user does not exist",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      429: {
        description: "Too many write requests",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
    $global: {
      components: {
        schemas: {
          Media: {
            type: "object",
            required: [
              "id",
              "key",
              "url",
              "filename",
              "mimeType",
              "kind",
              "sizeBytes",
              "uploadedBy",
              "createdAt",
            ],
            properties: {
              id: { type: "integer" },
              key: { type: "string" },
              url: {
                type: "string",
                format: "uri",
                description: "Absolute URL served by `GET /media/<key>`",
              },
              filename: { type: "string" },
              mimeType: { type: "string" },
              kind: { type: "string", enum: ["image", "video"] },
              sizeBytes: { type: "integer" },
              width: { type: ["integer", "null"] },
              height: { type: ["integer", "null"] },
              durationSeconds: { type: ["integer", "null"] },
              alt: { type: ["string", "null"] },
              caption: { type: ["string", "null"] },
              uploadedBy: { type: "integer" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const contentType = getRequestHeader(event, "content-type");

  if (!contentType?.toLowerCase().startsWith("multipart/form-data")) {
    throw new HTTPError({
      status: 415,
      statusText: "Unsupported Media Type",
      message: "Expected a multipart/form-data body",
    });
  }

  let form: FormData;

  try {
    form = await readFormData(event);
  } catch {
    throw badRequest("Malformed multipart/form-data body");
  }

  const fields = v.safeParse(mediaUploadFieldsSchema, {
    uploadedBy: form.get("uploadedBy"),
    alt: form.get("alt"),
    caption: form.get("caption"),
    width: form.get("width"),
    height: form.get("height"),
    durationSeconds: form.get("durationSeconds"),
  });

  if (!fields.success) {
    throw badRequest(fields.issues[0]?.message ?? "Invalid upload fields");
  }

  const file = form.get("file");

  if (!file || typeof file === "string") {
    throw badRequest("file is required");
  }

  if (file.size === 0) {
    throw badRequest("file must not be empty");
  }

  const type = mediaType(file.type);

  if (!type) {
    throw new HTTPError({
      status: 415,
      statusText: "Unsupported Media Type",
      message: "file must be an image (JPEG, PNG, WebP, GIF or AVIF) or a video (MP4, WebM or MOV)",
    });
  }

  const limitBytes = type.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const limitMb = type.kind === "video" ? MAX_VIDEO_MB : MAX_IMAGE_MB;

  if (file.size > limitBytes) {
    throw new HTTPError({
      status: 413,
      statusText: "Content Too Large",
      message: `file must be at most ${limitMb} MB`,
    });
  }

  if (type.kind === "image" && fields.output.durationSeconds !== null) {
    throw badRequest("durationSeconds is only valid for video uploads");
  }

  const key = `media/${crypto.randomUUID()}.${type.ext}`;
  const rawName = file.name.split(/[\\/]/).pop()?.trim();
  const filename = (rawName || `media.${type.ext}`).slice(0, 255);

  await env.STORAGE.put(key, file, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  try {
    const rows = await writeOrThrow(() =>
      getDb()
        .insert(media)
        .values({
          key,
          filename,
          mimeType: file.type,
          kind: type.kind,
          sizeBytes: file.size,
          width: fields.output.width,
          height: fields.output.height,
          durationSeconds: fields.output.durationSeconds,
          alt: fields.output.alt,
          caption: fields.output.caption,
          uploadedBy: fields.output.uploadedBy,
        })
        .returning(),
    );
    const created = rows[0];

    if (!created) {
      throw new Error("Failed to create media");
    }

    event.res.status = 201;
    return { ...created, url: mediaUrl(event, created.key) };
  } catch (error) {
    // Do not leave an orphaned object in R2 when the D1 insert fails.
    await env.STORAGE.delete(key).catch(() => {});
    throw error;
  }
});
