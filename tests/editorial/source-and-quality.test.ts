import { describe, expect, it } from "vitest";

import {
  evaluateClaimPublicationGate,
  type EditorialClaim,
} from "../../lib/editorial/claims";
import {
  scoreArticleQuality,
  type QualityComponentInputs,
} from "../../lib/editorial/quality-scoring";
import { classifySensitiveContent } from "../../lib/editorial/sensitive-content";
import {
  assessSourceSet,
  assessSourceTier,
  type EditorialSource,
} from "../../lib/editorial/source-tiers";

function source(
  overrides: Partial<EditorialSource> = {},
): EditorialSource {
  return {
    id: "source-primary",
    name: "Fictional Public Data Record",
    domain: "public-data.example",
    publisherGroupId: "publisher-public-data",
    countryCode: "US",
    sourceType: "OFFICIAL_DATA",
    identityVerified: true,
    followsProfessionalStandards: true,
    isPrimaryEvidence: true,
    citationRequirement: "Attribute the fictional record.",
    licensingStatus: "PERMITTED",
    lastReviewedAt: "2000-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function claim(): EditorialClaim {
  return {
    id: "claim-central",
    text: "The fictional record was released.",
    articleSection: "What happened",
    category: "RELEASE",
    isCentral: true,
    supportingSourceIds: ["source-primary", "source-newsroom"],
    contradictingSourceIds: [],
    primaryEvidenceAvailable: true,
    observedAt: "2000-01-01T12:00:00.000Z",
    verificationStatus: "VERIFIED_BY_PRIMARY_SOURCE",
    riskLevel: "LOW",
  };
}

function qualityComponents(
  scoreRatio = 1,
): QualityComponentInputs {
  return {
    factualVerification: {
      score: 25 * scoreRatio,
      explanation: "Central claims are linked to reviewed evidence.",
    },
    sourceQualityAndIndependence: {
      score: 15 * scoreRatio,
      explanation: "Primary and independent professional sources are present.",
    },
    originalReaderValue: {
      score: 15 * scoreRatio,
      explanation: "The story adds a timeline and source comparison.",
    },
    searchIntentSatisfaction: {
      score: 10 * scoreRatio,
      explanation: "The lead answers the identified reader question.",
    },
    writingQuality: {
      score: 10 * scoreRatio,
      explanation: "Copy review found clear, neutral American English.",
    },
    headlineAccuracy: {
      score: 5 * scoreRatio,
      explanation: "The headline is fully supported by the central claim.",
    },
    contextAndCompleteness: {
      score: 5 * scoreRatio,
      explanation: "Material context and uncertainty are disclosed.",
    },
    mediaQualityAndRights: {
      score: 5 * scoreRatio,
      explanation: "No media is required for this text-led story.",
    },
    technicalSeo: {
      score: 5 * scoreRatio,
      explanation: "Canonical and structured metadata checks pass.",
    },
    trustAndTransparency: {
      score: 5 * scoreRatio,
      explanation: "Sources, byline, timestamps, and AI assistance are disclosed.",
    },
  };
}

const newsroomSource = source({
  id: "source-newsroom",
  name: "Fictional National Desk",
  domain: "national-desk.example",
  publisherGroupId: "publisher-national-desk",
  sourceType: "ESTABLISHED_NEWSROOM",
  isPrimaryEvidence: false,
});

describe("source tier and independence rules", () => {
  it("treats verified primary records as Tier 1 and social posts as Tier 4", () => {
    expect(assessSourceTier(source()).tier).toBe(1);
    expect(
      assessSourceTier({
        sourceType: "SOCIAL_ACCOUNT",
        identityVerified: true,
        followsProfessionalStandards: false,
        isPrimaryEvidence: false,
      }).tier,
    ).toBe(4);
  });

  it("requires independent publisher groups for central claims", () => {
    const sufficient = assessSourceSet(
      [source(), newsroomSource],
      "CENTRAL_CLAIM",
    );
    expect(sufficient.meetsPublicationStandard).toBe(true);
    expect(sufficient.independentPublisherCount).toBe(2);

    const syndicated = assessSourceSet(
      [
        source(),
        newsroomSource,
        source({
          id: "source-syndicated",
          publisherGroupId: "publisher-national-desk",
          sourceType: "LOCAL_NEWSROOM",
          isPrimaryEvidence: false,
        }),
      ],
      "CENTRAL_CLAIM",
      {
        minimumIndependentSourcesForCentralClaim: 3,
        allowPrimarySourceAlone: false,
      },
    );
    expect(syndicated.meetsPublicationStandard).toBe(false);
    expect(syndicated.independentPublisherCount).toBe(2);
  });

  it("rejects duplicate source identities instead of silently replacing evidence", () => {
    expect(() =>
      assessSourceSet(
        [source(), source({ name: "Conflicting snapshot" })],
        "CENTRAL_CLAIM",
      ),
    ).toThrow(/duplicated/);
  });
});

describe("sensitive-content classification", () => {
  it("always routes election coverage to a human", () => {
    const classification = classifySensitiveContent({
      topics: ["US_ELECTIONS"],
      autoPublishContentClass: "OFFICIAL_COMPANY_ANNOUNCEMENT",
    });
    expect(classification.decision).toBe("HUMAN_REVIEW_REQUIRED");
    expect(classification.reasons[0]).toContain("elections");
  });

  it("allows only an explicitly allowlisted, non-sensitive class to proceed", () => {
    expect(
      classifySensitiveContent({
        topics: [],
        autoPublishContentClass: "TECHNOLOGY_LAUNCH",
      }).decision,
    ).toBe("AUTO_PUBLISH_ELIGIBLE");
    expect(classifySensitiveContent({ topics: [] }).decision).toBe(
      "HUMAN_REVIEW_REQUIRED",
    );
  });
});

describe("article quality scoring", () => {
  const claimGate = evaluateClaimPublicationGate([claim()]);
  const sourceAssessment = assessSourceSet(
    [source(), newsroomSource],
    "CENTRAL_CLAIM",
  );
  const lowRisk = classifySensitiveContent({
    topics: [],
    autoPublishContentClass: "TECHNOLOGY_LAUNCH",
  });

  it("makes a fully gated 100-point story eligible for auto-publication", () => {
    const result = scoreArticleQuality({
      components: qualityComponents(),
      claimGate,
      sourceAssessment,
      sensitiveContent: lowRisk,
      coreFactualChecksPassed: true,
      mediaRightsStatus: "NOT_APPLICABLE",
    });

    expect(result.score).toBe(100);
    expect(result.decision).toBe("AUTO_PUBLISH_ELIGIBLE");
    expect(result.reasons).toContain(
      "No media is present; missing media alone does not reject a strong story.",
    );
  });

  it("routes a high-scoring sensitive story to a human", () => {
    const result = scoreArticleQuality({
      components: qualityComponents(),
      claimGate,
      sourceAssessment,
      sensitiveContent: classifySensitiveContent({
        topics: ["PUBLIC_HEALTH"],
      }),
      coreFactualChecksPassed: true,
      mediaRightsStatus: "CLEARED",
    });
    expect(result.decision).toBe("HUMAN_REVIEW_REQUIRED");
  });

  it("lets deterministic factual blockers override a perfect score", () => {
    const result = scoreArticleQuality({
      components: qualityComponents(),
      claimGate,
      sourceAssessment,
      sensitiveContent: lowRisk,
      coreFactualChecksPassed: false,
      mediaRightsStatus: "CLEARED",
    });
    expect(result.score).toBe(100);
    expect(result.decision).toBe("BLOCKED");
    expect(result.hardBlockers.map((blocker) => blocker.code)).toContain(
      "CORE_FACTUAL_CHECK_FAILED",
    );
  });

  it("does not accept a supporting-only source assessment as a publication gate", () => {
    const result = scoreArticleQuality({
      components: qualityComponents(),
      claimGate,
      sourceAssessment: assessSourceSet([source()], "SUPPORTING_CLAIM"),
      sensitiveContent: lowRisk,
      coreFactualChecksPassed: true,
      mediaRightsStatus: "CLEARED",
    });
    expect(result.decision).toBe("BLOCKED");
    expect(result.hardBlockers.map((blocker) => blocker.code)).toContain(
      "SOURCE_STANDARD_FAILED",
    );
  });

  it("uses revision and rejection thresholds without inflating the score", () => {
    expect(
      scoreArticleQuality({
        components: qualityComponents(0.8),
        claimGate,
        sourceAssessment,
        sensitiveContent: lowRisk,
        coreFactualChecksPassed: true,
        mediaRightsStatus: "CLEARED",
      }).decision,
    ).toBe("REVISION_REQUIRED");
    expect(
      scoreArticleQuality({
        components: qualityComponents(0.6),
        claimGate,
        sourceAssessment,
        sensitiveContent: lowRisk,
        coreFactualChecksPassed: true,
        mediaRightsStatus: "CLEARED",
      }).decision,
    ).toBe("REJECT");
  });
});
