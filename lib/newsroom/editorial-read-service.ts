import { desc, eq, inArray } from "drizzle-orm";
import { storyClusters, trends } from "../../db/schema";
import { getD1Binding, getDb } from "../../db";
import {
  candidateQueue as fixtureCandidates,
  trends as fixtureTrends,
} from "../../dev/fixtures/site-data";
import { resolveContentMode } from "../content";
import type { Trend } from "../site/types";

export type NewsroomCandidate = {
  id: string;
  title: string;
  category: string;
  score: number;
  risk: string;
  state: string;
  sources: number;
  primary: number;
};

export type ResearchCandidate = {
  id: string;
  term: string;
  category: string;
  score: number;
  risk: string;
  state: string;
  opportunityState: string | null;
  recommendedFormat: string | null;
  observationCount: number;
  sourceFamilies: string[];
  explanation: string;
  latestDetectedAt: string;
};

export type ResearchSourceSummary = {
  id: string;
  name: string;
  domain: string;
  sourceType: string;
  credibilityTier: number;
  isPrimary: boolean;
  licensingStatus: string;
};

export type ResearchArticleSummary = {
  id: string;
  slug: string;
  headline: string | null;
  category: string;
  state: string;
  updatedAt: string;
};

export type ResearchWorkspaceData = {
  candidates: ResearchCandidate[];
  sources: ResearchSourceSummary[];
  articles: ResearchArticleSummary[];
};

export type IntelligenceOpportunity = {
  id: string;
  trendId: string;
  term: string;
  category: string;
  score: number;
  risk: string;
  state: string;
  recommendedFormat: string;
  explanation: string;
  updatedAt: string;
};

export type IntelligenceJob = {
  id: string;
  jobType: string;
  state: string;
  attempt: number;
  errorCode: string | null;
  startedAt: string;
};

export type IntelligenceWorkspaceData = {
  metrics: {
    totalTrends: number;
    observedSignals: number;
    researchCandidates: number;
    activeOpportunities: number;
    draftArticles: number;
    reviewArticles: number;
    approvedArticles: number;
    publishedArticles: number;
    failedJobs: number;
  };
  opportunities: IntelligenceOpportunity[];
  jobs: IntelligenceJob[];
  categories: Array<{ category: string; count: number }>;
};

export type ReviewArticleSummary = {
  id: string;
  slug: string;
  headline: string | null;
  subheadline: string | null;
  category: string;
  format: string;
  state: string;
  risk: string;
  sensitive: boolean;
  currentVersionId: string | null;
  qualityScore: number;
  /** Why the pipeline held this article, e.g. "missing_primary_source". */
  qualityReasons: string[];
  centralClaimId: string | null;
  centralClaimText: string | null;
  centralClaimStatus: string | null;
  centralClaimHasPrimaryEvidence: boolean;
  evidenceCount: number;
  updatedAt: string;
};

export type ReviewWorkspaceData = {
  articles: ReviewArticleSummary[];
};

export async function getNewsroomCandidates(): Promise<NewsroomCandidate[]> {
  if (resolveContentMode() === "DEMO_FIXTURES") {
    return fixtureCandidates.map((candidate, index) => ({
      id: `demo-candidate-${index + 1}`,
      ...candidate,
    }));
  }
  const db = await getDb();
  const rows = await db
    .select({
      id: trends.id,
      title: storyClusters.title,
      fallbackTitle: trends.originalTerm,
      category: trends.category,
      score: trends.score,
      risk: trends.riskLevel,
      state: trends.editorialState,
    })
    .from(trends)
    .leftJoin(storyClusters, eq(trends.storyClusterId, storyClusters.id))
    .where(
      inArray(trends.editorialState, [
        "CANDIDATE",
        "RESEARCHING",
        "SOURCE_INSUFFICIENT",
        "RESEARCH_COMPLETE",
        "OUTLINING",
        "DRAFTING",
        "FACT_REVIEW",
        "HUMAN_REVIEW_REQUIRED",
        "REVISION_REQUIRED",
      ]),
    )
    .orderBy(desc(trends.score), desc(trends.latestDetectedAt))
    .limit(50);
  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? row.fallbackTitle,
    category: row.category,
    score: row.score,
    risk: row.risk,
    state: row.state,
    sources: 0,
    primary: 0,
  }));
}

export async function getNewsroomTrends(): Promise<Trend[]> {
  if (resolveContentMode() === "DEMO_FIXTURES") return fixtureTrends;
  const db = await getD1Binding();
  const result = await db
    .prepare(
      `SELECT t.id, t.original_term AS term, t.category,
        t.search_velocity AS velocity, t.score, t.editorial_state AS state,
        t.risk_level AS risk, t.geographic_market AS regions,
        t.score_explanation_json AS explanation,
        t.latest_detected_at AS latestDetectedAt,
        s.slug,
        (SELECT COUNT(*) FROM trend_signal_observations o
          WHERE o.normalized_topic = t.normalized_term) AS observationCount,
        (SELECT GROUP_CONCAT(DISTINCT o.metric_source)
          FROM trend_signal_observations o
          WHERE o.normalized_topic = t.normalized_term) AS sourceFamilies
       FROM trends t
       LEFT JOIN story_clusters s ON s.id = t.story_cluster_id
       WHERE t.editorial_state NOT IN ('ARCHIVED','REJECTED_EARLY')
       ORDER BY t.score DESC, t.latest_detected_at DESC
       LIMIT 100`,
    )
    .all<{
      id: string;
      term: string;
      category: string;
      velocity: number;
      score: number;
      state: string;
      risk: string;
      regions: string;
      explanation: string;
      latestDetectedAt: number;
      slug: string | null;
      observationCount: number;
      sourceFamilies: string | null;
    }>();
  return result.results.map((row, index) => ({
    id: row.id,
    rank: index + 1,
    term: row.term,
    category: row.category,
    velocity: row.velocity,
    score: row.score,
    state: row.state,
    risk: row.risk,
    latestDetectedAt: new Date(row.latestDetectedAt).toISOString(),
    observationCount: Number(row.observationCount ?? 0),
    sourceFamilies: commaList(row.sourceFamilies),
    regions: [row.regions],
    explanation: publicExplanation(row.explanation),
    confidence: row.score >= 70 ? "High" : "Medium",
    related: [],
    storySlug: row.slug ?? undefined,
  }));
}

export async function getResearchWorkspaceData(): Promise<ResearchWorkspaceData> {
  const db = await getD1Binding();
  const [candidateResult, sourceResult, articleResult] = await Promise.all([
    db
      .prepare(
        `SELECT t.id, t.original_term AS term, t.category, t.score,
          t.risk_level AS risk, t.editorial_state AS state,
          t.score_explanation_json AS explanation,
          t.latest_detected_at AS latestDetectedAt,
          o.state AS opportunityState,
          o.recommended_format AS recommendedFormat,
          (SELECT COUNT(*) FROM trend_signal_observations x
            WHERE x.normalized_topic = t.normalized_term) AS observationCount,
          (SELECT GROUP_CONCAT(DISTINCT x.metric_source)
            FROM trend_signal_observations x
            WHERE x.normalized_topic = t.normalized_term) AS sourceFamilies
         FROM trends t
         LEFT JOIN story_opportunities o ON o.trend_id = t.id
         WHERE t.editorial_state IN (
           'SIGNAL_DETECTED','NORMALIZED','CLUSTERED','CANDIDATE',
           'RESEARCHING','SOURCE_INSUFFICIENT','RESEARCH_COMPLETE'
         )
         ORDER BY CASE WHEN o.state='RESEARCH' THEN 0 ELSE 1 END,
           t.score DESC, t.latest_detected_at DESC
         LIMIT 100`,
      )
      .all<{
        id: string;
        term: string;
        category: string;
        score: number;
        risk: string;
        state: string;
        explanation: string;
        latestDetectedAt: number;
        opportunityState: string | null;
        recommendedFormat: string | null;
        observationCount: number;
        sourceFamilies: string | null;
      }>(),
    db
      .prepare(
        `SELECT id, name, domain, source_type AS sourceType,
          credibility_tier AS credibilityTier, is_primary AS isPrimary,
          licensing_status AS licensingStatus
         FROM sources
         ORDER BY is_primary DESC, credibility_tier ASC, name ASC
         LIMIT 100`,
      )
      .all<{
        id: string;
        name: string;
        domain: string;
        sourceType: string;
        credibilityTier: number;
        isPrimary: number;
        licensingStatus: string;
      }>(),
    db
      .prepare(
        `SELECT a.id, a.slug, a.category, a.state,
          v.headline, a.updated_at AS updatedAt
         FROM articles a
         LEFT JOIN article_versions v ON v.id = a.current_version_id
         ORDER BY a.updated_at DESC LIMIT 30`,
      )
      .all<{
        id: string;
        slug: string;
        category: string;
        state: string;
        headline: string | null;
        updatedAt: number;
      }>(),
  ]);

  return {
    candidates: candidateResult.results.map((row) => ({
      ...row,
      observationCount: Number(row.observationCount ?? 0),
      sourceFamilies: commaList(row.sourceFamilies),
      explanation: publicExplanation(row.explanation),
      latestDetectedAt: new Date(row.latestDetectedAt).toISOString(),
    })),
    sources: sourceResult.results.map((row) => ({
      ...row,
      isPrimary: row.isPrimary === 1,
    })),
    articles: articleResult.results.map((row) => ({
      ...row,
      updatedAt: new Date(row.updatedAt).toISOString(),
    })),
  };
}

export async function getIntelligenceWorkspaceData(): Promise<IntelligenceWorkspaceData> {
  const db = await getD1Binding();
  const [metrics, opportunities, jobs, categories] = await Promise.all([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM trends) AS totalTrends,
          (SELECT COUNT(*) FROM trend_signal_observations) AS observedSignals,
          (SELECT COUNT(*) FROM trends WHERE editorial_state IN ('CANDIDATE','RESEARCHING','RESEARCH_COMPLETE')) AS researchCandidates,
          (SELECT COUNT(*) FROM story_opportunities WHERE state IN ('RESEARCH','WATCH')) AS activeOpportunities,
          (SELECT COUNT(*) FROM articles WHERE state IN ('DRAFTING','REVISION_REQUIRED')) AS draftArticles,
          (SELECT COUNT(*) FROM articles WHERE state='HUMAN_REVIEW_REQUIRED') AS reviewArticles,
          (SELECT COUNT(*) FROM articles WHERE state IN ('APPROVED','SCHEDULED')) AS approvedArticles,
          (SELECT COUNT(*) FROM articles WHERE state IN ('PUBLISHED','DEVELOPING','UPDATED','CORRECTED')) AS publishedArticles,
          (SELECT COUNT(*) FROM job_runs WHERE state='FAILED') AS failedJobs`,
      )
      .first<{
        totalTrends: number;
        observedSignals: number;
        researchCandidates: number;
        activeOpportunities: number;
        draftArticles: number;
        reviewArticles: number;
        approvedArticles: number;
        publishedArticles: number;
        failedJobs: number;
      }>(),
    db
      .prepare(
        `SELECT o.id, o.trend_id AS trendId, t.original_term AS term,
          t.category, t.score, t.risk_level AS risk, o.state,
          o.recommended_format AS recommendedFormat, o.explanation,
          o.updated_at AS updatedAt
         FROM story_opportunities o
         JOIN trends t ON t.id = o.trend_id
         ORDER BY CASE o.state WHEN 'RESEARCH' THEN 0 WHEN 'WATCH' THEN 1 ELSE 2 END,
          t.score DESC, o.updated_at DESC
         LIMIT 50`,
      )
      .all<{
        id: string;
        trendId: string;
        term: string;
        category: string;
        score: number;
        risk: string;
        state: string;
        recommendedFormat: string;
        explanation: string;
        updatedAt: number;
      }>(),
    db
      .prepare(
        `SELECT id, job_type AS jobType, state, attempt, error_code AS errorCode,
          started_at AS startedAt
         FROM job_runs ORDER BY started_at DESC LIMIT 20`,
      )
      .all<{
        id: string;
        jobType: string;
        state: string;
        attempt: number;
        errorCode: string | null;
        startedAt: number;
      }>(),
    db
      .prepare(
        `SELECT category, COUNT(*) AS count FROM trends
         WHERE editorial_state NOT IN ('ARCHIVED','REJECTED_EARLY')
         GROUP BY category ORDER BY count DESC, category ASC LIMIT 20`,
      )
      .all<{ category: string; count: number }>(),
  ]);

  const safeMetrics = metrics ?? {
    totalTrends: 0,
    observedSignals: 0,
    researchCandidates: 0,
    activeOpportunities: 0,
    draftArticles: 0,
    reviewArticles: 0,
    approvedArticles: 0,
    publishedArticles: 0,
    failedJobs: 0,
  };
  return {
    metrics: Object.fromEntries(
      Object.entries(safeMetrics).map(([key, value]) => [key, Number(value ?? 0)]),
    ) as IntelligenceWorkspaceData["metrics"],
    opportunities: opportunities.results.map((row) => ({
      ...row,
      updatedAt: new Date(row.updatedAt).toISOString(),
    })),
    jobs: jobs.results.map((row) => ({
      ...row,
      startedAt: new Date(row.startedAt).toISOString(),
    })),
    categories: categories.results.map((row) => ({
      category: row.category,
      count: Number(row.count ?? 0),
    })),
  };
}

export async function getReviewWorkspaceData(): Promise<ReviewWorkspaceData> {
  const db = await getD1Binding();
  const result = await db
    .prepare(
      `SELECT a.id, a.slug, a.category, a.format, a.state,
        a.risk_level AS risk, a.sensitive,
        a.current_version_id AS currentVersionId,
        v.headline, v.subheadline, v.quality_score AS qualityScore,
        v.quality_explanation_json AS qualityExplanationJson,
        c.id AS centralClaimId, c.claim_text AS centralClaimText,
        c.verification_status AS centralClaimStatus,
        c.primary_evidence_available AS centralClaimHasPrimaryEvidence,
        (SELECT COUNT(*) FROM evidence e WHERE e.claim_id = c.id) AS evidenceCount,
        a.updated_at AS updatedAt
       FROM articles a
       LEFT JOIN article_versions v ON v.id = a.current_version_id
       LEFT JOIN claims c ON c.article_version_id = a.current_version_id
         AND c.importance = 'central'
       WHERE a.state NOT IN ('ARCHIVED','RETRACTED')
       ORDER BY CASE a.state
         WHEN 'HUMAN_REVIEW_REQUIRED' THEN 0
         WHEN 'APPROVED' THEN 1
         WHEN 'REVISION_REQUIRED' THEN 2
         WHEN 'DRAFTING' THEN 3
         ELSE 4 END,
         a.updated_at DESC
       LIMIT 100`,
    )
    .all<{
      id: string;
      slug: string;
      headline: string | null;
      subheadline: string | null;
      category: string;
      format: string;
      state: string;
      risk: string;
      sensitive: number;
      currentVersionId: string | null;
      qualityScore: number;
      qualityExplanationJson: string | null;
      centralClaimId: string | null;
      centralClaimText: string | null;
      centralClaimStatus: string | null;
      centralClaimHasPrimaryEvidence: number | null;
      evidenceCount: number;
      updatedAt: number;
    }>();
  return {
    articles: result.results.map(({ qualityExplanationJson, ...row }) => ({
      ...row,
      sensitive: row.sensitive === 1,
      centralClaimHasPrimaryEvidence:
        row.centralClaimHasPrimaryEvidence === 1,
      evidenceCount: Number(row.evidenceCount ?? 0),
      qualityScore: Number(row.qualityScore ?? 0),
      qualityReasons: readQualityReasons(qualityExplanationJson),
      updatedAt: new Date(row.updatedAt).toISOString(),
    })),
  };
}

function readQualityReasons(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function publicExplanation(value: string): string {
  try {
    const parsed = JSON.parse(value) as {
      publicExplanation?: unknown;
      summary?: unknown;
      reasons?: unknown;
    };
    if (typeof parsed.publicExplanation === "string") {
      return parsed.publicExplanation;
    }
    if (typeof parsed.summary === "string") return parsed.summary;
    if (Array.isArray(parsed.reasons)) {
      const first = parsed.reasons.find(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      );
      if (first) return first;
    }
  } catch {
    // Malformed internal JSON is never rendered.
  }
  return "No public explanation has been recorded.";
}

function commaList(value: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}
