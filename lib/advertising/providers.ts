export type AdProvider =
  | "DIRECT_FIRST_PARTY"
  | "GOOGLE_ADSENSE"
  | "GOOGLE_AD_MANAGER"
  | "JOURNEY_MEDIAVINE"
  | "RAPTIVE"
  | "OTHER_APPROVED_PROVIDER";

export interface AdProviderAdapter {
  readonly provider: AdProvider;
  readonly approved: boolean;
  readonly privacyReviewed: boolean;
  readonly consentReviewed: boolean;
  readonly cspReviewed: boolean;
  readonly performanceTested: boolean;
  select(): Promise<unknown | null>;
}

export function providerCanActivate(adapter: AdProviderAdapter): boolean {
  return (
    adapter.approved &&
    adapter.privacyReviewed &&
    adapter.consentReviewed &&
    adapter.cspReviewed &&
    adapter.performanceTested
  );
}

export const fallbackPriority = [
  "DIRECT_GUARANTEED",
  "DIRECT_REMNANT",
  "APPROVED_PROGRAMMATIC",
  "HOUSE_AD",
  "EMPTY_COLLAPSED",
] as const;

export interface PaymentProvider {
  readonly name: "MANUAL" | "STRIPE" | string;
  createPaymentIntent(input: {
    invoiceId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ providerReference: string; checkoutUrl?: string }>;
  refund(input: {
    paymentReference: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<{ providerReference: string; status: "PENDING" | "SUCCEEDED" }>;
}

export function assertEnabledFeatureConfiguration(
  env: Record<string, string | undefined>,
): void {
  requireWhen(env.FEATURE_DIRECT_ADS === "true", env.AD_TOKEN_SECRET, "AD_TOKEN_SECRET");
  requireWhen(env.FEATURE_DIRECT_ADS === "true", env.AD_EVENT_HASH_SECRET, "AD_EVENT_HASH_SECRET");
  requireWhen(
    env.FEATURE_ADVERTISER_PORTAL === "true",
    env.SESSION_SECRET,
    "SESSION_SECRET",
  );
  requireWhen(
    env.FEATURE_ADSENSE === "true",
    env.ADSENSE_CLIENT_ID,
    "ADSENSE_CLIENT_ID",
  );
  requireWhen(
    env.FEATURE_GOOGLE_AD_MANAGER === "true",
    env.GOOGLE_AD_MANAGER_NETWORK_CODE,
    "GOOGLE_AD_MANAGER_NETWORK_CODE",
  );
  requireWhen(
    env.PAYMENT_PROVIDER === "stripe",
    env.STRIPE_SECRET_KEY,
    "STRIPE_SECRET_KEY",
  );
}

function requireWhen(enabled: boolean, value: string | undefined, key: string): void {
  if (enabled && !value?.trim()) throw new Error(`${key} is required by an enabled feature`);
}

