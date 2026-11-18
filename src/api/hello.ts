import { defineHandler } from "nitro";
// import { env } from "cloudflare:workers";

export default defineHandler(() => {
  return { message: "Hello from Nitro!" };
});
