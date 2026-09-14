/**
 * The publisher's logo, as search engines need to see it.
 *
 * This looks like it should be one call to a URL resolver, and that is exactly
 * how it was wrong. An empty string is a *valid* relative URL, so
 * `new URL("", origin)` resolves to the origin rather than throwing, and any
 * try/catch fallback around it never runs. With no logo configured the site
 * published `"logo": "https://usnorthline.com/"` on every article - an
 * ImageObject whose url serves HTML - which search engines discard.
 */

/** Shipped at 1000x1000, the size Publisher Center asks a publication for. */
export const FALLBACK_PUBLISHER_LOGO_PATH = "/brand/square-logo.png";
export const FALLBACK_PUBLISHER_LOGO_SIZE = 1000;

export type PublisherLogo = {
  "@type": "ImageObject";
  url: string;
  width?: number;
  height?: number;
};

export function publisherLogo(
  configuredLogo: string | undefined,
  origin: string,
): PublisherLogo {
  const trimmed = configuredLogo?.trim() ?? "";

  let resolved = "";
  if (trimmed) {
    try {
      resolved = new URL(trimmed, `${origin}/`).toString();
    } catch {
      resolved = "";
    }
  }

  // A configured value that resolves to the bare origin is no more usable than
  // an empty one.
  if (resolved && resolved !== `${origin}/`) {
    // Dimensions are deliberately omitted: a configured logo is an arbitrary
    // file, and stating a size we have not measured would be a false claim.
    return { "@type": "ImageObject", url: resolved };
  }

  return {
    "@type": "ImageObject",
    url: `${origin}${FALLBACK_PUBLISHER_LOGO_PATH}`,
    width: FALLBACK_PUBLISHER_LOGO_SIZE,
    height: FALLBACK_PUBLISHER_LOGO_SIZE,
  };
}
