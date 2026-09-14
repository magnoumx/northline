"use client";

import {
  AudioLines,
  Bot,
  CheckCircle2,
  ExternalLink,
  Link2,
  LoaderCircle,
  RefreshCw,
  Rocket,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusPill } from "./primitives";

type RunState = {
  state: string;
  total: number;
};

type AutonomousRun = {
  id: string;
  headline?: string | null;
  state: string;
  attemptCount: number;
  articleId?: string | null;
  qualityScore?: number | null;
  wordCount?: number | null;
  costMicros?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  updatedAt: number;
};

type StatusPayload = {
  enabled: boolean;
  publishing: boolean;
  audio: boolean;
  states: RunState[];
  today?: { total?: number; costMicros?: number; words?: number } | null;
  pendingAudio: number;
  recent: AutonomousRun[];
  generatedAt: string;
  error?: { message?: string };
};

type OperationKind =
  | "article.autodraft"
  | "article.autopublish"
  | "article_audio.backfill"
  | "internal_links.refresh";

const actions: Array<{
  kind: OperationKind;
  label: string;
  description: string;
  icon: typeof Bot;
}> = [
  {
    kind: "article.autodraft",
    label: "Queue autonomous drafting",
    description: "Select the next eligible signals and create bounded article jobs.",
    icon: Bot,
  },
  {
    kind: "article.autopublish",
    label: "Release approved articles",
    description: "Publish only articles that already passed every automated gate.",
    icon: Rocket,
  },
  {
    kind: "article_audio.backfill",
    label: "Generate natural narration",
    description: "Queue full-story and quick-brief ElevenLabs narration.",
    icon: AudioLines,
  },
  {
    kind: "internal_links.refresh",
    label: "Refresh internal links",
    description: "Rebuild category-aware related-story links for published content.",
    icon: Link2,
  },
];

export function AutonomousWorkspace() {
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<OperationKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/newsroom/autonomous/status", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await response.json()) as StatusPayload;
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Autonomous status is unavailable.");
      }
      setPayload(data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Autonomous status is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const stateMap = useMemo(
    () => new Map((payload?.states ?? []).map((item) => [item.state, item.total])),
    [payload?.states],
  );

  async function queue(kind: OperationKind) {
    if (running) return;
    setRunning(kind);
    setNotice(null);
    try {
      const csrfResponse = await fetch("/api/newsroom/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const csrf = (await csrfResponse.json()) as {
        csrfToken?: string;
        error?: { message?: string };
      };
      if (!csrfResponse.ok || !csrf.csrfToken) {
        throw new Error(csrf.error?.message ?? "Request security is unavailable.");
      }

      const response = await fetch("/api/newsroom/autonomous/run", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf.csrfToken,
        },
        body: JSON.stringify({ kind }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(data.error?.message ?? "The operation could not be queued.");
      }
      setNotice(data.message ?? "Operation queued.");
      window.setTimeout(() => void refresh(), 4_000);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Operation failed.");
    } finally {
      setRunning(null);
    }
  }

  if (loading && !payload) {
    return (
      <div className="operational-loading">
        <LoaderCircle className="spin" aria-hidden="true" /> Loading autonomous newsroom…
      </div>
    );
  }
  if (error && !payload) return <p className="operational-empty">{error}</p>;

  const today = payload?.today ?? {};
  return (
    <div className="autonomous-workspace">
      <div className="operational-workspace__toolbar">
        <p>
          Live D1 and queue state. The system never invents completion, approval,
          audio, or publication records.
        </p>
        <button className="button-secondary" type="button" onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="autonomous-summary-grid">
        <article>
          <span>Today&apos;s runs</span>
          <strong>{Number(today.total ?? 0)}</strong>
          <small>{Number(today.words ?? 0).toLocaleString("en-US")} words</small>
        </article>
        <article>
          <span>Approved</span>
          <strong>{stateMap.get("COMPLETED") ?? 0}</strong>
          <small>Passed deterministic system gates</small>
        </article>
        <article>
          <span>Human review</span>
          <strong>{stateMap.get("REVIEW_REQUIRED") ?? 0}</strong>
          <small>Blocked from automatic publication</small>
        </article>
        <article>
          <span>Pending audio</span>
          <strong>{payload?.pendingAudio ?? 0}</strong>
          <small>Published versions without full narration</small>
        </article>
      </div>

      <div className="autonomous-health-grid">
        <article>
          {payload?.enabled ? <CheckCircle2 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
          <div>
            <strong>Autonomous drafting</strong>
            <span>Research, independent fact review, copy review, and system gate.</span>
          </div>
          <StatusPill tone={payload?.enabled ? "success" : "warning"}>
            {payload?.enabled ? "Enabled" : "Disabled"}
          </StatusPill>
        </article>
        <article>
          {payload?.publishing ? <CheckCircle2 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
          <div>
            <strong>Approved-only publishing</strong>
            <span>Only low-risk approved records can be released by the scheduler.</span>
          </div>
          <StatusPill tone={payload?.publishing ? "success" : "warning"}>
            {payload?.publishing ? "Enabled" : "Disabled"}
          </StatusPill>
        </article>
        <article>
          {payload?.audio ? <CheckCircle2 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
          <div>
            <strong>Natural narration</strong>
            <span>Stored ElevenLabs audio with browser fallback only on failure.</span>
          </div>
          <StatusPill tone={payload?.audio ? "success" : "warning"}>
            {payload?.audio ? "Enabled" : "Disabled"}
          </StatusPill>
        </article>
      </div>

      <section className="autonomous-action-grid" aria-label="Autonomous operations">
        {actions.map((action) => {
          const Icon = action.icon;
          const isRunning = running === action.kind;
          return (
            <button
              type="button"
              key={action.kind}
              disabled={Boolean(running)}
              onClick={() => void queue(action.kind)}
            >
              {isRunning ? <LoaderCircle className="spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
              <span>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </span>
            </button>
          );
        })}
      </section>

      {notice ? <p className="autonomous-notice" aria-live="polite">{notice}</p> : null}

      <section className="autonomous-runs">
        <div className="panel-heading">
          <div>
            <span>AUTOMATION LEDGER</span>
            <h2>Recent story runs</h2>
          </div>
          <StatusPill tone="info">{payload?.recent.length ?? 0} records</StatusPill>
        </div>
        {(payload?.recent.length ?? 0) === 0 ? (
          <p className="operational-empty">No autonomous story run has been recorded.</p>
        ) : (
          <div className="autonomous-runs__table">
            {(payload?.recent ?? []).map((run) => (
              <article key={run.id}>
                <div>
                  <strong>{run.headline || run.id}</strong>
                  <span>
                    Attempt {run.attemptCount} · {run.wordCount ?? 0} words · quality {run.qualityScore ?? 0}
                  </span>
                </div>
                <StatusPill
                  tone={
                    run.state === "COMPLETED"
                      ? "success"
                      : run.state === "FAILED"
                        ? "danger"
                        : run.state === "REVIEW_REQUIRED"
                          ? "warning"
                          : "info"
                  }
                >
                  {run.state}
                </StatusPill>
                <span>
                  ${(Number(run.costMicros ?? 0) / 1_000_000).toFixed(4)} · {new Date(run.updatedAt).toLocaleString("en-US")}
                </span>
                {run.errorMessage ? <p>{run.errorCode}: {run.errorMessage}</p> : null}
                {run.articleId ? (
                  <Link href="/newsroom/editor">
                    Open editor <ExternalLink aria-hidden="true" />
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
