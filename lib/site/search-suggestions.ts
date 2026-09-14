/**
 * Category names, exactly as `lib/editorial/topic-derivation.ts` renders
 * them - so they can be told apart from the specific people, teams, and
 * events also stored in `story.topics`. The nav bar already covers "Sports"
 * and "U.S. News"; a search suggestion earns its place by naming something
 * more specific than the section a reader is already standing in.
 */
const CATEGORY_TOPIC_NAMES = new Set(
  [
    "U.S. News", "World", "Politics", "Business", "Finance", "Technology",
    "Science", "Health", "Sports", "Entertainment", "Gaming", "Weather",
    "Internet",
  ].map((name) => name.toLowerCase()),
);

/**
 * Real subjects to suggest in the search dialog, not a static example that
 * drifts from whatever the site currently covers.
 */
export function distinctSubjects(topics: readonly string[]): string[] {
  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const topic of topics) {
    const key = topic.trim().toLowerCase();
    if (!key || CATEGORY_TOPIC_NAMES.has(key) || seen.has(key)) continue;
    seen.add(key);
    subjects.push(topic);
  }
  return subjects;
}
