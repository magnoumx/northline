"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TrendRefreshControl() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState(
    "Runs Google Trends and GDELT through the protected editorial queue.",
  );

  async function runRefresh() {
    if (state === "running") return;
    setState("running");
    setMessage("Queuing a protected discovery refresh…");

    try {
      const csrfResponse = await fetch("/api/newsroom/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const csrfPayload = (await csrfResponse.json()) as {
        csrfToken?: string;
        error?: { message?: string };
      };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) {
        throw new Error(csrfPayload.error?.message ?? "Request security is unavailable.");
      }

      const response = await fetch("/api/newsroom/jobs/run", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfPayload.csrfToken,
        },
        body: JSON.stringify({ kind: "trend.refresh" }),
      });
      const payload = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? payload.message ?? "Discovery refresh failed.");
      }

      setState("success");
      setMessage(payload.message ?? "Discovery refresh queued.");
      window.setTimeout(() => router.refresh(), 8_000);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Discovery refresh failed.");
    }
  }

  return (
    <div className={`trend-refresh-control trend-refresh-control--${state}`}>
      <button type="button" disabled={state === "running"} onClick={() => void runRefresh()}>
        {state === "running" ? (
          <RefreshCw className="is-spinning" aria-hidden="true" />
        ) : (
          <Sparkles aria-hidden="true" />
        )}
        {state === "running" ? "Running discovery…" : "Run discovery now"}
      </button>
      <p aria-live="polite">{message}</p>
    </div>
  );
}
