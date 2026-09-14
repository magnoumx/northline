export type ArticleSearchItem = {
  label: string;
  text: string;
};

export function calculateReadingProgressBps(input: {
  scrollY: number;
  articleTop: number;
  articleHeight: number;
  viewportHeight: number;
}): number {
  const available = Math.max(1, input.articleHeight - input.viewportHeight);
  const raw = ((input.scrollY - input.articleTop) / available) * 10_000;
  return Math.max(0, Math.min(10_000, Math.round(raw)));
}

export function canResumeReading(progressBps: number): boolean {
  return progressBps >= 500 && progressBps < 9500;
}

export function changedSinceLastVisit(
  previousVersion: string | null,
  currentVersion: string,
): boolean {
  return previousVersion !== null && previousVersion !== currentVersion;
}

export function searchArticleItems(
  items: readonly ArticleSearchItem[],
  query: string,
  limit = 6,
): readonly ArticleSearchItem[] {
  const needle = query.trim().toLocaleLowerCase("en-US");
  if (needle.length < 2) return [];
  return items
    .filter((item) => item.text.toLocaleLowerCase("en-US").includes(needle))
    .slice(0, Math.max(0, limit));
}
