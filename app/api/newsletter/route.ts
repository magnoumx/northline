import { NextResponse } from "next/server";
import { z } from "zod";
import { getD1Binding, getDb } from "@/db";
import {
  NEWSLETTER_REQUEST_MAX_BYTES,
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/newsletter/body";
import { createConfirmationToken, sha256 } from "@/lib/newsletter/crypto";
import {
  assertEmailDeliveryConfigured,
  deliverNewsletterConfirmation,
  EmailDeliveryConfigurationError,
  EmailDeliveryError,
  isProductionAppEnvironment,
  type DeliveryEnvironment,
} from "@/lib/newsletter/delivery";
import { resolveSiteOrigin } from "@/lib/newsletter/origin";
import {
  createD1NewsletterRateLimitStore,
  enforceNewsletterRateLimits,
  resolveClientAddress,
  resolveRateLimitSecret,
} from "@/lib/newsletter/rate-limit";
import { confirmationExpiry } from "@/lib/newsletter/subscriptions";
import { validateMutationRequest } from "@/lib/security/origin";

const allowedLists = [
  "daily-brief",
  "breaking-updates",
  "weekend-deep-reads",
] as const;

const newsletterRequest = z
  .object({
    email: z.string().trim().email().max(254),
    list: z.enum(allowedLists).optional(),
    lists: z.array(z.enum(allowedLists)).min(1).max(3).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.list && !value.lists?.length) {
      context.addIssue({ code: "custom", message: "Choose at least one briefing." });
    }
  });

const noStoreHeaders = { "cache-control": "no-store" };

export async function POST(request: Request) {
  const production = isProductionAppEnvironment(process.env.APP_ENV);
  const deliveryEnvironment: DeliveryEnvironment = {
    APP_ENV: production ? "production" : process.env.APP_ENV,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
    APP_NAME: process.env.APP_NAME,
  };

  let origin: string;
  let rateLimitSecret: string;
  try {
    origin = resolveSiteOrigin({
      requestUrl: request.url,
      configuredOrigin: process.env.NEXT_PUBLIC_SITE_URL,
      production,
    });
    rateLimitSecret = resolveRateLimitSecret(process.env.RATE_LIMIT_SECRET, production);
    assertEmailDeliveryConfigured(deliveryEnvironment);
  } catch {
    return NextResponse.json(
      { message: "Newsletter signup is not configured. Please try again later." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const requestProtection = validateMutationRequest(request, {
    allowedOrigins: [origin],
    allowedMediaTypes: ["application/json"],
    requireOrigin: true,
  });
  if (!requestProtection.allowed) {
    return NextResponse.json(
      {
        message:
          requestProtection.status === 415
            ? "Send the signup request as JSON."
            : "The signup request origin could not be verified.",
      },
      { status: requestProtection.status, headers: noStoreHeaders },
    );
  }

  let input: unknown;
  try {
    input = await readJsonBodyWithLimit(request, NEWSLETTER_REQUEST_MAX_BYTES);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof RequestBodyTooLargeError
            ? "The request was larger than expected."
            : "Send a valid email address and briefing selection.",
      },
      {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        headers: noStoreHeaders,
      },
    );
  }

  const parsed = newsletterRequest.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter a valid email and choose at least one briefing." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const lists = Array.from(
    new Set(parsed.data.lists ?? (parsed.data.list ? [parsed.data.list] : [])),
  );
  const now = new Date();
  const email = parsed.data.email.toLowerCase();

  try {
    const db = await getDb();
    const rateLimit = await enforceNewsletterRateLimits({
      store: createD1NewsletterRateLimitStore(db),
      email,
      clientAddress: await resolveClientAddress(request.headers),
      secret: rateLimitSecret,
      now,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many signup attempts. Please try again later." },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            "retry-after": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }
  } catch {
    return NextResponse.json(
      { message: "Signup storage is temporarily unavailable. Please try again shortly." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const token = createConfirmationToken();
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const expiresAt = confirmationExpiry(now, process.env.NEWSLETTER_CONFIRMATION_TTL_HOURS);
  const confirmationUrl = new URL("/newsletter/confirm", origin);
  confirmationUrl.searchParams.set("token", token);

  try {
    const database = await getD1Binding();
    await database
      .prepare(
        `INSERT INTO newsletter_signup_batches (
           id, email, lists_json, status, confirmation_token_hash,
           confirmation_token_expires_at, consent_source, consented_at,
           confirmed_at, created_at, updated_at
         ) VALUES (?1, ?2, ?3, 'pending', ?4, ?5, 'northline_web_form', ?6, NULL, ?6, ?6)`,
      )
      .bind(
        id,
        email,
        JSON.stringify(lists),
        tokenHash,
        expiresAt.getTime(),
        now.getTime(),
      )
      .run();
  } catch {
    return NextResponse.json(
      { message: "Signup storage is temporarily unavailable. Please try again shortly." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    const delivery = await deliverNewsletterConfirmation({
      email,
      list: lists.length === 1 ? lists[0] : `${lists.length} selected briefings`,
      confirmationUrl: confirmationUrl.toString(),
      idempotencyKey: `newsletter-batch-confirmation-${tokenHash.slice(0, 48)}`,
      environment: deliveryEnvironment,
    });

    if (delivery.kind === "preview") {
      return NextResponse.json(
        {
          mode: "demo",
          message: "Local preview: no email was sent. Use the confirmation link below.",
          confirmationUrl: delivery.confirmationUrl,
        },
        { status: 202, headers: noStoreHeaders },
      );
    }

    return NextResponse.json(
      { message: `Check your inbox to confirm ${lists.length} briefing${lists.length === 1 ? "" : "s"}.` },
      { status: 202, headers: noStoreHeaders },
    );
  } catch (error) {
    const status = error instanceof EmailDeliveryConfigurationError ? 503 : 502;
    const message =
      error instanceof EmailDeliveryError
        ? "We could not send the confirmation email. Please try again."
        : "Newsletter signup is temporarily unavailable.";
    return NextResponse.json({ message }, { status, headers: noStoreHeaders });
  }
}
