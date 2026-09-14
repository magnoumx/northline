import { headers } from "next/headers";

/**
 * The site's own origin, for canonical URLs and absolute metadata.
 *
 * This was a local helper inside `app/layout.tsx`, which meant the homepage
 * could not reuse it and shipped without a canonical tag at all. Anything that
 * needs an absolute URL should resolve it here so the rules stay in one place:
 * production trusts the configured value, every other environment trusts the
 * forwarded host so preview deployments are self-consistent.
 */
export async function resolveSiteOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const configured = process.env.NEXT_PUBLIC_SITE_URL;

  return normalizeOrigin(
    process.env.APP_ENV === "production" && configured
      ? configured
      : host
        ? `${protocol}://${host}`
        : configured ?? "http://localhost:3000",
  );
}

/**
 * Refuses anything that is not http(s), so a spoofed forwarded header cannot put
 * a `javascript:` or `data:` origin into a canonical tag.
 */
export function normalizeOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "http://localhost:3000";
    }
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}
