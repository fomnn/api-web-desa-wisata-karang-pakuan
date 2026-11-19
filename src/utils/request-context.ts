import type { HTTPEvent } from "nitro/h3";

const requestIdKey = "requestId";
const requestStartedAtKey = "requestStartedAt";

function requestContext(event: HTTPEvent): Record<string, unknown> {
  return (event.req.context ??= {});
}

export function setRequestId(event: HTTPEvent, requestId: string) {
  requestContext(event)[requestIdKey] = requestId;
}

export function getRequestId(event: HTTPEvent): string | undefined {
  const value = event.req.context?.[requestIdKey];
  return typeof value === "string" ? value : undefined;
}

export function setRequestStartedAt(event: HTTPEvent, startedAt: number) {
  requestContext(event)[requestStartedAtKey] = startedAt;
}

export function getRequestStartedAt(event: HTTPEvent): number | undefined {
  const value = event.req.context?.[requestStartedAtKey];
  return typeof value === "number" ? value : undefined;
}

export function getRequestPath(event: HTTPEvent): string {
  try {
    return new URL(event.req.url).pathname;
  } catch {
    return event.req.url;
  }
}
