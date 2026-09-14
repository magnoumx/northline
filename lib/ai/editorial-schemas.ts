import { z } from "zod";

export const trendClassificationSchema = z
  .object({
    relevant: z.boolean(),
    category: z.string().min(2).max(80),
    market: z.string().min(2).max(40),
    confidence: z.number().min(0).max(1),
    rationale: z.string().min(10).max(1_000),
  })
  .strict();

export const normalizedEntitiesSchema = z
  .object({
    entities: z
      .array(
        z
          .object({
            name: z.string().min(1).max(200),
            type: z.enum([
              "person",
              "organization",
              "place",
              "product",
              "event",
              "other",
            ]),
            aliases: z.array(z.string().min(1).max(200)).max(20),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

export const extractedClaimsSchema = z
  .object({
    claims: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z0-9:_-]{4,128}$/u),
            text: z.string().min(5).max(2_000),
            importance: z.enum(["central", "supporting"]),
            evidenceIds: z
              .array(z.string().regex(/^[A-Za-z0-9:_-]{4,128}$/u))
              .max(50),
            status: z.enum([
              "supported",
              "contradicted",
              "unclear",
              "unsupported",
            ]),
          })
          .strict(),
      )
      .max(150),
    explicitUnknowns: z.array(z.string().min(3).max(1_000)).max(50),
  })
  .strict();

export const evidenceComparisonSchema = z
  .object({
    findings: z
      .array(
        z
          .object({
            claimId: z.string().min(4).max(128),
            disposition: z.enum([
              "supported",
              "partially_supported",
              "contradicted",
              "insufficient",
            ]),
            supportingEvidenceIds: z.array(z.string()).max(50),
            contradictingEvidenceIds: z.array(z.string()).max(50),
            explanation: z.string().min(10).max(2_000),
          })
          .strict(),
      )
      .max(150),
  })
  .strict();

/**
 * Google truncates a search-result title at roughly 60 characters, so anything
 * past that is invisible to the reader deciding whether to click. The previous
 * 220-character ceiling let the newsroom publish 131-character headlines whose
 * entire second half - usually the part naming the actual news - never reached
 * a search result at all.
 *
 * This is a guardrail, not the target. The prompt asks for 50-65 characters;
 * the extra headroom here means a compliant headline never fails validation and
 * only the egregious cases are forced into a retry.
 */
const HEADLINE_MAX_CHARACTERS = 100;

export const articleOutlineSchema = z
  .object({
    headlineDirection: z.string().min(5).max(HEADLINE_MAX_CHARACTERS),
    readerPromise: z.string().min(10).max(500),
    sections: z
      .array(
        z
          .object({
            heading: z.string().min(2).max(180),
            claimIds: z.array(z.string().min(4).max(128)).max(50),
            purpose: z.string().min(5).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    explicitUnknowns: z.array(z.string().min(3).max(1_000)).max(50),
  })
  .strict();

export const articleDraftSchema = z
  .object({
    headline: z.string().min(10).max(HEADLINE_MAX_CHARACTERS),
    subheadline: z.string().min(10).max(420),
    sections: z
      .array(
        z
          .object({
            heading: z.string().min(2).max(180),
            paragraphs: z.array(z.string().min(1).max(8_000)).min(1).max(20),
            claimIdsUsed: z.array(z.string().min(4).max(128)).max(50),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    unknownsDisclosed: z.array(z.string().min(3).max(1_000)).max(50),
  })
  .strict();

export const factReviewSchema = z
  .object({
    findings: z
      .array(
        z
          .object({
            claimId: z.string().min(4).max(128),
            draftExcerpt: z.string().min(1).max(2_000),
            disposition: z.enum([
              "supported",
              "misstated",
              "unsupported",
              "missing_context",
              "contradicted",
            ]),
            evidenceIds: z.array(z.string()).max(50),
            requiredChange: z.string().min(3).max(2_000).nullable(),
          })
          .strict(),
      )
      .max(200),
    blocking: z.boolean(),
  })
  .strict();

export const copyEditSchema = z
  .object({
    draft: articleDraftSchema,
    factualPacketPreserved: z.boolean(),
    attemptedFactualAdditions: z.array(z.string().max(2_000)).max(50),
  })
  .strict();

export const seoBriefOutputSchema = z
  .object({
    primaryReaderIntent: z.string().min(5).max(500),
    primaryQuery: z.string().min(2).max(180),
    secondaryQueries: z.array(z.string().min(2).max(180)).max(20),
    entities: z.array(z.string().min(1).max(200)).max(50),
    questions: z.array(z.string().min(3).max(300)).max(30),
    missingReaderValue: z.array(z.string().min(3).max(500)).max(20),
    recommendedFormat: z.string().min(2).max(120),
    internalLinks: z.array(z.string().max(500)).max(30),
    recommendedMedia: z.array(z.string().max(500)).max(20),
    freshnessPlan: z.string().min(5).max(1_000),
    updateTriggers: z.array(z.string().min(3).max(500)).max(20),
    demandEstimate: z.literal("unknown"),
  })
  .strict();

export const headlineCandidatesSchema = z
  .object({
    candidates: z
      .array(
        z
          .object({
            headline: z.string().min(10).max(HEADLINE_MAX_CHARACTERS),
            rationale: z.string().min(5).max(500),
            claimIds: z.array(z.string().min(4).max(128)).max(20),
          })
          .strict(),
      )
      .min(3)
      .max(12),
  })
  .strict();

export const dossierAnswerSchema = z
  .object({
    answer: z.string().min(1).max(5_000),
    evidenceIds: z.array(z.string().min(4).max(128)).max(50),
    unresolved: z.boolean(),
  })
  .strict();

/**
 * Live source discovery runs on a provider with real web search so the drafting
 * model works from current reporting instead of training memory. It returns
 * leads only: no article text, and no claim is treated as verified here.
 */
export const liveSourceDiscoverySchema = z
  .object({
    topicSummary: z.string().min(20).max(2_000),
    sources: z
      .array(
        z
          .object({
            name: z.string().min(2).max(200),
            publisher: z.string().min(2).max(200),
            url: z.string().url().max(2_000),
            sourceKind: z.enum(["PRIMARY", "INDEPENDENT", "CONTEXT"]),
            publishedAt: z.string().max(40).optional(),
            summary: z.string().min(20).max(1_500),
            keyFacts: z.array(z.string().min(3).max(500)).max(12),
          })
          .strict(),
      )
      .max(12),
    openQuestions: z.array(z.string().min(3).max(500)).max(10),
    /**
     * Candidate official video pages. These are suggestions only: the platform
     * oEmbed endpoint decides whether a video exists and may be embedded, and
     * the real title and channel come from the platform, never from the model.
     */
    videoLeads: z
      .array(
        z
          .object({
            url: z.string().url().max(2_000),
            publisher: z.string().min(2).max(200),
            whyRelevant: z.string().min(10).max(500),
            isOfficialChannel: z.boolean(),
          })
          .strict(),
      )
      .max(6)
      .default([]),
  })
  .strict();

export const automatedResearchDraftSchema = z
  .object({
    recommendedFormat: z.enum([
      "NEWS_FLASH",
      "QUICK_BRIEF",
      "STANDARD_NEWS",
      "DEEP_EXPLAINER",
      "LIVE_BLOG",
      "WHY_TRENDING",
      "VISUAL_STORY",
      "SOURCE_COMPARISON",
    ]),
    targetWords: z.number().int().min(300).max(3_500),
    centralClaim: z.string().min(10).max(2_000),
    sources: z
      .array(
        z
          .object({
            name: z.string().min(2).max(240),
            publisher: z.string().min(2).max(240),
            url: z.string().url().startsWith("https://").max(2_000),
            domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/u).max(253),
            sourceKind: z.enum(["PRIMARY", "INDEPENDENT", "CONTEXT"]),
            sourceType: z.enum([
              "GOVERNMENT",
              "PRIMARY_DOCUMENT",
              "COMPANY",
              "NEWSROOM",
              "WIRE",
              "RESEARCH",
              "EXPERT",
              "DATASET",
              "OTHER",
            ]),
            summary: z.string().min(40).max(4_000),
            supports: z.array(z.string().min(5).max(1_000)).min(1).max(20),
            publishedAt: z.string().max(120).nullable(),
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .min(3)
      .max(10),
    claims: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z0-9:_-]{4,128}$/u),
            text: z.string().min(5).max(2_000),
            importance: z.enum(["central", "supporting"]),
            sourceUrls: z.array(z.string().url().startsWith("https://")).min(1).max(10),
            status: z.enum(["supported", "partially_supported", "unclear", "contradicted"]),
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .min(1)
      .max(80),
    outline: articleOutlineSchema,
    article: z
      .object({
        headline: z.string().min(10).max(HEADLINE_MAX_CHARACTERS),
        subheadline: z.string().min(10).max(420),
        sections: z
          .array(
            z
              .object({
                heading: z.string().min(2).max(180),
                paragraphs: z.array(z.string().min(20).max(8_000)).min(1).max(20),
              })
              .strict(),
          )
          .min(2)
          .max(30),
        keyTakeaways: z.array(z.string().min(5).max(500)).min(2).max(12),
        whyItMatters: z.string().min(20).max(2_000),
        whatHappensNext: z.string().min(10).max(2_000),
        uncertainties: z.array(z.string().min(5).max(1_000)).max(20),
      })
      .strict(),
    seo: z
      .object({
        title: z.string().min(10).max(70),
        description: z.string().min(40).max(180),
        primaryQuery: z.string().min(2).max(180),
        secondaryQueries: z.array(z.string().min(2).max(180)).max(15),
        internalLinkIdeas: z.array(z.string().min(3).max(500)).max(15),
      })
      .strict(),
    distribution: z
      .object({
        socialPosts: z
          .array(
            z
              .object({
                platform: z.enum(["X", "FACEBOOK", "LINKEDIN", "THREADS", "TELEGRAM"]),
                text: z.string().min(10).max(1_500),
              })
              .strict(),
          )
          .min(2)
          .max(10),
        newsletterSubject: z.string().min(5).max(160),
        newsletterPreview: z.string().min(10).max(240),
        newsletterSummary: z.string().min(30).max(2_000),
      })
      .strict(),
    explicitUnknowns: z.array(z.string().min(3).max(1_000)).max(30),
  })
  .strict();

export const regeneratedSectionSchema = z
  .object({
    section: z.enum(["headline", "summary", "body"]),
    content: z.string().min(10).max(80_000),
    factualPacketPreserved: z.boolean(),
    notes: z.array(z.string().min(3).max(500)).max(12),
  })
  .strict();
