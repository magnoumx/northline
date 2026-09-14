import type { Story } from "../site/types";

export function isNewsSitemapEligible(
  story: Story,
  now = new Date(),
): boolean {
  if (story.isDemo || !story.publishedAtIso) return false;
  const publishedAt = Date.parse(story.publishedAtIso);
  const current = now.getTime();
  return (
    Number.isFinite(publishedAt) &&
    publishedAt <= current + 5 * 60 * 1000 &&
    publishedAt >= current - 48 * 60 * 60 * 1000 &&
    Boolean(story.headline.trim()) &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(story.slug)
  );
}

export function validPublishedDate(value: string | undefined): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}
