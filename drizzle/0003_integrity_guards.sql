-- Freeze the version already serving any valid public article created before
-- the published-version column existed. The article timestamp is authoritative.
UPDATE `article_versions`
SET `published_at` = (
  SELECT `articles`.`published_at`
  FROM `articles`
  WHERE `articles`.`current_version_id` = `article_versions`.`id`
    AND `articles`.`id` = `article_versions`.`article_id`
)
WHERE `published_at` IS NULL
  AND EXISTS (
    SELECT 1
    FROM `articles`
    WHERE `articles`.`current_version_id` = `article_versions`.`id`
      AND `articles`.`id` = `article_versions`.`article_id`
      AND `articles`.`published_at` IS NOT NULL
      AND `articles`.`state` IN (
        'PUBLISHED',
        'DEVELOPING',
        'UPDATED',
        'CORRECTED',
        'RETRACTED',
        'ARCHIVED'
      )
  );--> statement-breakpoint
-- Make the migration fail closed if legacy data still violates either pointer
-- ownership or the public/frozen-version contract.
CREATE TABLE `__article_integrity_migration_check` (
  `valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__article_integrity_migration_check` (`valid`)
SELECT 0
WHERE EXISTS (
  SELECT 1
  FROM `articles`
  LEFT JOIN `article_versions`
    ON `article_versions`.`id` = `articles`.`current_version_id`
  WHERE (
    `articles`.`current_version_id` IS NOT NULL
    AND (
      `article_versions`.`id` IS NULL
      OR `article_versions`.`article_id` <> `articles`.`id`
    )
  )
  OR (
    `articles`.`state` IN (
      'PUBLISHED',
      'DEVELOPING',
      'UPDATED',
      'CORRECTED',
      'RETRACTED',
      'ARCHIVED'
    )
    AND (
      `articles`.`published_at` IS NULL
      OR `articles`.`current_version_id` IS NULL
      OR `article_versions`.`published_at` IS NULL
    )
  )
);--> statement-breakpoint
DROP TABLE `__article_integrity_migration_check`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `articles_current_version_same_article_update`;--> statement-breakpoint
CREATE TRIGGER `articles_current_version_same_article_update`
BEFORE UPDATE ON `articles`
WHEN NEW.`current_version_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `article_versions`
    WHERE `id` = NEW.`current_version_id`
      AND `article_id` = NEW.`id`
  )
BEGIN
  SELECT RAISE(ABORT, 'current article version must belong to the same article');
END;--> statement-breakpoint
CREATE TRIGGER `article_versions_cannot_leave_current_article`
BEFORE UPDATE OF `article_id` ON `article_versions`
WHEN NEW.`article_id` <> OLD.`article_id`
  AND EXISTS (
    SELECT 1 FROM `articles`
    WHERE `current_version_id` = OLD.`id`
  )
BEGIN
  SELECT RAISE(ABORT, 'a current version cannot move to another article');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `articles_published_state_requires_frozen_version`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `articles_public_current_version_requires_frozen_version`;--> statement-breakpoint
CREATE TRIGGER `articles_public_update_requires_frozen_version`
BEFORE UPDATE ON `articles`
WHEN NEW.`state` IN (
  'PUBLISHED',
  'DEVELOPING',
  'UPDATED',
  'CORRECTED',
  'RETRACTED',
  'ARCHIVED'
)
  AND (
    NEW.`published_at` IS NULL
    OR NEW.`current_version_id` IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM `article_versions`
      WHERE `id` = NEW.`current_version_id`
        AND `article_id` = NEW.`id`
        AND `published_at` IS NOT NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'public articles require a timestamped frozen current version');
END;
