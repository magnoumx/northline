const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export function safeRelativeRedirectPath(
  value: string,
  fallback = "/",
): string {
  if (!isSafeFallback(fallback)) fallback = "/";
  if (!value || CONTROL_CHARACTERS.test(value)) return fallback;
  const normalized = value.trim().replaceAll("\\", "/");
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return fallback;
  }
  try {
    const base = "https://redirect.invalid";
    const url = new URL(normalized, base);
    if (url.origin !== base || url.username || url.password) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export type ExternalUrlValidation =
  | { valid: true; url: URL }
  | {
      valid: false;
      reason:
        | "invalid"
        | "scheme"
        | "credentials"
        | "port"
        | "hostname"
        | "fragment";
    };

export function validateExternalHttpUrl(
  value: string,
  {
    requireHttps = true,
    allowFragments = false,
    allowedPorts = requireHttps ? [443] : [80, 443],
  }: {
    requireHttps?: boolean;
    allowFragments?: boolean;
    allowedPorts?: readonly number[];
  } = {},
): ExternalUrlValidation {
  if (
    !value ||
    value.length > 2_048 ||
    CONTROL_CHARACTERS.test(value) ||
    value.includes("\\")
  ) {
    return { valid: false, reason: "invalid" };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, reason: "invalid" };
  }
  if (
    (requireHttps && url.protocol !== "https:") ||
    (!requireHttps && url.protocol !== "https:" && url.protocol !== "http:")
  ) {
    return { valid: false, reason: "scheme" };
  }
  if (url.username || url.password) {
    return { valid: false, reason: "credentials" };
  }
  const effectivePort = url.port
    ? Number(url.port)
    : url.protocol === "https:"
      ? 443
      : 80;
  if (!allowedPorts.includes(effectivePort)) {
    return { valid: false, reason: "port" };
  }
  if (
    !url.hostname ||
    url.hostname.length > 253 ||
    url.hostname.endsWith(".") ||
    CONTROL_CHARACTERS.test(url.hostname)
  ) {
    return { valid: false, reason: "hostname" };
  }
  if (!allowFragments && url.hash) {
    return { valid: false, reason: "fragment" };
  }
  url.hash = "";
  return { valid: true, url };
}

function isSafeFallback(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}
