export const LIVING_STORY_STATES = [
  "WATCH_ACTIVE",
  "CHECKING",
  "NO_CHANGE",
  "POTENTIAL_UPDATE",
  "VERIFYING",
  "MEDIA_REVIEW",
  "UPDATE_PROPOSED",
  "HUMAN_REVIEW_REQUIRED",
  "UPDATE_APPROVED",
  "ARTICLE_UPDATED",
  "NEW_ANGLE_RECOMMENDED",
  "WATCH_PAUSED",
  "WATCH_EXPIRED",
  "WATCH_FAILED",
] as const;

export type LivingStoryState = (typeof LIVING_STORY_STATES)[number];

export type StorySignal = {
  id: string;
  sourceUrl: string;
  sourceTier: number;
  claim: string;
  subject?: string;
  metric?: string;
  value?: string;
  mediaUrls?: readonly string[];
  detectedAt: string;
  sensitive?: boolean;
};

export type StoredEvidence = {
  claim: string;
  subject?: string;
  metric?: string;
  value?: string;
  sourceUrl: string;
  recordedAt: string;
};

export type ArticleVersionSnapshot = {
  articleId: string;
  versionId: string;
  headline: string;
  evidence: readonly StoredEvidence[];
  sensitive: boolean;
};

export type UpdateDisposition =
  | "NO_CHANGE"
  | "UPDATE_PROPOSED"
  | "MEDIA_REVIEW"
  | "HUMAN_REVIEW_REQUIRED"
  | "NEW_ANGLE_RECOMMENDED";

export type UpdateProposal = {
  disposition: UpdateDisposition;
  state: LivingStoryState;
  newClaims: readonly StorySignal[];
  duplicateClaims: readonly StorySignal[];
  contradictions: readonly { incoming: StorySignal; existing: StoredEvidence }[];
  primarySource: StorySignal | null;
  mediaToReview: readonly string[];
  sensitivityFlagged: boolean;
  requiresHumanReview: boolean;
  diff: { beforeClaimCount: number; afterClaimCount: number; added: readonly string[] };
};

export function claimDedupKey(claim: string): string {
  return claim.trim().toLowerCase().replace(/\s+/gu, " ");
}

function valueKey(signal: { subject?: string; metric?: string }): string {
  return `${(signal.subject ?? "").trim().toLowerCase()}|${(signal.metric ?? "").trim().toLowerCase()}`;
}

export function signalsContradict(
  incoming: { subject?: string; metric?: string; value?: string },
  existing: { subject?: string; metric?: string; value?: string },
): boolean {
  if (!incoming.subject || !incoming.metric || !existing.subject || !existing.metric) {
    return false;
  }
  if (valueKey(incoming) !== valueKey(existing)) return false;
  const a = (incoming.value ?? "").trim().toLowerCase();
  const b = (existing.value ?? "").trim().toLowerCase();
  return a.length > 0 && b.length > 0 && a !== b;
}

export function evaluateSignal(input: {
  incoming: readonly StorySignal[];
  version: ArticleVersionSnapshot;
}): UpdateProposal {
  const { incoming, version } = input;
  const existingKeys = new Set(version.evidence.map((e) => claimDedupKey(e.claim)));
  const duplicateClaims = incoming.filter((s) =>
    existingKeys.has(claimDedupKey(s.claim)),
  );
  const newClaims = incoming.filter(
    (s) => !existingKeys.has(claimDedupKey(s.claim)),
  );

  const contradictions = newClaims.flatMap((signal) =>
    version.evidence
      .filter((e) => signalsContradict(signal, e))
      .map((existing) => ({ incoming: signal, existing })),
  );

  const mediaToReview = newClaims.flatMap((s) => s.mediaUrls ?? []);
  const sensitivityFlagged =
    version.sensitive ||
    newClaims.some((s) => s.sensitive) ||
    newClaims.some((s) => (s.sourceTier ?? 99) > 2 && contradictions.length > 0);

  const primarySource = newClaims.slice().sort((a, b) => a.sourceTier - b.sourceTier)[0] ?? null;

  const added = newClaims.map((s) => s.claim);
  const diff = {
    beforeClaimCount: version.evidence.length,
    afterClaimCount: version.evidence.length + newClaims.length,
    added,
  };

  let disposition: UpdateDisposition;
  let state: LivingStoryState;
  if (newClaims.length === 0) {
    disposition = "NO_CHANGE";
    state = "NO_CHANGE";
  } else if (sensitivityFlagged || contradictions.length > 0) {
    disposition = "HUMAN_REVIEW_REQUIRED";
    state = "HUMAN_REVIEW_REQUIRED";
  } else if (mediaToReview.length > 0) {
    disposition = "MEDIA_REVIEW";
    state = "MEDIA_REVIEW";
  } else if (representsNewAngle(newClaims, version)) {
    disposition = "NEW_ANGLE_RECOMMENDED";
    state = "NEW_ANGLE_RECOMMENDED";
  } else {
    disposition = "UPDATE_PROPOSED";
    state = "UPDATE_PROPOSED";
  }

  return {
    disposition,
    state,
    newClaims,
    duplicateClaims,
    contradictions,
    primarySource,
    mediaToReview,
    sensitivityFlagged,
    requiresHumanReview: disposition === "HUMAN_REVIEW_REQUIRED",
    diff,
  };
}

function representsNewAngle(
  newClaims: readonly StorySignal[],
  version: ArticleVersionSnapshot,
): boolean {
  if (newClaims.length < 3) return false;
  const existingSubjects = new Set(
    version.evidence.map((e) => e.subject?.trim().toLowerCase()).filter(Boolean),
  );
  const newSubjects = new Set(
    newClaims.map((s) => s.subject?.trim().toLowerCase()).filter(Boolean),
  );
  const novelSubjects = [...newSubjects].filter((s) => !existingSubjects.has(s));
  return novelSubjects.length >= 2;
}

export const MONITORING_CADENCE_MS: ReadonlyArray<{
  untilHours: number;
  intervalMs: number;
}> = [
  { untilHours: 6, intervalMs: 10 * 60_000 },
  { untilHours: 24, intervalMs: 20 * 60_000 },
  { untilHours: 72, intervalMs: 60 * 60_000 },
  { untilHours: 24 * 7, intervalMs: 6 * 60 * 60_000 },
  { untilHours: 24 * 30, intervalMs: 24 * 60 * 60_000 },
];

export function computeNextCheck(input: {
  publishedAt: Date;
  lastCheck?: Date | null;
  now?: Date;
}): Date | null {
  const now = input.now ?? new Date();
  const ageMs = now.getTime() - input.publishedAt.getTime();
  if (ageMs < 0) return input.publishedAt;
  const ageHours = ageMs / (60 * 60_000);
  if (ageHours > 24 * 30) return null;
  const rule =
    MONITORING_CADENCE_MS.find((rule) => ageHours <= rule.untilHours) ??
    MONITORING_CADENCE_MS[MONITORING_CADENCE_MS.length - 1];
  const base = (input.lastCheck ?? now).getTime() + rule.intervalMs;
  return new Date(base);
}

export type MeaningfulChangeDecision = {
  updateDateModified: boolean;
  regenerateAudio: boolean;
  regenerateSocialCards: boolean;
  notifyFollowers: boolean;
};

export function classifyMeaningfulChange(proposal: UpdateProposal): MeaningfulChangeDecision {
  const hasNewClaims = proposal.newClaims.length > 0;
  const hasContradictions = proposal.contradictions.length > 0;
  const material = hasNewClaims || hasContradictions;
  return {
    updateDateModified: material,
    regenerateAudio: material,
    regenerateSocialCards: proposal.mediaToReview.length > 0,
    notifyFollowers: material,
  };
}
