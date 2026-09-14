-- Records which article went out in which issue.
--
-- Without this the composer has no memory: every send would rebuild "the five
-- newest stories" and subscribers would receive the same coverage repeatedly
-- until something newer displaced it.
CREATE TABLE IF NOT EXISTS `newsletter_issue_articles` (
  `issue_id` text NOT NULL,
  `article_id` text NOT NULL,
  `position` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  PRIMARY KEY (`issue_id`, `article_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `newsletter_issue_articles_article_idx`
  ON `newsletter_issue_articles` (`article_id`);
