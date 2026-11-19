import { queryOptions } from "@tanstack/react-query";

export type PostStatus = "draft" | "review" | "published" | "archived";

export type UserRole = "admin" | "editor" | "author";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: number;
  slug: string;
  name: string;
}

export interface Media {
  id: number;
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  uploadedBy: number;
  createdAt: string;
}

export interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverMediaId: number | null;
  categoryId: number | null;
  authorId: number;
  status: PostStatus;
  publishedAt: string | null;
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostDetail extends Post {
  author: User;
  category: Category | null;
  cover: Media | null;
  tags: Tag[];
}

/**
 * Payload for POST/PATCH `/api/cms/posts`. `coverMediaId` is deliberately absent:
 * there is no media endpoint yet, and an omission keeps the current cover intact on PATCH.
 */
export interface PostInput {
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  categoryId: number | null;
  authorId: number;
  status: PostStatus;
  publishedAt: string | null;
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  tagIds: number[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface PostFilters {
  page?: number;
  pageSize?: number;
  status?: PostStatus;
  categoryId?: number;
  q?: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();

  if (text) {
    try {
      const body: unknown = JSON.parse(text);

      if (isRecord(body)) {
        const message = body["message"];
        if (typeof message === "string" && message) return message;

        const statusMessage = body["statusMessage"];
        if (typeof statusMessage === "string" && statusMessage) return statusMessage;
      }
    } catch {
      // Not JSON, fall through to the status line.
    }
  }

  return `${response.status} ${response.statusText}`;
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  if (init?.body) headers.set("content-type", "application/json");

  const response = await fetch(path, { ...init, headers });

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }

  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init);

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- response shape is the server's typed contract
  return (await response.json()) as T;
}

async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  await send(path, init);
}

async function dataOf<T>(path: string): Promise<T[]> {
  const body = await request<{ data: T[] }>(path);
  return body.data;
}

export function listPosts(filters: PostFilters = {}): Promise<Paginated<Post>> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 12),
  });

  if (filters.status) params.set("status", filters.status);
  if (filters.categoryId) params.set("categoryId", String(filters.categoryId));
  if (filters.q) params.set("q", filters.q);

  return request<Paginated<Post>>(`/api/cms/posts?${params.toString()}`);
}

export function getPost(id: number): Promise<PostDetail> {
  return request<PostDetail>(`/api/cms/posts/${id}`);
}

export function createPost(input: PostInput): Promise<Post> {
  return request<Post>("/api/cms/posts", { method: "POST", body: JSON.stringify(input) });
}

export function updatePost(id: number, input: PostInput): Promise<Post> {
  return request<Post>(`/api/cms/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePost(id: number): Promise<void> {
  return requestNoContent(`/api/cms/posts/${id}`, { method: "DELETE" });
}

export function postsQueryOptions(filters: PostFilters = {}) {
  return queryOptions({
    queryKey: ["posts", filters],
    queryFn: () => listPosts(filters),
  });
}

export function postQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["post", id],
    queryFn: () => getPost(id),
  });
}

export function usersQueryOptions() {
  return queryOptions({
    queryKey: ["users"],
    queryFn: () => dataOf<User>("/api/cms/users"),
  });
}

export function categoriesQueryOptions() {
  return queryOptions({
    queryKey: ["categories"],
    queryFn: () => dataOf<Category>("/api/cms/categories"),
  });
}

export function tagsQueryOptions() {
  return queryOptions({
    queryKey: ["tags"],
    queryFn: () => dataOf<Tag>("/api/cms/tags"),
  });
}
