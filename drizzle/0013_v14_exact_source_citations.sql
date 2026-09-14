-- Article citations previously resolved through a domain-level `sources` row,
-- so two stories from the same publisher shared one page identity and a reader
-- could be shown a film page as evidence for a diplomacy report. The exact
-- document a version cites is now recorded on the citation itself.
ALTER TABLE `article_source_links` ADD COLUMN `source_url` text;
--> statement-breakpoint
ALTER TABLE `article_source_links` ADD COLUMN `source_title` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `article_source_links_url_idx`
  ON `article_source_links` (`source_url`);
