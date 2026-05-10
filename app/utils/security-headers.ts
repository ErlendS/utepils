const GOOGLE_MAPS_SCRIPT_SOURCES = [
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
];

const GOOGLE_MAPS_CONNECT_SOURCES = [
  "https://maps.googleapis.com",
  "https://mapsresources-pa.googleapis.com",
];

const GOOGLE_MAPS_IMAGE_SOURCES = [
  "https://maps.googleapis.com",
  "https://mapsresources-pa.googleapis.com",
  "https://maps.gstatic.com",
  "https://*.google.com",
  "https://*.googleapis.com",
  "https://*.ggpht.com",
  "https://*.googleusercontent.com",
];

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
  `script-src 'self' ${GOOGLE_MAPS_SCRIPT_SOURCES.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: ${GOOGLE_MAPS_IMAGE_SOURCES.join(" ")}`,
  `connect-src 'self' ${GOOGLE_MAPS_CONNECT_SOURCES.join(" ")} data:`,
  "font-src 'self' https://fonts.gstatic.com",
  "frame-src https://google.com https://*.google.com",
  "worker-src 'self'",
].join("; ");

export function setSecurityHeaders(headers: Headers) {
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
}
