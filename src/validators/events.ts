import * as v from "valibot";
import {
  idSchema,
  paginationEntries,
  publishStatusSchema,
  searchEntry,
  slugSchema,
  timestampSchema,
  titleSchema,
} from "./common";

const eventFields = {
  slug: slugSchema,
  title: titleSchema,
  description: v.pipe(v.string(), v.nonEmpty()),
  coverMediaId: v.optional(v.nullable(idSchema)),
  startAt: timestampSchema,
  endAt: v.optional(v.nullable(timestampSchema)),
  location: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(500)))),
  status: publishStatusSchema,
  isFeatured: v.boolean(),
  metaTitle: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(200)))),
  metaDescription: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(300)))),
};

export const createEventSchema = v.pipe(
  v.object({
    ...eventFields,
    status: v.optional(publishStatusSchema, "draft"),
    isFeatured: v.optional(v.boolean(), false),
  }),
  v.check(
    (input) => !input.endAt || input.endAt >= input.startAt,
    "endAt must not be before startAt",
  ),
);

export const updateEventSchema = v.partial(v.object(eventFields));

export const listEventsQuerySchema = v.object({
  ...paginationEntries,
  status: v.optional(publishStatusSchema),
  q: searchEntry,
});
