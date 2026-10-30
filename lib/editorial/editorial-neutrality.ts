/**
 * Deterministic neutrality checks on a finished draft.
 *
 * The Schumer story went live with the dek "A crucial judicial victory against
 * administration propaganda provides political lift" and a 1,461-word body
 * that never once said who said what. It was filed as US_NEWS, so the
 * high-risk-category rule never saw it. None of these checks rejects a story:
 * each one only sends it to a human instead of publishing it automatically.
 */

/**
 * Words that make a news headline or dek an opinion. Kept narrow on purpose:
 * each one either judges the news ("crucial", "stunning") or adopts one side's
 * label for it ("propaganda", "slams"). A quote in the body is not checked,
 * because there it is attributed.
 */
const LOADED_TERMS = [
  "propaganda",
  "crucial",
  "dramatic",
  "dramatically",
  "stunning",
  "shocking",
  "bombshell",
  "explosive",
  "outrageous",
  "disastrous",
  "devastating",
  "humiliating",
  "unequivocally",
  "slams",
  "slammed",
  "blasts",
  "blasted",
  "destroys",
  "eviscerates",
  "epic",
] as const;

const ATTRIBUTION =
  /\b(said|says|according to|announced|told|stated|wrote|reported|confirmed|testified|ruled|declared|argued|added)\b/u;

/**
 * Terms that only appear when a story is about government or party politics.
 * Generic words that sport and business share ("campaign", "president",
 * "vote") are left out, and three distinct terms are needed, so a match is a
 * political story rather than a passing mention.
 */
const POLITICAL_TERMS = [
  "senate",
  "senator",
  "congress",
  "congressional",
  "white house",
  "democrat",
  "democrats",
  "democratic party",
  "republican",
  "republicans",
  "gop",
  "lawmakers",
  "caucus",
  "filibuster",
  "impeachment",
  "midterm",
  "midterms",
  "governor",
  "trump administration",
  "biden administration",
  "speaker of the house",
  "house speaker",
  "majority leader",
  "minority leader",
] as const;

/** Body length below which a missing attribution is not judged. */
const ATTRIBUTION_MIN_WORDS = 400;
const POLITICAL_MIN_DISTINCT_TERMS = 3;

export type NeutralityAssessment = {
  /** Loaded words found in the headline or dek, lower-cased, in list order. */
  loadedTerms: string[];
  /** A body of real length that never says who said what. */
  missingAttribution: boolean;
  /** Distinct political terms found anywhere in the draft. */
  politicalTerms: string[];
};

function wordsOf(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim()} `;
}

export function assessNeutrality(input: {
  headline: string;
  subheadline?: string | null;
  body: string;
}): NeutralityAssessment {
  const display = wordsOf(`${input.headline} ${input.subheadline ?? ""}`);
  const body = input.body.toLowerCase();
  const everything = wordsOf(`${input.headline} ${input.subheadline ?? ""} ${input.body}`);
  const bodyWords = body.split(/\s+/u).filter(Boolean).length;

  return {
    loadedTerms: LOADED_TERMS.filter((term) => display.includes(` ${term} `)),
    missingAttribution: bodyWords >= ATTRIBUTION_MIN_WORDS && !ATTRIBUTION.test(body),
    politicalTerms: POLITICAL_TERMS.filter((term) => everything.includes(` ${term} `)),
  };
}

export function isPoliticalStory(assessment: NeutralityAssessment): boolean {
  return assessment.politicalTerms.length >= POLITICAL_MIN_DISTINCT_TERMS;
}
