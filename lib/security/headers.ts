import { randomBase64Url } from "./crypto";

export type ContentSecurityPolicyOptions = {
  nonce?: string;
  reportUri?: string;
  trustedTypes?: boolean;
  adsense?: boolean;
};

export type SecurityHeaderOptions = ContentSecurityPolicyOptions & {
  reportOnly?: boolean;
};

const BASE_SECURITY_HEADERS = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
] as const;

/**
 * Static fallback used by Next configuration. The Worker replaces this with a
 * per-request nonce policy for deployed traffic.
 */
export const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
  ...BASE_SECURITY_HEADERS,
] as const;

export function createCspNonce(): string {
  return randomBase64Url(18);
}

export function buildContentSecurityPolicy({
  nonce,
  reportUri,
  trustedTypes = false,
  adsense = false,
}: ContentSecurityPolicyOptions = {}): string {
  const scriptSources = ["'self'"];
  const styleElementSources = ["'self'"];
  const imageSources = [
    "'self'",
    "data:",
    "https://images.unsplash.com",
    "https://upload.wikimedia.org",
  ];
  const connectSources = ["'self'"];
  const frameSources = [
    "'self'",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://player.vimeo.com",
    "https://www.tiktok.com",
    "https://www.facebook.com",
    "https://www.instagram.com",
    "https://platform.twitter.com",
    "https://syndication.twitter.com",
  ];
  if (nonce) {
    scriptSources.push(`'nonce-${nonce}'`, "'strict-dynamic'");
    styleElementSources.push(`'nonce-${nonce}'`);
  }
  if (adsense) {
    scriptSources.push("https://pagead2.googlesyndication.com");
    imageSources.push(
      "https://*.googlesyndication.com",
      "https://*.doubleclick.net",
      "https://*.google.com",
    );
    connectSources.push(
      "https://*.googlesyndication.com",
      "https://*.doubleclick.net",
      "https://*.google.com",
    );
    frameSources.push(
      "https://googleads.g.doubleclick.net",
      "https://tpc.googlesyndication.com",
      "https://*.googlesyndication.com",
    );
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    `style-src ${styleElementSources.join(" ")}`,
    `style-src-elem ${styleElementSources.join(" ")}`,
    "style-src-attr 'none'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${frameSources.join(" ")}`,
    "media-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ];
  if (trustedTypes) {
    directives.push("require-trusted-types-for 'script'");
  }
  if (reportUri && isSafeReportUri(reportUri)) {
    directives.push(`report-uri ${reportUri}`);
  }
  return directives.join("; ");
}

export function withSecurityHeaders(
  response: Response,
  options: SecurityHeaderOptions = {},
): Response {
  const secured = new Response(response.body, response);
  for (const { key, value } of BASE_SECURITY_HEADERS) {
    secured.headers.set(key, value);
  }

  const policy = buildContentSecurityPolicy(options);
  if (options.reportOnly) {
    secured.headers.delete("Content-Security-Policy");
    secured.headers.set("Content-Security-Policy-Report-Only", policy);
  } else {
    secured.headers.delete("Content-Security-Policy-Report-Only");
    secured.headers.set("Content-Security-Policy", policy);
  }
  return secured;
}

function isSafeReportUri(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\r\n;]/.test(value)
  );
}
