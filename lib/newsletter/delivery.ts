import { runtimeFetch } from "../runtime/fetch";
import { brandDefaults } from "../brand/config";

export type DeliveryEnvironment = {
  APP_ENV?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM_ADDRESS?: string;
  APP_NAME?: string;
};

export type AppEnvironment =
  | "development"
  | "test"
  | "preview"
  | "production";

export type ConfirmationDeliveryResult =
  | { kind: "sent"; provider: "resend"; providerId?: string }
  | { kind: "preview"; confirmationUrl: string };

export class EmailDeliveryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor() {
    super("The email provider did not accept the confirmation message.");
    this.name = "EmailDeliveryError";
  }
}

export class AppEnvironmentConfigurationError extends EmailDeliveryConfigurationError {
  constructor() {
    super(
      "APP_ENV must explicitly identify development, test, preview, or production.",
    );
    this.name = "AppEnvironmentConfigurationError";
  }
}

type ResendResponse = { id?: unknown };

/**
 * Product behavior follows the explicitly promoted app environment. Build tools
 * commonly set NODE_ENV=production for preview artifacts, so it is not a
 * deployment-stage signal.
 */
export function isProductionAppEnvironment(appEnvironment?: string): boolean {
  return appEnvironment === "production";
}

export function resolveAppEnvironment(
  appEnvironment: string | undefined,
): AppEnvironment {
  if (
    appEnvironment === "development" ||
    appEnvironment === "test" ||
    appEnvironment === "preview" ||
    appEnvironment === "production"
  ) {
    return appEnvironment;
  }
  throw new AppEnvironmentConfigurationError();
}

export function assertEmailDeliveryConfigured(
  environment: DeliveryEnvironment,
): void {
  const appEnvironment = resolveAppEnvironment(environment.APP_ENV);
  const provider = environment.EMAIL_PROVIDER?.trim().toLowerCase();
  const production = isProductionAppEnvironment(appEnvironment);

  if (!provider) {
    if (production) {
      throw new EmailDeliveryConfigurationError(
        "EMAIL_PROVIDER is required in production.",
      );
    }
    return;
  }

  if (provider !== "resend") {
    throw new EmailDeliveryConfigurationError(
      `Unsupported email provider: ${provider}.`,
    );
  }

  if (
    !environment.EMAIL_API_KEY?.trim() ||
    !environment.EMAIL_FROM_ADDRESS?.trim()
  ) {
    throw new EmailDeliveryConfigurationError(
      "Resend requires EMAIL_API_KEY and EMAIL_FROM_ADDRESS.",
    );
  }
}

export async function deliverNewsletterConfirmation({
  email,
  list,
  confirmationUrl,
  idempotencyKey,
  environment,
  fetchImpl = runtimeFetch,
}: {
  email: string;
  list: string;
  confirmationUrl: string;
  idempotencyKey: string;
  environment: DeliveryEnvironment;
  fetchImpl?: typeof fetch;
}): Promise<ConfirmationDeliveryResult> {
  assertEmailDeliveryConfigured(environment);
  const provider = environment.EMAIL_PROVIDER?.trim().toLowerCase();
  const brandName = environment.APP_NAME?.trim() || brandDefaults.name;

  if (!provider) {
    return { kind: "preview", confirmationUrl };
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${environment.EMAIL_API_KEY!.trim()}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      from: environment.EMAIL_FROM_ADDRESS!.trim(),
      to: [email],
      subject: `Confirm your ${brandName} briefing`,
      text: [
        `Confirm your ${brandName} newsletter subscription:`,
        confirmationUrl,
        "",
        `Briefing: ${list}`,
        "If you did not request this, you can ignore this message.",
      ].join("\n"),
      html: confirmationEmailHtml(confirmationUrl, list, brandName),
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new EmailDeliveryError();
  }

  let payload: ResendResponse = {};
  try {
    payload = (await response.json()) as ResendResponse;
  } catch {
    // A 2xx response is authoritative even if a future provider response has no JSON body.
  }

  return {
    kind: "sent",
    provider: "resend",
    providerId: typeof payload.id === "string" ? payload.id : undefined,
  };
}

function confirmationEmailHtml(
  confirmationUrl: string,
  list: string,
  brandName: string,
): string {
  const safeUrl = escapeHtml(confirmationUrl);
  const safeList = escapeHtml(list);
  const safeBrandName = escapeHtml(brandName);
  return `<!doctype html>
<html lang="en">
  <body style="font-family:Arial,sans-serif;color:#161616;line-height:1.5">
    <h1 style="font-family:Georgia,serif">Confirm your ${safeBrandName} briefing</h1>
    <p>One more step confirms your subscription to <strong>${safeList}</strong>.</p>
    <p><a href="${safeUrl}" style="background:#2153d6;color:#fff;padding:12px 18px;text-decoration:none">Confirm subscription</a></p>
    <p>If you did not request this, you can ignore this message.</p>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Sends one composed issue to one confirmed subscriber.
 *
 * Separate from the confirmation path because the failure handling differs: a
 * confirmation that fails should surface to the person who just typed their
 * address, while a failed issue send is recorded against that subscriber and
 * the run continues for everyone else.
 *
 * The idempotency key is the provider's guarantee that a retry does not deliver
 * the same issue twice, so it is derived from the issue and the recipient, never
 * from the attempt.
 */
export async function deliverNewsletterIssue({
  email,
  subject,
  text,
  html,
  idempotencyKey,
  environment,
  fetchImpl = runtimeFetch,
}: {
  email: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
  environment: DeliveryEnvironment;
  fetchImpl?: typeof fetch;
}): Promise<{ providerId?: string }> {
  assertEmailDeliveryConfigured(environment);
  if (!environment.EMAIL_PROVIDER?.trim()) {
    throw new EmailDeliveryConfigurationError(
      "No email provider is configured for issue delivery.",
    );
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${environment.EMAIL_API_KEY!.trim()}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      from: environment.EMAIL_FROM_ADDRESS!.trim(),
      to: [email],
      subject,
      text,
      html,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new EmailDeliveryError();

  let payload: ResendResponse = {};
  try {
    payload = (await response.json()) as ResendResponse;
  } catch {
    // A 2xx is authoritative even without a JSON body.
  }
  return { providerId: typeof payload.id === "string" ? payload.id : undefined };
}
