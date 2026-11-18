import * as v from "valibot";
import {
  idSchema,
  paginationEntries,
  publishStatusSchema,
  searchEntry,
  slugSchema,
  titleSchema,
} from "./common";

const productFields = {
  slug: slugSchema,
  name: titleSchema,
  description: v.pipe(v.string(), v.nonEmpty()),
  price: v.pipe(v.number(), v.integer(), v.minValue(0)),
  unit: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(50)))),
  sellerName: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(200)),
  sellerPhone: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(30)))),
  sellerAddress: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(500)))),
  coverMediaId: v.optional(v.nullable(idSchema)),
  status: publishStatusSchema,
  isFeatured: v.boolean(),
};

export const createProductSchema = v.object({
  ...productFields,
  status: v.optional(publishStatusSchema, "draft"),
  isFeatured: v.optional(v.boolean(), false),
});

export const updateProductSchema = v.partial(v.object(productFields));

export const listProductsQuerySchema = v.object({
  ...paginationEntries,
  status: v.optional(publishStatusSchema),
  q: searchEntry,
});
