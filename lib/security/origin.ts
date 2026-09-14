export type RequestProtectionFailure =
  | "missing_origin"
  | "invalid_origin"
  | "cross_origin"
  | "cross_site"
  | "unsupported_media_type";

export type RequestProtectionResult =
  | { allowed: true }
  | { allowed: false; reason: RequestProtectionFailure; status: 403 | 415 };

export function validateMutationOrigin(
  headers: Headers,
  {
    allowedOrigins,
    requireOrigin = true,
  }: {
    allowedOrigins: readonly string[];
    requireOrigin?: boolean;
  },
): RequestProtectionResult {
  const normalizedAllowed = new Set(
    allowedOrigins
      .map(normalizeOrigin)
      .filter((origin): origin is string => origin !== null),
  );
  if (normalizedAllowed.size === 0) {
    return { allowed: false, reason: "invalid_origin", status: 403 };
  }

  const fetchSite = headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") {
    return { allowed: false, reason: "cross_site", status: 403 };
  }

  const supplied = headers.get("origin");
  if (!supplied) {
    return requireOrigin
      ? { allowed: false, reason: "missing_origin", status: 403 }
      : { allowed: true };
  }
  const origin = normalizeOrigin(supplied);
  if (!origin) return { allowed: false, reason: "invalid_origin", status: 403 };
  return normalizedAllowed.has(origin)
    ? { allowed: true }
    : { allowed: false, reason: "cross_origin", status: 403 };
}

export function validateRequestContentType(
  headers: Headers,
  allowedMediaTypes: readonly string[],
): RequestProtectionResult {
  const raw = headers.get("content-type");
  const mediaType = raw?.split(";", 1)[0]?.trim().toLowerCase();
  if (!mediaType || !allowedMediaTypes.includes(mediaType)) {
    return {
      allowed: false,
      reason: "unsupported_media_type",
      status: 415,
    };
  }
  return { allowed: true };
}

export function validateMutationRequest(
  request: Request,
  {
    allowedOrigins,
    allowedMediaTypes,
    requireOrigin = true,
  }: {
    allowedOrigins: readonly string[];
    allowedMediaTypes: readonly string[];
    requireOrigin?: boolean;
  },
): RequestProtectionResult {
  const contentType = validateRequestContentType(
    request.headers,
    allowedMediaTypes,
  );
  if (!contentType.allowed) return contentType;
  return validateMutationOrigin(request.headers, {
    allowedOrigins,
    requireOrigin,
  });
}

export function normalizeOrigin(value: string): string | null {
  if (
    value === "null" ||
    /[\u0000-\u001F\u007F]/.test(value) ||
    value.includes(",")
  ) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}
