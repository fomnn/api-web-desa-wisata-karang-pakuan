import * as v from "valibot";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_MB = MAX_VIDEO_BYTES / (1024 * 1024);

const MEDIA_TYPES: Record<string, { ext: string; kind: "image" | "video" }> = {
  "image/avif": { ext: "avif", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
};

export function mediaType(mimeType: string): { ext: string; kind: "image" | "video" } | null {
  return MEDIA_TYPES[mimeType] ?? null;
}

function optionalText(field: string, maxLength: number) {
  return v.nullish(
    v.pipe(
      v.string(`${field} must be text`),
      v.trim(),
      v.maxLength(maxLength, `${field} must be at most ${maxLength} characters`),
      v.transform((value) => value || null),
    ),
    null,
  );
}

function optionalInt(field: string) {
  return v.nullish(
    v.pipe(
      v.string(`${field} must be text`),
      v.trim(),
      v.toNumber(`${field} must be a number`),
      v.integer(`${field} must be an integer`),
      v.minValue(1, `${field} must be a positive integer`),
    ),
    null,
  );
}

export const mediaUploadFieldsSchema = v.object({
  uploadedBy: v.pipe(
    v.string("uploadedBy is required"),
    v.trim(),
    v.nonEmpty("uploadedBy is required"),
    v.toNumber("uploadedBy must be a number"),
    v.integer("uploadedBy must be an integer"),
    v.minValue(1, "uploadedBy must be a positive integer"),
  ),
  alt: optionalText("alt", 500),
  caption: optionalText("caption", 1000),
  width: optionalInt("width"),
  height: optionalInt("height"),
  durationSeconds: optionalInt("durationSeconds"),
});
