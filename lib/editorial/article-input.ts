import { z } from "zod";
import { ARTICLE_FORMATS, STORY_CATEGORIES } from "./types";

const opaqueId = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/u);

const bodySection = z
  .object({
    heading: z.string().trim().min(2).max(180).optional(),
    paragraphs: z
      .array(z.string().trim().min(1).max(8_000))
      .min(1)
      .max(20),
  })
  .strict();

const sourceLink = z
  .object({
    sourceId: opaqueId,
    relationship: z.enum([
      "PRIMARY",
      "INDEPENDENT",
      "CONTEXT",
      "CONTRADICTS",
    ]),
    summary: z.string().trim().min(10).max(1_500),
    sourceUrl: z.string().url().startsWith("https://").max(2_000).optional(),
    sourceTitle: z.string().trim().min(2).max(300).optional(),
  })
  .strict();

const evidenceInput = z
  .object({
    sourceId: opaqueId,
    relationship: z.enum(["SUPPORTS", "CONTRADICTS", "CONTEXT"]),
    sourceLocator: z.string().trim().min(1).max(2_000),
    excerptHash: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{32,128}$/u)
      .optional(),
    observedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const claimInput = z
  .object({
    claimText: z.string().trim().min(5).max(2_000),
    articleSection: z.string().trim().min(1).max(180),
    category: z.string().trim().min(2).max(80),
    importance: z.enum(["central", "supporting"]),
    primaryEvidenceAvailable: z.boolean(),
    verificationStatus: z.enum([
      "VERIFIED",
      "PARTIALLY_VERIFIED",
      "DISPUTED",
      "UNVERIFIED",
    ]),
    riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    reviewNotes: z.string().trim().max(2_000).optional(),
    evidence: z.array(evidenceInput).max(20).default([]),
  })
  .strict();

export const articleVersionInputSchema = z
  .object({
    headline: z.string().trim().min(10).max(220),
    subheadline: z.string().trim().min(10).max(420).nullable(),
    body: z.array(bodySection).min(1).max(80),
    keyTakeaways: z.array(z.string().trim().min(5).max(500)).max(12),
    seo: z
      .object({
        summary: z.string().trim().min(20).max(320),
        eyebrow: z.string().trim().min(2).max(80).optional(),
        whyItMatters: z.string().trim().min(10).max(1_000).optional(),
        whyTrending: z.string().trim().min(10).max(1_000).optional(),
        whatHappensNext: z.string().trim().min(10).max(1_000).optional(),
        uncertainties: z.array(z.string().trim().min(3).max(500)).max(12),
        primaryQuery: z.string().trim().max(180).optional(),
        // The queries the SEO stage produced. Dropping these cost the
        // `keywords` field its only real source, leaving every article
        // declaring its category and nothing else.
        secondaryQueries: z
          .array(z.string().trim().min(2).max(180))
          .max(12)
          .optional(),
        demandEstimate: z.literal("unknown").default("unknown"),
      })
      .strict(),
    structuredData: z.record(z.string(), z.unknown()).default({}),
    // Computed by the autonomous pipeline and never persisted: the column
    // existed, but every INSERT into article_versions omitted it, so the
    // dashboard read a permanent 0 for every article regardless of how it was
    // actually scored, and an operator reviewing a held draft had no way to
    // see why it needed them at all.
    qualityScore: z.number().int().min(0).max(100).optional(),
    qualityReasons: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    changeSummary: z.string().trim().min(10).max(1_000),
    sources: z.array(sourceLink).min(1).max(50),
    claims: z.array(claimInput).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const serialized = JSON.stringify(value);
    if (serialized.length > 500_000) {
      context.addIssue({
        code: "custom",
        message: "The article version exceeds the 500 KB editorial limit.",
      });
    }
    const sourceIds = new Set(value.sources.map((source) => source.sourceId));
    value.claims.forEach((claim, claimIndex) => {
      claim.evidence.forEach((evidence, evidenceIndex) => {
        if (!sourceIds.has(evidence.sourceId)) {
          context.addIssue({
            code: "custom",
            path: ["claims", claimIndex, "evidence", evidenceIndex, "sourceId"],
            message: "Claim evidence must use a source linked to this version.",
          });
        }
      });
    });
  });

export const createArticleInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    category: z.enum(STORY_CATEGORIES),
    format: z.enum(ARTICLE_FORMATS),
    sensitive: z.boolean().default(false),
    version: articleVersionInputSchema,
  })
  .strict();

export const saveArticleVersionInputSchema = z
  .object({
    expectedCurrentVersionId: opaqueId,
    version: articleVersionInputSchema,
  })
  .strict();

export const publishArticleInputSchema = z
  .object({
    expectedCurrentVersionId: opaqueId,
    reason: z.string().trim().min(20).max(1_000),
  })
  .strict();

export const correctionInputSchema = z
  .object({
    expectedCurrentVersionId: opaqueId,
    publicNotice: z.string().trim().min(20).max(2_000),
    reason: z.string().trim().min(20).max(1_000),
    version: articleVersionInputSchema,
  })
  .strict();

export type ArticleVersionInput = z.infer<typeof articleVersionInputSchema>;
export type CreateArticleInput = z.infer<typeof createArticleInputSchema>;
export type SaveArticleVersionInput = z.infer<
  typeof saveArticleVersionInputSchema
>;
export type PublishArticleInput = z.infer<typeof publishArticleInputSchema>;
export type CorrectionInput = z.infer<typeof correctionInputSchema>;
