import * as v from "valibot";
import { slugSchema, titleSchema } from "./common";

const categoryFields = {
  slug: slugSchema,
  name: titleSchema,
  description: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(1000)))),
  sortOrder: v.pipe(v.number(), v.integer()),
};

export const createCategorySchema = v.object({
  ...categoryFields,
  sortOrder: v.optional(v.pipe(v.number(), v.integer()), 0),
});

export const updateCategorySchema = v.partial(v.object(categoryFields));
