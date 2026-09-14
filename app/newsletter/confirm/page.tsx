import type { Metadata } from "next";
import Link from "next/link";
import {
  createNewsletterConfirmationCsrfToken,
  resolveConfirmationSecuritySecret,
} from "@/lib/newsletter/confirmation-security";
import {
  isProductionAppEnvironment,
  resolveAppEnvironment,
} from "@/lib/newsletter/delivery";
import { inspectNewsletterSubscription } from "@/lib/newsletter/subscriptions";
import { getBrandConfig } from "@/lib/brand/config";
import "../../public-pages.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your briefing",
  robots: { index: false, follow: false },
};

type ConfirmationState =
  | "confirmable"
  | "confirmed"
  | "already-confirmed"
  | "expired"
  | "invalid"
  | "unavailable";

const confirmationCopy: Record<
  ConfirmationState,
  { eyebrow: string; title: string; body: string }
> = {
  confirmable: {
    eyebrow: "CONFIRM YOUR SUBSCRIPTION",
    title: "One last deliberate step.",
    body: "Confirm below to activate this briefing. Opening the email link alone never changes your subscription.",
  },
  confirmed: {
    eyebrow: "SUBSCRIPTION CONFIRMED",
    title: "Your briefing is on.",
    body: "Your address is confirmed. We will only send the briefing you requested.",
  },
  "already-confirmed": {
    eyebrow: "ALREADY CONFIRMED",
    title: "You’re all set.",
    body: "This briefing subscription was already confirmed. No further action is needed.",
  },
  expired: {
    eyebrow: "LINK EXPIRED",
    title: "That confirmation window closed.",
    body: "For your privacy, confirmation links expire. Return to the newsletter page to request a fresh one.",
  },
  invalid: {
    eyebrow: "INVALID LINK",
    title: "We could not verify that link.",
    body: "The confirmation token is missing or invalid. Request a new link from the newsletter page.",
  },
  unavailable: {
    eyebrow: "TEMPORARILY UNAVAILABLE",
    title: "We could not confirm right now.",
    body: "The signup service is temporarily unavailable. Your link may still be valid, so please try again shortly.",
  },
};

export default async function NewsletterConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const brand = getBrandConfig();
  const parameters = await searchParams;
  const token =
    typeof parameters.token === "string" ? parameters.token : "";
  let state: ConfirmationState;
  let csrfToken: string | null = null;

  try {
    state = await inspectNewsletterSubscription(token);
    if (state === "confirmable") {
      const appEnvironment = resolveAppEnvironment(process.env.APP_ENV);
      const secret = resolveConfirmationSecuritySecret(
        process.env.NEWSLETTER_CONFIRMATION_SECRET,
        isProductionAppEnvironment(appEnvironment),
      );
      csrfToken = await createNewsletterConfirmationCsrfToken(token, secret);
    }
  } catch {
    state = "unavailable";
  }

  const copy = confirmationCopy[state];
  return (
    <main className="system-state">
      <Link className="system-state__brand" href="/">
        {brand.wordmark}
      </Link>
      <div>
        <span>{copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        {state === "confirmable" && csrfToken ? (
          <form action="/api/newsletter/confirm" method="post">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="csrf" value={csrfToken} />
            <button type="submit">Confirm subscription</button>
          </form>
        ) : (
          <Link
            href={
              state === "confirmed" || state === "already-confirmed"
                ? "/latest"
                : "/newsletter"
            }
          >
            {state === "confirmed" || state === "already-confirmed"
              ? "Read the latest"
              : "Back to newsletters"}
          </Link>
        )}
      </div>
      <small>{brand.tagline}</small>
    </main>
  );
}
