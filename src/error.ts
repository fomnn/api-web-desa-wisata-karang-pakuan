import { defineErrorHandler } from "nitro";
import { HTTPError } from "nitro/h3";

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

export default defineErrorHandler((error, _event) => {
  const isHttpError = HTTPError.isError(error);
  const status = isHttpError ? error.status : 500;
  const unhandled = !isHttpError || error.unhandled === true;
  const statusText = unhandled
    ? "Internal Server Error"
    : (error.statusText ?? STATUS_TEXT[status] ?? "Error");

  const body: Record<string, unknown> = {
    error: true,
    status,
    statusText,
    message: unhandled ? "Internal Server Error" : error.message,
  };

  if (!unhandled && error.data !== undefined) {
    body.data = error.data;
  }

  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });

  if (isHttpError && error.headers) {
    for (const [name, value] of error.headers) {
      headers.set(name, value);
    }
  }

  return new Response(JSON.stringify(body), { status, statusText, headers });
});
