import { runtimeFetch } from "../runtime/fetch";
import { withDeadline } from "../security/api";

export type CaptchaResult =
  | { verified: true }
  | {
      verified: false;
      reason: "MISSING_CONFIGURATION" | "MISSING_TOKEN" | "REJECTED" | "UNAVAILABLE";
    };

export async function verifyTurnstile(input: {
  token: string;
  secret: string | undefined;
  remoteAddress?: string;
  required: boolean;
  fetcher?: typeof fetch;
}): Promise<CaptchaResult> {
  const secret = input.secret?.trim();
  if (!secret) {
    return input.required
      ? { verified: false, reason: "MISSING_CONFIGURATION" }
      : { verified: true };
  }
  if (!input.token) return { verified: false, reason: "MISSING_TOKEN" };
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", input.token);
  if (input.remoteAddress && input.remoteAddress !== "unavailable") {
    form.set("remoteip", input.remoteAddress);
  }
  try {
    const response = await withDeadline(
      (signal) =>
        (input.fetcher ?? runtimeFetch)(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            body: form,
            signal,
          },
        ),
      5_000,
    );
    if (!response.ok) return { verified: false, reason: "UNAVAILABLE" };
    const result = (await response.json()) as { success?: unknown };
    return result.success === true
      ? { verified: true }
      : { verified: false, reason: "REJECTED" };
  } catch {
    return { verified: false, reason: "UNAVAILABLE" };
  }
}
