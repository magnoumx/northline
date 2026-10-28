import { getD1Binding, getDb } from "../../db";
import { createAiGateway, createD1AiWorkflowLedger, EditorialAiGateway } from "../ai";
import { AiRuntimeError } from "../ai/errors";
import { prepareAiReviewPackage, type SelectedEvidence } from "../editorial/ai-workflow";
import {
  AutonomousTopicNotReportableError,
  runAutonomousNewsroomStory,
} from "../editorial/autonomous-newsroom";
import {
  EditorialWriteError,
  publishApprovedArticle,
} from "../editorial/article-write-service";
import { GdeltTrendConnector } from "../connectors/gdelt";
import { GoogleTrendsConnector } from "../connectors/google-trends";
import type { TrendSignal } from "../connectors/types";
import { ConnectorRunner } from "../connectors/runner";
import { resolveConnectorRuntimeConfiguration } from "../connectors/config";
import {
  allocateDailyCapacity,
  decideDailyCapacity,
} from "../editorial/daily-capacity";
import { resolveRuntimeConfig } from "../editorial/runtime-config";
import {
  planIndexNowSubmission,
  submitToIndexNow,
} from "../distribution/indexnow";
import {
  composeIssue,
  renderIssue,
} from "../newsletter/issue-composition";
import { deliverNewsletterIssue } from "../newsletter/delivery";
import {
  createMediaOnlyRevision,
  MediaRevisionError,
} from "../editorial/media-revision";
import { registerLicensedCommonsMedia } from "../media/commons-editorial";
import {
  registerAiIllustration,
  workersAiRunner,
} from "../media/ai-illustration";
import { selectEditorialVideo } from "../media/video-verification";
import { discoverOfficialVideos } from "../media/youtube-discovery";
import { sha256Base64Url } from "../security/crypto";
import { normalizeTrendTerm } from "../editorial/normalization";
import { scoreTrend } from "../editorial/trend-scoring";
import { createD1ArticleAudioRepository } from "../audio/d1-repository";
import { buildNarrationDocument } from "../audio/narration";
import { readArticleAudioConfig } from "../audio/config";
import { ArticleAudioError } from "../audio/errors";
import { createArticleAudioAdapterRegistry, type ProviderExecutor } from "../audio/providers";
import { createR2ArticleAudioObjectStore } from "../audio/storage";
import { executeArticleAudioGeneration } from "../audio/workflow";
import { createArticleAudioService } from "../audio/service";
import type { ArticleAudioRecord, ServerAudioProvider } from "../audio/types";
import type { JobServices, QueueJobMessage } from "./consumer";

export type NorthlineJobServices = JobServices & {
  DB?: D1Database;
  ARTICLE_AUDIO?: R2Bucket;
  MEDIA?: R2Bucket;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
  EDITORIAL_QUEUE?: Queue<unknown>;
  featureFlags?: Record<string, unknown>;
};

const TREND_QUERIES = [
  "United States",
  "technology OR artificial intelligence",
  "business OR economy",
  "science OR space",
  "sports OR entertainment",
] as const;
const DEFAULT_AUTO_PUBLISH_CATEGORIES = new Set([
  "US_NEWS",
  "TECHNOLOGY",
  "BUSINESS",
  "ENTERTAINMENT",
  "SPORTS",
  "GAMING",
  "SCIENCE",
  "INTERNET_TRENDS",
  "WEATHER",
]);
const DEFAULT_AUTO_PUBLISH_FORMATS = new Set([
  "QUICK_BRIEF",
  "STANDARD_NEWS",
  "DEEP_EXPLAINER",
  "WHY_TRENDING",
  "SOURCE_COMPARISON",
]);

export async function executeTrendRefresh(services: NorthlineJobServices): Promise<void> {
  const db = services.DB ?? (await getD1Binding());
  const environment = toStringEnvironment(services.featureFlags);
  const configuration = resolveConnectorRuntimeConfiguration(environment);
  const runner = new ConnectorRunner(configuration, {
    logger(event) {
      console.log(JSON.stringify({ event: "connector_runtime", ...event }));
    },
  });
  const observedAt = new Date();
  let enabledConnectors = 0;
  let successfulRuns = 0;
  let fetchedItems = 0;
  let persistedItems = 0;
  const failures: string[] = [];
  let runSequence = 0;

  if (configuration.googleTrendsEnabled) {
    enabledConnectors += 1;
    const startedAt = Date.now() + runSequence++;
    const result = await runner.run(
      new GoogleTrendsConnector(environment.GOOGLE_TRENDS_RSS_URL),
      { limit: 75 },
    );
    await persistConnectorRun({
      db,
      connectorId: result.connectorId,
      provider: "Google Trends Trending Now RSS",
      startedAt,
      result,
      categories: ["U.S.", "Technology", "Business", "Science", "Culture"],
      termsNotes:
        "Official Trending Now RSS metadata only; every resulting claim requires independent verification.",
    });
    if (result.ok) {
      successfulRuns += 1;
      fetchedItems += result.items.length;
      for (const signal of result.items) {
        if (
          await persistTrendSignal({
            db,
            signal,
            observedAt,
            category: categoryForTrendTitle(signal.title),
            metricSource: "GOOGLE_TRENDS",
            demandExplanation:
              "Google Trends U.S. Trending Now volume and rank are used as relative search-demand signals.",
            sourceConfidence: 0.68,
          })
        ) {
          persistedItems += 1;
        }
      }
    } else {
      failures.push(`${result.connectorId}:${result.code}:${result.errorMessage}`);
    }
  }

  if (configuration.gdeltEnabled) {
    enabledConnectors += 1;
    const connector = new GdeltTrendConnector();
    for (const query of TREND_QUERIES) {
      const startedAt = Date.now() + runSequence++;
      const result = await runner.run(connector, {
        query,
        limit: 30,
        since: new Date(observedAt.getTime() - 4 * 60 * 60 * 1_000),
      });
      await persistConnectorRun({
        db,
        connectorId: result.connectorId,
        provider: "GDELT DOC 2.0",
        startedAt,
        result,
        categories: [categoryForQuery(query)],
        termsNotes:
          "Public document-discovery metadata; source velocity is not proof of claim accuracy.",
      });
      if (!result.ok) {
        failures.push(`${result.connectorId}:${result.code}:${query}:${result.errorMessage}`);
        continue;
      }
      successfulRuns += 1;
      fetchedItems += result.items.length;
      for (const signal of result.items) {
        if (
          await persistTrendSignal({
            db,
            signal,
            observedAt,
            category: categoryForQuery(query),
            metricSource: "GDELT",
            demandExplanation:
              "GDELT article-list rank is used as a source-velocity and discovery signal, not as proof of search demand.",
            sourceConfidence: 0.6,
          })
        ) {
          persistedItems += 1;
        }
      }
    }
  }

  const summary = {
    enabledConnectors,
    successfulRuns,
    fetchedItems,
    persistedItems,
    failures,
  };
  console.log(JSON.stringify({ event: "trend_refresh_summary", ...summary }));

  if (enabledConnectors === 0) {
    throw new Error("TREND_REFRESH_NO_CONNECTORS_ENABLED");
  }
  if (successfulRuns === 0) {
    throw new Error(`TREND_REFRESH_ALL_CONNECTORS_FAILED:${failures.join("|")}`);
  }
  if (persistedItems === 0) {
    throw new Error(
      `TREND_REFRESH_EMPTY:fetched=${fetchedItems};failures=${failures.join("|")}`,
    );
  }
}

async function persistConnectorRun(input: {
  db: D1Database;
  connectorId: string;
  provider: string;
  startedAt: number;
  result:
    | {
        ok: true;
        connectorId: string;
        items: readonly TrendSignal[];
        health: {
          state: string;
          consecutiveFailures: number;
        };
      }
    | {
        ok: false;
        connectorId: string;
        code: string;
        errorMessage: string;
        health: {
          state: string;
          consecutiveFailures: number;
        };
      };
  categories: readonly string[];
  termsNotes: string;
}): Promise<void> {
  const completedAt = Date.now();
  const itemCount = "items" in input.result ? input.result.items.length : 0;
  const errorCategory = "code" in input.result ? input.result.code : null;
  const errorDigest =
    "errorMessage" in input.result ? input.result.errorMessage.slice(0, 500) : null;
  try {
    await input.db
      .prepare(
        `INSERT INTO connector_runs (
           id, connector_id, provider, state, credentials_state, terms_notes,
           rate_limit_json, markets_json, categories_json, cost_micros,
           item_count, started_at, completed_at, error_category, error_digest,
           circuit_state, failure_count
         ) VALUES (?1, ?2, ?3, ?4, 'NOT_REQUIRED', ?5, '{}', '["US"]', ?6,
           0, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      )
      .bind(
        `connector_run_${await shortHash(`${input.connectorId}:${input.startedAt}`)}`,
        input.connectorId,
        input.provider,
        input.result.ok ? "COMPLETED" : "FAILED",
        input.termsNotes,
        JSON.stringify(input.categories),
        itemCount,
        input.startedAt,
        completedAt,
        errorCategory,
        errorDigest,
        input.result.health.state.toUpperCase(),
        input.result.health.consecutiveFailures,
      )
      .run();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "connector_run_persist_failed",
        connectorId: input.connectorId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

async function persistTrendSignal(input: {
  db: D1Database;
  signal: TrendSignal;
  observedAt: Date;
  category: string;
  metricSource: "GOOGLE_TRENDS" | "GDELT";
  demandExplanation: string;
  sourceConfidence: number;
}): Promise<boolean> {
  const { db, signal, observedAt, category, metricSource } = input;
  const normalized = normalizeTrendTerm(signal.title);
  if (!normalized) return false;
  const score = scoreTrend({
    contributions: {
      usSearchDemand: sig(signal.score / 100, input.demandExplanation),
      freshnessAndVelocity: sig(
        freshnessScore(signal.observedAt, observedAt) / 100,
        "The signal is recent within the monitored U.S. discovery window.",
      ),
      newsImportance: sig(
        metricSource === "GOOGLE_TRENDS" ? 0.72 : 0.65,
        "The item belongs to an editor-approved U.S. news discovery channel.",
      ),
      sourceConfidence: sig(
        input.sourceConfidence,
        "The source URL is stored for research, while every claim still requires verification.",
      ),
      originalValueOpportunity: sig(
        0.6,
        "The topic may support original multi-source reporting or a useful explainer.",
      ),
      audienceRelevance: sig(
        0.82,
        "The discovery source is scoped to U.S. audience demand.",
      ),
      visualPotential: sig(0.3, "Visual availability is unknown until media review."),
      commercialSuitability: sig(
        0.45,
        "Commercial suitability is provisional before brand-safety review.",
      ),
      followUpPotential: sig(
        0.4,
        "Follow-up potential is inferred from recency and demand, not guaranteed.",
      ),
    },
    penalties: {
      legalAndReputationRisk: sig(
        0.05,
        "No high-risk classification has been established at signal stage.",
      ),
      weakVerification: sig(
        0.35,
        "This is a discovery signal and still requires independent verification.",
      ),
      duplicateCoverage: sig(
        0.1,
        "Exact duplicates are deduplicated by external identifier.",
      ),
      copyrightRisk: sig(0.05, "Only metadata and source links are stored."),
      sensationalismRisk: sig(
        0.05,
        "No headline rewrite occurs during ingestion.",
      ),
    },
  });
  const trendId = `trend_${await shortHash(`${signal.externalId}:${normalized}`)}`;
  const detectedAt = safeDate(signal.observedAt, observedAt).getTime();
  await db
    .prepare(
      `INSERT INTO trends (
         id, original_term, normalized_term, related_terms_json, category,
         entities_json, geographic_market, first_detected_at,
         latest_detected_at, search_velocity, source_velocity,
         social_velocity, us_relevance, commercial_value, novelty,
         visual_availability, primary_source_availability, risk_level,
         score, score_explanation_json, editorial_state, created_at, updated_at
       ) VALUES (?1, ?2, ?3, '[]', ?4, '[]', 'US', ?5, ?5, ?6, ?7, 0,
         82, 45, 58, 25, 0, 'LOW', ?8, ?9, 'SIGNAL_DETECTED', ?5, ?5)
       ON CONFLICT(id) DO UPDATE SET
         latest_detected_at=excluded.latest_detected_at,
         search_velocity=MAX(trends.search_velocity, excluded.search_velocity),
         source_velocity=trends.source_velocity + 1,
         score=MAX(trends.score, excluded.score),
         score_explanation_json=excluded.score_explanation_json,
         updated_at=excluded.updated_at`,
    )
    .bind(
      trendId,
      signal.title.slice(0, 500),
      normalized.slice(0, 500),
      category,
      detectedAt,
      Math.min(100, signal.score),
      1,
      score.score,
      JSON.stringify({
        connector: signal.connectorId,
        source: signal.source,
        url: signal.url,
        metadata: signal.metadata,
        reasons: score.explanation,
      }),
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO trend_signal_observations (
         id, normalized_topic, original_query, country, region, language,
         category, window, metric_type, relative_search_interest,
         search_growth_bps, news_source_velocity, metric_source,
         metric_confidence, provenance_json, first_detected_at,
         last_detected_at, observed_at, created_at, updated_at
       ) VALUES (?1, ?2, ?3, 'US', NULL, 'en', ?4, '4h',
         'RELATIVE_SEARCH_INTEREST', ?5, NULL, 1, ?6, 'MEDIUM', ?7,
         ?8, ?8, ?9, ?9, ?9)`,
    )
    .bind(
      `obs_${await shortHash(`${signal.externalId}:${observedAt.toISOString().slice(0, 13)}`)}`,
      normalized.slice(0, 500),
      signal.title.slice(0, 500),
      category,
      Math.min(100, signal.score),
      metricSource,
      JSON.stringify({
        url: signal.url,
        source: signal.source,
        externalId: signal.externalId,
        metadata: signal.metadata,
      }),
      detectedAt,
      observedAt.getTime(),
    )
    .run();
  return true;
}

/**
 * Clears drafts that will never reach publication on their own.
 *
 * News stops being news. A story held for a missing primary source is still
 * held a week later, by which point publishing it would be worse than not, and
 * meanwhile it sits in the queue making the real backlog unreadable - nineteen
 * of twenty-four HUMAN_REVIEW_REQUIRED drafts were older than three days.
 *
 * DRAFTING is swept for the same reason from the opposite end: it is the fixed
 * state every article is created in, and the autonomous pipeline only ever
 * moves it forward - to HUMAN_REVIEW_REQUIRED or APPROVED - as its last act. A
 * run that throws before that point (a timed-out call, an exhausted budget)
 * leaves the row in DRAFTING with nothing left running to finish it. Three
 * articles sat there for six to eight days before this swept them; a normal
 * run completes in well under an hour.
 *
 * `REJECTED_EARLY`, not `ARCHIVED`: the state machine offers both, but the
 * database trigger requires a timestamped frozen version for ARCHIVED, so a
 * draft that never published cannot legally enter it. That mismatch is why
 * nothing was clearing either queue on its own.
 *
 * Nothing published is touched, and the reason is recorded per article.
 */
async function retireStaleReviewBacklog(
  db: D1Database,
  environment: Record<string, string | undefined>,
): Promise<void> {
  const maxAgeHours = boundedInteger(
    environment.REVIEW_BACKLOG_MAX_AGE_HOURS,
    6,
    24 * 14,
    72,
  );
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  const stale = await db
    .prepare(
      `SELECT id FROM articles
       WHERE state IN ('HUMAN_REVIEW_REQUIRED', 'DRAFTING') AND created_at <= ?1
       LIMIT 25`,
    )
    .bind(cutoff)
    .all<{ id: string }>();
  if (stale.results.length === 0) return;

  await db
    .prepare(
      `UPDATE articles
       SET state = 'REJECTED_EARLY', human_approval_required = 0, updated_at = ?2
       WHERE state IN ('HUMAN_REVIEW_REQUIRED', 'DRAFTING') AND created_at <= ?1`,
    )
    .bind(cutoff, Date.now())
    .run();

  await recordJobDiagnostic(db, "article.autopublish", "review_backlog_retired", {
    articles: stale.results.length,
    maxAgeHours,
  });
}

/**
 * Keeps the operational tables from growing without bound. The trends table had
 * reached ~20k rows of mostly dead search queries and the story-runs table ~4k
 * of mostly exhausted failures; together they pushed the candidate query past
 * D1's per-query CPU limit and stopped drafting. This prunes what is safe to
 * lose - never a published article, its version, sources or media - in bounded
 * batches so the delete itself never trips the same limit.
 */
export async function executeDataHygiene(
  services: NorthlineJobServices,
): Promise<void> {
  const environment = toStringEnvironment(services.featureFlags);
  if (environment.FEATURE_DURABLE_JOBS !== "true") return;
  const db = services.DB ?? (await getD1Binding());
  const now = Date.now();
  const trendMaxAgeDays = boundedInteger(
    environment.DATA_HYGIENE_TREND_MAX_AGE_DAYS,
    7,
    120,
    21,
  );
  const runMaxAgeDays = boundedInteger(
    environment.DATA_HYGIENE_FAILED_RUN_MAX_AGE_DAYS,
    1,
    60,
    7,
  );
  const trendCutoff = now - trendMaxAgeDays * 86_400_000;
  const runCutoff = now - runMaxAgeDays * 86_400_000;
  const BATCH = 500;
  const MAX_BATCHES = 16;

  // Expired AI generation cache rows - a short-lived idempotency cache that
  // nothing reads once expired.
  const expiredAiRequests =
    (await db
      .prepare(`DELETE FROM ai_generation_requests WHERE expires_at < ?1`)
      .bind(now)
      .run()).meta.changes ?? 0;

  // Failed story runs past the retry window. They are no longer retryable and
  // every one is scanned by the candidate de-duplication on each draft cycle.
  let failedRunsDeleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const changed =
      (await db
        .prepare(
          `DELETE FROM autonomous_story_runs WHERE id IN (
             SELECT id FROM autonomous_story_runs
             WHERE state = 'FAILED' AND created_at < ?1
             LIMIT ?2)`,
        )
        .bind(runCutoff, BATCH)
        .run()).meta.changes ?? 0;
    failedRunsDeleted += changed;
    if (changed < BATCH) break;
  }

  // Dead trends: not re-detected in weeks and never turned into a story. The
  // autonomous_story_runs FK is ON DELETE CASCADE, so any leftover failed runs
  // go with them; trend_signals and story_opportunities are ON DELETE SET NULL.
  // A trend that produced or is producing an article (a non-failed run) is kept
  // so the provenance of a published story is never severed.
  let deadTrendsDeleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const changed =
      (await db
        .prepare(
          `DELETE FROM trends WHERE id IN (
             SELECT t.id FROM trends t
             WHERE t.latest_detected_at < ?1
               AND NOT EXISTS (
                 SELECT 1 FROM autonomous_story_runs r
                 WHERE r.trend_id = t.id AND r.state <> 'FAILED')
             LIMIT ?2)`,
        )
        .bind(trendCutoff, BATCH)
        .run()).meta.changes ?? 0;
    deadTrendsDeleted += changed;
    if (changed < BATCH) break;
  }

  // Finished job-run history past two weeks. Runs still in flight or awaiting
  // retry are never touched.
  const jobRunCutoff = now - boundedInteger(environment.DATA_HYGIENE_JOB_RUN_MAX_AGE_DAYS, 1, 90, 14) * 86_400_000;
  let jobRunsDeleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const changed =
      (await db
        .prepare(
          `DELETE FROM job_runs WHERE id IN (
             SELECT id FROM job_runs
             WHERE completed_at IS NOT NULL AND completed_at < ?1
             LIMIT ?2)`,
        )
        .bind(jobRunCutoff, BATCH)
        .run()).meta.changes ?? 0;
    jobRunsDeleted += changed;
    if (changed < BATCH) break;
  }
  await recordJobDiagnostic(db, "maintenance.data_hygiene", "cleaned", {
    expiredAiRequests,
    failedRunsDeleted,
    deadTrendsDeleted,
    jobRunsDeleted,
    trendMaxAgeDays,
    runMaxAgeDays,
  });
}

export async function executeApprovedArticleAutopublish(
  services: NorthlineJobServices,
): Promise<void> {
  const environment = toStringEnvironment(services.featureFlags);
  const db = services.DB ?? (await getD1Binding());
  // Three separate switches could each stop publication in silence, so a queue
  // of approved articles sat unpublished with the job reporting COMPLETED.
  const gate =
    environment.FEATURE_AUTO_PUBLISH !== "true"
      ? "feature_off"
      : environment.AUTO_PUBLISH_READINESS_APPROVED !== "true"
        ? "readiness_not_approved"
        : environment.AUTO_PUBLISH_MODE !== "approved_only"
          ? "mode_not_approved_only"
          : null;
  if (gate) {
    await recordJobDiagnostic(db, "article.autopublish", gate);
    return;
  }

  await retireStaleReviewBacklog(db, environment);
  const dailyLimit = resolveRuntimeConfig(environment).settings
    .publicationsPerDay;
  const allowedCategories = configuredAllowlist(
    environment.AUTO_PUBLISH_ALLOWED_CATEGORIES,
    DEFAULT_AUTO_PUBLISH_CATEGORIES,
  );
  const allowedFormats = configuredAllowlist(
    environment.AUTO_PUBLISH_ALLOWED_FORMATS,
    DEFAULT_AUTO_PUBLISH_FORMATS,
  );
  const now = Date.now();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const publishedToday = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM audit_logs
       WHERE actor_id = 'system:autopublish'
         AND action = 'ARTICLE_PUBLISHED'
         AND occurred_at >= ?1`,
    )
    .bind(dayStart.getTime())
    .first<{ count: number }>();
  const remaining = Math.max(0, dailyLimit - Number(publishedToday?.count ?? 0));
  if (remaining === 0) return;

  const candidates = await db
    .prepare(
      `SELECT id, slug, current_version_id AS currentVersionId, category, format
       FROM articles
       WHERE state = 'APPROVED'
         AND current_version_id IS NOT NULL
         AND sensitive = 0
         AND risk_level = 'LOW'
         AND human_approval_required = 0
         AND (scheduled_at IS NULL OR scheduled_at <= ?1)
       ORDER BY COALESCE(scheduled_at, updated_at) ASC, updated_at ASC
       LIMIT ?2`,
    )
    .bind(now, Math.min(100, remaining * 5))
    .all<{
      id: string;
      slug: string;
      currentVersionId: string;
      category: string;
      format: string;
    }>();

  const eligible = candidates.results
    .filter(
      (article) =>
        allowedCategories.has(article.category) &&
        allowedFormats.has(article.format),
    )
    .slice(0, remaining);
  await recordJobDiagnostic(db, "article.autopublish", "selected", {
    candidates: candidates.results.length,
    eligible: eligible.length,
    remaining,
  });

  const publishedUrls: string[] = [];
  for (const article of eligible) {
    try {
      await publishApprovedArticle(
        article.id,
        {
          expectedCurrentVersionId: article.currentVersionId,
          reason:
            "Automatically released after an approved editorial packet passed the configured publication policy.",
        },
        { userId: "system:autopublish", type: "PUBLISHER" },
        `autopublish:${article.id}:${article.currentVersionId}`,
      );
      publishedUrls.push(
        `${(environment.NEXT_PUBLIC_SITE_URL ?? "https://usnorthline.com").replace(/\/+$/u, "")}/story/${article.slug}`,
      );
    } catch (error) {
      // A swallowed conflict left nine approved articles unpublished with the
      // job still reporting success. The reason is recorded before the skip.
      await recordJobDiagnostic(db, "article.autopublish", "publish_failed", {
        articleId: article.id,
        code: error instanceof EditorialWriteError ? error.code : "UNKNOWN",
        message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
      });
      // An article the publication contract refuses is a decision about that
      // article, not a fault in the run. Treating it as a job failure meant one
      // unpublishable story stopped every other approved story behind it from
      // being released at all.
      if (
        error instanceof EditorialWriteError &&
        [
          "VERSION_CONFLICT",
          "NOT_FOUND",
          "PUBLICATION_PACKET_INCOMPLETE",
        ].includes(error.code)
      ) {
        continue;
      }
      throw error;
    }
  }

  // Announced only for URLs that actually published in this run.
  await announceToIndexNow(db, environment, publishedUrls);
}


/**
 * Tells the participating search engines that URLs changed.
 *
 * Called after publication rather than on a timer: the point of the protocol is
 * that a URL is announced the moment it changes. Announcing on a schedule would
 * be indistinguishable from spam and is how a key gets revoked.
 */
async function announceToIndexNow(
  db: D1Database,
  environment: Record<string, string | undefined>,
  urls: readonly string[],
): Promise<void> {
  const plan = planIndexNowSubmission({
    urls,
    siteUrl: environment.NEXT_PUBLIC_SITE_URL,
    key: environment.INDEXNOW_KEY,
  });

  if (!plan.ok) {
    // "Nothing changed" is the ordinary case and is not worth a record.
    if (plan.refusal.reason === "no_urls") return;
    await recordJobDiagnostic(db, "distribution.indexnow", "not_submitted", {
      reason: plan.refusal.reason,
      detail: plan.refusal.detail,
    });
    return;
  }

  const result = await submitToIndexNow(plan.submission);
  await recordJobDiagnostic(
    db,
    "distribution.indexnow",
    result.ok ? "submitted" : "rejected",
    result.ok
      ? { submitted: result.submitted, status: result.status }
      : { status: result.status, detail: result.detail },
  );
}

/**
 * A provider that has spent its daily quota answers every further request with
 * the same 429. Recording one cooldown row lets the next ninety-five scheduler
 * ticks skip the work instead of each starting stories that cannot be written.
 */
async function recordAiProviderCooldown(
  db: D1Database,
  environment: Record<string, string | undefined>,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const minutes = boundedInteger(
    environment.AI_RATE_LIMIT_COOLDOWN_MINUTES,
    1,
    1_440,
    60,
  );
  await recordJobDiagnostic(db, "ai.provider", "rate_limited", {
    ...detail,
    cooldownUntil: Date.now() + minutes * 60_000,
  });
}

/**
 * Returns the moment the newest rate-limit cooldown expires, or null when no
 * cooldown is open. Reading the audit log keeps the signal in the one place
 * operators already look for job history.
 */
async function readAiProviderCooldownUntil(
  db: D1Database,
): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT metadata_json AS metadataJson
       FROM audit_logs
       WHERE target_type='JOB' AND target_id='ai.provider'
         AND occurred_at > ?1
         AND action='JOB_DIAGNOSTIC' AND decision='rate_limited'
       ORDER BY occurred_at DESC LIMIT 1`,
    )
    // Indexed and bounded: a cooldown older than a day has long expired.
    .bind(Date.now() - 24 * 60 * 60 * 1000)
    .first<{ metadataJson: string | null }>();
  if (!row?.metadataJson) return null;
  try {
    const parsed: unknown = JSON.parse(row.metadataJson);
    const until =
      parsed && typeof parsed === "object"
        ? Number((parsed as Record<string, unknown>).cooldownUntil)
        : Number.NaN;
    if (!Number.isFinite(until) || until <= Date.now()) return null;
    return until;
  } catch {
    return null;
  }
}

export async function executeAutonomousDraftSchedule(
  services: NorthlineJobServices,
): Promise<void> {
  const environment = toStringEnvironment(services.featureFlags);
  if (environment.FEATURE_AUTONOMOUS_NEWSROOM !== "true") return;
  const queue = services.EDITORIAL_QUEUE;
  if (!queue) throw new Error("AUTONOMOUS_NEWSROOM_QUEUE_UNAVAILABLE");
  const db = services.DB ?? (await getD1Binding());
  const cooldownUntil = await readAiProviderCooldownUntil(db);
  if (cooldownUntil !== null) {
    await recordJobDiagnostic(db, "article.autodraft", "ai_provider_cooldown", {
      cooldownUntil,
    });
    return;
  }
  const batchSize = boundedInteger(environment.AUTONOMOUS_DRAFT_BATCH_SIZE, 1, 20, 2);
  const minimumScore =
    environment.AUTONOMOUS_PROCESS_ALL_ACTIVE_SIGNALS === "true"
      ? 0
      : boundedInteger(
          environment.AUTONOMOUS_MIN_TREND_SCORE,
          0,
          100,
          55,
        );
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const staleBefore = Date.now() - 45 * 60 * 1_000;
  await db
    .prepare(
      `UPDATE autonomous_story_runs
       SET state='FAILED',
         error_code='STALE_RUN_RECOVERED',
         error_message='A queued or running job exceeded the recovery window.',
         completed_at=?1,
         updated_at=?1
       WHERE state IN ('QUEUED','RUNNING')
         AND updated_at < ?2`,
    )
    .bind(Date.now(), staleBefore)
    .run();
  // Failed runs must not consume the day's story capacity. A provider
  // rate-limit that killed all thirteen midnight runs was counting as
  // "thirteen stories started today", so the capacity gate then refused every
  // retry until the next midnight - three full days produced nothing while the
  // key was throttled. A failed run produced no story and is still retryable
  // (bounded by attempt_count and the cost ceiling below), so it does not hold
  // a slot. Cost is still summed across every run, so a run that failed after
  // spending is still charged against the daily cost limit.
  const generated = await db.prepare(
    `SELECT COUNT(*) AS count FROM autonomous_story_runs
     WHERE created_at >= ?1 AND state <> 'FAILED'`,
  ).bind(dayStart.getTime()).first<{ count: number }>();
  const costToday = await db
    .prepare(
      `SELECT COALESCE(SUM(cost_micros), 0) AS costMicros
       FROM autonomous_story_runs
       WHERE created_at >= ?1`,
    )
    .bind(dayStart.getTime())
    .first<{ costMicros: number }>();

  // A flat daily counter lets an ordinary morning spend the whole day before
  // anything important breaks. Capacity is allocated by importance instead: a
  // portion of the day is held back for major stories, and a major story can
  // exceed the ordinary limit while the day's budget still covers it.
  // Every limit comes from the one declaration that also feeds the dashboard
  // and the documentation, so a number cannot be documented as one value and
  // obeyed as another.
  const runtime = resolveRuntimeConfig(environment);
  const capacityPolicy = {
    baseDailyLimit: runtime.settings.storiesPerDay,
    breakingReserve: runtime.settings.breakingReserve,
    breakingOverflow: runtime.settings.breakingOverflow,
    breakingScore: runtime.settings.breakingScore,
    dailyCostLimitUsd: runtime.settings.dailyCostCeilingUsd,
    estimatedCostPerStoryUsd: runtime.settings.estimatedStoryCostUsd,
  };
  const capacity = decideDailyCapacity(capacityPolicy, {
    startedToday: Number(generated?.count ?? 0),
    spentUsd: Number(costToday?.costMicros ?? 0) / 1_000_000,
  });
  if (capacity.stopReason) {
    console.warn("autonomous_daily_capacity_exhausted", {
      reason: capacity.stopReason,
      startedToday: Number(generated?.count ?? 0),
      spentUsd: Number(costToday?.costMicros ?? 0) / 1_000_000,
      dailyCostLimitUsd: capacityPolicy.dailyCostLimitUsd,
    });
    return;
  }
  const remaining = capacity.ordinarySlots + capacity.breakingSlots;
  const maximumAttempts = boundedInteger(
    environment.AUTONOMOUS_MAX_ATTEMPTS,
    1,
    5,
    2,
  );
  const candidates = await db.prepare(
    `SELECT t.id AS trendId, t.original_term AS headline, t.category, t.score,
       t.risk_level AS riskLevel, o.recommended_format AS recommendedFormat,
       t.visual_availability AS visualAvailability,
       CAST(
         t.score
         + MIN(12, CAST(t.visual_availability AS REAL) / 5)
         + MIN(6, CAST(t.primary_source_availability AS REAL) / 10)
         -- Source velocity is how many newsrooms are actually reporting the
         -- topic right now: the difference between a breaking event and a
         -- persistent search query with no news behind it. Weighted heavily,
         -- because the pipeline was starving on high-search / no-news terms
         -- ("current mortgage rates", "toronto open") that write as retrospectives.
         + MIN(24, CAST(t.source_velocity AS REAL) * 2)
         -- Freshness. A trend first seen in the last two days is news; one that
         -- has persisted for ten is an evergreen query, and drafting it yields a
         -- historical retrospective stamped with today's date. Reward the fresh,
         -- penalise the stale.
         + CASE
             WHEN (unixepoch() * 1000 - t.first_detected_at) < 172800000 THEN 28
             WHEN (unixepoch() * 1000 - t.first_detected_at) < 432000000 THEN 12
             WHEN (unixepoch() * 1000 - t.first_detected_at) > 864000000 THEN -25
             ELSE 0
           END
         + CASE
             WHEN LOWER(t.score_explanation_json) LIKE '%youtube.com%'
               OR LOWER(t.score_explanation_json) LIKE '%youtu.be%'
               OR LOWER(t.score_explanation_json) LIKE '%vimeo.com%'
               OR LOWER(t.score_explanation_json) LIKE '%tiktok.com%'
               OR LOWER(t.score_explanation_json) LIKE '%instagram.com%'
               OR LOWER(t.score_explanation_json) LIKE '%facebook.com%'
               OR LOWER(t.score_explanation_json) LIKE '%x.com/%'
               OR LOWER(t.score_explanation_json) LIKE '%twitter.com/%'
             THEN 12 ELSE 0
           END
         + CASE
             WHEN LOWER(t.score_explanation_json) LIKE '%thumbnail%'
               OR LOWER(t.score_explanation_json) LIKE '%image%'
               OR LOWER(t.score_explanation_json) LIKE '%photo%'
               OR LOWER(t.score_explanation_json) LIKE '%video%'
             THEN 6 ELSE 0
           END
       AS INTEGER) AS priorityScore
     -- Narrow to the freshest eligible trends BEFORE the per-row scoring below.
     -- The scoring runs a dozen text scans per row and the de-duplication joins every
     -- run, so over the whole table (10k+ rows) the query exceeded D1's per-query
     -- CPU limit and the autodraft job went to the dead-letter queue every tick.
     FROM (
       SELECT * FROM trends
       WHERE editorial_state IN ('CANDIDATE','WATCH','SIGNAL_DETECTED','RESEARCHING')
         AND latest_detected_at >= (unixepoch() - 1209600) * 1000
         AND (
           score >= ?1
           OR ((unixepoch() * 1000 - first_detected_at) < 259200000 AND source_velocity >= 6)
         )
       ORDER BY latest_detected_at DESC
       LIMIT 300
     ) t
     LEFT JOIN story_opportunities o ON o.trend_id=t.id
     LEFT JOIN autonomous_story_runs r ON r.trend_id=t.id
     WHERE (
       r.id IS NULL OR (
         r.state='FAILED' AND r.attempt_count < ?3
         AND COALESCE(r.error_code, '') NOT IN (
           'AI_PROVIDER_TIMEOUT',
           'AI_BUDGET_EXCEEDED',
           'AI_INPUT_INVALID',
           'AI_PROVIDER_INVALID_KEY',
           'AI_PROVIDER_NO_CREDIT',
           'AI_PROVIDER_CONTEXT_LIMIT',
           'AI_PROVIDER_MODERATION_REJECTION',
           'AI_PROVIDER_REJECTED',
           'AI_PROVIDER_RESPONSE_INVALID',
           'AI_STRUCTURED_OUTPUT_INVALID',
           'AUTONOMOUS_TOPIC_NOT_REPORTABLE'
         )
       )
     )
       -- The score floor admitted only trends that had accumulated score over
       -- many days - i.e. old evergreen queries. A genuinely breaking story
       -- four hours old scores below the floor because score compounds with
       -- persistence, so it was excluded exactly when it was most current. A
       -- fresh trend (under three days) that several newsrooms are already
       -- covering (source_velocity >= 6) is admitted below the floor; the
       -- priority ranking above still places the best of them first.
       AND (
         t.score >= ?1
         OR (
           (unixepoch() * 1000 - t.first_detected_at) < 259200000
           AND t.source_velocity >= 6
         )
       )
       AND t.editorial_state IN ('CANDIDATE','WATCH','SIGNAL_DETECTED','RESEARCHING')
       -- Bound the scan to trends still active in the last two weeks. The table
       -- grows without limit (20k rows and counting) and the per-row freshness
       -- math plus the dedup below were scanning all of it, which pushed the
       -- query past D1's per-query CPU limit and stopped the pipeline dead. A
       -- trend not re-detected in fourteen days is not news anyway; this pairs
       -- with the trends_state_latest index to keep the query cheap as the
       -- archive keeps growing.
       AND t.latest_detected_at >= (unixepoch() - 1209600) * 1000
       AND NOT EXISTS (
         SELECT 1
         FROM autonomous_story_runs duplicate_run
         JOIN trends duplicate_trend ON duplicate_trend.id=duplicate_run.trend_id
         WHERE duplicate_run.trend_id<>t.id
           AND LOWER(TRIM(duplicate_trend.normalized_term))=LOWER(TRIM(t.normalized_term))
           AND duplicate_run.state IN ('QUEUED','RUNNING','COMPLETED','REVIEW_REQUIRED')
       )
     ORDER BY priorityScore DESC, t.score DESC, t.latest_detected_at DESC
     LIMIT ?2`,
  ).bind(
    minimumScore,
    // Allocation ranks by importance, so it needs a pool to rank rather than
    // the first `remaining` rows the ordering happened to return.
    Math.min(40, Math.max(batchSize, remaining) * 4),
    maximumAttempts,
  ).all<{
    trendId: string;
    headline: string;
    category: string;
    score: number;
    riskLevel: string;
    recommendedFormat: string | null;
    visualAvailability: number;
    priorityScore: number;
  }>();
  const now = Date.now();
  const scheduledHeadlines = new Set<string>();
  const distinctCandidates = candidates.results.filter((candidate) => {
    const normalizedHeadline = candidate.headline
      .trim()
      .toLowerCase()
      .replaceAll(/\s+/gu, " ");
    if (scheduledHeadlines.has(normalizedHeadline)) return false;
    scheduledHeadlines.add(normalizedHeadline);
    return true;
  });
  const scheduled = allocateDailyCapacity(
    distinctCandidates,
    capacityPolicy,
    capacity,
  ).slice(0, batchSize);
  console.info("autonomous_daily_capacity_allocated", {
    ordinarySlots: capacity.ordinarySlots,
    breakingSlots: capacity.breakingSlots,
    pool: distinctCandidates.length,
    scheduled: scheduled.length,
  });
  for (const candidate of scheduled) {
    const runId = `autonomous_${candidate.trendId}`;
    await db.prepare(
      `INSERT INTO autonomous_story_runs
       (id,trend_id,state,attempt_count,created_at,updated_at)
       VALUES (?1,?2,'QUEUED',0,?3,?3)
       ON CONFLICT(trend_id) DO UPDATE SET
         state='QUEUED',
         error_code=NULL,
         error_message=NULL,
         started_at=NULL,
         completed_at=NULL,
         created_at=excluded.created_at,
         updated_at=excluded.updated_at
       WHERE autonomous_story_runs.state='FAILED'`,
    ).bind(runId, candidate.trendId, now).run();
    try {
      await queue.send({
        kind: "article.generate",
        source: "autonomous-schedule",
        payload: {
          runId,
          trendId: candidate.trendId,
          headline: candidate.headline,
          category: normalizeStoryCategory(candidate.category),
          recommendedFormat:
            environment.AUTONOMOUS_FORCE_LONGFORM === "true"
              ? "DEEP_EXPLAINER"
              : opportunityFormatToArticleFormat(
                  candidate.recommendedFormat,
                  candidate.score,
                  environment.AUTONOMOUS_ALLOW_QUICK_BRIEFS === "true",
                ),
          score: candidate.score,
          priorityScore: candidate.priorityScore,
          visualAvailability: candidate.visualAvailability,
          riskLevel: candidate.riskLevel,
        },
      });
    } catch (error) {
      await db
        .prepare(
          `UPDATE autonomous_story_runs
           SET state='FAILED', error_code='QUEUE_SEND_FAILED',
             error_message=?1, completed_at=?2, updated_at=?2
           WHERE id=?3 AND state='QUEUED'`,
        )
        .bind(
          error instanceof Error
            ? error.message.slice(0, 500)
            : String(error).slice(0, 500),
          Date.now(),
          runId,
        )
        .run();
      console.error("autonomous_queue_send_failed", {
        runId,
        trendId: candidate.trendId,
      });
    }
  }
}

export async function executeAutonomousArticleGenerate(
  message: QueueJobMessage,
  services: NorthlineJobServices,
): Promise<void> {
  const environment = toStringEnvironment(services.featureFlags);
  if (environment.FEATURE_AUTONOMOUS_NEWSROOM !== "true") return;
  const payload = asRecord(message.payload);
  const runId = stringValue(payload.runId);
  const trendId = stringValue(payload.trendId);
  const headline = stringValue(payload.headline);
  if (!runId || !trendId || !headline) throw new Error("AUTONOMOUS_MESSAGE_INVALID");
  const db = services.DB ?? (await getD1Binding());
  const maximumAttempts = boundedInteger(
    environment.AUTONOMOUS_MAX_ATTEMPTS,
    1,
    5,
    2,
  );
  const now = Date.now();
  const claim = await db
    .prepare(
      `UPDATE autonomous_story_runs
       SET state='RUNNING', attempt_count=attempt_count+1,
         started_at=?1, completed_at=NULL, updated_at=?1
       WHERE id=?2 AND state IN ('QUEUED','FAILED')
         AND attempt_count < ?3`,
    )
    .bind(now, runId, maximumAttempts)
    .run();
  if (Number(claim.meta.changes ?? 0) !== 1) return;
  const claimed = await db
    .prepare(
      `SELECT attempt_count AS attemptCount FROM autonomous_story_runs WHERE id=?1`,
    )
    .bind(runId)
    .first<{ attemptCount: number }>();
  try {
    const result = await runAutonomousNewsroomStory({
      trendId,
      headline,
      attempt: Number(claimed?.attemptCount ?? 1),
      category: normalizeStoryCategory(String(payload.category ?? "US_NEWS")),
      recommendedFormat: opportunityFormatToArticleFormat(
        String(payload.recommendedFormat ?? "STANDARD_NEWS"),
        Number(payload.score ?? 0),
        true,
      ),
      score: Number(payload.score ?? 0),
      riskLevel: String(payload.riskLevel ?? "LOW"),
    }, environment);
    const completedAt = Date.now();
    await db.prepare(
      `UPDATE autonomous_story_runs SET state=?1, article_id=?2, article_version_id=?3,
       quality_score=?4, word_count=?5, cost_micros=?6, decision_reasons_json=?7,
       completed_at=?8, updated_at=?8, error_code=NULL, error_message=NULL WHERE id=?9`,
    ).bind(
      result.state === "APPROVED" ? "COMPLETED" : "REVIEW_REQUIRED",
      result.articleId,
      result.versionId,
      Math.round(result.qualityScore),
      result.wordCount,
      Math.round(result.costUsd * 1_000_000),
      JSON.stringify(result.reasons),
      completedAt,
      runId,
    ).run();
    await db
      .prepare(
        `UPDATE trends SET editorial_state=?1, updated_at=?2 WHERE id=?3`,
      )
      .bind(
        result.state === "APPROVED" ? "APPROVED" : "HUMAN_REVIEW_REQUIRED",
        completedAt,
        trendId,
      )
      .run();
  } catch (error) {
    const failedAt = Date.now();
    const errorCode =
      error instanceof AiRuntimeError
        ? error.code
        : error instanceof AutonomousTopicNotReportableError
          ? error.code
          : "AUTONOMOUS_GENERATION_FAILED";
    await db
      .prepare(
        `UPDATE autonomous_story_runs SET state='FAILED', error_code=?1,
         error_message=?2, completed_at=?3, updated_at=?3 WHERE id=?4`,
      )
      .bind(
        errorCode,
        error instanceof Error
          ? error.message.slice(0, 500)
          : String(error).slice(0, 500),
        failedAt,
        runId,
      )
      .run();
    if (errorCode === "AI_PROVIDER_RATE_LIMITED") {
      await recordAiProviderCooldown(db, environment, { runId, trendId });
    }
    if (isNonRetryableAutonomousError(error)) return;
    throw error;
  }
}

/**
 * The archive's media ladder, strongest evidence first.
 *
 *   1. a licensed photograph of the subject,
 *   2. the rightsholder's own video, embedded through their player,
 *   3. an abstract editorial illustration, clearly disclosed.
 *
 * Rungs one and two are records of the event. Rung three is explicitly not, and
 * says so, which is why it is last: a story only gets artwork when no evidence
 * of the event can be published lawfully.
 */
async function attachArchiveMedia(input: {
  db: D1Database;
  services: NorthlineJobServices;
  environment: Record<string, string | undefined>;
  draftVersionId: string;
  article: { articleId: string; category: string; headline: string };
}): Promise<number> {
  const { db, draftVersionId, article, environment } = input;

  const photograph = await registerLicensedCommonsMedia({
    database: db,
    articleVersionId: draftVersionId,
    headline: article.headline,
    category: article.category,
    subject: article.headline,
  });
  if (photograph) {
    await recordJobDiagnostic(db, "archive.media_backfill", "attached_photo", {
      articleId: article.articleId,
    });
    return 1;
  }

  if (await attachArticleVideo({ db, environment, draftVersionId, article })) {
    return 1;
  }

  if (input.environment.FEATURE_AI_ILLUSTRATION !== "true") {
    await recordJobDiagnostic(db, "archive.media_backfill", "illustration_off", {
      articleId: article.articleId,
    });
    return 0;
  }
  const ai = (input.services as { AI?: Parameters<typeof workersAiRunner>[0] }).AI;
  const bucket = input.services.MEDIA;
  if (!ai || !bucket) {
    await recordJobDiagnostic(
      db,
      "archive.media_backfill",
      "illustration_binding_missing",
      { articleId: article.articleId, hasAi: Boolean(ai), hasBucket: Boolean(bucket) },
    );
    return 0;
  }

  const summaryRow = await db
    .prepare(
      `SELECT subheadline AS summary FROM article_versions WHERE id = ?1`,
    )
    .bind(draftVersionId)
    .first<{ summary: string | null }>();
  const illustration = await registerAiIllustration({
    database: db,
    bucket,
    articleVersionId: draftVersionId,
    slug: article.articleId,
    headline: article.headline,
    category: article.category,
    summary: summaryRow?.summary ?? "",
    run: workersAiRunner(ai),
  });
  if (!illustration) return 0;
  await recordJobDiagnostic(db, "archive.media_backfill", "attached_illustration", {
    articleId: article.articleId,
    byteSize: illustration.byteSize,
  });
  return 1;
}

function safeJsonParse(value: string | null | undefined): unknown {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/**
 * Heals the published archive. Stories published before licensed media
 * discovery worked carry the generated house graphic, and their versions are
 * frozen, so the only way to give them real imagery is a new version that
 * repeats the reporting word for word and changes nothing but presentation.
 */
/**
 * Composes and sends the Daily Brief.
 *
 * The site advertised a schedule while nothing existed to keep it: no job, no
 * cron entry, and not one row in `newsletter_delivery_logs`. This is that
 * worker.
 *
 * Two properties matter more than throughput. A subscriber must never receive
 * the same issue twice, which the delivery log enforces per recipient. And a
 * story taken off the site must never arrive in an inbox afterwards, which the
 * composer enforces by refusing anything not currently live.
 */
export async function executeNewsletterIssueSend(
  services: NorthlineJobServices,
): Promise<void> {
  const environment = toStringEnvironment(services.featureFlags);
  const db = services.DB ?? (await getD1Binding());

  if (environment.FEATURE_NEWSLETTER_DELIVERY !== "true") {
    await recordJobDiagnostic(db, "newsletter.issue_send", "feature_off");
    return;
  }

  const issueDate = new Date().toISOString().slice(0, 10);
  const dayStart = Date.parse(`${issueDate}T00:00:00Z`);

  const sentToday = await db
    .prepare(
      `SELECT COUNT(*) AS total FROM newsletter_issues
       WHERE state = 'SENT' AND sent_at >= ?1`,
    )
    .bind(dayStart)
    .first<{ total: number }>();

  const alreadySentRows = await db
    .prepare(
      `SELECT DISTINCT article_id AS articleId
       FROM newsletter_issue_articles`,
    )
    .all<{ articleId: string }>()
    .catch(() => ({ results: [] as { articleId: string }[] }));

  const candidates = await db
    .prepare(
      `SELECT a.id AS articleId, a.slug AS slug, a.category AS category,
         v.headline AS headline, v.subheadline AS dek,
         a.published_at AS publishedAt
       FROM articles a
       JOIN article_versions v ON v.id = a.current_version_id
       WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED')
       ORDER BY a.published_at DESC
       LIMIT 30`,
    )
    .all<{
      articleId: string;
      slug: string;
      category: string;
      headline: string;
      dek: string | null;
      publishedAt: number | null;
    }>();

  const composed = composeIssue({
    candidates: candidates.results.map((row) => ({
      articleId: row.articleId,
      slug: row.slug,
      headline: row.headline,
      dek: row.dek ?? "",
      category: row.category,
      publishedAtIso: row.publishedAt
        ? new Date(row.publishedAt).toISOString()
        : null,
      live: true,
    })),
    alreadySent: new Set(alreadySentRows.results.map((row) => row.articleId)),
    sentToday: Number(sentToday?.total ?? 0) > 0,
    issueDate,
  });

  if (!composed.ok) {
    // Refusing to send is a normal outcome, not a failure. An empty or repeated
    // issue costs subscribers, so the reason is recorded and the run ends.
    await recordJobDiagnostic(db, "newsletter.issue_send", "not_sent", {
      reason: composed.refusal.reason,
      detail: composed.refusal.detail,
    });
    return;
  }

  const origin = (environment.NEXT_PUBLIC_SITE_URL ?? "https://usnorthline.com")
    .replace(/\/+$/u, "");
  const issueId = `issue_${issueDate}_${await shortHash(composed.issue.includedIds.join(","))}`;

  const subscribers = await db
    .prepare(
      `SELECT s.id AS id, s.email AS email FROM newsletter_subscribers s
       WHERE s.status = 'CONFIRMED'
         AND NOT EXISTS (
           SELECT 1 FROM newsletter_suppressions p WHERE p.email = s.email
         )
       LIMIT 500`,
    )
    .all<{ id: string; email: string }>()
    .catch(() => ({ results: [] as { id: string; email: string }[] }));

  if (subscribers.results.length === 0) {
    await recordJobDiagnostic(db, "newsletter.issue_send", "no_recipients", {
      issueDate,
    });
    return;
  }

  let delivered = 0;
  let failed = 0;

  for (const subscriber of subscribers.results) {
    // Keyed on issue and recipient, never on the attempt, so a retry cannot
    // deliver the same issue a second time.
    const idempotencyKey = `newsletter-issue:${issueId}:${subscriber.id}`;
    const keyHash = await shortHash(idempotencyKey);

    const existing = await db
      .prepare(
        `SELECT 1 AS present FROM newsletter_delivery_logs
         WHERE idempotency_key_hash = ?1 LIMIT 1`,
      )
      .bind(keyHash)
      .first<{ present: number }>();
    if (existing) continue;

    const unsubscribeUrl = `${origin}/newsletter/unsubscribe?s=${encodeURIComponent(subscriber.id)}`;
    const body = renderIssue(composed.issue, {
      origin,
      unsubscribeUrl,
      issueDate,
    });

    try {
      const result = await deliverNewsletterIssue({
        email: subscriber.email,
        subject: composed.issue.subject,
        text: body.text,
        html: body.html,
        idempotencyKey,
        environment,
      });
      await db
        .prepare(
          `INSERT OR IGNORE INTO newsletter_delivery_logs
             (id, issue_id, subscriber_id, idempotency_key_hash, provider,
              provider_message_id_hash, state, attempted_at, delivered_at)
           VALUES (?1, ?2, ?3, ?4, 'resend', ?5, 'DELIVERED', ?6, ?6)`,
        )
        .bind(
          `nld_${keyHash}`,
          issueId,
          subscriber.id,
          keyHash,
          result.providerId ? await shortHash(result.providerId) : null,
          Date.now(),
        )
        .run();
      delivered += 1;
    } catch (error) {
      failed += 1;
      await db
        .prepare(
          `INSERT OR IGNORE INTO newsletter_delivery_logs
             (id, issue_id, subscriber_id, idempotency_key_hash, provider,
              state, attempted_at, error_category)
           VALUES (?1, ?2, ?3, ?4, 'resend', 'FAILED', ?5, ?6)`,
        )
        .bind(
          `nld_${keyHash}`,
          issueId,
          subscriber.id,
          keyHash,
          Date.now(),
          error instanceof Error ? error.name.slice(0, 60) : "UNKNOWN",
        )
        .run();
    }
  }

  // Recorded only after at least one delivery succeeded. Marking the articles
  // as sent when nothing went out would silently retire coverage no subscriber
  // ever received.
  if (delivered > 0) {
    for (const [position, articleId] of composed.issue.includedIds.entries()) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO newsletter_issue_articles
             (issue_id, article_id, position, created_at)
           VALUES (?1, ?2, ?3, ?4)`,
        )
        .bind(issueId, articleId, position, Date.now())
        .run();
    }
    await db
      .prepare(
        `INSERT OR IGNORE INTO newsletter_issues
           (id, slug, subject, body_text, state, sent_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'SENT', ?5, ?5, ?5)`,
      )
      .bind(
        issueId,
        `daily-brief-${issueDate}`,
        composed.issue.subject,
        `${composed.issue.includedIds.length} stories`,
        Date.now(),
      )
      .run()
      .catch(() => {});
  }

  await recordJobDiagnostic(db, "newsletter.issue_send", "sent", {
    issueId,
    articles: composed.issue.includedIds.length,
    delivered,
    failed,
  });
}

/**
 * Attaches the rightsholder's own footage to a draft version.
 *
 * Nothing is copied: their player is embedded and keeps its attribution, and
 * the platform - never a model - supplies the title and channel.
 *
 * Returns true when a video was attached.
 */
async function attachArticleVideo(input: {
  db: D1Database;
  environment: Record<string, string | undefined>;
  draftVersionId: string;
  article: { articleId: string; headline: string };
}): Promise<boolean> {
  const { db, environment, draftVersionId, article } = input;

  if (!environment.YOUTUBE_API_KEY?.trim()) {
    // Without this the search silently returns nothing and the archive looks as
    // though no footage exists, which is indistinguishable from a real absence.
    await recordJobDiagnostic(db, "archive.media_backfill", "video_search_unconfigured", {
      articleId: article.articleId,
    });
  }

  const leads = await db
    .prepare(
      `SELECT DISTINCT source_url AS url
       FROM article_source_links
       WHERE article_version_id = ?1 AND source_url IS NOT NULL`,
    )
    .bind(draftVersionId)
    .all<{ url: string }>();

  // Cited sources rarely include a video page, which is why the archive had so
  // little footage. Searching for the outlet's own upload is what actually
  // finds it; the oEmbed check below still decides whether it is embedded.
  const discovered = await discoverOfficialVideos({
    subject: article.headline,
    headline: article.headline,
    key: environment.YOUTUBE_API_KEY,
    // Wider than a live run: these stories are already days old.
    recencyDays: 14,
  }).catch(() => []);

  const video = await selectEditorialVideo(
    [
      ...discovered.map((candidate) => candidate.sourceUrl),
      ...leads.results.map((row) => row.url).filter(Boolean),
    ],
    { subject: article.headline, headline: article.headline },
  );
  if (!video) return false;

  // Structured data carries presentation metadata and is deliberately outside
  // the reader-text hash, so a video may be added without altering reporting.
  const current = await db
    .prepare(
      `SELECT structured_data_json AS json FROM article_versions WHERE id = ?1`,
    )
    .bind(draftVersionId)
    .first<{ json: string | null }>();
  const structured = asRecord(safeJsonParse(current?.json));
  await db
    .prepare(`UPDATE article_versions SET structured_data_json = ?2 WHERE id = ?1`)
    .bind(
      draftVersionId,
      JSON.stringify({
        ...structured,
        videoEmbedUrl: video.embedUrl,
        videoSourceUrl: video.sourceUrl,
        videoTitle: video.title,
      }),
    )
    .run();
  await recordJobDiagnostic(db, "archive.media_backfill", "attached_video", {
    articleId: article.articleId,
    provider: video.provider,
  });
  return true;
}

/**
 * Gives published articles the footage the hero pass can never reach.
 *
 * The hero pass treats video as a rung below artwork, and it skips any article
 * that already has a hero. Once the illustration fallback has run - which it
 * has, across the whole archive - every article is permanently excluded, so no
 * published story could ever gain a video no matter how good discovery became.
 *
 * A video is not a hero. A story can carry a lead image and the rightsholder's
 * footage at once, the way every newspaper site does, so this selects purely on
 * whether a video is already present.
 */
async function backfillArticleVideos(
  db: D1Database,
  environment: Record<string, string | undefined>,
  limit: number,
): Promise<void> {
  // Without the cooldown this takes the newest few every run, finds nothing for
  // them, and takes the same few again fifteen minutes later - so the rest of
  // the archive is never reached at all. An article that yielded no footage is
  // set aside for a day and the pass moves on through the backlog.
  const retryAfter = Date.now() - 24 * 60 * 60 * 1000;
  // The cooldown set is read once through audit_logs_target_idx and applied
  // here. A correlated LIKE '%id%' against audit_logs scanned the whole table
  // once per article on every run - tens of billions of D1 rows a month.
  const coolingDown = await db
    .prepare(
      `SELECT metadata_json AS metadataJson
       FROM audit_logs
       WHERE target_type = 'JOB'
         AND target_id = 'archive.media_backfill'
         AND occurred_at > ?1
         AND action = 'JOB_DIAGNOSTIC'
         AND decision = 'video_none_found'
       LIMIT 2000`,
    )
    .bind(retryAfter)
    .all<{ metadataJson: string | null }>();
  const skip = new Set<string>();
  for (const row of coolingDown.results) {
    try {
      const id = (JSON.parse(row.metadataJson ?? "{}") as { articleId?: unknown })
        .articleId;
      if (typeof id === "string") skip.add(id);
    } catch {
      // A malformed diagnostic only means that article is not held back.
    }
  }
  const scanned = await db
    .prepare(
      `SELECT a.id AS articleId, a.current_version_id AS versionId,
         v.headline AS headline
       FROM articles a
       INNER JOIN article_versions v ON v.id = a.current_version_id
       WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING')
         AND (v.structured_data_json IS NULL
              OR v.structured_data_json NOT LIKE '%videoEmbedUrl%')
       ORDER BY a.published_at DESC
       LIMIT ?1`,
    )
    .bind(limit + skip.size)
    .all<{ articleId: string; versionId: string; headline: string }>();
  const candidates = {
    results: scanned.results
      .filter((article) => !skip.has(article.articleId))
      .slice(0, limit),
  };

  await recordJobDiagnostic(db, "archive.media_backfill", "video_selected", {
    articles: candidates.results.length,
  });

  for (const article of candidates.results) {
    try {
      await createMediaOnlyRevision(
        db,
        {
          articleId: article.articleId,
          currentVersionId: article.versionId,
          media: [],
          sources: [],
          changeSummary:
            "Embedded source video from the rightsholder. Reporting unchanged.",
          createdById: "system:autonomous",
          now: new Date(),
          async attachToDraft(draftVersionId) {
            const attached = await attachArticleVideo({
              db,
              environment,
              draftVersionId,
              article,
            });
            return attached ? 1 : 0;
          },
        },
        sha256Base64Url,
      );
    } catch (error) {
      // No rights-clean footage for this story is the ordinary case, not a
      // fault: createMediaOnlyRevision drops the draft and throws rather than
      // churning an identical version. It is still recorded, because a search
      // that ran and found nothing has to be distinguishable from a search that
      // never ran - and it is what the cooldown above reads.
      const code = error instanceof MediaRevisionError ? error.code : "UNKNOWN";
      if (code === "NOTHING_TO_ATTACH") {
        await recordJobDiagnostic(db, "archive.media_backfill", "video_none_found", {
          articleId: article.articleId,
        });
        continue;
      }

      // One article failing must not stop the rest of the batch.
      await recordJobDiagnostic(db, "archive.media_backfill", "video_failed", {
        articleId: article.articleId,
        code,
        error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
    }
  }
}

export async function executeArchiveMediaBackfill(
  services: NorthlineJobServices,
): Promise<void> {
  const environment = toStringEnvironment(services.featureFlags);
  const db = services.DB ?? (await getD1Binding());
  if (environment.FEATURE_ARCHIVE_MEDIA_BACKFILL !== "true") {
    await recordJobDiagnostic(db, "archive.media_backfill", "feature_off");
    return;
  }

  const limit = boundedInteger(
    environment.ARCHIVE_MEDIA_BACKFILL_BATCH_SIZE,
    1,
    5,
    1,
  );
  // Only articles whose hero is the generated graphic, or which have no hero at
  // all. An article already carrying a licensed photograph is left alone.
  const candidates = await db
    .prepare(
      `SELECT a.id AS articleId, a.current_version_id AS versionId,
         a.category AS category, v.headline AS headline
       FROM articles a
       INNER JOIN article_versions v ON v.id = a.current_version_id
       WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING')
         AND NOT EXISTS (
           SELECT 1 FROM article_media m
           INNER JOIN media_assets s ON s.id = m.media_asset_id
           WHERE m.article_version_id = a.current_version_id
             AND m.role = 'HERO'
             AND s.workflow_state = 'APPROVED'
             AND s.verification_state = 'VERIFIED'
             AND s.public_url NOT LIKE '/story-image/%'
         )
       ORDER BY a.published_at DESC
       LIMIT ?1`,
    )
    .bind(limit)
    .all<{
      articleId: string;
      versionId: string;
      category: string;
      headline: string;
    }>();

  await recordJobDiagnostic(db, "archive.media_backfill", "selected", {
    articles: candidates.results.length,
    limit,
  });

  for (const article of candidates.results) {
    try {
      const result = await createMediaOnlyRevision(
        db,
        {
          articleId: article.articleId,
          currentVersionId: article.versionId,
          media: [],
          sources: [],
          changeSummary:
            "Attached licensed source imagery. Reporting unchanged.",
          createdById: "system:autonomous",
          now: new Date(),
          async attachToDraft(draftVersionId) {
            return attachArchiveMedia({
              db,
              services,
              environment,
              draftVersionId,
              article,
            });
          },
        },
        sha256Base64Url,
      );
      await recordJobDiagnostic(db, "archive.media_backfill", "revised", {
        articleId: article.articleId,
        newVersionId: result.newVersionId,
        versionNumber: result.versionNumber,
      });
    } catch (error) {
      await recordJobDiagnostic(db, "archive.media_backfill", "skipped", {
        articleId: article.articleId,
        code: error instanceof MediaRevisionError ? error.code : "UNKNOWN",
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  // Runs regardless of what the hero pass did above: the two fill different
  // slots, and the hero pass has no candidates left across the whole archive.
  await backfillArticleVideos(db, environment, limit);
}

export async function executeArticleAudioBackfill(
  services: NorthlineJobServices,
): Promise<void> {
  const environment = toStringEnvironment(services.featureFlags);
  const db = services.DB ?? (await getD1Binding());
  // Audio silently produced nothing for days. Each exit now states its reason
  // in a place that has proven readable: the database.
  if (environment.FEATURE_ARTICLE_AUDIO !== "true") {
    await recordJobDiagnostic(db, "article_audio.backfill", "feature_off");
    return;
  }
  const queue = services.EDITORIAL_QUEUE;
  if (!queue) {
    await recordJobDiagnostic(db, "article_audio.backfill", "queue_unavailable");
    throw new Error("ARTICLE_AUDIO_QUEUE_UNAVAILABLE");
  }
  const now = Date.now();
  await db
    .prepare(
      `INSERT OR IGNORE INTO users
       (id,email,display_name,role,status,created_at,updated_at)
       VALUES ('system:autonomous','autonomous@usnorthline.com',
         'Northline Newsroom','Publisher','active',?1,?1)`,
    )
    .bind(now)
    .run();
  let config;
  try {
    config = readArticleAudioConfig(environment);
  } catch (error) {
    // A missing or contradictory TTS setting threw here and took the whole job
    // down before it could report anything.
    await recordJobDiagnostic(db, "article_audio.backfill", "config_error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
  if (!config.generationEnabled) {
    await recordJobDiagnostic(
      db,
      "article_audio.backfill",
      "generation_disabled",
      { disabledReason: config.disabledReason },
    );
    return;
  }

  // A queued row whose queue message was lost or dropped stays queued forever
  // and still consumes the daily article allowance. Anything that has not
  // progressed within the recovery window is released so the normal request
  // path can enqueue it again.
  const audioStaleBefore =
    now -
    boundedInteger(environment.ARTICLE_AUDIO_STALE_MINUTES, 1, 720, 30) *
      60 *
      1_000;
  // The state machine allows QUEUED/GENERATING/PROCESSING to move to STALE, and
  // STALE back to QUEUED. Going straight to NOT_REQUESTED is rejected by the
  // transition trigger, so recovery follows the legal path.
  // Abandoning an attempt has to hand its money back. Without this the
  // reservation each attempt writes stays committed forever, so a few stale
  // recoveries exhaust the day's narration budget without ever having called
  // the provider - which is exactly how every article ended up on the browser
  // voice with a DAILY_BUDGET rejection behind it.
  const abandoned = await db
    .prepare(
      `SELECT id, article_version_id AS articleVersionId, provider,
         estimated_cost_micros AS estimatedCostMicros
       FROM article_audio_versions
       WHERE state IN ('QUEUED','GENERATING','PROCESSING')
         AND COALESCE(updated_at, 0) < ?1`,
    )
    .bind(audioStaleBefore)
    .all<{
      id: string;
      articleVersionId: string;
      provider: string;
      estimatedCostMicros: number;
    }>();
  const released = await db
    .prepare(
      `UPDATE article_audio_versions
       SET state='STALE', requested_at=NULL, queue_job_id=NULL,
         cooldown_until=NULL, stale_at=?1, updated_at=?1
       WHERE state IN ('QUEUED','GENERATING','PROCESSING')
         AND COALESCE(updated_at, 0) < ?2`,
    )
    .bind(now, audioStaleBefore)
    .run();
  if (Number(released.meta.changes ?? 0) > 0) {
    console.warn("article_audio_stale_released", {
      released: Number(released.meta.changes ?? 0),
    });
  }
  for (const row of abandoned.results) {
    if (Number(row.estimatedCostMicros ?? 0) <= 0) continue;
    // The refund belongs to the day the money was committed, not the day the
    // recovery runs, or a stale attempt would credit today for yesterday's hold.
    const outstanding = await db
      .prepare(
        `SELECT budget_date AS budgetDate,
           SUM(CASE entry_type
                 WHEN 'RESERVATION' THEN amount_micros
                 WHEN 'RELEASE' THEN -amount_micros
                 ELSE 0 END) AS net
         FROM article_audio_cost_ledger
         WHERE article_audio_version_id = ?1
         GROUP BY budget_date
         HAVING net > 0
         ORDER BY budget_date DESC
         LIMIT 1`,
      )
      .bind(row.id)
      .first<{ budgetDate: string; net: number }>();
    if (!outstanding) continue;
    const budgetDate = outstanding.budgetDate;
    // Keyed on the audio version and the recovery day, so replaying the job
    // cannot refund the same reservation twice.
    const idempotencyKeyHash = `stale-release-${await shortHash(
      `article-audio-stale-release|${row.id}|${budgetDate}`,
    )}`;
    await db
      .prepare(
        `INSERT OR IGNORE INTO article_audio_cost_ledger
         (id, article_audio_version_id, article_version_id, provider,
          entry_type, amount_micros, budget_date, idempotency_key_hash,
          recorded_at)
         VALUES (?1, ?2, ?3, ?4, 'RELEASE', ?5, ?6, ?7, ?8)`,
      )
      .bind(
        `ledger_${idempotencyKeyHash}`,
        row.id,
        row.articleVersionId,
        row.provider,
        // Refund exactly what is still held, never more.
        Number(outstanding.net),
        budgetDate,
        idempotencyKeyHash,
        now,
      )
      .run();
    console.warn("article_audio_reservation_released", {
      audioVersionId: row.id,
      refundedMicros: Number(outstanding.net),
      budgetDate,
    });
  }

  const dailyArticleLimit = resolveRuntimeConfig(environment).settings
    .narrationArticlesPerDay;
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const requestedToday = await db
    .prepare(
      `SELECT COUNT(DISTINCT article_id) AS total
       FROM article_audio_versions
       WHERE requested_at >= ?1
         AND state IN ('QUEUED','GENERATING','PROCESSING','READY')`,
    )
    .bind(dayStart.getTime())
    .first<{ total: number }>();
  const remainingAudioArticles = Math.max(
    0,
    dailyArticleLimit - Number(requestedToday?.total ?? 0),
  );
  if (remainingAudioArticles === 0) {
    await recordJobDiagnostic(
      db,
      "article_audio.backfill",
      "daily_limit_reached",
      {
        dailyArticleLimit,
        requestedToday: Number(requestedToday?.total ?? 0),
      },
    );
    return;
  }
  const limit = Math.min(
    remainingAudioArticles,
    boundedInteger(
      environment.ARTICLE_AUDIO_BACKFILL_BATCH_SIZE,
      1,
      20,
      1,
    ),
  );
  const audioVariants = parseArticleAudioVariants(
    environment.ARTICLE_AUDIO_VARIANTS,
  );
  const variantPlaceholders = audioVariants.map(() => "?").join(",");
  const rows = await db.prepare(
    `SELECT a.id AS articleId, a.current_version_id AS articleVersionId
     FROM articles a
     WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING')
       AND a.current_version_id IS NOT NULL
       -- Eligibility is per variant. A NOT EXISTS over the whole variant list
       -- excluded any article that already had one narration, so a story with a
       -- Quick Brief could never gain its Full Article reading and the player
       -- fell back to the browser voice for that tab.
       AND (
         SELECT COUNT(DISTINCT av.variant) FROM article_audio_versions av
         WHERE av.article_version_id=a.current_version_id
           AND av.variant IN (${variantPlaceholders})
           AND av.state IN ('QUEUED','GENERATING','PROCESSING','READY')
       ) < ${audioVariants.length}
     ORDER BY a.published_at DESC LIMIT ?`,
  ).bind(...audioVariants, limit).all<{articleId:string;articleVersionId:string}>();
  const repository = createD1ArticleAudioRepository(db);
  const service = createArticleAudioService({
    config,
    repository,
    queue: {
      async enqueue(input) {
        const id = `queue_${await shortHash(`${input.kind}:${input.idempotencyKey}`)}`;
        await queue.send({kind: input.kind, source: "article-audio-backfill", payload: input.payload});
        return {job: {id, state: "QUEUED"}, replayed: false};
      },
    },
    queueName: environment.ARTICLE_AUDIO_QUEUE_NAME ?? "northline-editorial",
  });
  await recordJobDiagnostic(db, "article_audio.backfill", "selected", {
    articles: rows.results.length,
    variants: audioVariants,
    limit,
  });
  for (const row of rows.results) {
    for (const variant of audioVariants) {
      // The planner can silently decline for cost, cooldown, length or replay
      // reasons. Recording the outcome is what makes a stalled narration
      // pipeline diagnosable without another deploy.
      try {
        const requested = await service.requestGeneration({
          articleId: row.articleId,
          expectedArticleVersionId: row.articleVersionId,
          variant,
          requestedById: "system:autonomous",
          idempotencyKey: `audio-backfill:${row.articleVersionId}:${variant}`,
        });
        await recordJobDiagnostic(
          db,
          "article_audio.backfill",
          `request_${String(requested.plan.outcome).toLowerCase()}`,
          {
            articleId: row.articleId,
            variant,
            reason:
              "reason" in requested.plan ? String(requested.plan.reason) : null,
            state: requested.audio?.state ?? null,
          },
        );
      } catch (error) {
        // One article that cannot be narrated must not stop the rest.
        await recordJobDiagnostic(
          db,
          "article_audio.backfill",
          "request_failed",
          {
            articleId: row.articleId,
            variant,
            code: error instanceof ArticleAudioError ? error.code : "UNKNOWN",
            message: error instanceof Error ? error.message : "unknown",
          },
        );
      }
    }
  }
}

export async function executeOpportunityRescore(services: NorthlineJobServices): Promise<void> {
  const environment = toStringEnvironment(services.featureFlags);
  // Live Google Trends signals normally score in the 40s and 50s, so the former
  // fixed 78/55 thresholds demoted almost every trend to REJECT within fifteen
  // minutes and starved the drafting queue. The thresholds are configurable, and
  // when the newsroom is asked to process every active signal a low score parks
  // a trend on the watch list instead of removing it from the pipeline.
  const researchScore = boundedInteger(
    environment.OPPORTUNITY_RESEARCH_SCORE,
    0,
    100,
    78,
  );
  const watchScore = boundedInteger(
    environment.OPPORTUNITY_WATCH_SCORE,
    0,
    100,
    55,
  );
  const keepAllActiveSignals =
    environment.AUTONOMOUS_PROCESS_ALL_ACTIVE_SIGNALS === "true";
  const db = services.DB ?? (await getD1Binding());
  const rows = await db.prepare(
    `SELECT id, normalized_term, category, score, risk_level, score_explanation_json
     FROM trends WHERE editorial_state IN ('SIGNAL_DETECTED','CANDIDATE')
     AND latest_detected_at >= (unixepoch() - 1209600) * 1000
     ORDER BY score DESC, latest_detected_at DESC LIMIT 100`,
  ).all<{ id: string; normalized_term: string; category: string; score: number; risk_level: string; score_explanation_json: string }>();
  const now = Date.now();
  for (const row of rows.results) {
    const state =
      row.score >= researchScore
        ? "RESEARCH"
        : row.score >= watchScore || keepAllActiveSignals
          ? "WATCH"
          : "REJECT";
    const format = row.score >= 88 ? "DEEP_EXPLAINER" : row.score >= 72 ? "STANDARD_STORY" : "QUICK_BRIEF";
    await db.prepare(
      `INSERT INTO story_opportunities (
         id, trend_id, story_cluster_id, state, recommended_format,
         reason_codes_json, explanation, internal_scores_json, evidence_ids_json,
         market, window, created_at, updated_at
       ) VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, '[]', 'US', '24h', ?8, ?8)
       ON CONFLICT(id) DO UPDATE SET state=excluded.state,
         recommended_format=excluded.recommended_format,
         explanation=excluded.explanation,
         internal_scores_json=excluded.internal_scores_json,
         updated_at=excluded.updated_at`,
    ).bind(
      `opp_${row.id}`,
      row.id,
      state,
      format,
      JSON.stringify([`score:${row.score}`, `risk:${row.risk_level}`]),
      `${row.normalized_term} scored ${row.score}/100 and is routed to ${state.toLowerCase()}.`,
      row.score_explanation_json || JSON.stringify({ score: row.score }),
      now,
    ).run();
    await db.prepare(`UPDATE trends SET editorial_state=?1, updated_at=?2 WHERE id=?3`)
      .bind(state === "RESEARCH" ? "CANDIDATE" : state, now, row.id).run();
  }
}


export async function executeInternalLinksRefresh(
  services: NorthlineJobServices,
): Promise<void> {
  const environment = toStringEnvironment(services.featureFlags);
  if (environment.FEATURE_INTERNAL_LINKS !== "true") return;
  const db = services.DB ?? (await getD1Binding());
  const articles = await db
    .prepare(
      `SELECT a.id, a.slug, a.category, a.current_version_id AS versionId,
         v.headline, v.structured_data_json AS structuredDataJson
       FROM articles a
       JOIN article_versions v ON v.id=a.current_version_id
       WHERE a.state IN ('PUBLISHED','DEVELOPING','UPDATED','CORRECTED')
       ORDER BY COALESCE(a.published_at,a.updated_at) DESC
       LIMIT 250`,
    )
    .all<{
      id: string;
      slug: string;
      category: string;
      versionId: string;
      headline: string;
      structuredDataJson: string;
    }>();

  const updates: D1PreparedStatement[] = [];
  for (const article of articles.results) {
    const related = articles.results
      .filter(
        (candidate) =>
          candidate.id !== article.id &&
          candidate.category === article.category,
      )
      .slice(0, 5)
      .map((candidate) => ({
        headline: candidate.headline,
        href: `/story/${candidate.slug}`,
      }));
    let structuredData: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(article.structuredDataJson) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        structuredData = parsed as Record<string, unknown>;
      }
    } catch {
      structuredData = {};
    }
    structuredData.internalLinks = related;
    updates.push(
      db
        .prepare(
          `UPDATE article_versions SET structured_data_json=?1
           WHERE id=?2 AND article_id=?3`,
        )
        .bind(JSON.stringify(structuredData), article.versionId, article.id),
    );
  }
  if (updates.length > 0) await db.batch(updates);
}

export async function executeAiReviewPackageJob(message: QueueJobMessage, services: NorthlineJobServices): Promise<void> {
  const payload = asRecord((message as QueueJobMessage & { payload?: unknown }).payload);
  const workflowId = stringValue(payload.workflowId);
  const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
  if (!workflowId || evidence.length === 0) return;
  const packet = evidence.map(normalizeEvidence).filter((item): item is SelectedEvidence => Boolean(item));
  if (!packet.length) return;
  const environment = toStringEnvironment(services.featureFlags);
  const gateway = new EditorialAiGateway(createAiGateway({ environment }), environment);
  await prepareAiReviewPackage({
    workflowId,
    sourcePacket: packet,
    operations: gateway,
    ledger: createD1AiWorkflowLedger({ database: await getDb() }),
    budget: {
      maxInputTokens: numberValue(environment.AI_MAX_CONTEXT_TOKENS, 24_000),
      maxOutputTokens: numberValue(environment.AI_MAX_OUTPUT_TOKENS, 4_000),
      maxCostUsd: numberValue(environment.AI_PER_STORY_BUDGET_USD, 1),
    },
  });
}

export async function executeArticleAudioJob(message: QueueJobMessage, services: NorthlineJobServices): Promise<void> {
  const payload = asRecord((message as QueueJobMessage & { payload?: unknown }).payload);
  const audioVersionId = stringValue(payload.articleAudioVersionId);
  const articleId = stringValue(payload.articleId);
  const articleVersionId = stringValue(payload.articleVersionId);
  const d1ForDiagnostics = services.DB ?? (await getD1Binding());
  if (!audioVersionId || !articleId || !articleVersionId || !services.ARTICLE_AUDIO) {
    await recordJobDiagnostic(
      d1ForDiagnostics,
      "article_audio.generate",
      "payload_or_bucket_missing",
      {
        audioVersionId,
        articleId,
        hasBucket: Boolean(services.ARTICLE_AUDIO),
      },
    );
    return;
  }
  const environment = toStringEnvironment(services.featureFlags);
  const config = readArticleAudioConfig(environment);
  const d1 = services.DB ?? (await getD1Binding());
  const repository = createD1ArticleAudioRepository(d1);
  const article = await repository.loadCurrentPublishedVersion(articleId, articleVersionId);
  if (!article) {
    await recordJobDiagnostic(d1, "article_audio.generate", "article_version_missing", {
      articleId,
      articleVersionId,
    });
    return;
  }
  const audio = await loadAudioRecord(d1, audioVersionId);
  if (!audio) {
    await recordJobDiagnostic(d1, "article_audio.generate", "audio_record_missing", {
      audioVersionId,
    });
    return;
  }
  const document = await buildNarrationDocument(article, audio.variant, config.narrationPolicyVersion);
  const adapters = createArticleAudioAdapterRegistry(config, audioExecutors(environment));
  try {
    await executeArticleAudioGeneration({
    audio,
    document,
    config,
    adapters,
    repository,
    objectStore: createR2ArticleAudioObjectStore(services.ARTICLE_AUDIO),
    postProcessor: {
      async finalize(input) {
        const byteLength = input.chunks.reduce((sum, chunk) => sum + chunk.bytes.byteLength, 0);
        const bytes = new Uint8Array(byteLength);
        let offset = 0;
        for (const chunk of input.chunks) { bytes.set(chunk.bytes, offset); offset += chunk.bytes.byteLength; }
        return { bytes, contentType: input.chunks[0]?.contentType ?? "audio/mpeg", durationMs: input.chunks.reduce((sum, chunk) => sum + chunk.durationMs, 0) };
      },
    },
    cacheInvalidator: { async invalidateArticleAudio() {} },
    });
  } catch (error) {
    // The real cause of a narration failure used to be overwritten by the
    // claim error of the next retry. Record it before rethrowing.
    await recordJobDiagnostic(d1, "article_audio.generate", "generation_failed", {
      audioVersionId,
      attempt: audio.generationAttempt,
      code: error instanceof ArticleAudioError ? error.code : "UNKNOWN",
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}

async function loadAudioRecord(db: D1Database, id: string): Promise<ArticleAudioRecord | null> {
  const row = await db.prepare(`SELECT * FROM article_audio_versions WHERE id=?1 LIMIT 1`).bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  return {
    id: String(row.id), articleId: String(row.article_id), articleVersionId: String(row.article_version_id),
    variant: row.variant as ArticleAudioRecord["variant"], state: row.state as ArticleAudioRecord["state"],
    inputHash: String(row.input_hash), provider: row.provider as ArticleAudioRecord["provider"],
    modelId: row.model_id ? String(row.model_id) : null, voiceId: row.voice_id ? String(row.voice_id) : null,
    characterCount: Number(row.character_count),
    chunkCount: Number(row.chunk_count), generationAttempt: Number(row.generation_attempt), estimatedCostMicros: Number(row.estimated_cost_micros),
    actualCostMicros: row.actual_cost_micros == null ? null : Number(row.actual_cost_micros), storageKey: row.storage_key ? String(row.storage_key) : null,
    contentType: row.content_type ? String(row.content_type) : null, durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    cooldownUntil: row.cooldown_until == null ? null : new Date(Number(row.cooldown_until)), queueJobId: row.queue_job_id ? String(row.queue_job_id) : null,
    requestedAt: row.requested_at == null ? null : new Date(Number(row.requested_at)), updatedAt: new Date(Number(row.updated_at)),
  };
}

function audioExecutors(environment: Record<string, string | undefined>): Partial<Record<ServerAudioProvider, ProviderExecutor>> {
  return {
    ELEVENLABS: async (request, configuration) => {
      const endpoint = (configuration.endpoint ?? "https://api.elevenlabs.io/v1/text-to-speech").replace(/\/$/u, "");
      const response = await fetch(`${endpoint}/${encodeURIComponent(configuration.voiceId)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: {
          "xi-api-key": configuration.credential,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: request.chunk.text,
          model_id: configuration.modelId,
          previous_text: request.previousText,
          next_text: request.nextText,
          apply_text_normalization: "auto",
          voice_settings: {
            stability: 0.52,
            similarity_boost: 0.78,
            style: 0.08,
            use_speaker_boost: true,
            speed: 0.98,
          },
          seed: 417,
        }),
      });
      if (!response.ok) {
        const rawDetail = await response.text();
        let detail = rawDetail.trim();
        try {
          const parsed = JSON.parse(rawDetail) as {
            detail?: { status?: string; message?: string } | string;
          };
          if (typeof parsed.detail === "string") {
            detail = parsed.detail;
          } else if (parsed.detail) {
            detail = [
              parsed.detail.status,
              parsed.detail.message,
            ].filter(Boolean).join(": ");
          }
        } catch {
          // Preserve the bounded provider response when it is not JSON.
        }
        detail = detail.slice(0, 500) || response.statusText;
        console.error("elevenlabs_tts_failed", {
          status: response.status,
          detail,
          model: configuration.modelId,
          voiceId: configuration.voiceId,
          characterCount: request.chunk.characterCount,
        });
        // ElevenLabs reports an exhausted character allowance as 401, the same
        // status it uses for a bad key. Treated as a plain rejection the
        // narration was burned permanently, when in fact it only needed to wait
        // for the allowance to renew.
        const quotaExhausted = /quota_exceeded|exceeds your quota/iu.test(
          detail,
        );
        const code =
          quotaExhausted || response.status === 402
            ? "BUDGET_EXCEEDED"
            : response.status === 408 || response.status === 429
              ? "PROVIDER_TIMEOUT"
              : response.status >= 500
                ? "PROVIDER_UNAVAILABLE"
                : "PROVIDER_REJECTED";
        throw new ArticleAudioError(
          code,
          `ElevenLabs TTS failed with ${response.status}: ${detail}`,
          // Retryable: an exhausted allowance renews, so the work is not lost.
          quotaExhausted ||
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500,
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        bytes,
        contentType: response.headers.get("content-type") ?? "audio/mpeg",
        durationMs: Math.max(1_000, Math.round(request.chunk.characterCount / 14 * 1_000)),
        costMicros: Math.round(request.chunk.characterCount * configuration.usdPerMillionCharacters),
        timings: [],
        providerRequestId: response.headers.get("request-id") ?? undefined,
      };
    },
    OPENAI_TTS: async (request, configuration) => {
      const apiKey = environment.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OpenAI TTS is not configured.");
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: configuration.modelId, voice: configuration.voiceId, input: request.chunk.text, response_format: "mp3" }),
      });
      if (!response.ok) throw new Error(`OpenAI TTS failed with ${response.status}.`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { bytes, contentType: response.headers.get("content-type") ?? "audio/mpeg", durationMs: Math.max(1_000, Math.round(request.chunk.characterCount / 14 * 1_000)), costMicros: Math.round(request.chunk.characterCount * configuration.usdPerMillionCharacters), timings: [], providerRequestId: response.headers.get("x-request-id") ?? undefined };
    },
  };
}

function isNonRetryableAutonomousError(error: unknown): boolean {
  // A generic search term never becomes a story, so it is not retried.
  if (error instanceof AutonomousTopicNotReportableError) return true;
  if (!(error instanceof AiRuntimeError)) return false;
  return new Set([
    "AI_PROVIDER_TIMEOUT",
    "AI_BUDGET_EXCEEDED",
    "AI_INPUT_INVALID",
    "AI_PROVIDER_INVALID_KEY",
    "AI_PROVIDER_NO_CREDIT",
    "AI_PROVIDER_CONTEXT_LIMIT",
    "AI_PROVIDER_MODERATION_REJECTION",
    "AI_PROVIDER_REJECTED",
    "AI_PROVIDER_RESPONSE_INVALID",
    "AI_STRUCTURED_OUTPUT_INVALID",
  ]).has(error.code);
}

function configuredAllowlist(
  value: string | undefined,
  fallback: ReadonlySet<string>,
): ReadonlySet<string> {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => /^[A-Z_]{3,40}$/u.test(entry));
  return entries.length > 0 ? new Set(entries) : fallback;
}

function boundedInteger(
  value: string | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function normalizeEvidence(value: unknown): SelectedEvidence | null {
  const item = asRecord(value);
  const id = stringValue(item.id); const sourceId = stringValue(item.sourceId); const sourceName = stringValue(item.sourceName);
  const summary = stringValue(item.summary); const excerptHash = stringValue(item.excerptHash); const observedAt = stringValue(item.observedAt);
  const sourceType = item.sourceType;
  if (!id || !sourceId || !sourceName || !summary || !excerptHash || !observedAt || !["PRIMARY","INDEPENDENT","CONTEXT"].includes(String(sourceType))) return null;
  return { id, sourceId, sourceName, sourceType: sourceType as SelectedEvidence["sourceType"], summary, excerptHash, observedAt };
}

/**
 * Narration produced nothing for days while every console line stayed
 * invisible: `wrangler tail` does not deliver this deployment's scheduled and
 * queue events, so a job that returned early looked identical to one that never
 * ran. Recording each outcome in D1 makes the pipeline diagnosable from the
 * database, which is the only surface that has proven observable here.
 */
async function recordJobDiagnostic(
  db: D1Database,
  job: string,
  outcome: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs
         (id, actor_id, action, target_type, target_id, decision, reason,
          metadata_json, occurred_at)
         VALUES (?1, 'system:jobs', 'JOB_DIAGNOSTIC', 'JOB', ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(
        `jobdiag_${crypto.randomUUID()}`,
        job,
        outcome,
        outcome,
        JSON.stringify(detail).slice(0, 4_000),
        Date.now(),
      )
      .run();
  } catch (error) {
    // Diagnostics must never be the reason a job fails.
    console.warn("job_diagnostic_write_failed", {
      job,
      outcome,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Values are trimmed on the way in. A secret set through a shell that appends a
 * newline arrives as "true\n", and every `=== "true"` comparison downstream
 * then reads false - which silently disabled the entire scheduled pipeline
 * while every deploy and cron invocation still reported success. Normalising at
 * the single point the environment is read removes that whole failure class.
 */
function toStringEnvironment(value: Record<string, unknown> | undefined): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(value ?? {}).map(([key, item]) => [
      key,
      typeof item === "string" ? item.trim() : undefined,
    ]),
  );
}
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function numberValue(value: string | undefined, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }
function safeDate(value: string, fallback: Date): Date { const date = new Date(value); return Number.isNaN(date.valueOf()) ? fallback : date; }
function freshnessScore(value: string, now: Date): number { const age = Math.max(0, now.getTime() - safeDate(value, now).getTime()); return Math.max(1, Math.round(100 - age / 144_000)); }
function sig(value: number, explanation: string) { return { value: Math.max(0, Math.min(1, value)), explanation }; }
function categoryForTrendTitle(title: string): string {
  const value = title.toLowerCase();
  if (/\b(ai|artificial intelligence|software|iphone|android|cybersecurity|technology|tech)\b/u.test(value)) return "Technology";
  if (/\b(stock|market|company|business|economy|jobs|earnings)\b/u.test(value)) return "Business";
  if (/\b(science|space|nasa|research|climate)\b/u.test(value)) return "Science";
  if (/\b(cricket|t20|odi|ipl|nfl|nba|mlb|nhl|soccer|football|basketball|baseball|tennis|golf|cycling|tour de france|formula 1|f1|boxing|ufc)\b/u.test(value)) return "Sports";
  if (/\b(movie|film|actor|actress|music|album|netflix|disney|celebrity|television|tv series)\b/u.test(value)) return "Entertainment";
  if (/\b(weather|storm|hurricane|wildfire|flood|earthquake|heat wave|tornado)\b/u.test(value)) return "Weather";
  if (/\b(health|disease|recall|fda|cdc|medicine|hospital)\b/u.test(value)) return "Health";
  return "U.S.";
}
function categoryForQuery(query: string): string { if (query.includes("technology")) return "Technology"; if (query.includes("business")) return "Business"; if (query.includes("science")) return "Science"; if (query.includes("sports")) return "Sports"; if (query.includes("entertainment")) return "Entertainment"; return "U.S."; }
function normalizeStoryCategory(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/gu,"_");
  const allowed = new Set(["US_NEWS","POLITICS","TECHNOLOGY","BUSINESS","ENTERTAINMENT","SPORTS","GAMING","SCIENCE","INTERNET_TRENDS","WORLD","HEALTH","FINANCE","WEATHER"]);
  if (normalized === "U_S" || normalized === "U_S_" || normalized === "CULTURE") return "US_NEWS" as const;
  return (allowed.has(normalized) ? normalized : "US_NEWS") as "US_NEWS"|"POLITICS"|"TECHNOLOGY"|"BUSINESS"|"ENTERTAINMENT"|"SPORTS"|"GAMING"|"SCIENCE"|"INTERNET_TRENDS"|"WORLD"|"HEALTH"|"FINANCE"|"WEATHER";
}
function opportunityFormatToArticleFormat(
  value: string | null,
  score: number,
  allowQuickBriefs = false,
) {
  const normalized = (value ?? "").toUpperCase();
  if (normalized === "DEEP_EXPLAINER" || score >= 88) {
    return "DEEP_EXPLAINER" as const;
  }
  if (normalized === "WHY_TRENDING") return "WHY_TRENDING" as const;
  if (
    allowQuickBriefs &&
    (normalized === "QUICK_BRIEF" || normalized === "NEWS_FLASH")
  ) {
    return normalized as "QUICK_BRIEF" | "NEWS_FLASH";
  }
  return "STANDARD_NEWS" as const;
}
async function shortHash(value: string): Promise<string> { const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); return Array.from(digest.slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join(""); }


function parseArticleAudioVariants(
  value: string | undefined,
): readonly ("FULL_ARTICLE" | "QUICK_BRIEF")[] {
  const normalized = (value ?? "QUICK_BRIEF")
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(
      (entry): entry is "FULL_ARTICLE" | "QUICK_BRIEF" =>
        entry === "FULL_ARTICLE" || entry === "QUICK_BRIEF",
    );
  return normalized.length > 0
    ? Array.from(new Set(normalized))
    : ["QUICK_BRIEF"];
}
