import Script from "next/script";

function normalizedClientId(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^ca-pub-\d{10,30}$/u.test(normalized) ? normalized : null;
}

/**
 * Loads Google's AdSense script.
 *
 * Two modes. Serving mode needs the global kill off and consent infrastructure
 * attested. Verification mode (ADSENSE_VERIFICATION=true) loads the same tag so
 * Google's crawler can confirm site ownership during review; no ad slot renders
 * in that mode, because slots stay gated on ADSENSE_CONSENT_READY separately.
 */
export function GoogleAdSenseLoader() {
  if (process.env.FEATURE_ADSENSE !== "true") return null;
  const clientId = normalizedClientId(process.env.ADSENSE_CLIENT_ID);
  if (!clientId) return null;
  const serving =
    process.env.AD_GLOBAL_KILL === "false" &&
    process.env.ADSENSE_CONSENT_READY === "true";
  if (!serving && process.env.ADSENSE_VERIFICATION !== "true") return null;

  return (
    <Script
      id="northline-google-adsense"
      async
      crossOrigin="anonymous"
      // Site verification reads the served HTML; afterInteractive injects the
      // tag in the browser, which the AdSense crawler never sees.
      strategy="beforeInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`}
    />
  );
}
