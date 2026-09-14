"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Mail, RefreshCw, RotateCcw } from "lucide-react";
import { EmptyWorkspaceState, StatusPill } from "./primitives";

type NewsletterIssue = {
  id: string;
  slug: string;
  subject: string;
  previewText: string;
  bodyText: string;
  state: string;
  scheduledAt?: number | null;
  sentAt?: number | null;
  sensitive: number | boolean;
  createdAt: number;
  updatedAt: number;
};

const blankDraft = {
  subject: "",
  previewText: "",
  bodyText: "",
  sensitive: false,
};

export function NewsletterWorkspace() {
  const [issues, setIssues] = useState<NewsletterIssue[]>([]);
  const [draft, setDraft] = useState(blankDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading newsletter issues…");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/newsroom/newsletters", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        issues?: NewsletterIssue[];
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Newsletter issues are unavailable.");
      }
      setIssues(payload.issues ?? []);
      setMessage(`${payload.issues?.length ?? 0} newsletter issues loaded.`);
    } catch (error) {
      setIssues([]);
      setMessage(error instanceof Error ? error.message : "Newsletter issues are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function csrfToken(): Promise<string> {
    const response = await fetch("/api/newsroom/csrf", { credentials: "same-origin" });
    const payload = (await response.json()) as {
      csrfToken?: string;
      error?: { message?: string };
    };
    if (!response.ok || !payload.csrfToken) {
      throw new Error(payload.error?.message ?? "Newsletter request security is unavailable.");
    }
    return payload.csrfToken;
  }

  async function saveDraft() {
    if (saving) return;
    setSaving(true);
    setMessage("Saving newsletter draft…");
    try {
      const token = await csrfToken();
      const response = await fetch("/api/newsroom/newsletters", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as {
        issue?: NewsletterIssue;
        error?: { message?: string };
      };
      if (!response.ok || !payload.issue) {
        throw new Error(payload.error?.message ?? "The newsletter draft could not be saved.");
      }
      setDraft(blankDraft);
      setMessage("Newsletter issue saved as a draft. Nothing was sent.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The newsletter draft could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function updateState(issue: NewsletterIssue, action: "approve" | "return_to_draft") {
    if (saving) return;
    setSaving(true);
    setMessage(action === "approve" ? "Approving newsletter issue…" : "Returning issue to draft…");
    try {
      const token = await csrfToken();
      const response = await fetch("/api/newsroom/newsletters", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({ id: issue.id, action }),
      });
      const payload = (await response.json()) as {
        issue?: { state?: string };
        error?: { message?: string };
      };
      if (!response.ok || !payload.issue) {
        throw new Error(payload.error?.message ?? "The newsletter workflow could not be updated.");
      }
      setMessage(
        action === "approve"
          ? "Newsletter issue approved. Delivery still requires a separate verified send operation."
          : "Newsletter issue returned to draft.",
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The newsletter workflow could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    draft.subject.trim().length >= 4 &&
    draft.previewText.trim().length >= 4 &&
    draft.bodyText.trim().length >= 20;

  return (
    <div className="newsletter-workspace">
      <section className="newsletter-compose source-form" aria-labelledby="newsletter-compose-title">
        <div className="source-form__heading">
          <div>
            <p>EDITORIAL BRIEFING</p>
            <h2 id="newsletter-compose-title">Create a newsletter issue</h2>
          </div>
          <Mail aria-hidden="true" />
        </div>
        <p>
          This desk creates and approves immutable editorial issue records. It does not send
          email until a delivery provider, suppression checks, and an explicit send operation
          are verified.
        </p>
        <div className="source-form__grid">
          <label className="source-form__wide">
            Subject
            <input
              maxLength={180}
              value={draft.subject}
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
            />
          </label>
          <label className="source-form__wide">
            Preview text
            <input
              maxLength={240}
              value={draft.previewText}
              onChange={(event) => setDraft({ ...draft, previewText: event.target.value })}
            />
          </label>
          <label className="source-form__wide">
            Issue body
            <textarea
              rows={12}
              value={draft.bodyText}
              onChange={(event) => setDraft({ ...draft, bodyText: event.target.value })}
            />
          </label>
          <label className="newsletter-sensitive-toggle source-form__wide">
            <input
              type="checkbox"
              checked={draft.sensitive}
              onChange={(event) => setDraft({ ...draft, sensitive: event.target.checked })}
            />
            Contains sensitive coverage requiring additional delivery review
          </label>
        </div>
        <button type="button" disabled={!canSave || saving} onClick={() => void saveDraft()}>
          Save newsletter draft
        </button>
      </section>

      <section className="newsletter-issue-registry source-register" aria-labelledby="newsletter-registry-title">
        <div className="source-registry__heading">
          <div>
            <p>ISSUE REGISTRY</p>
            <h2 id="newsletter-registry-title">Newsletter workflow</h2>
          </div>
          <button type="button" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw aria-hidden="true" /> Refresh
          </button>
        </div>
        <p className="source-workspace__message" aria-live="polite">{message}</p>
        {!loading && issues.length === 0 ? (
          <EmptyWorkspaceState
            title="No newsletter issues yet"
            description="Create the first reviewed issue. The system will not synthesize delivery history or subscriber performance."
            icon={Mail}
          />
        ) : (
          <div className="newsletter-issue-list">
            {issues.map((issue) => (
              <article key={issue.id}>
                <div>
                  <StatusPill tone={issue.state === "APPROVED" ? "success" : "neutral"}>
                    {issue.state}
                  </StatusPill>
                  {Boolean(issue.sensitive) ? <StatusPill tone="warning">Sensitive</StatusPill> : null}
                </div>
                <h3>{issue.subject}</h3>
                <p>{issue.previewText}</p>
                <small>
                  Created {new Date(issue.createdAt).toLocaleString("en-US")} · {issue.slug}
                </small>
                <div className="newsletter-issue-actions">
                  {issue.state !== "APPROVED" ? (
                    <button type="button" disabled={saving} onClick={() => void updateState(issue, "approve")}>
                      <CheckCircle2 aria-hidden="true" /> Approve
                    </button>
                  ) : (
                    <button type="button" disabled={saving} onClick={() => void updateState(issue, "return_to_draft")}>
                      <RotateCcw aria-hidden="true" /> Return to draft
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
