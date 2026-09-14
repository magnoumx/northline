"use client";

import { Archive, Binoculars, Check, LoaderCircle, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TrendAction = "PROMOTE" | "START_RESEARCH" | "WATCH" | "REJECT" | "ARCHIVE";

export function TrendDecisionControls({
  trendId,
  state,
  compact = false,
}: {
  trendId: string;
  state: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState<TrendAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: TrendAction) {
    if (running) return;
    const labels: Record<TrendAction, string> = {
      PROMOTE: "Promote this signal to the editorial candidate queue.",
      START_RESEARCH: "Start accountable research on this signal.",
      WATCH: "Keep this signal on the watch list.",
      REJECT: "Reject this signal because it does not meet the current editorial threshold.",
      ARCHIVE: "Archive this signal from the active discovery queue.",
    };
    const reason = window.prompt(
      "Decision reason (minimum 20 characters)",
      labels[action],
    );
    if (!reason || reason.trim().length < 20) {
      setMessage("A specific reason of at least 20 characters is required.");
      return;
    }
    setRunning(action);
    setMessage(null);
    try {
      const csrfResponse = await fetch("/api/newsroom/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const csrfBody = (await csrfResponse.json()) as {
        csrfToken?: string;
        error?: { message?: string };
      };
      if (!csrfResponse.ok || !csrfBody.csrfToken) {
        throw new Error(
          csrfBody.error?.message ?? "The protected session token could not be created.",
        );
      }
      const response = await fetch(`/api/newsroom/trends/${encodeURIComponent(trendId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfBody.csrfToken,
        },
        body: JSON.stringify({
          action,
          reason: reason.trim(),
          expectedState: state,
        }),
      });
      const payload = (await response.json()) as {
        trend?: { state?: string };
        error?: { message?: string };
      };
      if (!response.ok || !payload.trend) {
        throw new Error(payload.error?.message ?? "The decision could not be saved.");
      }
      setMessage(`Saved as ${payload.trend.state ?? "updated"}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The decision could not be saved.");
    } finally {
      setRunning(null);
    }
  }

  const buttons: Array<{
    action: TrendAction;
    label: string;
    icon: typeof Check;
    hidden?: boolean;
  }> = [
    {
      action: "PROMOTE",
      label: "Promote",
      icon: Check,
      hidden: state === "CANDIDATE" || state === "RESEARCHING",
    },
    {
      action: "START_RESEARCH",
      label: "Start research",
      icon: Search,
      hidden: state === "RESEARCHING",
    },
    { action: "WATCH", label: "Watch", icon: Binoculars },
    { action: "REJECT", label: "Reject", icon: X },
    { action: "ARCHIVE", label: "Archive", icon: Archive },
  ];

  return (
    <div className={compact ? "trend-decision-controls compact" : "trend-decision-controls"}>
      <div>
        {buttons
          .filter((button) => !button.hidden)
          .map(({ action, label, icon: Icon }) => (
            <button
              className={action === "START_RESEARCH" ? "button-primary" : "button-secondary"}
              disabled={Boolean(running)}
              key={action}
              onClick={() => void run(action)}
              type="button"
            >
              {running === action ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <Icon aria-hidden="true" />
              )}
              {label}
            </button>
          ))}
      </div>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
