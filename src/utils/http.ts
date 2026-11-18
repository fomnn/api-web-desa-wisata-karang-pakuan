import { HTTPError } from "nitro";
import { getRouterParam, type H3Event } from "nitro/h3";

export function getIdParam(event: H3Event): number {
  const id = Number(getRouterParam(event, "id"));

  if (!Number.isInteger(id) || id < 1) {
    throw new HTTPError({ status: 400, statusText: "Bad Request", message: "Invalid id" });
  }

  return id;
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
