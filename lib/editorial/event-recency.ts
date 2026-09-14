/**
 * Detects an article whose reporting describes an event far older than the day
 * it is being published.
 *
 * The newsroom published a Chicago Bears contract signed in **July 2024** with a
 * `datePublished` of **16 August 2026**, and submitted it to Google News with a
 * matching `news:publication_date`. It was not an isolated case: 24 of 91
 * published articles opened by narrating a 2023, 2024 or 2025 event. Nothing in
 * the pipeline compared the date *inside* the reporting with the date being
 * stamped on it, because every existing gate measured sourcing and wording
 * rather than time.
 *
 * Google's spam policy names "automated transformations" of existing material as
 * scaled content abuse, and a two-year-old story restamped as today's news is
 * that pattern whatever the intent behind it.
 *
 * The detector reads only the lede. A current story routinely cites history in
 * its later paragraphs - "the franchise has not won since 2019" - and penalising
 * that would be wrong. What distinguishes a stale republication is that the
 * *opening* anchors the whole piece in the past.
 */

export type EventRecency = {
  /** True when the lede anchors the story in a materially older period. */
  stale: boolean;
  /** Newest year the lede anchors to, when one was found. */
  anchorYear?: number;
  /** Newest anchored month (1-12), when the lede named one. */
  anchorMonth?: number;
  /** Whole months between the newest anchor and publication. */
  monthsBehind?: number;
};

/** How far back the lede may reach before the article stops being news. */
export const DEFAULT_MAXIMUM_EVENT_AGE_MONTHS = 6;

/**
 * Characters of body text treated as the lede for the bare-year patterns. A
 * story dates its own event in the opening; a history citation ("not won since
 * 2019") tends to sit deeper, so a bare year is only trusted this far in.
 */
const LEDE_CHARACTERS = 700;

/**
 * A written-out calendar date is trusted further into the body than a bare
 * year, because in news writing a full date is almost always the event date,
 * not incidental history. This is how "O.J. Simpson died on April 10, 2024" and
 * a fight dated "November 15, 2024" - both just past the lede cutoff - get
 * caught without also flagging a current story that cites an old year in passing.
 */
const FULL_DATE_CHARACTERS = 1200;

const MONTHS: Readonly<Record<string, number>> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Phrases that place the narration at a point in time: "In July 2024", "during
 * the 2024 season", "back in 2023". A bare year is deliberately not enough - a
 * lede mentioning a jersey number or a dollar figure that happens to look like a
 * year must not trip the gate.
 */
const ANCHOR_PATTERN = new RegExp(
  String.raw`\b(?:in|on|during|back in|throughout|since|as of|ahead of|following|after)\s+` +
    String.raw`(?:the\s+)?(?:(?:late|early|mid|middle of|start of|end of)\s+)?` +
    String.raw`(?:(january|february|march|april|may|june|july|august|september|october|november|december)\s+)?` +
    String.raw`((?:19|20)\d{2})\b`,
  "giu",
);

/** "the 2024 season", "2025 spring training" - a year qualifying a named period. */
const QUALIFIED_YEAR_PATTERN = new RegExp(
  String.raw`\b((?:19|20)\d{2})\s+(?:season|campaign|spring training|draft|playoffs|tournament|championship|series|olympics|world cup)\b`,
  "giu",
);

/**
 * A written-out calendar date - "April 10, 2024", "November 15th 2024". In news
 * writing a full date in the opening is almost always the date of the event
 * being reported, so its year anchors the story even without a preposition in
 * front of it. This is the pattern the preposition-only rule kept missing.
 */
const FULL_DATE_PATTERN = new RegExp(
  String.raw`\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+` +
    String.raw`\d{1,2}(?:st|nd|rd|th)?,?\s+((?:19|20)\d{2})\b`,
  "giu",
);

export function detectEventRecency(
  body: string,
  publishedAt: Date,
  options: { maximumAgeMonths?: number } = {},
): EventRecency {
  const maximumAgeMonths =
    options.maximumAgeMonths ?? DEFAULT_MAXIMUM_EVENT_AGE_MONTHS;
  const lede = body.slice(0, LEDE_CHARACTERS).toLowerCase();

  let anchorYear: number | undefined;
  let anchorMonth: number | undefined;

  const consider = (year: number, month?: number) => {
    if (anchorYear === undefined || year > anchorYear) {
      anchorYear = year;
      anchorMonth = month;
      return;
    }
    // Same year: keep the latest month so a lede naming several months in one
    // year is measured from the most recent of them.
    if (year === anchorYear && month !== undefined) {
      if (anchorMonth === undefined || month > anchorMonth) anchorMonth = month;
    }
  };

  for (const match of lede.matchAll(ANCHOR_PATTERN)) {
    const month = match[1] ? MONTHS[match[1]] : undefined;
    consider(Number(match[2]), month);
  }
  for (const match of lede.matchAll(QUALIFIED_YEAR_PATTERN)) {
    consider(Number(match[1]));
  }
  const earlyBody = body.slice(0, FULL_DATE_CHARACTERS).toLowerCase();
  for (const match of earlyBody.matchAll(FULL_DATE_PATTERN)) {
    consider(Number(match[2]), MONTHS[match[1]]);
  }

  // No temporal anchor at all. The detector cannot tell, and guessing "stale"
  // would block ordinary reporting that simply does not date itself.
  if (anchorYear === undefined) return { stale: false };

  const publishedYear = publishedAt.getUTCFullYear();
  const publishedMonth = publishedAt.getUTCMonth() + 1;
  // An anchor without a named month is measured from the latest point in that
  // year that is not in the future: December for a past year, and the current
  // month for the publication year itself. Reading a bare "in 2026" as January
  // would make an article published in August look seven months stale.
  const effectiveMonth =
    anchorMonth ?? (anchorYear < publishedYear ? 12 : publishedMonth);
  const monthsBehind =
    (publishedYear - anchorYear) * 12 + (publishedMonth - effectiveMonth);

  return {
    stale: monthsBehind > maximumAgeMonths,
    anchorYear,
    anchorMonth,
    monthsBehind,
  };
}
