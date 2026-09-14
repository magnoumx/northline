export interface MediaKitMetric {
  label: string;
  value: string;
  source: string;
  verifiedAt: string;
}

export interface MediaKitData {
  metrics: MediaKitMetric[];
  countryDistribution: string | null;
  deviceDistribution: string | null;
  categoryInterests: string | null;
  contactEmail: string | null;
}

export function getMediaKitData(
  env: Record<string, string | undefined> = process.env,
): MediaKitData {
  const verifiedAt = env.MEDIA_KIT_METRICS_VERIFIED_AT?.trim();
  const source = env.MEDIA_KIT_METRICS_SOURCE?.trim();
  const metrics: MediaKitMetric[] = [];
  if (verifiedAt && source) {
    addMetric(metrics, "Monthly pageviews", env.MEDIA_KIT_MONTHLY_PAGEVIEWS, source, verifiedAt);
    addMetric(metrics, "Monthly users", env.MEDIA_KIT_MONTHLY_USERS, source, verifiedAt);
    addMetric(
      metrics,
      "Newsletter subscribers",
      env.MEDIA_KIT_NEWSLETTER_SUBSCRIBERS,
      source,
      verifiedAt,
    );
  }
  return {
    metrics,
    countryDistribution: verified(verifiedAt, env.MEDIA_KIT_COUNTRY_DISTRIBUTION),
    deviceDistribution: verified(verifiedAt, env.MEDIA_KIT_DEVICE_DISTRIBUTION),
    categoryInterests: verified(verifiedAt, env.MEDIA_KIT_CATEGORY_INTERESTS),
    contactEmail: env.SALES_NOTIFICATION_EMAIL?.trim() || null,
  };
}

function addMetric(
  target: MediaKitMetric[],
  label: string,
  value: string | undefined,
  source: string,
  verifiedAt: string,
) {
  const normalized = value?.trim();
  if (!normalized || !/^\d[\d,]*$/u.test(normalized)) return;
  target.push({ label, value: normalized, source, verifiedAt });
}

function verified(
  verifiedAt: string | undefined,
  value: string | undefined,
): string | null {
  return verifiedAt && value?.trim() ? value.trim() : null;
}

