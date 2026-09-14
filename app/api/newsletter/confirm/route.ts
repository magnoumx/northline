import { NextResponse } from "next/server";
import {
  NEWSLETTER_REQUEST_MAX_BYTES,
  readTextBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/newsletter/body";
import {
  resolveConfirmationSecuritySecret,
  verifyNewsletterConfirmationCsrfToken,
} from "@/lib/newsletter/confirmation-security";
import { isValidConfirmationToken } from "@/lib/newsletter/crypto";
import {
  isProductionAppEnvironment,
  resolveAppEnvironment,
} from "@/lib/newsletter/delivery";
import { resolveSiteOrigin } from "@/lib/newsletter/origin";
import { confirmNewsletterSubscription } from "@/lib/newsletter/subscriptions";
import { apiErrorResponse } from "@/lib/security/api";
import { validateMutationRequest } from "@/lib/security/origin";

export async function POST(request: Request) {
  let origin: string;
  let confirmationSecret: string;
  try {
    const appEnvironment = resolveAppEnvironment(process.env.APP_ENV);
    const production = isProductionAppEnvironment(appEnvironment);
    origin = resolveSiteOrigin({
      requestUrl: request.url,
      configuredOrigin: process.env.NEXT_PUBLIC_SITE_URL,
      production,
    });
    confirmationSecret = resolveConfirmationSecuritySecret(
      process.env.NEWSLETTER_CONFIRMATION_SECRET,
      production,
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Newsletter confirmation is temporarily unavailable.",
    });
  }

  const protection = validateMutationRequest(request, {
    allowedOrigins: [origin],
    allowedMediaTypes: ["application/x-www-form-urlencoded"],
    requireOrigin: true,
  });
  if (!protection.allowed) {
    return apiErrorResponse(
      protection.status === 415 ? "UNSUPPORTED_MEDIA_TYPE" : "FORBIDDEN",
      {
        status: protection.status,
        message:
          protection.status === 415
            ? "Send a form-encoded confirmation request."
            : "The confirmation request origin could not be verified.",
      },
    );
  }

  let body: string;
  try {
    body = await readTextBodyWithLimit(
      request,
      NEWSLETTER_REQUEST_MAX_BYTES,
    );
  } catch (error) {
    return apiErrorResponse(
      error instanceof RequestBodyTooLargeError
        ? "PAYLOAD_TOO_LARGE"
        : "BAD_REQUEST",
      {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        message: "The confirmation request is invalid.",
      },
    );
  }

  const form = new URLSearchParams(body);
  if (
    Array.from(form.keys()).some((key) => key !== "token" && key !== "csrf") ||
    form.getAll("token").length !== 1 ||
    form.getAll("csrf").length !== 1
  ) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "The confirmation request is invalid.",
    });
  }
  const token = form.get("token") ?? "";
  const csrf = form.get("csrf") ?? "";
  if (
    !isValidConfirmationToken(token) ||
    !(await verifyNewsletterConfirmationCsrfToken(
      csrf,
      token,
      confirmationSecret,
    ))
  ) {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: "The confirmation request could not be verified.",
    });
  }

  try {
    await confirmNewsletterSubscription(token);
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Newsletter confirmation is temporarily unavailable.",
    });
  }

  const destination = new URL("/newsletter/confirm", origin);
  destination.searchParams.set("token", token);
  return NextResponse.redirect(destination, 303);
}
