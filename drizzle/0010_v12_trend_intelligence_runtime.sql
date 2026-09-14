-- Northline V12 runtime intelligence tables.
-- These tables are actively written by trend.refresh and opportunity.rescore jobs.

CREATE TABLE IF NOT EXISTS `trend_signal_observations` (
  `id` text PRIMARY KEY NOT NULL,
  `normalized_topic` text NOT NULL,
  `original_query` text NOT NULL,
  `country` text NOT NULL,
  `region` text,
  `language` text NOT NULL,
  `category` text NOT NULL,
  `window` text NOT NULL,
  `metric_type` text NOT NULL,
  `relative_search_interest` integer,
  `estimated_monthly_searches` integer,
  `own_site_impressions` integer,
  `own_site_clicks` integer,
  `public_social_signal` integer,
  `estimated_traffic` integer,
  `search_growth_bps` integer,
  `news_source_velocity` integer,
  `video_velocity` integer,
  `wikipedia_interest` integer,
  `metric_source` text NOT NULL,
  `metric_confidence` text NOT NULL,
  `provenance_json` text NOT NULL,
  `first_detected_at` integer NOT NULL,
  `last_detected_at` integer NOT NULL,
  `peak_at` integer,
  `observed_at` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  CONSTRAINT `trend_signal_observations_window_ck`
    CHECK (`window` IN ('4h','12h','24h','7d','30d','12mo','custom')),
  CONSTRAINT `trend_signal_observations_metric_ck`
    CHECK (`metric_type` IN (
      'RELATIVE_SEARCH_INTEREST',
      'ESTIMATED_MONTHLY_SEARCHES',
      'OWN_SITE_IMPRESSIONS',
      'OWN_SITE_CLICKS',
      'PUBLIC_SOCIAL_SIGNALS',
      'ESTIMATED_TRAFFIC'
    )),
  CONSTRAINT `trend_signal_observations_relative_ck`
    CHECK (
      `relative_search_interest` IS NULL OR
      (`relative_search_interest` >= 0 AND `relative_search_interest` <= 100)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS `trend_signal_observations_dedupe_uq`
  ON `trend_signal_observations` (
    `normalized_topic`,
    `original_query`,
    `country`,
    `region`,
    `window`,
    `metric_source`,
    `observed_at`
  );

CREATE INDEX IF NOT EXISTS `trend_signal_observations_market_idx`
  ON `trend_signal_observations` (`country`, `window`, `observed_at`);

CREATE TABLE IF NOT EXISTS `story_opportunities` (
  `id` text PRIMARY KEY NOT NULL,
  `trend_id` text,
  `story_cluster_id` text,
  `state` text DEFAULT 'WATCH' NOT NULL,
  `recommended_format` text NOT NULL,
  `reason_codes_json` text DEFAULT '[]' NOT NULL,
  `explanation` text NOT NULL,
  `internal_scores_json` text NOT NULL,
  `evidence_ids_json` text DEFAULT '[]' NOT NULL,
  `market` text DEFAULT 'US' NOT NULL,
  `window` text DEFAULT '24h' NOT NULL,
  `decided_by` text,
  `decided_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`trend_id`) REFERENCES `trends`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`story_cluster_id`) REFERENCES `story_clusters`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `story_opportunities_state_ck`
    CHECK (`state` IN (
      'REJECT',
      'WATCH',
      'RESEARCH',
      'QUICK_BRIEF',
      'STANDARD_STORY',
      'DEEP_EXPLAINER',
      'LIVE_COVERAGE',
      'VISUAL_STORY',
      'VIDEO_STORY',
      'UPDATE_EXISTING_STORY'
    )),
  CONSTRAINT `story_opportunities_format_ck`
    CHECK (`recommended_format` IN (
      'NEWS_FLASH',
      'QUICK_BRIEF',
      'STANDARD_STORY',
      'DEEP_EXPLAINER',
      'ULTIMATE_GUIDE',
      'LIVE_COVERAGE'
    ))
);

CREATE INDEX IF NOT EXISTS `story_opportunities_state_updated_idx`
  ON `story_opportunities` (`state`, `updated_at`);

CREATE INDEX IF NOT EXISTS `story_opportunities_trend_idx`
  ON `story_opportunities` (`trend_id`);
