"use client";

import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { FormEvent, useState } from "react";

type RequestState = "idle" | "submitting" | "accepted" | "error";

export function MagicLinkForm({
  allowRegistration,
  enabled,
  returnTo,
}: {
  allowRegistration: boolean;
  enabled: boolean;
  returnTo: string;
}) {
  const [intent, setIntent] = useState<"sign_in" | "register">("sign_in");
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;
    setState("submitting");
    setMessage("");

    const fields = new FormData(event.currentTarget);
    const payload = {
      email: String(fields.get("email") ?? ""),
      intent,
      displayName:
        intent === "register"
          ? String(fields.get("displayName") ?? "")
          : undefined,
      redirectPath: returnTo,
    };

    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const csrfPayload = (await csrfResponse.json()) as {
        csrfToken?: string;
        message?: string;
      };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) {
        throw new Error(
          csrfPayload.message ?? "Secure sign-in is temporarily unavailable.",
        );
      }

      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfPayload.csrfToken,
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message ?? "Unable to request a sign-in link.");
      }
      setState("accepted");
      setMessage(
        result.message ??
          "If the address is eligible, a one-time sign-in link will arrive shortly.",
      );
      event.currentTarget.reset();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Secure sign-in is temporarily unavailable.",
      );
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {allowRegistration ? (
        <fieldset className="auth-form__mode">
          <legend className="sr-only">Account action</legend>
          <button
            aria-pressed={intent === "sign_in"}
            onClick={() => setIntent("sign_in")}
            type="button"
          >
            Sign in
          </button>
          <button
            aria-pressed={intent === "register"}
            onClick={() => setIntent("register")}
            type="button"
          >
            Create account
          </button>
        </fieldset>
      ) : null}

      {intent === "register" ? (
        <label>
          <span>Name</span>
          <input
            autoComplete="name"
            disabled={state === "submitting" || !enabled}
            maxLength={80}
            minLength={2}
            name="displayName"
            required
            type="text"
          />
        </label>
      ) : null}

      <label>
        <span>Email address</span>
        <span className="auth-form__input">
          <Mail aria-hidden="true" size={18} />
          <input
            autoComplete="email"
            disabled={state === "submitting" || !enabled}
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </span>
      </label>

      <button
        className="auth-form__submit"
        disabled={state === "submitting" || !enabled}
        type="submit"
      >
        {state === "submitting" ? (
          <LoaderCircle aria-hidden="true" className="spin" size={18} />
        ) : state === "accepted" ? (
          <CheckCircle2 aria-hidden="true" size={18} />
        ) : null}
        {state === "submitting" ? "Requesting link…" : "Email me a secure link"}
      </button>

      {!enabled ? (
        <p className="auth-form__message auth-form__message--notice" role="status">
          Standard sign-in is disabled until email delivery and the production
          authentication configuration are verified.
        </p>
      ) : message ? (
        <p
          className={`auth-form__message auth-form__message--${state}`}
          role={state === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
