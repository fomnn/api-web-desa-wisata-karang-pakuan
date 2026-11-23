import { defineHandler } from "nitro";
import { resolveCors } from "@src/utils/cors";

export default defineHandler((event) => {
  const headers = resolveCors(event);
  if (!headers) return undefined;

  for (const [name, value] of headers) {
    event.res.headers.set(name, value);
  }

  if (event.req.method === "OPTIONS" && event.req.headers.get("access-control-request-method")) {
    return new Response(null, { status: 204, headers });
  }

  return undefined;
});
