/**
 * Contextual links inside article prose.
 *
 * Major publications turn the names in a story - people, teams, titles,
 * agencies - into links to their coverage of that subject. It is the single
 * highest-value thing a newsroom can do for both readers and search: it builds
 * a real internal link graph instead of a pile of orphan pages.
 *
 * Two rules make it safe here:
 *
 *  1. This runs at render time and never touches stored text. The published
 *     body keeps the exact bytes independent review approved, so the body hash
 *     and the unapproved-link check stay meaningful.
 *  2. A link is only offered for a subject we have actually published. A link
 *     to nothing is worse than plain text - that was the trending page's
 *     mistake, and it is not repeated here.
 */

export type LinkableEntity = {
  /** Exact phrase as it appears in prose, for example "Tour de France". */
  phrase: string;
  href: string;
};

export type ProseSegment =
  | { kind: "text"; value: string }
  | { kind: "link"; value: string; href: string };

/**
 * Headline vocabulary. A headline is title-cased, so "Wins" and "Claims" look
 * exactly like names; without this the extractor returns "Van der Poel Wins"
 * and never matches the prose, which is why the first version produced no
 * links at all.
 */
const HEADLINE_NOISE = new Set([
  "wins", "win", "won", "claims", "claim", "says", "said", "makes", "made",
  "takes", "took", "becomes", "became", "is", "are", "was", "were", "has",
  "have", "will", "after", "before", "amid", "against", "as", "into", "over",
  "first", "new", "official", "officially", "report", "reports", "live",
  "blog", "update", "updates", "guide", "why", "how", "what", "when",
  "returns", "opens", "faces", "leads", "hits", "sets", "gets", "dominates",
  "most", "best", "top", "star", "crown", "season", "series", "game", "debut",
]);

/** Words that are never a subject on their own, however they are capitalised. */
const STOP_PHRASES = new Set([
  "the", "a", "an", "and", "but", "for", "in", "of", "on", "to", "with",
  "he", "she", "it", "they", "we", "you", "i", "this", "that", "these",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Builds the candidate set from published coverage. A story contributes its
 * topics and the proper-noun phrases in its headline, because those are what a
 * reader would recognise as "the subject" of that page.
 */
export function collectLinkableEntities(
  stories: readonly {
    slug: string;
    headline: string;
    dek?: string;
    topics: readonly string[];
  }[],
  options: { excludeSlug?: string } = {},
): LinkableEntity[] {
  const byPhrase = new Map<string, LinkableEntity>();

  for (const story of stories) {
    if (story.slug === options.excludeSlug) continue;
    const href = `/story/${story.slug}`;

    // Headlines are title-cased, so every word looks like a name and
    // "Van der Poel Wins" comes out as one phrase. The deck is written in
    // sentence case, where a capital letter still means something.
    const candidates = [
      ...story.topics,
      ...properNounPhrases(story.dek ?? ""),
      ...properNounPhrases(story.headline).map(trimHeadlineNoise),
    ];

    for (const raw of candidates) {
      const phrase = raw.trim().replace(/\s+/gu, " ");
      if (phrase.length < 4) continue;
      const key = phrase.toLowerCase();
      if (STOP_PHRASES.has(key)) continue;
      // A single word has to be distinctive to be worth linking; multi-word
      // phrases are specific enough on their own.
      if (!phrase.includes(" ") && phrase.length < 6) continue;
      if (!byPhrase.has(key)) byPhrase.set(key, { phrase, href });
    }
  }

  // Longest first, so "Tour de France" wins over "France".
  return [...byPhrase.values()].sort(
    (left, right) => right.phrase.length - left.phrase.length,
  );
}

/**
 * Strips headline verbs from the edges of an extracted phrase, so
 * "Van der Poel Wins" becomes "Van der Poel" - a phrase that actually occurs
 * in the article body.
 */
export function trimHeadlineNoise(phrase: string): string {
  let words = phrase.split(/\s+/u).filter(Boolean);
  while (words.length > 0 && HEADLINE_NOISE.has(words[0].toLowerCase())) {
    words = words.slice(1);
  }
  while (
    words.length > 0 &&
    HEADLINE_NOISE.has(words[words.length - 1].toLowerCase())
  ) {
    words = words.slice(0, -1);
  }
  return words.join(" ");
}

/** Consecutive capitalised words, the shape a name takes in English prose. */
export function properNounPhrases(value: string): string[] {
  const cleaned = value.replace(/[":,;—–-]+/gu, " ");
  const matches = cleaned.match(
    /\b[A-Z][\p{L}'’.]*(?:\s+(?:of|de|van|der|la|le)\s+[A-Z][\p{L}'’.]*|\s+[A-Z][\p{L}'’.]*)*/gu,
  );
  return (matches ?? [])
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.split(/\s+/u).length <= 5);
}

/**
 * Splits a paragraph into text and link segments.
 *
 * Only the first mention of each subject is linked, across the whole article,
 * which is why `used` is threaded in by the caller. Repeating the same link in
 * every paragraph reads as spam and search engines treat it that way.
 */
export function linkifyParagraph(
  paragraph: string,
  entities: readonly LinkableEntity[],
  used: Set<string>,
  options: { maximumLinks?: number } = {},
): ProseSegment[] {
  const maximumLinks = options.maximumLinks ?? 8;
  if (entities.length === 0 || used.size >= maximumLinks) {
    return [{ kind: "text", value: paragraph }];
  }

  const segments: ProseSegment[] = [{ kind: "text", value: paragraph }];

  for (const entity of entities) {
    if (used.size >= maximumLinks) break;
    const key = entity.phrase.toLowerCase();
    if (used.has(key)) continue;

    const pattern = new RegExp(`\\b${escapeRegExp(entity.phrase)}\\b`, "u");
    const index = segments.findIndex(
      (segment) => segment.kind === "text" && pattern.test(segment.value),
    );
    if (index === -1) continue;

    const target = segments[index] as { kind: "text"; value: string };
    const match = pattern.exec(target.value);
    if (!match || match.index === undefined) continue;

    const before = target.value.slice(0, match.index);
    const after = target.value.slice(match.index + match[0].length);
    const replacement: ProseSegment[] = [];
    if (before) replacement.push({ kind: "text", value: before });
    replacement.push({ kind: "link", value: match[0], href: entity.href });
    if (after) replacement.push({ kind: "text", value: after });

    segments.splice(index, 1, ...replacement);
    used.add(key);
  }

  return segments;
}
