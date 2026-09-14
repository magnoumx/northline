export class SiteOriginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteOriginConfigurationError";
  }
}

export function resolveSiteOrigin({
  requestUrl,
  configuredOrigin,
  production,
}: {
  requestUrl: string;
  configuredOrigin?: string;
  production: boolean;
}): string {
  if (configuredOrigin) {
    return parseOrigin(configuredOrigin, production);
  }

  if (production) {
    throw new SiteOriginConfigurationError(
      "NEXT_PUBLIC_SITE_URL is required in production.",
    );
  }

  return parseOrigin(requestUrl, false);
}

function parseOrigin(value: string, requireHttps: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SiteOriginConfigurationError("The configured site URL is invalid.");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password
  ) {
    throw new SiteOriginConfigurationError(
      "The configured site URL must be an HTTP(S) origin without credentials.",
    );
  }

  if (requireHttps && url.protocol !== "https:") {
    throw new SiteOriginConfigurationError(
      "The production site URL must use HTTPS.",
    );
  }

  return url.origin;
}
