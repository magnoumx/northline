export interface TrendNormalizationOptions {
  /**
   * Aliases are compared after normalization. Both keys and values may use
   * reader-facing spelling, punctuation, or capitalization.
   */
  readonly aliases?: Readonly<Record<string, string>>;
}

export interface TrendIdentity {
  readonly id: string;
  readonly originalTerm: string;
  readonly relatedTerms?: readonly string[];
  readonly entityIds?: readonly string[];
}

export type DuplicateDecision = "EXACT" | "NEAR_DUPLICATE" | "DISTINCT";

export interface DuplicateDetectionConfig {
  readonly nearDuplicateThreshold: number;
  readonly entityWeight: number;
}

export interface DuplicateAssessment {
  readonly decision: DuplicateDecision;
  readonly similarity: number;
  readonly lexicalSimilarity: number;
  readonly entitySimilarity: number | null;
  readonly normalizedCandidate: string;
  readonly normalizedExisting: string;
  readonly sharedEntityIds: readonly string[];
  readonly reasons: readonly string[];
}

export interface DuplicateMatch {
  readonly existingId: string;
  readonly assessment: DuplicateAssessment;
}

export const DEFAULT_DUPLICATE_CONFIG: DuplicateDetectionConfig = Object.freeze({
  nearDuplicateThreshold: 0.78,
  entityWeight: 0.25,
});

const DUPLICATE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function baseNormalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/['"]s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeTrendTerm(
  term: string,
  options: TrendNormalizationOptions = {},
): string {
  const normalized = baseNormalize(term);
  if (!normalized) {
    return "";
  }

  if (!options.aliases) {
    return normalized;
  }

  const aliases = new Map(
    Object.entries(options.aliases).map(([key, value]) => [
      baseNormalize(key),
      baseNormalize(value),
    ]),
  );

  // Resolve short alias chains while protecting against accidental cycles.
  let resolved = normalized;
  const visited = new Set<string>();
  while (aliases.has(resolved) && !visited.has(resolved)) {
    visited.add(resolved);
    resolved = aliases.get(resolved) ?? resolved;
  }
  return resolved;
}

function stemToken(token: string): string {
  if (token.length > 5 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.length > 5 && token.endsWith("ing")) {
    return token.slice(0, -3);
  }
  if (token.length > 4 && token.endsWith("ed")) {
    return token.slice(0, -2);
  }
  if (token.length > 4 && token.endsWith("es")) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function comparisonTokens(value: string): Set<string> {
  return new Set(
    baseNormalize(value)
      .split(" ")
      .filter((token) => token && !DUPLICATE_STOP_WORDS.has(token))
      .map(stemToken),
  );
}

function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 && right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function maxLexicalSimilarity(
  candidate: TrendIdentity,
  existing: TrendIdentity,
): number {
  const candidateTerms = [
    candidate.originalTerm,
    ...(candidate.relatedTerms ?? []),
  ];
  const existingTerms = [existing.originalTerm, ...(existing.relatedTerms ?? [])];

  let highest = 0;
  for (const candidateTerm of candidateTerms) {
    const candidateTokens = comparisonTokens(candidateTerm);
    for (const existingTerm of existingTerms) {
      highest = Math.max(
        highest,
        jaccard(candidateTokens, comparisonTokens(existingTerm)),
      );
    }
  }
  return highest;
}

function validateDuplicateConfig(config: DuplicateDetectionConfig): void {
  if (
    !Number.isFinite(config.nearDuplicateThreshold) ||
    config.nearDuplicateThreshold <= 0 ||
    config.nearDuplicateThreshold > 1
  ) {
    throw new RangeError("nearDuplicateThreshold must be greater than 0 and at most 1");
  }
  if (
    !Number.isFinite(config.entityWeight) ||
    config.entityWeight < 0 ||
    config.entityWeight > 1
  ) {
    throw new RangeError("entityWeight must be between 0 and 1");
  }
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function compareTrendCandidates(
  candidate: TrendIdentity,
  existing: TrendIdentity,
  config: DuplicateDetectionConfig = DEFAULT_DUPLICATE_CONFIG,
): DuplicateAssessment {
  validateDuplicateConfig(config);

  const normalizedCandidate = normalizeTrendTerm(candidate.originalTerm);
  const normalizedExisting = normalizeTrendTerm(existing.originalTerm);
  const exact =
    normalizedCandidate.length > 0 &&
    normalizedCandidate === normalizedExisting;

  const lexicalSimilarity = exact
    ? 1
    : maxLexicalSimilarity(candidate, existing);
  const candidateEntities = new Set(candidate.entityIds ?? []);
  const existingEntities = new Set(existing.entityIds ?? []);
  const sharedEntityIds = [...candidateEntities]
    .filter((entityId) => existingEntities.has(entityId))
    .sort();
  const hasEntityData =
    candidateEntities.size > 0 && existingEntities.size > 0;
  const entitySimilarity = hasEntityData
    ? jaccard(candidateEntities, existingEntities)
    : null;
  const similarity = hasEntityData
    ? lexicalSimilarity * (1 - config.entityWeight) +
      (entitySimilarity ?? 0) * config.entityWeight
    : lexicalSimilarity;

  const reasons: string[] = [];
  if (exact) {
    reasons.push("The primary terms have the same normalized form.");
  }
  if (lexicalSimilarity >= config.nearDuplicateThreshold && !exact) {
    reasons.push("The terms share substantially the same meaningful words.");
  }
  if (sharedEntityIds.length > 0) {
    reasons.push(
      `The candidates share ${sharedEntityIds.length} named ${
        sharedEntityIds.length === 1 ? "entity" : "entities"
      }.`,
    );
  }

  const decision: DuplicateDecision = exact
    ? "EXACT"
    : similarity >= config.nearDuplicateThreshold
      ? "NEAR_DUPLICATE"
      : "DISTINCT";

  if (decision === "DISTINCT") {
    reasons.push("Combined lexical and entity similarity is below the duplicate threshold.");
  }

  return {
    decision,
    similarity: round(similarity),
    lexicalSimilarity: round(lexicalSimilarity),
    entitySimilarity:
      entitySimilarity === null ? null : round(entitySimilarity),
    normalizedCandidate,
    normalizedExisting,
    sharedEntityIds,
    reasons,
  };
}

export function detectTrendDuplicates(
  candidate: TrendIdentity,
  existingCandidates: readonly TrendIdentity[],
  config: DuplicateDetectionConfig = DEFAULT_DUPLICATE_CONFIG,
): readonly DuplicateMatch[] {
  return existingCandidates
    .map((existing) => ({
      existingId: existing.id,
      assessment: compareTrendCandidates(candidate, existing, config),
    }))
    .filter(({ assessment }) => assessment.decision !== "DISTINCT")
    .sort(
      (left, right) =>
        right.assessment.similarity - left.assessment.similarity ||
        left.existingId.localeCompare(right.existingId),
    );
}
