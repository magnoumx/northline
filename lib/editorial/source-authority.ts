export type SourceKind = "PRIMARY" | "INDEPENDENT" | "CONTEXT";

export type SourceRegistryEntry = {
  domain: string;
  sourceType: string;
  credibilityTier: number;
  isPrimary: boolean;
};

export type ModelProposedSource = {
  url: string;
  domain: string;
  sourceKind: SourceKind;
  sourceType: string;
};

export type ResolvedSourceAuthority = {
  /** Host taken from the URL itself, never from the model. */
  domain: string;
  sourceKind: SourceKind;
  sourceType: string;
  credibilityTier: number;
  /** True only when a server-side rule, not the model, established it. */
  primaryConfirmedByPolicy: boolean;
  downgradeReason: string | null;
};

/**
 * Domains whose pages are first-party records by definition. A claim of
 * PRIMARY from any other domain is a suggestion, not an authority.
 */
const PRIMARY_SUFFIXES = [".gov", ".mil", ".int"];

/**
 * First-party records that are not government.
 *
 * The policy list was government-only, which suited hard news and fitted almost
 * nothing this publication actually covers. A film, a signing or a product
 * launch has no `.gov` record, so `primaryCount` was structurally zero on those
 * beats and the articles piled up unpublishable - 15 of 24 stuck stories had no
 * primary source at all.
 *
 * The standard is unchanged: a first-party record is the account published by
 * the party the story is about. A league announcing its own fixture, a studio
 * releasing its own trailer, a company publishing its own results. Trade press
 * reporting those events is independent corroboration, not a primary record,
 * and is deliberately absent here.
 */
const PRIMARY_EXACT = new Set([
  "supremecourt.gov",
  "congress.gov",
  "federalregister.gov",
  "sec.gov",
  "federalreserve.gov",
  "bls.gov",
  "noaa.gov",
  "usgs.gov",
  "nasa.gov",
  "cdc.gov",
  "fda.gov",
  "nhtsa.gov",
  "who.int",
  "europa.eu",
  "un.org",

  // Leagues and governing bodies, for the events they themselves stage.
  "mlb.com",
  "nba.com",
  "nfl.com",
  "nhl.com",
  "ncaa.com",
  "mlssoccer.com",
  "atptour.com",
  "wtatennis.com",
  "pgatour.com",
  "nascar.com",
  "ufc.com",
  "formula1.com",
  "fifa.com",
  "uefa.com",
  "olympics.com",

  // Studios and networks, for their own titles, casting and release dates.
  "marvel.com",
  "dc.com",
  "sonypictures.com",
  "warnerbros.com",
  "universalpictures.com",
  "paramountpictures.com",
  "paramountpressexpress.com",
  "searchlightpictures.com",
  "focusfeatures.com",
  "a24films.com",
  "lionsgate.com",
  "thewaltdisneycompany.com",
  "about.netflix.com",
  "press.hulu.com",
  "press.wbd.com",

  // Companies, for their own products, filings and statements.
  "apple.com",
  "samsung.com",
  "microsoft.com",
  "nvidia.com",
  "tesla.com",
  "openai.com",
  "anthropic.com",
  "blog.google",
  "about.fb.com",

  // Newswires carry the party's own release verbatim, which is why a statement
  // distributed here is still that party speaking rather than a report about
  // them.
  "prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
]);

export function normalizeSourceDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "")
    .replace(/\.$/u, "");
}

/** Extracts the host from the URL. Returns null for anything unusable. */
export function domainFromUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = normalizeSourceDomain(url.hostname);
    return /^[a-z0-9.-]+\.[a-z]{2,}$/u.test(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * Whether server-side policy - not a model - considers this domain a
 * first-party record. Exported because the registry writer needs the same
 * answer: a model's opinion must never become a registry fact.
 */
export function isPolicyPrimaryDomain(domain: string): boolean {
  if (PRIMARY_EXACT.has(domain)) return true;
  return PRIMARY_SUFFIXES.some((suffix) => domain.endsWith(suffix));
}

/**
 * Independent press. These are corroborators by definition and are never
 * promoted to first-party by the subject-match below, even when the outlet is
 * itself named in a story ("Bloomberg reports..."). An allowlist of primary
 * domains can never cover the long tail - every studio, league, company and
 * person has its own site - so the real test of a first-party record is
 * whether the domain belongs to the party the story is about. This set is the
 * guard that keeps that test from misfiring on the outlets doing the reporting.
 */
const INDEPENDENT_PRESS = new Set([
  "reuters.com", "apnews.com", "ap.org", "bloomberg.com", "nytimes.com",
  "washingtonpost.com", "wsj.com", "theguardian.com", "bbc.com", "bbc.co.uk",
  "cnn.com", "foxnews.com", "nbcnews.com", "cbsnews.com", "abcnews.go.com",
  "usatoday.com", "variety.com", "deadline.com", "hollywoodreporter.com",
  "thewrap.com", "techcrunch.com", "theverge.com", "wired.com", "engadget.com",
  "arstechnica.com", "espn.com", "cnbc.com", "forbes.com", "businessinsider.com",
  "axios.com", "politico.com", "thehill.com", "npr.org", "aljazeera.com",
]);

/**
 * The registrable brand label of a domain: "netflix" from netflix.com or
 * about.netflix.com, "draper" from draper.vc. The label immediately before the
 * final TLD label is a good-enough approximation for the single-part TLDs these
 * sources use.
 */
function brandLabel(domain: string): string {
  const labels = domain.split(".");
  return labels.length >= 2 ? labels[labels.length - 2] : "";
}

/**
 * Whether a domain is the first-party record for the story's subject: its brand
 * is named in the story. "Netflix Orders The Gentlemen Season 2" makes
 * netflix.com first-party; "Tim Draper Secures $150M Fund VIII" makes draper.vc
 * first-party. Short brands are ignored to avoid coincidental matches, and
 * independent press can never qualify.
 */
export function isFirstPartyForSubject(
  domain: string,
  subjectText: string | undefined,
): boolean {
  if (!subjectText) return false;
  if (INDEPENDENT_PRESS.has(domain)) return false;
  const brand = brandLabel(domain);
  if (brand.length < 4) return false;
  const haystack = subjectText.toLowerCase().replace(/[^a-z0-9]+/gu, " ");
  return new RegExp(`\\b${brand}\\b`, "u").test(haystack);
}

/**
 * Decides what a source actually is. The model may propose a role, but the
 * fields the publication gate reads are derived here from the resolved URL and
 * the operator-maintained registry. A fabricated `domain` field can no longer
 * borrow the identity of a trusted publisher, and a model cannot promote its
 * own link to primary evidence.
 */
export function resolveSourceAuthority(
  proposed: ModelProposedSource,
  registry: readonly SourceRegistryEntry[],
  subjectText?: string,
): ResolvedSourceAuthority | null {
  const domain = domainFromUrl(proposed.url);
  if (!domain) return null;

  const declared = normalizeSourceDomain(proposed.domain);
  const registryEntry = registry.find(
    (entry) => normalizeSourceDomain(entry.domain) === domain,
  );

  // A first-party record for the story's subject counts as primary even when
  // the domain is not on the curated allowlist - the allowlist cannot enumerate
  // every studio, company and person a newsroom covers. Guarded three ways: the
  // model must have proposed PRIMARY, it must not be spoofing its own domain,
  // and the domain's brand must actually be named in the story. This is what
  // stopped netflix.com and draper.vc from being downgraded so hard that every
  // article read as unsourced and none could publish.
  // A first-party domain is a first-party record whatever the model called it.
  // The model routinely under-labels these - it tagged netflix.com's own page
  // for a Netflix show as INDEPENDENT - so requiring a PRIMARY proposal here
  // left the fix inert and every such story still read as unsourced. Policy
  // decides in both directions; the guards below (no domain spoof, not
  // independent press, brand actually named in the story) are what keep this
  // from over-promoting.
  const declaredMatchesResolved = !declared || declared === domain;
  const subjectPrimary =
    declaredMatchesResolved && isFirstPartyForSubject(domain, subjectText);

  const policyPrimary =
    isPolicyPrimaryDomain(domain) ||
    registryEntry?.isPrimary === true ||
    subjectPrimary;

  let sourceKind: SourceKind = proposed.sourceKind;
  let downgradeReason: string | null = null;

  if (declared && declared !== domain) {
    downgradeReason = `declared domain ${declared} does not match ${domain}`;
    sourceKind = sourceKind === "PRIMARY" ? "CONTEXT" : sourceKind;
  }

  if (sourceKind === "PRIMARY" && !policyPrimary) {
    sourceKind = "INDEPENDENT";
    downgradeReason ??= `${domain} is not a policy primary source`;
  }

  // Policy decides in both directions, or it is not policy.
  //
  // Only over-claims were corrected, so a model that under-labelled a
  // first-party record left it under-labelled for good: a flood story cited
  // forecast.weather.gov as CONTEXT and was then held back for having no
  // primary source. What a source *is* does not depend on how the model chose
  // to describe it.
  //
  // Not applied when the declared domain did not match the resolved one - a
  // source that misrepresented its own identity is not promoted on the strength
  // of the host it turned out to have.
  if (policyPrimary && !downgradeReason) {
    sourceKind = "PRIMARY";
  }

  return {
    domain,
    sourceKind,
    sourceType: registryEntry?.sourceType ?? proposed.sourceType,
    credibilityTier:
      registryEntry?.credibilityTier ?? (policyPrimary ? 2 : 3),
    primaryConfirmedByPolicy: policyPrimary && sourceKind === "PRIMARY",
    downgradeReason,
  };
}
