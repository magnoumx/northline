export type SourceTier = 1 | 2 | 3 | 4;

export const SOURCE_TYPES = [
  "PRIMARY_RECORD",
  "OFFICIAL_STATEMENT",
  "REGULATORY_FILING",
  "COURT_DOCUMENT",
  "OFFICIAL_DATA",
  "DIRECT_INTERVIEW",
  "ESTABLISHED_NEWSROOM",
  "SPECIALIST_PUBLICATION",
  "LOCAL_NEWSROOM",
  "TRADE_PUBLICATION",
  "BLOG",
  "REPOSTING_SITE",
  "SOCIAL_ACCOUNT",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export interface SourceProfile {
  readonly sourceType: SourceType;
  readonly identityVerified: boolean;
  readonly followsProfessionalStandards: boolean;
  readonly isPrimaryEvidence: boolean;
}

export interface EditorialSource extends SourceProfile {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  /**
   * Sources controlled by the same publisher share a group so syndication is
   * not incorrectly counted as independent corroboration.
   */
  readonly publisherGroupId: string;
  readonly countryCode: string;
  readonly citationRequirement: string;
  readonly licensingStatus:
    | "PERMITTED"
    | "ATTRIBUTION_REQUIRED"
    | "DISCOVERY_ONLY"
    | "UNKNOWN";
  readonly lastReviewedAt: string;
  readonly historicalReliabilityNotes?: string;
}

export interface SourceTierRule {
  readonly tier: SourceTier;
  readonly label: string;
  readonly evidenceUse: "PRIMARY" | "PUBLISHABLE" | "CORROBORATION" | "DISCOVERY_ONLY";
  readonly description: string;
}

export const SOURCE_TIER_RULES: Readonly<Record<SourceTier, SourceTierRule>> =
  Object.freeze({
    1: {
      tier: 1,
      label: "Primary evidence",
      evidenceUse: "PRIMARY",
      description:
        "Verified primary records, official material, direct data, or direct interviews.",
    },
    2: {
      tier: 2,
      label: "Established reporting",
      evidenceUse: "PUBLISHABLE",
      description:
        "Verified professional newsrooms and specialist publications with editorial standards.",
    },
    3: {
      tier: 3,
      label: "Credible local or trade reporting",
      evidenceUse: "CORROBORATION",
      description:
        "Verified local newsrooms and reputable trade publications with editorial standards.",
    },
    4: {
      tier: 4,
      label: "Discovery signal",
      evidenceUse: "DISCOVERY_ONLY",
      description:
        "Blogs, reposting sites, social accounts, or sources whose identity and standards are unverified.",
    },
  });

export interface SourceTierAssessment {
  readonly tier: SourceTier;
  readonly rule: SourceTierRule;
  readonly reasons: readonly string[];
}

const PRIMARY_TYPES = new Set<SourceType>([
  "PRIMARY_RECORD",
  "OFFICIAL_STATEMENT",
  "REGULATORY_FILING",
  "COURT_DOCUMENT",
  "OFFICIAL_DATA",
  "DIRECT_INTERVIEW",
]);

const TIER_TWO_TYPES = new Set<SourceType>([
  "ESTABLISHED_NEWSROOM",
  "SPECIALIST_PUBLICATION",
]);

const TIER_THREE_TYPES = new Set<SourceType>([
  "LOCAL_NEWSROOM",
  "TRADE_PUBLICATION",
]);

export function assessSourceTier(
  profile: SourceProfile,
): SourceTierAssessment {
  const reasons: string[] = [];
  let tier: SourceTier;

  if (
    profile.identityVerified &&
    profile.isPrimaryEvidence &&
    PRIMARY_TYPES.has(profile.sourceType)
  ) {
    tier = 1;
    reasons.push("The source is verified and provides direct primary evidence.");
  } else if (
    profile.identityVerified &&
    profile.followsProfessionalStandards &&
    TIER_TWO_TYPES.has(profile.sourceType)
  ) {
    tier = 2;
    reasons.push(
      "The source is a verified professional newsroom or specialist publication.",
    );
  } else if (
    profile.identityVerified &&
    profile.followsProfessionalStandards &&
    TIER_THREE_TYPES.has(profile.sourceType)
  ) {
    tier = 3;
    reasons.push(
      "The source is a verified local newsroom or trade publication with editorial standards.",
    );
  } else {
    tier = 4;
    reasons.push(
      "The source does not meet the deterministic requirements for publication evidence.",
    );
    if (!profile.identityVerified) {
      reasons.push("The source identity has not been verified.");
    }
    if (
      !profile.followsProfessionalStandards &&
      !PRIMARY_TYPES.has(profile.sourceType)
    ) {
      reasons.push("Professional editorial standards are not established.");
    }
  }

  return { tier, rule: SOURCE_TIER_RULES[tier], reasons };
}

export type SourceUse = "DISCOVERY" | "SUPPORTING_CLAIM" | "CENTRAL_CLAIM";

export interface SourceSetPolicy {
  readonly minimumIndependentSourcesForCentralClaim: number;
  readonly allowPrimarySourceAlone: boolean;
}

export const DEFAULT_SOURCE_SET_POLICY: SourceSetPolicy = Object.freeze({
  minimumIndependentSourcesForCentralClaim: 2,
  allowPrimarySourceAlone: false,
});

export interface SourceSetAssessment {
  readonly use: SourceUse;
  readonly meetsPublicationStandard: boolean;
  readonly primarySourceIds: readonly string[];
  readonly publishableSourceIds: readonly string[];
  readonly discoveryOnlySourceIds: readonly string[];
  readonly independentPublisherCount: number;
  readonly reasons: readonly string[];
}

export function assessSourceSet(
  sources: readonly EditorialSource[],
  use: SourceUse,
  policy: SourceSetPolicy = DEFAULT_SOURCE_SET_POLICY,
): SourceSetAssessment {
  if (
    !Number.isInteger(policy.minimumIndependentSourcesForCentralClaim) ||
    policy.minimumIndependentSourcesForCentralClaim < 1
  ) {
    throw new RangeError(
      "minimumIndependentSourcesForCentralClaim must be a positive integer",
    );
  }

  const uniqueSources = new Map<string, EditorialSource>();
  for (const source of sources) {
    if (!source.id.trim()) {
      throw new TypeError("Every source must have a non-empty id");
    }
    if (uniqueSources.has(source.id)) {
      throw new TypeError(`Source id "${source.id}" is duplicated`);
    }
    if (!source.publisherGroupId.trim()) {
      throw new TypeError(
        `Source "${source.id}" must identify its controlling publisher group`,
      );
    }
    uniqueSources.set(source.id, source);
  }

  const assessed = [...uniqueSources.values()].map((source) => ({
    source,
    tier: assessSourceTier(source).tier,
  }));
  const primarySourceIds = assessed
    .filter(({ tier }) => tier === 1)
    .map(({ source }) => source.id)
    .sort();
  const publishable = assessed.filter(({ tier }) => tier <= 3);
  const publishableSourceIds = publishable
    .map(({ source }) => source.id)
    .sort();
  const discoveryOnlySourceIds = assessed
    .filter(({ tier }) => tier === 4)
    .map(({ source }) => source.id)
    .sort();
  const independentPublisherCount = new Set(
    publishable.map(({ source }) => source.publisherGroupId),
  ).size;

  const reasons: string[] = [];
  let meetsPublicationStandard = false;

  if (use === "DISCOVERY") {
    meetsPublicationStandard = false;
    reasons.push(
      sources.length > 0
        ? "The source set may be used to discover a lead, but discovery alone is not publication evidence."
        : "No discovery sources were supplied.",
    );
  } else if (use === "SUPPORTING_CLAIM") {
    meetsPublicationStandard = publishableSourceIds.length >= 1;
    reasons.push(
      meetsPublicationStandard
        ? "At least one Tier 1–3 source supports the claim."
        : "A supporting claim needs at least one Tier 1–3 source.",
    );
  } else {
    const enoughIndependentSources =
      independentPublisherCount >=
      policy.minimumIndependentSourcesForCentralClaim;
    const allowedPrimaryException =
      policy.allowPrimarySourceAlone && primarySourceIds.length > 0;
    meetsPublicationStandard =
      enoughIndependentSources || allowedPrimaryException;

    if (enoughIndependentSources) {
      reasons.push(
        `${independentPublisherCount} independent publisher groups meet the central-claim corroboration rule.`,
      );
    } else if (allowedPrimaryException) {
      reasons.push(
        "The configured policy permits direct primary evidence to support this central claim alone.",
      );
    } else {
      reasons.push(
        `A central claim needs ${policy.minimumIndependentSourcesForCentralClaim} independent Tier 1–3 publisher groups.`,
      );
    }
  }

  if (discoveryOnlySourceIds.length > 0) {
    reasons.push(
      `${discoveryOnlySourceIds.length} Tier 4 ${
        discoveryOnlySourceIds.length === 1 ? "source is" : "sources are"
      } treated only as discovery signals.`,
    );
  }

  return {
    use,
    meetsPublicationStandard,
    primarySourceIds,
    publishableSourceIds,
    discoveryOnlySourceIds,
    independentPublisherCount,
    reasons,
  };
}
