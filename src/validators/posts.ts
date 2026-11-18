import * as v from "valibot";
import {
  editorialStatusSchema,
  idSchema,
  paginationEntries,
  queryIdSchema,
  searchEntry,
  slugSchema,
  timestampSchema,
  titleSchema,
  unique,
} from "./common";

const tagIdsSchema = v.pipe(v.array(idSchema), v.transform(unique));

const postFields = {
  slug: slugSchema,
  title: titleSchema,
  excerpt: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(500)))),
  content: v.pipe(v.string(), v.nonEmpty()),
  coverMediaId: v.optional(v.nullable(idSchema)),
  categoryId: v.optional(v.nullable(idSchema)),
  authorId: idSchema,
  status: editorialStatusSchema,
  publishedAt: v.optional(v.nullable(timestampSchema)),
  isFeatured: v.boolean(),
  metaTitle: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(200)))),
  metaDescription: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(300)))),
  tagIds: v.optional(tagIdsSchema),
};

export const createPostSchema = v.object({
  ...postFields,
  status: v.optional(editorialStatusSchema, "draft"),
  isFeatured: v.optional(v.boolean(), false),
});

export const updatePostSchema = v.partial(v.object(postFields));

export const listPostsQuerySchema = v.object({
  ...paginationEntries,
  status: v.optional(editorialStatusSchema),
  categoryId: queryIdSchema,
  tagId: queryIdSchema,
  q: searchEntry,
});
