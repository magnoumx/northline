"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, StatusPill } from "./primitives";

type SourceRecord = {
  id: string;
  name: string;
  domain: string;
  sourceType: string;
  credibilityTier: number;
  isPrimary: number | boolean;
  licensingStatus: string;
};

type SavedDraft = {
  articleId: string;
  versionId: string;
  state: string;
};

type EditorialArticle = {
  id: string;
  slug: string;
  category: string;
  format: string;
  state: string;
  sensitive: boolean;
  currentVersionId: string | null;
  headline: string | null;
  centralClaimId: string | null;
  centralClaimStatus: string | null;
  centralClaimHasPrimaryEvidence: boolean;
  sourceCount: number;
  primarySourceCount: number;
  /** Why the quality gate refused to publish this on its own. */
  qualityReasons: string[];
  qualityScore: number;
  updatedAt: string;
};

type GeneratedResearchSource = {
  sourceId: string | null;
  name: string;
  publisher: string;
  url: string;
  domain: string;
  sourceKind: "PRIMARY" | "INDEPENDENT" | "CONTEXT";
  sourceType: string;
  summary: string;
  supports: string[];
  confidence: number;
};

type AutomatedDraftPackage = {
  workflowId: string;
  recommendedFormat: (typeof formats)[number];
  targetWords: number;
  centralClaim: string;
  sources: GeneratedResearchSource[];
  claims: Array<{
    id: string;
    text: string;
    importance: "central" | "supporting";
    sourceUrls: string[];
    status: string;
    confidence: number;
  }>;
  article: {
    headline: string;
    subheadline: string;
    sections: Array<{ heading: string; paragraphs: string[] }>;
    keyTakeaways: string[];
    whyItMatters: string;
    whatHappensNext: string;
    uncertainties: string[];
  };
  seo: {
    title: string;
    description: string;
    primaryQuery: string;
    secondaryQueries: string[];
    internalLinkIdeas: string[];
  };
  distribution: {
    socialPosts: Array<{ platform: string; text: string }>;
    newsletterSubject: string;
    newsletterPreview: string;
    newsletterSummary: string;
  };
  factReview: {
    findings: Array<{
      claimId: string;
      disposition: string;
      requiredChange: string | null;
    }>;
    blocking: boolean;
  };
  metrics: {
    actualWordCount: number;
    targetWords: number;
    durationMs: number;
    costUsd: number;
    draftingProvider: string;
    draftingModel: string;
    factReviewProvider: string;
    factReviewModel: string;
    independentReview: boolean;
  };
  qualityFlags: string[];
  readyForHumanReview: boolean;
  publishableByModel: false;
};

const categories = [
  "US_NEWS",
  "POLITICS",
  "TECHNOLOGY",
  "BUSINESS",
  "ENTERTAINMENT",
  "SPORTS",
  "GAMING",
  "SCIENCE",
  "INTERNET_TRENDS",
  "WORLD",
  "HEALTH",
  "FINANCE",
  "WEATHER",
] as const;

const formats = [
  "NEWS_FLASH",
  "QUICK_BRIEF",
  "STANDARD_NEWS",
  "DEEP_EXPLAINER",
  "LIVE_BLOG",
  "WHY_TRENDING",
  "VISUAL_STORY",
  "SOURCE_COMPARISON",
] as const;

const initialForm = {
  slug: "",
  category: "US_NEWS",
  format: "STANDARD_NEWS",
  sensitive: false,
  headline: "",
  subheadline: "",
  body: "",
  takeaways: "",
  centralClaim: "",
  whyItMatters: "",
  whatHappensNext: "",
  uncertainties: "",
  primaryQuery: "",
  sourceOneId: "",
  sourceOneSummary: "",
  sourceTwoId: "",
  sourceTwoSummary: "",
};

const ACTION_LABEL = {
  submit: "Submission",
  approve: "Approval",
  publish: "Publication",
  archive: "Removal",
  retract: "Retraction",
} as const;

const ACTION_PROGRESS = {
  submit: "Submitting",
  approve: "Approving",
  publish: "Publishing",
  archive: "Removing",
  retract: "Retracting",
} as const;


/**
 * Plain-language names for the gate's refusal codes.
 *
 * `event_older_than_publication` means nothing to the person deciding whether
 * to publish. Anything unmapped is shown verbatim rather than hidden, so a new
 * gate reason is visible the day it ships instead of silently disappearing.
 */
const HELD_REASON_LABELS: Readonly<Record<string, string>> = {
  event_older_than_publication: "the event is far older than today",
  fact_review_blocking: "fact review could not support a claim",
  fact_review_unavailable:
    "the independent reviewer never ran - this was not checked",
  article_too_short: "below the minimum length",
  missing_primary_source: "no primary source",
  missing_independent_sources: "not enough independent sources",
  central_claim_not_verified: "central claim unverified",
  central_claim_missing_primary_evidence: "central claim has no primary evidence",
  final_body_contains_unapproved_links: "contains a link review never saw",
  review_not_independent: "review ran on the drafting provider",
  review_not_search_grounded: "review was not search-grounded",
  high_risk_category: "high-risk category",
  loaded_language_in_display_copy: "headline or dek reads as opinion",
  missing_attribution: "the body never says who said what",
  political_content: "political story filed under a general category",
};

function heldReasonLabel(reason: string): string {
  return HELD_REASON_LABELS[reason] ?? reason.replaceAll("_", " ");
}

export function ArticleEditor() {
  const [form, setForm] = useState(initialForm);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [message, setMessage] = useState("Start with verified source records and a blank draft.");
  const [saving, setSaving] = useState(false);
  const [runningAi, setRunningAi] = useState(false);
  const [researchStage, setResearchStage] = useState("Ready to research.");
  const [regenerating, setRegenerating] = useState(false);
  const [saved, setSaved] = useState<SavedDraft | null>(null);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [generatedPackage, setGeneratedPackage] =
    useState<AutomatedDraftPackage | null>(null);
  const [articles, setArticles] = useState<EditorialArticle[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const headline = params.get("headline")?.trim() ?? "";
      if (!headline) return;
      const category = params.get("category")?.trim().toUpperCase() ?? "US_NEWS";
      const format = params.get("format")?.trim().toUpperCase() ?? "STANDARD_NEWS";
      const primaryQuery = params.get("primaryQuery")?.trim() || headline;

      setForm((current) => {
        if (current.headline || current.body || current.centralClaim) return current;
        return {
          ...current,
          headline,
          slug: slugify(headline),
          category: categories.includes(category as (typeof categories)[number])
            ? category
            : "US_NEWS",
          format: formats.includes(format as (typeof formats)[number])
            ? format
            : "STANDARD_NEWS",
          primaryQuery,
          subheadline: `Research brief for ${headline}`,
          centralClaim: headline,
        };
      });
      setMessage("Trend context loaded. Add verified source summaries and replace the provisional claim before saving.");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const refreshArticles = useCallback(async () => {
    try {
      const response = await fetch("/api/newsroom/articles?limit=50", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        articles?: EditorialArticle[];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Article queue is unavailable.");
      setArticles(payload.articles ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Article queue is unavailable.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/newsroom/sources", { credentials: "same-origin", cache: "no-store" })
        .then(async (response) => {
          const payload = (await response.json()) as { sources?: SourceRecord[]; error?: { message?: string } };
          if (!response.ok) throw new Error(payload.error?.message ?? "Source records are unavailable.");
          setSources(payload.sources ?? []);
          setMessage(
            payload.sources?.length
              ? `${payload.sources.length} source records are available.`
              : "Add at least one source record before saving a draft.",
          );
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "Source records are unavailable.");
        });
      void refreshArticles();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshArticles]);

  const selectedOne = sources.find((source) => source.id === form.sourceOneId) ?? null;
  const paragraphs = useMemo(
    () => form.body.split(/\n\s*\n/u).map((value) => value.trim()).filter(Boolean),
    [form.body],
  );
  const takeaways = useMemo(
    () => form.takeaways.split("\n").map((value) => value.trim()).filter(Boolean).slice(0, 12),
    [form.takeaways],
  );
  const uncertainties = useMemo(
    () => form.uncertainties.split("\n").map((value) => value.trim()).filter(Boolean).slice(0, 12),
    [form.uncertainties],
  );
  const wordCount = `${form.headline} ${form.subheadline} ${form.body}`.trim().split(/\s+/u).filter(Boolean).length;
  const canSave =
    form.slug.length >= 3 &&
    form.headline.trim().length >= 10 &&
    form.subheadline.trim().length >= 10 &&
    paragraphs.length > 0 &&
    form.centralClaim.trim().length >= 5 &&
    form.sourceOneId.length >= 8 &&
    form.sourceOneSummary.trim().length >= 10;

  function update<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(null);
    setAiResult(null);
  }

  function updateHeadline(value: string) {
    setForm((current) => ({
      ...current,
      headline: value,
      slug: current.slug || slugify(value),
    }));
    setSaved(null);
    setAiResult(null);
  }

  async function saveDraft() {
    if (saving) return;
    if (!canSave) {
      setMessage(
        `Complete these fields before saving: ${missingDraftFields({
          slug: form.slug,
          headline: form.headline,
          subheadline: form.subheadline,
          bodyParagraphs: paragraphs,
          centralClaim: form.centralClaim,
          sourceOneId: form.sourceOneId,
          sourceOneSummary: form.sourceOneSummary,
        }).join(", ")}.`,
      );
      return;
    }
    setSaving(true);
    setMessage("Saving an immutable first draft version…");
    try {
      const csrfToken = await getCsrfToken();
      const body = buildArticlePayload();
      const response = await fetch("/api/newsroom/articles", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        article?: SavedDraft;
        error?: { message?: string };
      };
      if (!response.ok || !payload.article) {
        throw new Error(payload.error?.message ?? "The draft could not be saved.");
      }
      setSaved(payload.article);
      await refreshArticles();
      setMessage(`Draft saved in ${payload.article.state} state. It has not been published.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The draft could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function researchAndGenerateDraft() {
    if (runningAi || form.headline.trim().length < 5) {
      setMessage("Add a clear story topic before starting AI research.");
      return;
    }

    setRunningAi(true);
    setSaved(null);
    setGeneratedPackage(null);
    setAiResult(null);

    const stages = [
      "Finding primary sources…",
      "Verifying independent sources…",
      "Extracting claims and conflicts…",
      "Building the article outline…",
      `Writing the ${formatTargetLabel(form.format)} draft…`,
      "Running the separate fact-review pass…",
      "Preparing SEO, social, and newsletter assets…",
    ];
    let stageIndex = 0;
    setResearchStage(stages[stageIndex]);
    setMessage("AI research started. The draft will still require human approval.");
    const progressTimer = window.setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, stages.length - 1);
      setResearchStage(stages[stageIndex]);
    }, 4_500);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch("/api/newsroom/ai/research-draft", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          headline: form.headline.trim(),
          category: form.category,
          requestedFormat: form.format,
          primaryQuery: form.primaryQuery.trim() || form.headline.trim(),
          sensitive: form.sensitive,
        }),
      });
      const payload = (await response.json()) as {
        draftPackage?: AutomatedDraftPackage;
        error?: { message?: string };
      };
      if (!response.ok || !payload.draftPackage) {
        throw new Error(
          payload.error?.message ?? "AI research and drafting are unavailable.",
        );
      }

      const draftPackage = payload.draftPackage;
      const sourcesResponse = await fetch("/api/newsroom/sources", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const sourcesPayload = (await sourcesResponse.json()) as {
        sources?: SourceRecord[];
      };
      const refreshedSources = sourcesPayload.sources ?? sources;
      setSources(refreshedSources);

      const primary =
        draftPackage.sources.find(
          (source) => source.sourceKind === "PRIMARY" && source.sourceId,
        ) ?? null;
      const independent =
        draftPackage.sources.find(
          (source) => source.sourceKind === "INDEPENDENT" && source.sourceId,
        ) ?? null;
      const body = draftPackage.article.sections
        .map(
          (section) =>
            `${section.heading}\n\n${section.paragraphs.join("\n\n")}`,
        )
        .join("\n\n");

      setForm((current) => ({
        ...current,
        slug: slugify(draftPackage.article.headline),
        category: current.category,
        format: draftPackage.recommendedFormat,
        headline: draftPackage.article.headline,
        subheadline: draftPackage.article.subheadline,
        body,
        takeaways: draftPackage.article.keyTakeaways.join("\n"),
        centralClaim: draftPackage.centralClaim,
        whyItMatters: draftPackage.article.whyItMatters,
        whatHappensNext: draftPackage.article.whatHappensNext,
        uncertainties: draftPackage.article.uncertainties.join("\n"),
        primaryQuery: draftPackage.seo.primaryQuery,
        sourceOneId: primary?.sourceId ?? "",
        sourceOneSummary: primary?.summary ?? "",
        sourceTwoId: independent?.sourceId ?? "",
        sourceTwoSummary: independent?.summary ?? "",
      }));
      setGeneratedPackage(draftPackage);
      setAiResult(draftPackage as unknown as Record<string, unknown>);
      setResearchStage(
        draftPackage.readyForHumanReview
          ? "Draft ready for human review."
          : "Draft created with review warnings.",
      );
      setMessage(
        `Generated ${draftPackage.metrics.actualWordCount} words from ${draftPackage.sources.length} sources in ${Math.round(
          draftPackage.metrics.durationMs / 1_000,
        )} seconds. Estimated AI cost: $${draftPackage.metrics.costUsd.toFixed(
          4,
        )}. Review every claim before saving.`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "AI research and drafting are unavailable.";
      setResearchStage(
        errorMessage.includes("blocked another charge")
          ? "Duplicate paid request blocked."
          : errorMessage.includes("timed out")
            ? "Provider timed out — no automatic retry."
            : "Research failed.",
      );
      setMessage(errorMessage);
    } finally {
      window.clearInterval(progressTimer);
      setRunningAi(false);
    }
  }

  async function regenerateSelectedSection() {
    if (regenerating || !generatedPackage) {
      setMessage("Generate a research-backed draft before regenerating a section.");
      return;
    }
    const requested = window
      .prompt(
        "Section to regenerate: headline, summary, or body",
        "body",
      )
      ?.trim()
      .toLowerCase();
    if (
      requested !== "headline" &&
      requested !== "summary" &&
      requested !== "body"
    ) {
      setMessage("Choose headline, summary, or body.");
      return;
    }
    const instruction = window.prompt(
      "What should improve? Facts and sources will remain locked.",
      requested === "body"
        ? "Improve clarity, structure, and reader value without adding facts."
        : "Make it clearer and more precise without changing the facts.",
    );
    if (!instruction || instruction.trim().length < 3) return;

    const currentContent =
      requested === "headline"
        ? form.headline
        : requested === "summary"
          ? form.subheadline
          : form.body;
    const sourceSummaries = generatedPackage.sources
      .map((source) => source.summary)
      .filter(Boolean);

    setRegenerating(true);
    setMessage(`Regenerating ${requested} from the locked evidence packet…`);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch("/api/newsroom/ai/regenerate-section", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          section: requested,
          instruction: instruction.trim(),
          currentContent,
          headline: form.headline,
          centralClaim: form.centralClaim,
          sourceSummaries,
          targetWords: generatedPackage.targetWords,
        }),
      });
      const payload = (await response.json()) as {
        regenerated?: {
          section: "headline" | "summary" | "body";
          content: string;
          factualPacketPreserved: boolean;
          notes: string[];
        };
        metadata?: { costUsd?: number };
        error?: { message?: string };
      };
      if (
        !response.ok ||
        !payload.regenerated ||
        !payload.regenerated.factualPacketPreserved
      ) {
        throw new Error(
          payload.error?.message ??
            "The section regeneration did not preserve the factual packet.",
        );
      }
      if (payload.regenerated.section === "headline") {
        updateHeadline(payload.regenerated.content);
      } else if (payload.regenerated.section === "summary") {
        update("subheadline", payload.regenerated.content);
      } else {
        update("body", payload.regenerated.content);
      }
      setMessage(
        `${requested} regenerated. Added facts were prohibited. Estimated cost: $${(
          payload.metadata?.costUsd ?? 0
        ).toFixed(4)}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The selected section could not be regenerated.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function verifyCentralClaim(article: EditorialArticle) {
    if (!article.centralClaimId || actingId) return;
    const notes = window.prompt(
      "Verification notes (minimum 20 characters). Confirm the primary evidence and independent support you reviewed.",
      "Reviewed the linked primary evidence and independent source summary; the central claim is supported as written.",
    );
    if (!notes || notes.trim().length < 20) {
      setMessage("Specific verification notes of at least 20 characters are required.");
      return;
    }
    setActingId(article.id);
    setMessage(`Verifying the central claim for ${article.headline ?? article.slug}…`);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/newsroom/articles/${article.id}/claims/${article.centralClaimId}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ verificationStatus: "VERIFIED", reviewNotes: notes.trim() }),
        },
      );
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Claim verification failed.");
      await refreshArticles();
      setMessage("The central claim was verified by the authorized reviewer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Claim verification failed.");
    } finally {
      setActingId(null);
    }
  }

  async function runWorkflowAction(
    article: EditorialArticle,
    action: "submit" | "approve" | "publish" | "archive" | "retract",
  ) {
    if (!article.currentVersionId || actingId) return;
    const defaultReason =
      action === "submit"
        ? "Editor completed the source packet and submitted the current version for accountable human review."
        : action === "approve"
          ? "Human reviewer completed the evidence, rights, risk, and editorial approval gates."
          : action === "publish"
            ? "Authorized publisher confirmed the approved version and production publication checklist."
            : action === "archive"
              ? "Removed from public listings by an editor. The published record is retained."
              : "Retracted after an editorial decision that the story should not have run.";
    const reason = window.prompt(
      `${ACTION_LABEL[action]} reason (minimum 20 characters)`,
      defaultReason,
    );
    if (!reason || reason.trim().length < 20) {
      setMessage("A specific reason of at least 20 characters is required.");
      return;
    }
    setActingId(article.id);
    setMessage(`${ACTION_PROGRESS[action]} ${article.headline ?? article.slug}…`);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/newsroom/articles/${article.id}`, {
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
        article?: SavedDraft;
        error?: { message?: string };
      };
      if (!response.ok || !payload.article) {
        throw new Error(payload.error?.message ?? `The ${action} action failed.`);
      }
      await refreshArticles();
      setMessage(`Article moved to ${payload.article.state}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `The ${action} action failed.`);
    } finally {
      setActingId(null);
    }
  }

  function buildArticlePayload() {
    const sourceLinks = [
      {
        sourceId: form.sourceOneId,
        relationship: selectedOne?.isPrimary ? "PRIMARY" : "CONTEXT",
        summary: form.sourceOneSummary.trim(),
      },
      ...(form.sourceTwoId && form.sourceTwoSummary.trim().length >= 10
        ? [{ sourceId: form.sourceTwoId, relationship: "INDEPENDENT", summary: form.sourceTwoSummary.trim() }]
        : []),
    ];
    const observedAt = new Date().toISOString();
    const evidence = sourceLinks.map((source) => ({
      sourceId: source.sourceId,
      relationship: source.relationship === "INDEPENDENT" ? "SUPPORTS" : "CONTEXT",
      sourceLocator: sources.find((item) => item.id === source.sourceId)?.domain ?? source.sourceId,
      observedAt,
    }));
    return {
      slug: form.slug,
      category: form.category,
      format: form.format,
      sensitive: form.sensitive,
      version: {
        headline: form.headline.trim(),
        subheadline: form.subheadline.trim(),
        body: [{ paragraphs }],
        keyTakeaways: takeaways,
        seo: {
          summary: form.subheadline.trim(),
          whyItMatters: form.whyItMatters.trim() || undefined,
          whatHappensNext: form.whatHappensNext.trim() || undefined,
          uncertainties,
          primaryQuery: form.primaryQuery.trim() || undefined,
          demandEstimate: "unknown",
        },
        structuredData: {},
        changeSummary: "Initial protected newsroom draft created from editor-supplied evidence.",
        sources: sourceLinks,
        claims: [
          {
            claimText: form.centralClaim.trim(),
            articleSection: "Main story",
            category: form.category,
            importance: "central",
            primaryEvidenceAvailable: Boolean(selectedOne?.isPrimary),
            verificationStatus: "UNVERIFIED",
            riskLevel: form.sensitive ? "HIGH" : "MEDIUM",
            reviewNotes: "Requires claim-level human verification before approval.",
            evidence,
          },
        ],
      },
    };
  }

  return (
    <NewsroomFrame activePath="/newsroom/editor">
      <div className="editor-workspace">
        <header className="editor-header">
          <div>
            <Link href="/newsroom" aria-label="Return to newsroom dashboard"><ArrowLeft aria-hidden="true" /></Link>
            <div>
              <span>PROTECTED EDITORIAL DRAFT</span>
              <strong>{form.headline || "Untitled article"}</strong>
            </div>
          </div>
          <div>
            <span className="editor-local-state">
              {saved ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
              {saved ? "Persisted in D1" : "Not saved"}
            </span>
            <button className="button-secondary" type="button" onClick={() => setForm(initialForm)}>
              <RefreshCw aria-hidden="true" /> New blank draft
            </button>
            <button
              className="button-primary"
              type="button"
              disabled={saving}
              aria-disabled={!canSave || saving}
              onClick={() => void saveDraft()}
            >
              <Save aria-hidden="true" /> {saving ? "Saving…" : "Save draft"}
            </button>
          </div>
        </header>

        <NewsroomNotice tone="warning">
          <strong>Human publication gate is enforced.</strong>
          <span>Saving creates a D1 draft and immutable version record. Approval and publication are separate permission-checked actions.</span>
        </NewsroomNotice>

        <section className="newsroom-panel editor-workflow-queue" aria-labelledby="editorial-queue-title">
          <div className="panel-heading">
            <div>
              <span>EDITORIAL DATABASE</span>
              <h2 id="editorial-queue-title">Draft and publication queue</h2>
            </div>
            <button className="button-secondary" type="button" onClick={() => void refreshArticles()}>
              <RefreshCw aria-hidden="true" /> Refresh
            </button>
          </div>
          <div className="newsroom-table-wrap">
            <table className="newsroom-table">
              <thead><tr><th>Article</th><th>Category</th><th>State</th><th>Updated</th><th>Action</th></tr></thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <th scope="row">{article.headline ?? article.slug}</th>
                    <td>{article.category}</td>
                    <td><StatusPill tone={article.state === "PUBLISHED" ? "success" : article.state === "APPROVED" ? "info" : "warning"}>{article.state}</StatusPill></td>
                    <td>{new Date(article.updatedAt).toLocaleString()}</td>
                    <td>
                      {["DRAFTING", "HUMAN_REVIEW_REQUIRED"].includes(article.state) &&
                      article.centralClaimStatus !== "VERIFIED" &&
                      article.centralClaimId ? (
                        <button
                          type="button"
                          disabled={
                            actingId === article.id ||
                            !article.centralClaimHasPrimaryEvidence
                          }
                          title={
                            article.centralClaimHasPrimaryEvidence
                              ? "Verify the central claim before approval."
                              : "Primary evidence is required before this claim can be verified."
                          }
                          onClick={() => void verifyCentralClaim(article)}
                        >
                          Verify central claim
                        </button>
                      ) : article.state === "DRAFTING" && article.currentVersionId ? (
                        <button type="button" disabled={actingId === article.id} onClick={() => void runWorkflowAction(article, "submit")}>Submit for review</button>
                      ) : article.state === "HUMAN_REVIEW_REQUIRED" &&
                        article.currentVersionId &&
                        article.sourceCount >= 2 &&
                        article.primarySourceCount >= 1 ? (
                        // The gate's refusal reasons ride with the button. An
                        // Approve control on its own reads as "nothing is
                        // wrong", and that is how an article held for a failed
                        // fact review and a four-year-old lede was approved.
                        <span className="article-row-approve">
                          {article.qualityReasons.length > 0 ? (
                            <span className="article-row-held">
                              <AlertTriangle aria-hidden="true" />
                              <span>
                                Held: {article.qualityReasons.map(heldReasonLabel).join(" · ")}
                                {article.qualityScore > 0
                                  ? ` · quality ${article.qualityScore}/100`
                                  : ""}
                              </span>
                            </span>
                          ) : null}
                          <button type="button" disabled={actingId === article.id} onClick={() => void runWorkflowAction(article, "approve")}>Approve</button>
                        </span>
                      ) : article.state === "HUMAN_REVIEW_REQUIRED" ? (
                        <span title="Approval requires at least two linked sources, including one primary source.">
                          Evidence incomplete
                        </span>
                      ) : article.state === "APPROVED" && article.currentVersionId ? (
                        <button type="button" disabled={actingId === article.id} onClick={() => void runWorkflowAction(article, "publish")}>Publish</button>
                      ) : ["PUBLISHED", "DEVELOPING", "UPDATED", "CORRECTED"].includes(article.state) ? (
                        <span className="article-row-actions">
                          <Link href={`/story/${article.slug}`}>View</Link>
                          {/* Taking a story down is a state change, never a
                              delete: the published record has to survive. */}
                          <button
                            type="button"
                            disabled={actingId === article.id}
                            onClick={() => void runWorkflowAction(article, "archive")}
                            title="Remove from the site and the sitemap. The record is kept."
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            disabled={actingId === article.id}
                            onClick={() => void runWorkflowAction(article, "retract")}
                            title="Withdraw on the record. Requires a stated reason."
                          >
                            Retract
                          </button>
                        </span>
                      ) : (
                        <span>Review state</span>
                      )}
                    </td>
                  </tr>
                ))}
                {articles.length === 0 ? <tr><td colSpan={5}>No database articles yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="editor-layout editor-layout--production">
          <aside className="editor-outline" aria-label="Draft outline">
            <p>DOCUMENT</p>
            {[
              ["draft-identity", "Identity"],
              ["draft-headline", "Headline"],
              ["draft-body", "Story body"],
              ["draft-evidence", "Evidence"],
              ["draft-context", "Context"],
            ].map(([href, label], index) => (
              <a key={href} href={`#${href}`}><span>{index + 1}</span>{label}</a>
            ))}
            <div className="editor-outline__score"><FileText aria-hidden="true" /><p><span>Word count</span><strong>{wordCount}</strong></p></div>
          </aside>

          <section className="editor-canvas" aria-labelledby="draft-editor-title">
            <h1 className="sr-only" id="draft-editor-title">Create article draft</h1>
            <div className="editor-document editor-document--production">
              <fieldset id="draft-identity" className="editor-fieldset">
                <legend>Article identity</legend>
                <div className="editor-grid">
                  <label>Slug<input value={form.slug} onChange={(event) => update("slug", slugify(event.target.value))} placeholder="verified-story-slug" /></label>
                  <label>Category<select value={form.category} onChange={(event) => update("category", event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label>Format<select value={form.format} onChange={(event) => update("format", event.target.value)}>{formats.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label className="editor-check"><input type="checkbox" checked={form.sensitive} onChange={(event) => update("sensitive", event.target.checked)} /> Sensitive/high-risk coverage</label>
                </div>
              </fieldset>

              <label htmlFor="draft-headline">Headline</label>
              <textarea id="draft-headline" className="editor-field editor-field--headline" value={form.headline} onChange={(event) => updateHeadline(event.target.value)} placeholder="Write a factual, specific headline" />
              <label htmlFor="draft-dek">Summary / dek</label>
              <textarea id="draft-dek" className="editor-field editor-field--dek" value={form.subheadline} onChange={(event) => update("subheadline", event.target.value)} placeholder="Explain the verified development and why it matters" />
              <label htmlFor="draft-body">Story body</label>
              <textarea id="draft-body" className="editor-field editor-field--body" value={form.body} onChange={(event) => update("body", event.target.value)} placeholder="Separate paragraphs with a blank line. Do not paste unsupported claims or copyrighted article text." />

              <fieldset id="draft-evidence" className="editor-fieldset">
                <legend>Evidence and claims</legend>
                <label>Central claim<textarea value={form.centralClaim} onChange={(event) => update("centralClaim", event.target.value)} placeholder="One central claim that a reviewer can verify" /></label>
                <div className="editor-grid">
                  <label>Primary/context source<select value={form.sourceOneId} onChange={(event) => update("sourceOneId", event.target.value)}><option value="">Select source</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} · Tier {source.credibilityTier}</option>)}</select></label>
                  <label>Independent source<select value={form.sourceTwoId} onChange={(event) => update("sourceTwoId", event.target.value)}><option value="">Optional second source</option>{sources.filter((source) => source.id !== form.sourceOneId).map((source) => <option key={source.id} value={source.id}>{source.name} · Tier {source.credibilityTier}</option>)}</select></label>
                </div>
                <label>What the first source supports<textarea value={form.sourceOneSummary} onChange={(event) => update("sourceOneSummary", event.target.value)} /></label>
                <label>What the independent source supports<textarea value={form.sourceTwoSummary} onChange={(event) => update("sourceTwoSummary", event.target.value)} /></label>
                {!sources.length ? <p><Link href="/newsroom/sources">Add verified source records first</Link>.</p> : null}
              </fieldset>

              <fieldset id="draft-context" className="editor-fieldset">
                <legend>Reader context and SEO</legend>
                <label>Key takeaways — one per line<textarea value={form.takeaways} onChange={(event) => update("takeaways", event.target.value)} /></label>
                <label>Why it matters<textarea value={form.whyItMatters} onChange={(event) => update("whyItMatters", event.target.value)} /></label>
                <label>What happens next<textarea value={form.whatHappensNext} onChange={(event) => update("whatHappensNext", event.target.value)} /></label>
                <label>Uncertainties — one per line<textarea value={form.uncertainties} onChange={(event) => update("uncertainties", event.target.value)} /></label>
                <label>Primary search query<input value={form.primaryQuery} onChange={(event) => update("primaryQuery", event.target.value)} /></label>
              </fieldset>

              {saved ? (
                <div className="editor-save-result">
                  <CheckCircle2 aria-hidden="true" />
                  <div><strong>Draft persisted</strong><span>Article {saved.articleId} · version {saved.versionId} · {saved.state}</span></div>
                </div>
              ) : null}
              {aiResult ? (
                <details className="editor-ai-result">
                  <summary>Open AI research, fact review, SEO, and distribution package</summary>
                  <pre>{JSON.stringify(aiResult, null, 2)}</pre>
                </details>
              ) : null}
            </div>
          </section>

          <aside className="editor-copilot" aria-labelledby="copilot-title">
            <div className="editor-copilot__head"><Sparkles aria-hidden="true" /><div><strong id="copilot-title">Editorial AI</strong><span>Research, draft, and fact review</span></div></div>
            <p>One protected workflow finds current sources, writes to the configured length profile, prepares SEO and distribution assets, and stops at human review.</p>
            <div className="editor-ai-progress" aria-live="polite">
              <span className={runningAi ? "is-running" : undefined} />
              <strong>{researchStage}</strong>
            </div>
            <button className="button-primary" type="button" disabled={runningAi || form.headline.trim().length < 5} onClick={() => void researchAndGenerateDraft()}>
              <Sparkles aria-hidden="true" /> {runningAi ? "Researching and writing…" : "Research & generate draft"}
            </button>
            <button className="button-secondary" type="button" disabled={!generatedPackage || runningAi || regenerating} onClick={() => void regenerateSelectedSection()}>
              <RefreshCw aria-hidden="true" /> {regenerating ? "Regenerating…" : "Regenerate selected section"}
            </button>
            {generatedPackage ? (
              <div className="editor-ai-metrics">
                <span><strong>{generatedPackage.metrics.actualWordCount}</strong> words</span>
                <span><strong>{generatedPackage.sources.length}</strong> sources</span>
                <span><strong>${generatedPackage.metrics.costUsd.toFixed(4)}</strong> cost</span>
                <span><strong>{generatedPackage.factReview.blocking ? "Blocked" : "Passed"}</strong> fact review</span>
              </div>
            ) : null}
            {generatedPackage?.qualityFlags.length ? (
              <ul className="editor-ai-warnings">
                {generatedPackage.qualityFlags.map((flag) => <li key={flag}>{flag}</li>)}
              </ul>
            ) : null}
            <div className="editor-copilot__boundary"><ShieldCheck aria-hidden="true" /><span>No model is permitted to approve or publish an article.</span></div>
            <StatusPill tone={saved ? "success" : generatedPackage?.readyForHumanReview ? "info" : "warning"}>{saved ? "Draft saved" : generatedPackage?.readyForHumanReview ? "Human review required" : "Generate draft"}</StatusPill>
          </aside>
        </div>
        <p className="editor-message" aria-live="polite">{message}</p>
      </div>
    </NewsroomFrame>
  );
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/newsroom/csrf", { credentials: "same-origin" });
  const payload = (await response.json()) as { csrfToken?: string; error?: { message?: string } };
  if (!response.ok || !payload.csrfToken) throw new Error(payload.error?.message ?? "CSRF protection is unavailable.");
  return payload.csrfToken;
}

function formatTargetLabel(format: string): string {
  if (format === "QUICK_BRIEF" || format === "NEWS_FLASH") return "650–1,200 word";
  if (format === "DEEP_EXPLAINER" || format === "SOURCE_COMPARISON") {
    return "2,200–4,000 word";
  }
  if (format === "WHY_TRENDING") return "1,000–1,800 word";
  return "1,200–2,000 word";
}

function missingDraftFields(input: {
  slug: string;
  headline: string;
  subheadline: string;
  bodyParagraphs: readonly string[];
  centralClaim: string;
  sourceOneId: string;
  sourceOneSummary: string;
}): string[] {
  const missing: string[] = [];
  if (input.slug.trim().length < 3) missing.push("slug");
  if (input.headline.trim().length < 10) missing.push("headline");
  if (input.subheadline.trim().length < 10) missing.push("summary/dek");
  if (input.bodyParagraphs.length === 0) missing.push("story body");
  if (input.centralClaim.trim().length < 5) missing.push("central claim");
  if (input.sourceOneId.trim().length < 8) missing.push("primary source");
  if (input.sourceOneSummary.trim().length < 10) {
    missing.push("what the primary source supports");
  }
  return missing;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 180);
}
