import { defineHandler } from "nitro";
import { setRequestId, setRequestStartedAt } from "@src/utils/request-context";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export default defineHandler((event) => {
  const incoming = event.req.headers.get("x-request-id");
  const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();

  setRequestId(event, requestId);
  setRequestStartedAt(event, Date.now());
  event.res.headers.set("x-request-id", requestId);
});
