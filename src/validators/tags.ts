import * as v from "valibot";
import { slugSchema, titleSchema } from "./common";

const tagFields = {
  slug: slugSchema,
  name: titleSchema,
};

export const createTagSchema = v.object(tagFields);

export const updateTagSchema = v.partial(v.object(tagFields));
