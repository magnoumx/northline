"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FilePenLine,
  FileText,
  LoaderCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  ReviewArticleSummary,
  ReviewWorkspaceData,
} from "@/lib/newsroom/editorial-read-service";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, StatusPill, WorkspaceHeading } from "./primitives";
import { hasNewsroomPermission, useNewsroomSession } from "./session";

type WorkflowAction = "submit" | "approve" | "publish" | "verify";

/**
 * The reason codes the pipeline records when it holds a draft. Plain English so
 * a reviewer can act without cross-referencing the source - `qualityScore` was
 * a permanent 0 for every article until now, which gave no signal at all.
 */
const QUALITY_REASON_LABELS: Record<string, string> = {
  article_too_short: "Below the minimum word count for its format.",
  missing_primary_source: "No first-party record - only independent reporting.",
  missing_independent_sources: "Fewer independent sources than the desk requires.",
  fact_review_blocking: "The independent fact review did not clear it.",
  fact_review_unavailable:
    "The independent fact review never ran, so nothing was checked.",
  final_body_contains_unapproved_links:
    "A link outside the reviewed source list appeared after review.",
  review_not_independent: "The fact review used the same provider as drafting.",
  review_not_search_grounded: "The fact review had no search-grounded evidence.",
  high_risk_category: "Filed under a category that always requires a human.",
  central_claim_not_verified: "The central claim was not confirmed as supported.",
  central_claim_missing_primary_evidence:
    "The central claim has no first-party source behind it.",
};

function qualityReasonLabel(reason: string): string {
  return QUALITY_REASON_LABELS[reason] ?? reason;
}

export function LiveReviewWorkspace({ data }: { data: ReviewWorkspaceData }) {
  const router = useRouter();
  const session = useNewsroomSession();
  const [selectedId, setSelectedId] = useState(data.articles[0]?.id ?? "");
  const [running, setRunning] = useState<WorkflowAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selected = useMemo(
    () => data.articles.find((article) => article.id === selectedId) ?? data.articles[0] ?? null,
    [data.articles, selectedId],
  );

  const queues = {
    review: data.articles.filter((article) => article.state === "HUMAN_REVIEW_REQUIRED").length,
    approved: data.articles.filter((article) => article.state === "APPROVED" || article.state === "SCHEDULED").length,
    revision: data.articles.filter((article) => article.state === "REVISION_REQUIRED").length,
  };

  async function run(action: WorkflowAction, article: ReviewArticleSummary) {
    if (running) return;
    const defaultReason: Record<WorkflowAction, string> = {
      verify: "Reviewed the linked primary evidence and the independent source packet; the central claim is supported as written.",
      submit: "The editor completed the source packet and submitted the current version for accountable human review.",
      approve: "Human review completed the evidence, rights, risk, quality, and editorial approval gates.",
      publish: "The authorized publisher confirmed the approved current version and the production publication checklist.",
    };
    const reason = window.prompt("Decision reason (minimum 20 characters)", defaultReason[action]);
    if (!reason || reason.trim().length < 20) {
      setMessage("A specific reason of at least 20 characters is required.");
      return;
    }
    setRunning(action);
    setMessage(null);
    try {
      const csrfToken = await getCsrfToken();
      const response = action === "verify"
        ? await fetch(
            `/api/newsroom/articles/${encodeURIComponent(article.id)}/claims/${encodeURIComponent(article.centralClaimId ?? "")}`,
            {
              method: "PATCH",
              credentials: "same-origin",
              headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
              body: JSON.stringify({ verificationStatus: "VERIFIED", reviewNotes: reason.trim() }),
            },
          )
        : await fetch(`/api/newsroom/articles/${encodeURIComponent(article.id)}`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
              "x-csrf-token": csrfToken,
              "idempotency-key": crypto.randomUUID(),
            },
            body: JSON.stringify({
              action,
              expectedCurrentVersionId: article.currentVersionId,
              reason: reason.trim(),
            }),
          });
      const payload = (await response.json()) as {
        article?: { state?: string };
        claim?: { verificationStatus?: string };
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "The review decision could not be saved.");
      }
      setMessage(
        action === "verify"
          ? `Central claim saved as ${payload.claim?.verificationStatus ?? "VERIFIED"}.`
          : `Article moved to ${payload.article?.state ?? "the next state"}.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The review decision could not be saved.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <NewsroomFrame activePath="/newsroom/review">
      <div className="newsroom-content">
        <WorkspaceHeading
          eyebrow="LIVE FINAL REVIEW"
          title="Human publication review"
          description="Review current D1-backed drafts, verify central claims, approve eligible versions, and publish only through accountable server-side gates."
          action={
            <Link className="button-primary" href="/newsroom/editor">
              Open Article Editor <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        <NewsroomNotice>
          <strong>Human decisions are persisted and audited.</strong>
          <span>
            Approval and publication remain unavailable until the current version, central claim, evidence, risk, and workflow state satisfy the server-side rules.
          </span>
        </NewsroomNotice>

        <div className="review-live-metrics">
          <article><span>Waiting for review</span><strong>{queues.review}</strong></article>
          <article><span>Approved or scheduled</span><strong>{queues.approved}</strong></article>
          <article><span>Revision required</span><strong>{queues.revision}</strong></article>
          <article><span>All active articles</span><strong>{data.articles.length}</strong></article>
        </div>

        {selected ? (
          <div className="review-live-layout">
            <aside className="review-live-list" aria-label="Article review queue">
              <div className="panel-heading">
                <div><span>REVIEW QUEUE</span><h2>Articles</h2></div>
                <StatusPill tone="info">{data.articles.length}</StatusPill>
              </div>
              <div>
                {data.articles.map((article) => (
                  <button
                    aria-pressed={selected.id === article.id}
                    className={selected.id === article.id ? "active" : undefined}
                    key={article.id}
                    onClick={() => setSelectedId(article.id)}
                    type="button"
                  >
                    <span>
                      <strong>{article.headline ?? article.slug}</strong>
                      <small>{article.category} · {article.state}</small>
                    </span>
                    <StatusPill tone={stateTone(article.state)}>{article.state}</StatusPill>
                  </button>
                ))}
              </div>
            </aside>

            <section className="review-live-detail">
              <header>
                <div>
                  <span>{selected.category} · {selected.format}</span>
                  <h2>{selected.headline ?? selected.slug}</h2>
                  <p>{selected.subheadline ?? "No subheadline has been saved for the current version."}</p>
                </div>
                <StatusPill tone={selected.risk === "LOW" ? "success" : "warning"}>
                  {selected.risk} risk
                </StatusPill>
              </header>

              <div className="review-live-gates">
                <Gate
                  label="Current version"
                  passed={Boolean(selected.currentVersionId)}
                  detail={selected.currentVersionId ?? "Missing"}
                />
                <Gate
                  label="Central claim"
                  passed={selected.centralClaimStatus === "VERIFIED"}
                  detail={selected.centralClaimStatus ?? "Missing"}
                />
                <Gate
                  label="Primary evidence"
                  passed={selected.centralClaimHasPrimaryEvidence}
                  detail={selected.centralClaimHasPrimaryEvidence ? "Recorded" : "Required"}
                />
                <Gate
                  label="Evidence links"
                  passed={selected.evidenceCount > 0}
                  detail={`${selected.evidenceCount} records`}
                />
                <Gate
                  label="Quality score"
                  passed={selected.qualityScore >= 80}
                  detail={`${selected.qualityScore}/100`}
                />
                <Gate
                  label="Sensitive coverage"
                  passed={!selected.sensitive}
                  detail={selected.sensitive ? "Additional review required" : "Standard controls"}
                />
              </div>

              {selected.qualityReasons.length > 0 ? (
                <section className="review-live-claim">
                  <div>
                    <span>HELD BECAUSE</span>
                  </div>
                  <ul>
                    {selected.qualityReasons.map((reason) => (
                      <li key={reason}>{qualityReasonLabel(reason)}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="review-live-claim">
                <div>
                  <span>CENTRAL CLAIM</span>
                  <StatusPill tone={selected.centralClaimStatus === "VERIFIED" ? "success" : "warning"}>
                    {selected.centralClaimStatus ?? "UNVERIFIED"}
                  </StatusPill>
                </div>
                <p>{selected.centralClaimText ?? "No central claim is attached to the current version."}</p>
              </section>

              <div className="review-live-actions">
                {selected.centralClaimId && selected.centralClaimStatus !== "VERIFIED" ? (
                  <ActionButton
                    action="verify"
                    icon={ShieldCheck}
                    label="Verify central claim"
                    running={running}
                    onClick={() => void run("verify", selected)}
                  />
                ) : null}
                {selected.state === "DRAFTING" || selected.state === "REVISION_REQUIRED" ? (
                  <ActionButton
                    action="submit"
                    icon={Send}
                    label="Submit for review"
                    running={running}
                    onClick={() => void run("submit", selected)}
                  />
                ) : null}
                {selected.state === "HUMAN_REVIEW_REQUIRED" ? (
                  <ActionButton
                    action="approve"
                    icon={CheckCircle2}
                    label="Approve current version"
                    running={running}
                    onClick={() => void run("approve", selected)}
                  />
                ) : null}
                {selected.state === "APPROVED" && hasNewsroomPermission(session, ["article.publish"]) ? (
                  <ActionButton
                    action="publish"
                    icon={FileText}
                    label="Publish approved version"
                    running={running}
                    onClick={() => void run("publish", selected)}
                  />
                ) : null}
                <Link className="button-secondary" href="/newsroom/editor">
                  <FilePenLine aria-hidden="true" /> Open editor
                </Link>
              </div>
              {message ? <p className="review-live-message" role="status">{message}</p> : null}
            </section>
          </div>
        ) : (
          <div className="review-live-empty">
            <AlertTriangle aria-hidden="true" />
            <h2>No article has entered the production workflow</h2>
            <p>Create a database-backed draft, attach evidence, and submit it for human review.</p>
            <Link className="button-primary" href="/newsroom/editor">
              Create first draft <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </NewsroomFrame>
  );
}

function Gate({ label, passed, detail }: { label: string; passed: boolean; detail: string }) {
  return (
    <article className={passed ? "passed" : "blocked"}>
      {passed ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
      <span><strong>{label}</strong><small>{detail}</small></span>
    </article>
  );
}

function ActionButton({
  action,
  icon: Icon,
  label,
  running,
  onClick,
}: {
  action: WorkflowAction;
  icon: typeof ShieldCheck;
  label: string;
  running: WorkflowAction | null;
  onClick: () => void;
}) {
  return (
    <button className="button-primary" disabled={Boolean(running)} onClick={onClick} type="button">
      {running === action ? <LoaderCircle className="spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
      {label}
    </button>
  );
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/newsroom/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    csrfToken?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.csrfToken) {
    throw new Error(
      payload.error?.message ?? "The protected session token could not be created.",
    );
  }
  return payload.csrfToken;
}

function stateTone(state: string): "success" | "warning" | "info" | "neutral" {
  if (["APPROVED", "PUBLISHED", "DEVELOPING", "UPDATED", "CORRECTED"].includes(state)) return "success";
  if (["HUMAN_REVIEW_REQUIRED", "REVISION_REQUIRED"].includes(state)) return "warning";
  if (["DRAFTING", "FACT_REVIEW", "COPY_REVIEW", "SEO_REVIEW"].includes(state)) return "info";
  return "neutral";
}
