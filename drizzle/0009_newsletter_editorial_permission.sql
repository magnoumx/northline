INSERT OR IGNORE INTO `permissions` (`id`,`key`,`description`) VALUES
  ('perm_newsletter_manage','newsletter.manage','Create and approve newsletter issues.');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`,`permission_id`) VALUES
  ('role_editor_in_chief','perm_newsletter_manage'),
  ('role_managing_editor','perm_newsletter_manage'),
  ('role_news_editor','perm_newsletter_manage');
