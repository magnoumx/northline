"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState("");

  async function signOut() {
    setState("submitting");
    setMessage("");
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
        throw new Error(csrfPayload.message ?? "Unable to verify sign-out.");
      }
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfPayload.csrfToken,
        },
        body: "{}",
      });
      if (!response.ok) throw new Error("Unable to sign out right now.");
      router.replace(returnTo);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to sign out right now.",
      );
    }
  }

  return (
    <div className="auth-form">
      <button
        className="auth-form__submit"
        disabled={state === "submitting"}
        onClick={signOut}
        type="button"
      >
        {state === "submitting" ? (
          <LoaderCircle aria-hidden="true" className="spin" size={18} />
        ) : (
          <LogOut aria-hidden="true" size={18} />
        )}
        {state === "submitting" ? "Signing out…" : "Sign out"}
      </button>
      {message ? (
        <p className="auth-form__message auth-form__message--error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
