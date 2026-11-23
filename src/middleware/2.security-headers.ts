import { defineHandler } from "nitro";
import { applySecurityHeaders } from "@src/utils/security-headers";

// Normal responses inherit these headers; the response hook re-applies them to
// error and static responses, which bypass `event.res`.
export default defineHandler((event) => {
  applySecurityHeaders(event.res.headers);
});
