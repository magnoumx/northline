import type { JobHandler, JobHandlerRegistry } from "./consumer";
import {
  executeAiReviewPackageJob,
  executeApprovedArticleAutopublish,
  executeArchiveMediaBackfill,
  executeDataHygiene,
  executeNewsletterIssueSend,
  executeArticleAudioBackfill,
  executeArticleAudioJob,
  executeInternalLinksRefresh,
  executeAutonomousArticleGenerate,
  executeAutonomousDraftSchedule,
  executeOpportunityRescore,
  executeTrendRefresh,
  type NorthlineJobServices,
} from "./executors";

function enabledHandler(
  flag: string,
  label: string,
  run: (message: Parameters<JobHandler>[0], services: NorthlineJobServices) => Promise<void>,
): JobHandler {
  return async (message, services) => {
    if (services.featureFlags?.[flag] !== "true") {
      return { outcome: "SKIPPED", reason: `${label}:feature_off` };
    }
    await run(message, services as NorthlineJobServices);
    return { outcome: "DONE" };
  };
}

export function createDefaultJobRegistry(): JobHandlerRegistry {
  return {
    "trend.refresh": enabledHandler("FEATURE_TREND_CONNECTORS", "trend.refresh", async (_message, services) => executeTrendRefresh(services)),
    "opportunity.rescore": enabledHandler("FEATURE_DURABLE_JOBS", "opportunity.rescore", async (_message, services) => executeOpportunityRescore(services)),
    "article.autodraft": enabledHandler("FEATURE_AUTONOMOUS_NEWSROOM", "article.autodraft", async (_message, services) => executeAutonomousDraftSchedule(services)),
    "article.generate": enabledHandler("FEATURE_AUTONOMOUS_NEWSROOM", "article.generate", executeAutonomousArticleGenerate),
    "article.autopublish": enabledHandler("FEATURE_AUTO_PUBLISH", "article.autopublish", async (_message, services) => executeApprovedArticleAutopublish(services)),
    "article_audio.backfill": enabledHandler("FEATURE_ARTICLE_AUDIO", "article_audio.backfill", async (_message, services) => executeArticleAudioBackfill(services)),
    "internal_links.refresh": enabledHandler(
      "FEATURE_INTERNAL_LINKS",
      "internal_links.refresh",
      async (_message, services) => executeInternalLinksRefresh(services),
    ),
    "intelligence.high_signal_sample": async () => ({ outcome: "SKIPPED", reason: "intelligence.high_signal_sample:connector_driven" }),
    "newsletter.issue_send": enabledHandler("FEATURE_NEWSLETTER_DELIVERY", "newsletter.issue_send", async (_message, services) => executeNewsletterIssueSend(services)),
    "archive.media_backfill": enabledHandler("FEATURE_ARCHIVE_MEDIA_BACKFILL", "archive.media_backfill", async (_message, services) => executeArchiveMediaBackfill(services)),
    "maintenance.data_hygiene": enabledHandler("FEATURE_DURABLE_JOBS", "maintenance.data_hygiene", async (_message, services) => executeDataHygiene(services)),
    "article_audio.generate": enabledHandler("FEATURE_ARTICLE_AUDIO", "article_audio.generate", executeArticleAudioJob),
    "ai.review_package": enabledHandler("AI_ENABLED", "ai.review_package", executeAiReviewPackageJob),
  } as JobHandlerRegistry;
}
