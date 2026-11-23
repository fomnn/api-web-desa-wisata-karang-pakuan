import * as v from "valibot";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function imageExtension(mimeType: string): string | null {
  return IMAGE_EXTENSIONS[mimeType] ?? null;
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
});
