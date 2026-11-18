import * as v from "valibot";

export const idSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

export const slugSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty("Slug is required"),
  v.maxLength(200),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
);

export const titleSchema = v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(200));

export const timestampSchema = v.pipe(
  v.string(),
  v.transform((value) => new Date(value)),
  v.date(),
);

export const editorialStatusSchema = v.picklist(["draft", "review", "published", "archived"]);

export const publishStatusSchema = v.picklist(["draft", "published", "archived"]);

const pageSchema = v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1));

const pageSizeSchema = v.pipe(
  v.string(),
  v.toNumber(),
  v.integer(),
  v.minValue(1),
  v.maxValue(100),
);

export const paginationEntries = {
  page: v.optional(pageSchema, "1"),
  pageSize: v.optional(pageSizeSchema, "50"),
};

export const queryIdSchema = v.optional(
  v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
);

export const searchEntry = v.optional(
  v.pipe(
    v.string(),
    v.trim(),
    v.transform((value) => (value === "" ? undefined : value)),
  ),
);

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
