import { env } from "cloudflare:workers";
import { HTTPError, defineHandler, defineRouteMeta } from "nitro";
import { getRequestHeader, readFormData } from "nitro/h3";
import * as v from "valibot";
import { getDb } from "@src/db/client";
import { media } from "@src/db/schema";
import { badRequest, writeOrThrow } from "@src/utils/http";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  imageExtension,
  mediaUploadFieldsSchema,
} from "@src/validators/media";

defineRouteMeta({
  openAPI: {
    tags: ["Media"],
    summary: "Upload an image",
    description: `Stores a JPEG, PNG, WebP, GIF or AVIF image in R2 (max ${MAX_IMAGE_MB} MB) and records it in media. The returned key identifies the stored object.`,
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
                description: `Image file (JPEG, PNG, WebP, GIF or AVIF), max ${MAX_IMAGE_MB} MB`,
              },
              uploadedBy: {
                type: "integer",
                minimum: 1,
                description: "ID of the user who uploaded the file",
              },
              alt: {
                type: ["string", "null"],
                maxLength: 500,
                description: "Alternative text for the image",
              },
              caption: {
                type: ["string", "null"],
                maxLength: 1000,
                description: "Caption for the image",
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
        description: `Image exceeds ${MAX_IMAGE_MB} MB`,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      415: {
        description: "Body is not multipart/form-data or the file is not a supported image type",
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
            required: ["id", "key", "filename", "mimeType", "sizeBytes", "uploadedBy", "createdAt"],
            properties: {
              id: { type: "integer" },
              key: { type: "string" },
              filename: { type: "string" },
              mimeType: { type: "string" },
              sizeBytes: { type: "integer" },
              width: { type: ["integer", "null"] },
              height: { type: ["integer", "null"] },
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

  const extension = imageExtension(file.type);

  if (!extension) {
    throw new HTTPError({
      status: 415,
      statusText: "Unsupported Media Type",
      message: "file must be a JPEG, PNG, WebP, GIF or AVIF image",
    });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new HTTPError({
      status: 413,
      statusText: "Content Too Large",
      message: `file must be at most ${MAX_IMAGE_MB} MB`,
    });
  }

  const key = `media/${crypto.randomUUID()}.${extension}`;
  const rawName = file.name.split(/[\\/]/).pop()?.trim();
  const filename = (rawName || `image.${extension}`).slice(0, 255);

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
          sizeBytes: file.size,
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
    return created;
  } catch (error) {
    // Do not leave an orphaned object in R2 when the D1 insert fails.
    await env.STORAGE.delete(key).catch(() => {});
    throw error;
  }
});
