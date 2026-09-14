export type BrandConfig = {
  name: string;
  shortName: string;
  tagline: string;
  logo: string;
  wordmark: string;
  favicon: string;
  socialHandle: string;
};

export const brandDefaults: BrandConfig = {
  name: "Northline",
  shortName: "Northline",
  tagline: "US news, traced to the source",
  logo: "",
  wordmark: "Northline",
  favicon: "/northline-mark.svg",
  socialHandle: "@northline",
};

function configured(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

/**
 * Public brand values have one server-side source of truth. Client components
 * receive this serializable object from their server wrapper instead of
 * reading environment variables directly.
 */
export function getBrandConfig(): BrandConfig {
  return {
    name: configured(process.env.APP_NAME, brandDefaults.name),
    shortName: configured(process.env.APP_SHORT_NAME, brandDefaults.shortName),
    tagline: configured(process.env.APP_TAGLINE, brandDefaults.tagline),
    logo: configured(process.env.APP_LOGO, brandDefaults.logo),
    wordmark: configured(process.env.APP_WORDMARK, brandDefaults.wordmark),
    favicon: configured(process.env.APP_FAVICON, brandDefaults.favicon),
    socialHandle: configured(
      process.env.APP_SOCIAL_HANDLE,
      brandDefaults.socialHandle,
    ),
  };
}

export function isAssetReference(value: string): boolean {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}
