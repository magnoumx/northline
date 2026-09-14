import { createCsrfToken, verifyCsrfToken } from "../security/csrf";
import { sha256 } from "./crypto";

const LOCAL_CONFIRMATION_CSRF_SECRET =
  "northline-local-confirmation-csrf-key-not-for-production";

export class ConfirmationSecurityConfigurationError extends Error {
  constructor() {
    super(
      "NEWSLETTER_CONFIRMATION_SECRET must contain at least 32 characters in production.",
    );
    this.name = "ConfirmationSecurityConfigurationError";
  }
}

export function resolveConfirmationSecuritySecret(
  configuredSecret: string | undefined,
  production: boolean,
): string {
  const secret = configuredSecret?.trim();
  if (secret && secret.length >= 32) return secret;
  if (production) throw new ConfirmationSecurityConfigurationError();
  return LOCAL_CONFIRMATION_CSRF_SECRET;
}

export async function createNewsletterConfirmationCsrfToken(
  confirmationToken: string,
  secret: string,
  now = new Date(),
): Promise<string> {
  return createCsrfToken({
    secret,
    subject: await confirmationSubject(confirmationToken),
    now,
    ttlSeconds: 30 * 60,
  });
}

export async function verifyNewsletterConfirmationCsrfToken(
  csrfToken: string,
  confirmationToken: string,
  secret: string,
  now = new Date(),
): Promise<boolean> {
  const verification = await verifyCsrfToken(csrfToken, {
    secret,
    subject: await confirmationSubject(confirmationToken),
    now,
  });
  return verification.valid;
}

async function confirmationSubject(token: string): Promise<string> {
  return `newsletter-confirmation:${await sha256(token)}`;
}
