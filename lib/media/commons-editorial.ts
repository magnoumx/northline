import { sha256Base64Url } from "../security/crypto";
import { inspectEditorialImage } from "./image-safety";

export type CommonsEditorialMediaInput = {
  database: D1Database;
  articleVersionId: string;
  headline: string;
  category: string;
  /**
   * The trend term the story came from, for example "rebecca ferguson". Commons
   * is an entity archive, so the plain subject finds photographs that a long
   * editorial headline never matches.
   */
  subject?: string;
  /** Extra licensed pictures placed inside the body. */
  maximumInlineImages?: number;
};

export type CommonsEditorialMediaResult = {
  mediaId: string;
  publicUrl: string;
  originalUrl: string;
  attribution: string;
  license: string;
};

type CommonsMetadataField = {
  value?: string;
};

type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  mime?: string;
  size?: number;
  width?: number;
  height?: number;
  user?: string;
  extmetadata?: Record<string, CommonsMetadataField>;
};

type CommonsPage = {
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

type CommonsResponse = {
  query?: {
    pages?: Record<string, CommonsPage>;
  };
};

/**
 * An exact allowlist. The previous word-boundary expression prefix matched, so
 * "CC BY-NC 4.0" and "CC BY-ND 4.0" passed as if they were "CC BY" and a
 * noncommercial or no-derivatives image could reach a commercial news page.
 */
const ACCEPTED_LICENSES = new Set([
  "CC0",
  "CC0 1.0",
  "PUBLIC DOMAIN",
  "PDM",
  "PDM 1.0",
  "CC BY 1.0",
  "CC BY 2.0",
  "CC BY 2.5",
  "CC BY 3.0",
  "CC BY 4.0",
  "CC BY-SA 1.0",
  "CC BY-SA 2.0",
  "CC BY-SA 2.5",
  "CC BY-SA 3.0",
  "CC BY-SA 4.0",
]);

/**
 * Tokens that disqualify a licence outright. This was a regular expression
 * whose word-boundary escapes had been mangled into literal control
 * characters, so the check never fired and the accepted-licence allowlist was
 * the only thing standing between a noncommercial or no-derivatives image and
 * a commercial news page. Comparing tokens cannot be corrupted that way.
 */
const REJECTED_LICENSE_TOKENS = new Set([
  "NC",
  "ND",
  "NONCOMMERCIAL",
  "NON-COMMERCIAL",
  "NODERIV",
  "NODERIVS",
  "NODERIVATIVE",
  "NODERIVATIVES",
]);

export function licenseTokens(value: string): string[] {
  return value
    .toUpperCase()
    .split(/[^A-Z0-9-]+/u)
    .flatMap((token) => [token, ...token.split("-")])
    .filter(Boolean);
}

export function isAcceptedCommonsLicense(value: string): boolean {
  const normalized = value
    .replaceAll(/[_-]+(?=\d)/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .toUpperCase()
    .replace(/^CC-BY/u, "CC BY")
    .replace(/^CC-0/u, "CC0");

  if (!normalized) return false;
  if (licenseTokens(normalized).some((token) => REJECTED_LICENSE_TOKENS.has(token))) {
    return false;
  }
  return ACCEPTED_LICENSES.has(normalized);
}
const STOP_WORDS = new Set([
  "after",
  "against",
  "amid",
  "and",
  "as",
  "at",
  "before",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "its",
  "of",
  "on",
  "over",
  "the",
  "to",
  "vs",
  "with",
  "wins",
  "win",
  "claims",
  "takes",
  "makes",
  "live",
  "blog",
  "breaking",
  "latest",
]);

export async function registerLicensedCommonsMedia(
  input: CommonsEditorialMediaInput,
): Promise<CommonsEditorialMediaResult | null> {
  const queries = searchQueries(
    input.headline,
    input.category,
    input.subject,
  );
  // Every article was falling back to the house graphic with no explanation, so
  // the outcome of each stage is recorded. Only counts and rejection reasons are
  // logged, never article content.
  const trace: string[] = [];
  let hero: CommonsEditorialMediaResult | null = null;
  let inlineCount = 0;
  const maximumInline = Math.max(0, input.maximumInlineImages ?? 2);

  for (const query of queries) {
    const candidates = await searchCommons(query);
    let relevant = 0;

    for (const candidate of candidates) {
      if (!isRelevantCandidate(candidate, input.headline, input.subject)) {
        continue;
      }
      // Commons is a medical and forensic archive too. A correct licence is not
      // permission to put a surgical photograph above a news story.
      const safety = inspectEditorialImage({
        title: candidate.pageTitle,
        description: candidate.description,
        category: input.category,
      });
      if (!safety.publishable) {
        console.warn("commons_media_refused_unsafe", {
          reason: safety.reason,
          pageTitle: candidate.pageTitle.slice(0, 120),
        });
        continue;
      }
      relevant += 1;
      if (!hero) {
        const result = await persistCandidate(input, candidate);
        if (result) {
          hero = result;
          console.warn("commons_media_selected", {
            query,
            license: candidate.license,
            mimeType: candidate.mimeType,
          });
        }
        continue;
      }
      // A story deserves more than one picture. Further matches run inside the
      // reporting, spaced through the body, still under the same licence rules.
      if (inlineCount < maximumInline && candidate.publicUrl !== hero.publicUrl) {
        const placed = await persistCandidate(input, candidate, {
          role: "INLINE",
          position: inlineCount + 1,
        });
        if (placed) inlineCount += 1;
      }
    }

    trace.push(
      `${query} -> licensed:${candidates.length} relevant:${relevant}`,
    );
    if (hero && inlineCount >= maximumInline) break;
  }

  if (hero) {
    console.warn("commons_media_complete", { inlineCount });
    return hero;
  }
  console.warn("commons_media_unavailable", { trace });
  return null;
}

type Candidate = {
  pageTitle: string;
  publicUrl: string;
  originalUrl: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  creator: string;
  copyrightOwner: string;
  license: string;
  licenseUrl: string | null;
  attribution: string;
  description: string;
};

async function searchCommons(query: string): Promise<Candidate[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|extmetadata|user");
  url.searchParams.set("iiurlwidth", "1600");
  url.searchParams.set(
    "iiextmetadatafilter",
    [
      "Artist",
      "Credit",
      "ImageDescription",
      "LicenseShortName",
      "LicenseUrl",
      "UsageTerms",
      "Copyrighted",
      "Restrictions",
    ].join("|"),
  );
  url.searchParams.set("origin", "*");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "NorthlineEditorialMedia/1.0 (https://usnorthline.com)",
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    console.warn("commons_search_unreachable", {
      query,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return [];
  }

  if (!response.ok) {
    console.warn("commons_search_rejected", {
      query,
      status: response.status,
    });
    return [];
  }

  let payload: CommonsResponse;
  try {
    payload = (await response.json()) as CommonsResponse;
  } catch {
    console.warn("commons_search_unreadable", { query });
    return [];
  }

  const pages = Object.values(payload.query?.pages ?? {});
  return pages.flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!info) return [];

    const metadata = info.extmetadata ?? {};
    const license = cleanHtml(
      metadata.LicenseShortName?.value ??
        metadata.UsageTerms?.value ??
        "",
    ).toUpperCase();

    if (!isAcceptedCommonsLicense(license)) return [];

    const restrictions = cleanHtml(metadata.Restrictions?.value ?? "");
    if (restrictions && !/^none$/iu.test(restrictions)) return [];

    const publicUrl = safeHttpsUrl(info.thumburl ?? info.url);
    const originalUrl = safeHttpsUrl(info.descriptionurl ?? info.url);
    if (!publicUrl || !originalUrl) return [];

    const mimeType = info.mime?.toLowerCase() ?? "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return [];
    }

    const creator = cleanHtml(
      metadata.Artist?.value ??
        metadata.Credit?.value ??
        info.user ??
        "Wikimedia Commons contributor",
    ).slice(0, 500);
    const licenseUrl = safeHttpsUrl(metadata.LicenseUrl?.value);
    const description = cleanHtml(
      metadata.ImageDescription?.value ?? page.title ?? query,
    ).slice(0, 500);
    const attribution = `${creator} / Wikimedia Commons / ${license}`.slice(
      0,
      500,
    );

    return [
      {
        pageTitle: page.title ?? query,
        publicUrl,
        originalUrl,
        mimeType,
        byteSize: Math.max(1, Math.trunc(info.size ?? 1)),
        width:
          Number.isFinite(info.width) && Number(info.width) > 0
            ? Math.trunc(Number(info.width))
            : null,
        height:
          Number.isFinite(info.height) && Number(info.height) > 0
            ? Math.trunc(Number(info.height))
            : null,
        creator,
        copyrightOwner: creator,
        license,
        licenseUrl,
        attribution,
        description,
      },
    ];
  });
}

async function persistCandidate(
  input: CommonsEditorialMediaInput,
  candidate: Candidate,
  placement: { role: "HERO" | "INLINE"; position: number } = {
    role: "HERO",
    position: 0,
  },
): Promise<CommonsEditorialMediaResult | null> {
  const checksum = await sha256Base64Url(
    `commons:${candidate.publicUrl}:${candidate.license}`,
  );
  const mediaId = `media_commons_${checksum.slice(0, 32)}`;
  const now = Date.now();

  try {
    await input.database.batch([
      input.database
        .prepare(
          `INSERT OR IGNORE INTO media_assets (
             id, storage_key, public_url, workflow_state, mime_type, byte_size,
             width, height, frame_count, checksum_sha256, creator,
             copyright_owner, original_url, license, license_url,
             usage_permission, attribution, downloaded_at, expires_at,
             verification_state, malware_scan_reference, metadata_stripped_at,
             created_at, updated_at
           ) VALUES (
             ?1, ?2, ?3, 'APPROVED', ?4, ?5,
             ?6, ?7, 1, ?8, ?9, ?10, ?11, ?12, ?13,
             'LICENSED_REUSE', ?14, NULL, NULL,
             'VERIFIED', 'COMMONS_METADATA_API', NULL, ?15, ?15
           )`,
        )
        .bind(
          mediaId,
          `licensed/commons/${checksum.slice(0, 40)}`,
          candidate.publicUrl,
          candidate.mimeType,
          candidate.byteSize,
          candidate.width,
          candidate.height,
          checksum,
          candidate.creator,
          candidate.copyrightOwner,
          candidate.originalUrl,
          candidate.license,
          candidate.licenseUrl,
          candidate.attribution,
          now,
        ),
      input.database
        .prepare(
          `INSERT OR IGNORE INTO article_media (
             article_version_id, media_asset_id, role, position,
             alt_text, caption, created_at
           ) VALUES (?1, ?2, ?6, ?7, ?3, ?4, ?5)`,
        )
        .bind(
          input.articleVersionId,
          mediaId,
          candidate.description || input.headline,
          `${candidate.description} — ${candidate.attribution}`.slice(0, 500),
          now,
          placement.role,
          placement.position,
        ),
    ]);
  } catch (error) {
    console.error("commons_media_persist_failed", {
      articleVersionId: input.articleVersionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  return {
    mediaId,
    publicUrl: candidate.publicUrl,
    originalUrl: candidate.originalUrl,
    attribution: candidate.attribution,
    license: candidate.license,
  };
}

/**
 * Two overlapping headline words used to be enough, which let a photograph of a
 * church illustrate an unrelated story and a portrait of one actor illustrate
 * two different articles. Ordinary vocabulary overlaps constantly; the only
 * signal that a picture is of *this* story is the story's subject - the proper
 * nouns naming who or what it is about. A wrong photograph is worse than none.
 */
export function isRelevantCandidate(
  candidate: Pick<Candidate, "pageTitle" | "description">,
  headline: string,
  subject?: string,
): boolean {
  const candidateTerms = new Set(
    meaningfulTerms(`${candidate.pageTitle} ${candidate.description}`),
  );

  const subjectTerms = meaningfulTerms(subject ?? "");
  if (subjectTerms.length > 0) {
    // The subject is what the article is about. If the picture does not name it,
    // the picture is of something else.
    //
    // Two independent terms must match. The previous threshold was
    // `Math.min(2, subjectTerms.length)`, which collapses to "one match is
    // enough" whenever the subject reduces to a single meaningful term - and
    // that is exactly what happened in production: "DJ Moore" loses "DJ" to the
    // three-character floor below, leaving only "moore", so a portrait of Sir
    // Roger Moore satisfied the gate and was published above an NFL contract
    // story as its hero image, its og:image and its schema image.
    //
    // A subject that cannot produce two matching terms cannot be distinguished
    // from anyone who happens to share that surname, that team name or that
    // place name. Such a subject now fails and the article falls back to the
    // house graphic. That deliberately loses some correct matches - a
    // one-word subject like "Everglades" can no longer be illustrated - and
    // that is the intended trade: this function exists because a wrong
    // photograph is worse than none.
    //
    // This remains lexical matching, not identity resolution. Two people with
    // identical full names would still pass; that needs an external entity
    // check this function does not have.
    const matched = subjectTerms.filter((term) => candidateTerms.has(term)).length;
    if (matched < 2) return false;

    // Two matching name terms still are not identity. A photograph captioned
    // "Alexander Zverev of Russia during the Men's 400M - T13 Semifinal" - a
    // Paralympic sprinter - satisfied a two-term match against the tennis
    // player and was published above an ATP story. "San Antonio, Nueva Ecija"
    // did the same to a story about Texas weather.
    //
    // What separated both from a correct match was not the name, it was the
    // rest of the caption describing a different world. Rejecting a candidate
    // whose description places it in a domain the article is not about costs
    // nothing on a correct match, where none of these words appear.
    return !contradictsSubject(candidateTerms);
  }

  const headlineTerms = meaningfulTerms(headline);
  if (headlineTerms.length === 0) return false;
  const overlap = headlineTerms.filter((term) => candidateTerms.has(term));
  // Without a subject to anchor on, demand three genuinely matching words - not
  // `Math.min(3, ...)`, which degrades to the same single-term hole for a short
  // headline.
  return overlap.length >= 3;
}

/**
 * Words that place a candidate in a world the story is not about.
 *
 * Deliberately small and concrete: each entry earned its place by appearing in
 * a caption that was actually published against the wrong article. This is a
 * blunt instrument and it is meant to be - it only has to catch a photograph
 * whose own description says it is of a building, a different sport, or a
 * different country's town, when the story is about a person or a place here.
 */
const CONTRADICTING_TERMS = new Set([
  // Structures, when the subject is a person.
  "elementary", "school", "chapel", "church", "cathedral", "monastery",
  "barangay", "municipality", "hall", "museum", "library",
  // Disability-sport classifications, which is how a sprinter reached a tennis
  // story: the names matched, the event did not.
  "paralympic", "t13", "t11", "t12", "f20", "wheelchair",
  // Military and naval captions that share surnames with athletes.
  "seaman", "airman", "boatswain", "petty", "aboard", "uss",
  // Devotional and ceremonial imagery.
  "icon", "procession", "shrine", "saint",
]);

function contradictsSubject(candidateTerms: ReadonlySet<string>): boolean {
  for (const term of CONTRADICTING_TERMS) {
    if (candidateTerms.has(term)) return true;
  }
  return false;
}

function meaningfulTerms(value: string): string[] {
  return value
    .replaceAll(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/u)
    .map((word) => word.trim().toLowerCase())
    .filter(
      (word) =>
        word.length >= 3 &&
        !STOP_WORDS.has(word) &&
        !/^(?:19|20)\d{2}$/u.test(word),
    );
}

function searchQueries(
  headline: string,
  category: string,
  subject?: string,
): string[] {
  const subjectQuery = (subject ?? "")
    .replaceAll(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 5)
    .join(" ");

  const normalized = headline
    .replaceAll(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/u)
    .map((word) => word.trim())
    .filter(
      (word) =>
        word.length >= 3 &&
        !STOP_WORDS.has(word.toLowerCase()) &&
        !/^(?:19|20)\d{2}$/u.test(word),
    );

  const primary = normalized.slice(0, 9).join(" ");
  const focused = normalized.slice(0, 5).join(" ");
  const categoryQuery = `${focused} ${category.replaceAll("_", " ")}`.trim();

  // The plain subject is tried first because it is what Commons actually
  // indexes; the headline-derived queries stay as fallbacks.
  return Array.from(
    new Set(
      [subjectQuery, focused, primary, categoryQuery].filter(
        (value) => value.length >= 3,
      ),
    ),
  ).slice(0, 4);
}

function cleanHtml(value: string): string {
  return value
    .replaceAll(/<[^>]*>/gu, " ")
    .replaceAll(/&nbsp;/giu, " ")
    .replaceAll(/&amp;/giu, "&")
    .replaceAll(/&quot;/giu, '"')
    .replaceAll(/&#0*39;/giu, "'")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function safeHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(cleanHtml(value));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
