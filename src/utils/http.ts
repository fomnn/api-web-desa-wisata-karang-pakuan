import { HTTPError } from "nitro";
import { getRouterParam, type H3Event } from "nitro/h3";

export function getIdParam(event: H3Event): number {
  const id = Number(getRouterParam(event, "id"));

  if (!Number.isInteger(id) || id < 1) {
    throw new HTTPError({ status: 400, statusText: "Bad Request", message: "Invalid id" });
  }

  return id;
}

export function getSlugParam(event: H3Event): string {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw new HTTPError({ status: 400, statusText: "Bad Request", message: "Invalid slug" });
  }

  return slug;
}

export function badRequest(message: string): HTTPError {
  return new HTTPError({ status: 400, statusText: "Bad Request", message });
}

export function notFound(resource: string): HTTPError {
  return new HTTPError({
    status: 404,
    statusText: "Not Found",
    message: `${resource} not found`,
  });
}

export function tooManyRequests(result: {
  limit: number;
  resetAt: Date;
  retryAfter: number;
}): HTTPError {
  return new HTTPError({
    status: 429,
    statusText: "Too Many Requests",
    message: "Too many requests. Try again later.",
    headers: {
      "retry-after": String(result.retryAfter),
      "x-ratelimit-limit": String(result.limit),
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.floor(result.resetAt.getTime() / 1000)),
    },
    data: { retryAfter: result.retryAfter },
  });
}

export function pagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

function errorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    return `${error.message} ${errorText(error.cause)}`;
  }
  if (typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  try {
    return JSON.stringify(error) ?? "";
  } catch {
    return "";
  }
}

export async function writeOrThrow<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (HTTPError.isError(error)) throw error;

    const text = errorText(error);

    if (text.includes("UNIQUE constraint failed")) {
      throw new HTTPError({ status: 409, statusText: "Conflict", message: "Duplicate value" });
    }

    if (text.includes("FOREIGN KEY constraint failed")) {
      throw new HTTPError({
        status: 422,
        statusText: "Unprocessable Entity",
        message: "Referenced record does not exist",
      });
    }

    throw error;
  }
}
