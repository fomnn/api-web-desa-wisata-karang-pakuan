const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-site",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
};

export function applySecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}
