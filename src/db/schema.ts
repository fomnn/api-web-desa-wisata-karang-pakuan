import { defineRelations, sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "editor", "author"] })
    .notNull()
    .default("author"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  ...timestamps,
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
);

export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt"),
  caption: text("caption"),
  uploadedBy: integer("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    content: text("content").notNull(),
    coverMediaId: integer("cover_media_id").references(() => media.id, { onDelete: "set null" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["draft", "review", "published", "archived"] })
      .notNull()
      .default("draft"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    ...timestamps,
  },
  (t) => [
    index("posts_status_published_at_idx").on(t.status, t.publishedAt),
    index("posts_category_id_idx").on(t.categoryId),
    index("posts_author_id_idx").on(t.authorId),
  ],
);

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("post_tags_tag_id_idx").on(t.tagId)],
);

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    coverMediaId: integer("cover_media_id").references(() => media.id, { onDelete: "set null" }),
    startAt: integer("start_at", { mode: "timestamp" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp" }),
    location: text("location"),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    ...timestamps,
  },
  (t) => [index("events_status_start_at_idx").on(t.status, t.startAt)],
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    price: integer("price").notNull(),
    unit: text("unit"),
    sellerName: text("seller_name").notNull(),
    sellerPhone: text("seller_phone"),
    sellerAddress: text("seller_address"),
    coverMediaId: integer("cover_media_id").references(() => media.id, { onDelete: "set null" }),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("products_status_created_at_idx").on(t.status, t.createdAt)],
);

export const albums = sqliteTable("albums", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverMediaId: integer("cover_media_id").references(() => media.id, { onDelete: "set null" }),
  status: text("status", { enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  ...timestamps,
});

export const albumMedia = sqliteTable(
  "album_media",
  {
    albumId: integer("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    mediaId: integer("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.albumId, t.mediaId] }),
    index("album_media_media_id_idx").on(t.mediaId),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
});

export const contactMessages = sqliteTable(
  "contact_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["new", "read", "replied", "spam"] })
      .notNull()
      .default("new"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("contact_messages_status_created_at_idx").on(t.status, t.createdAt)],
);

export const schema = {
  users,
  sessions,
  media,
  categories,
  tags,
  posts,
  postTags,
  events,
  products,
  albums,
  albumMedia,
  settings,
  contactMessages,
};

export const relations = defineRelations(schema, (r) => ({
  users: {
    sessions: r.many.sessions({ from: r.users.id, to: r.sessions.userId }),
    posts: r.many.posts({ from: r.users.id, to: r.posts.authorId }),
    uploadedMedia: r.many.media({ from: r.users.id, to: r.media.uploadedBy }),
  },
  sessions: {
    user: r.one.users({ from: r.sessions.userId, to: r.users.id }),
  },
  media: {
    uploader: r.one.users({ from: r.media.uploadedBy, to: r.users.id }),
  },
  categories: {
    posts: r.many.posts({ from: r.categories.id, to: r.posts.categoryId }),
  },
  tags: {
    posts: r.many.posts({
      from: r.tags.id.through(r.postTags.tagId),
      to: r.posts.id.through(r.postTags.postId),
    }),
  },
  posts: {
    author: r.one.users({ from: r.posts.authorId, to: r.users.id }),
    category: r.one.categories({ from: r.posts.categoryId, to: r.categories.id }),
    cover: r.one.media({ from: r.posts.coverMediaId, to: r.media.id }),
    tags: r.many.tags({
      from: r.posts.id.through(r.postTags.postId),
      to: r.tags.id.through(r.postTags.tagId),
    }),
  },
  postTags: {
    post: r.one.posts({ from: r.postTags.postId, to: r.posts.id }),
    tag: r.one.tags({ from: r.postTags.tagId, to: r.tags.id }),
  },
  events: {
    cover: r.one.media({ from: r.events.coverMediaId, to: r.media.id }),
  },
  products: {
    cover: r.one.media({ from: r.products.coverMediaId, to: r.media.id }),
  },
  albums: {
    cover: r.one.media({ from: r.albums.coverMediaId, to: r.media.id }),
    items: r.many.media({
      from: r.albums.id.through(r.albumMedia.albumId),
      to: r.media.id.through(r.albumMedia.mediaId),
    }),
  },
  albumMedia: {
    album: r.one.albums({ from: r.albumMedia.albumId, to: r.albums.id }),
    media: r.one.media({ from: r.albumMedia.mediaId, to: r.media.id }),
  },
}));
