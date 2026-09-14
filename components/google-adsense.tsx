import Script from "next/script";

function normalizedClientId(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^ca-pub-\d{10,30}$/u.test(normalized) ? normalized : null;
}

export function GoogleAdSenseLoader() {
  if (process.env.FEATURE_ADSENSE !== "true") return null;
  if (process.env.AD_GLOBAL_KILL !== "false") return null;
  if (process.env.ADSENSE_CONSENT_READY !== "true") return null;
  const clientId = normalizedClientId(process.env.ADSENSE_CLIENT_ID);
  if (!clientId) return null;

  return (
    <Script
      id="northline-google-adsense"
      async
      crossOrigin="anonymous"
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`}
    />
  );
}
