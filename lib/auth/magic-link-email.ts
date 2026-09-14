import { runtimeFetch } from "../runtime/fetch";
import { brandDefaults } from "../brand/config";

export type MagicLinkEmailEnvironment = {
  APP_NAME?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM_ADDRESS?: string;
  EMAIL_PROVIDER?: string;
};

export type MagicLinkEmail = {
  email: string;
  intent: "register" | "sign_in";
  magicLinkUrl: string;
  idempotencyKey: string;
};

export interface MagicLinkEmailSender {
  send(message: MagicLinkEmail): Promise<void>;
}

export class MagicLinkEmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MagicLinkEmailConfigurationError";
  }
}

export class MagicLinkEmailDeliveryError extends Error {
  constructor() {
    super("The authentication email provider rejected the message.");
    this.name = "MagicLinkEmailDeliveryError";
  }
}

/**
 * Unconfigured delivery is deliberately disabled. Authentication links are
 * never printed, returned from an API, or delivered through a preview sink.
 */
export function createMagicLinkEmailSender(
  environment: MagicLinkEmailEnvironment =
    process.env as MagicLinkEmailEnvironment,
  fetchImpl: typeof fetch = runtimeFetch,
): MagicLinkEmailSender | null {
  const provider = environment.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!provider) return null;
  if (provider !== "resend") {
    throw new MagicLinkEmailConfigurationError(
      `Unsupported authentication email provider: ${provider}.`,
    );
  }
  const apiKey = environment.EMAIL_API_KEY?.trim();
  const from = environment.EMAIL_FROM_ADDRESS?.trim();
  if (!apiKey || !from || !isMailbox(from)) {
    throw new MagicLinkEmailConfigurationError(
      "Resend authentication email requires EMAIL_API_KEY and a valid EMAIL_FROM_ADDRESS.",
    );
  }
  const brandName = environment.APP_NAME?.trim() || brandDefaults.name;

  return {
    async send(message) {
      const action =
        message.intent === "register" ? "Create your account" : "Sign in";
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "idempotency-key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [message.email],
          subject: `${action} to ${brandName}`,
          text: [
            `${action} to ${brandName}:`,
            message.magicLinkUrl,
            "",
            "This one-time link expires in 15 minutes.",
            "If you did not request it, you can ignore this email.",
          ].join("\n"),
          html: magicLinkHtml({
            action,
            brandName,
            magicLinkUrl: message.magicLinkUrl,
          }),
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new MagicLinkEmailDeliveryError();
    },
  };
}

function magicLinkHtml({
  action,
  brandName,
  magicLinkUrl,
}: {
  action: string;
  brandName: string;
  magicLinkUrl: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <body style="font-family:Arial,sans-serif;color:#161616;line-height:1.5">
    <h1>${escapeHtml(action)} to ${escapeHtml(brandName)}</h1>
    <p><a href="${escapeHtml(magicLinkUrl)}">${escapeHtml(action)}</a></p>
    <p>This one-time link expires in 15 minutes. If you did not request it, you can ignore this email.</p>
  </body>
</html>`;
}

function isMailbox(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
