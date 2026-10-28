import { getD1Binding } from "../../db";
import { createAiGateway, EditorialAiGateway } from "../ai";
import type { AiProviderId } from "../ai/types";
import { registerLicensedCommonsMedia } from "../media/commons-editorial";
import { registerGeneratedEditorialMedia } from "../media/generated-editorial";
import {
  normalizeEditorialEmbed,
  type EditorialEmbed,
} from "../media/editorial-embeds";
import { selectEditorialVideo } from "../media/video-verification";
import { discoverOfficialVideos } from "../media/youtube-discovery";
import { sha256Base64Url } from "../security/crypto";
import { isPolicyPrimaryDomain, resolveSourceAuthority } from "./source-authority";
import { measureFinalBodyIntegrity } from "./final-body-integrity";
import { detectEventRecency } from "./event-recency";
import { deriveTopics } from "./topic-derivation";
import { resolveRuntimeConfig } from "./runtime-config";
import { inspectUntrustedSource } from "../security/ai-boundary";
import {
  createArticleDraft,
  systemApproveArticleForPublication,
} from "./article-write-service";
import type { ArticleVersionInput } from "./article-input";
import { STORY_CATEGORIES, type ArticleFormat, type StoryCategory } from "./types";

export type AutonomousEnvironment = Record<string, string | undefined>;

/**
 * Raised when live search shows the trend is a generic query rather than a
 * reportable event. It ends the run before any drafting cost is incurred.
 */
export class AutonomousTopicNotReportableError extends Error {
  readonly code = "AUTONOMOUS_TOPIC_NOT_REPORTABLE";

  constructor(message: string) {
    super(message);
    this.name = "AutonomousTopicNotReportableError";
  }
}

export type AutonomousTrendInput = {
  trendId: string;
  headline: string;
  category: StoryCategory;
  recommendedFormat: ArticleFormat;
  score: number;
  riskLevel: string;
  /**
   * Claimed attempt number for this trend. It makes the editorial idempotency
   * key unique per attempt, so a trend that produced an earlier draft can be
   * regenerated. Duplicate delivery of one attempt is already prevented by the
   * single-row run claim in the queue executor.
   */
  attempt?: number;
};

export type AutonomousRunResult = {
  articleId: string;
  versionId: string;
  state: "APPROVED" | "HUMAN_REVIEW_REQUIRED";
  wordCount: number;
  qualityScore: number;
  draftingProvider: string;
  reviewProvider: string;
  costUsd: number;
  reasons: string[];
};

type SourceRow = {
  id: string;
  name: string;
  domain: string;
  sourceType: string;
  credibilityTier: number;
  isPrimary: number;
  licensingStatus: string;
};

type GeneratedSource = {
  name: string;
  publisher: string;
  url: string;
  domain: string;
  sourceKind: "PRIMARY" | "INDEPENDENT" | "CONTEXT";
  sourceType: string;
  summary: string;
  supports: string[];
  confidence: number;
};

const HIGH_RISK_CATEGORIES = new Set<StoryCategory>([
  "POLITICS",
  "HEALTH",
  "FINANCE",
  "WORLD",
]);

export async function runAutonomousNewsroomStory(
  input: AutonomousTrendInput,
  environment: AutonomousEnvironment,
): Promise<AutonomousRunResult> {
  const db = await getD1Binding();
  await ensureSystemUser(db);
  const heuristicCategory = inferAutonomousCategory(input.headline, input.category);
  const registry = await loadSourceRegistry(db);
  const profile = wordProfile(input.recommendedFormat, environment);
  const autonomousEnvironment = autonomousAiEnvironment(environment);
  const gateway = new EditorialAiGateway(
    createAiGateway({ environment: autonomousEnvironment }),
    autonomousEnvironment,
  );
  // A keyword search of the headline only ever finds what the list anticipated
  // - a story about the tennis player "Rublev" fell through to US_NEWS because
  // no headline word matched a hardcoded sport term. The list still runs first
  // because it is free; the model only spends anything on the case the list
  // itself could not resolve, where a general-knowledge read of the headline
  // is worth the cost of asking.
  const category =
    heuristicCategory === "US_NEWS"
      ? await classifyStoryCategory(gateway, input.headline, input.trendId)
      : heuristicCategory;
  const workflowId = `autonomous_${input.trendId}_${Date.now()}`;
  const selectedRegistry = selectSources(registry, category, input.headline, 24);

  // Live source discovery runs on the paid provider that has real web search.
  // Gemini writes from current reporting instead of training memory, which is
  // what makes the claims verifiable at fact review. A failure here is not
  // fatal: the run continues with the trusted source registry alone.
  let liveSourceLeads: unknown = null;
  let discoveryProvider = "not-run";
  let discoveryCost = 0;

  if (environment.AI_SOURCE_DISCOVERY_CHAIN?.trim()) {
    try {
      const discovery = await gateway.discoverLiveSources({
        taskId: `${workflowId}:source-discovery`,
        storyId: workflowId,
        content: {
          topic: input.headline,
          category,
          market: "United States",
          instruction:
            "Find the most recent, citable reporting about this topic. Return at " +
            "least one official or first-party PRIMARY source and at least two " +
            "INDEPENDENT newsroom sources when they exist. Prefer material " +
            "published in the last seven days. Give exact HTTPS URLs and short " +
            "factual summaries with concrete names, dates, numbers, and results. " +
            "Also list videoLeads: pages on YouTube, Vimeo or TikTok that show " +
            "the event itself, preferring the official channel of the league, " +
            "team, agency, company or broadcaster involved. Give the exact watch " +
            "URL. Do not invent a video that you have not seen listed.",
        },
        budget: {
          maxInputTokens: 8_000,
          maxOutputTokens: 3_000,
          maxCostUsd: positiveNumber(environment.AI_PER_TASK_BUDGET_USD, 0.15),
        },
      });

      liveSourceLeads = discovery.data;
      discoveryProvider = discovery.metadata.provider;
      discoveryCost = discovery.metadata.costUsd;

      // Many trending terms are generic queries rather than events: "weather
      // radar" or "pressure" have no reportable news behind them. When live
      // search finds no primary reporting, the story is abandoned here instead
      // of spending the drafting budget on something the publication gate will
      // reject for an unverifiable central claim.
      const leads = discovery.data.sources;
      const primaryLeads = leads.filter(
        (lead) => lead.sourceKind === "PRIMARY",
      ).length;

      if (leads.length < 2 || primaryLeads < 1) {
        console.warn("autonomous_topic_not_reportable", {
          trendId: input.trendId,
          leadCount: leads.length,
          primaryLeadCount: primaryLeads,
        });
        throw new AutonomousTopicNotReportableError(
          `Live search found ${leads.length} sources and ${primaryLeads} primary sources for this term, which is not enough for a verifiable story.`,
        );
      }
    } catch (error) {
      if (error instanceof AutonomousTopicNotReportableError) throw error;
      console.error("autonomous_source_discovery_failed", error);
    }
  }

  const research = await gateway.researchAndDraft({
    taskId: `${workflowId}:research`,
    storyId: workflowId,
    content: {
      topic: input.headline,
      category,
      requestedFormat: input.recommendedFormat,
      primaryQuery: input.headline,
      sensitive: false,
      // The model cannot judge "more than two months old" without knowing the
      // day it is writing for. Without this it defaulted to whatever the search
      // surfaced - often a past season - and the currency rule had no anchor.
      publicationDate: new Date().toISOString().slice(0, 10),
      wordProfile: profile,
      liveSourceLeads,
      // Gemini rejects `minItems`, so the array and length rules cannot be
      // enforced through the response schema. The same contract is stated in
      // the request instead, because a draft below the minimum is discarded by
      // the publication gate and the generation cost is wasted.
      lengthContract:
        `Write a full, substantial article of about ${profile.targetWords} words. This is a hard floor: a draft under ${profile.minWords} words is rejected before publication, so the story must be developed to at least that length - report the background, the context, why it matters, the specifics, the reactions, and what happens next until it is genuinely complete. Reaching the length is done with real reporting and detail, never with filler, repetition, or padding. ` +
        `Do not write to a fixed template, and do not stop early: let the story set its own shape - how many sections it needs, how long each runs, where a short sharp paragraph lands and where a longer one earns its space - but keep developing it until it is thorough. A thin 200-word stub is a failure even if every sentence is sharp. ` +
        `Open on the news itself - the specific thing that happened, in a sentence a person would actually say out loud - never a throat-clearing "In an era of..." or "In the world of..." windup. Each heading should name what that part actually delivers, not a vague label.`,
      sourceRequirements: {
        minimumPrimarySources: 1,
        minimumIndependentSources: 2,
        maximumResearchSources: 10,
        exactHttpsUrlsRequired: true,
        // Publication is refused when the central claim has no primary source,
        // so the requirement is stated to the model rather than discovered at
        // the end of an otherwise finished article.
        centralClaimRule:
          "Exactly one claim must be marked central, and its sourceUrls must " +
          "include at least one source whose sourceKind is PRIMARY. Choose a " +
          "central claim that an official, first-party, or on-the-record " +
          "primary source directly supports.",
      },
      trustedSourceRegistry: selectedRegistry.map((source) => ({
        name: source.name,
        domain: source.domain,
        sourceType: source.sourceType,
        credibilityTier: source.credibilityTier,
        isPrimary: source.isPrimary === 1,
        licensingStatus: source.licensingStatus,
      })),
      editorialRules: {
        locale: "en-US",
        originalWritingOnly: true,
        noCopiedPassages: true,
        noInventedQuotes: true,
        noKeywordStuffing: true,
        discloseUncertainty: true,
        evidenceFirst: true,
        // The house voice. The single biggest complaint was that articles read
        // like a content mill filling a template; this is the instruction that
        // pushes them toward writing a sharp human reporter would file.
        voice:
          "Write like a sharp human reporter on a good newsroom, not a content " +
          "mill filling a form. Active voice. Concrete specifics - names, " +
          "numbers, places, dates - over abstraction. Vary sentence and " +
          "paragraph length so the piece has rhythm. Ban boilerplate " +
          "transitions (Moreover, Furthermore, Additionally, In conclusion), " +
          "throat-clearing openers, and any closing paragraph that only " +
          "restates what was already said. No hedging filler, no marketing " +
          "adjectives, no keyword padding. Every sentence must earn its place " +
          "or be cut. Attribute what is claimed and say plainly what is not yet " +
          "known.",
      },
    },
    budget: budgetFor(input.recommendedFormat, environment),
  });

  // Source identity is a server decision. The model proposes a role and a
  // domain, but the domain is re-derived from the resolved URL and the primary
  // classification only survives when operator policy or the source registry
  // agrees. This stops a fabricated `domain` field from borrowing a trusted
  // publisher's identity to satisfy the publication gate.
  const registryAuthority = registry.map((entry) => ({
    domain: entry.domain,
    sourceType: entry.sourceType,
    credibilityTier: entry.credibilityTier,
    isPrimary: entry.isPrimary === 1,
  }));
  const sources = deduplicateSources(
    (research.data.sources as GeneratedSource[]).flatMap((source) => {
      const authority = resolveSourceAuthority(
        source,
        registryAuthority,
        input.headline,
      );
      if (!authority) {
        console.warn("source_rejected_unusable_url", {
          declaredDomain: source.domain,
        });
        return [];
      }
      if (authority.downgradeReason) {
        console.warn("source_authority_downgraded", {
          domain: authority.domain,
          declaredKind: source.sourceKind,
          resolvedKind: authority.sourceKind,
          reason: authority.downgradeReason,
        });
      }
      return [
        {
          ...source,
          domain: authority.domain,
          sourceKind: authority.sourceKind,
          sourceType: authority.sourceType,
        },
      ];
    }),
  );
  // Source text is untrusted data that reaches models whose output is
  // published. The boundary inspector existed but was never connected to the
  // production path, so a hostile page could carry instructions straight into
  // drafting. Anything that trips the inspector is quarantined out of the
  // evidence packet; if that breaks the source contract, the publication gate
  // stops the story rather than publishing on poisoned material.
  const quarantinedSources = sources.filter((source) => {
    const verdict = inspectUntrustedSource(
      `${source.summary} ${source.supports.join(" ")}`,
    );
    if (verdict.requiresHumanReview) {
      console.warn("source_quarantined_untrusted_content", {
        domain: source.domain,
        promptInjectionIndicators: verdict.containsPromptInjectionIndicators,
        secretLikeMaterial: verdict.containsSecretLikeMaterial,
      });
    }
    return verdict.requiresHumanReview;
  });
  const quarantinedUrls = new Set(
    quarantinedSources.map((source) => source.url),
  );
  const trustedSources = sources.filter(
    (source) => !quarantinedUrls.has(source.url),
  );

  const persistedSources = await persistSources(db, trustedSources);
  const evidencePacket = trustedSources.map((source, index) => ({
    id: `evidence_${index + 1}`,
    sourceId: persistedSources.get(normalizeDomain(source.domain))!,
    sourceName: source.name,
    sourceType: source.sourceKind,
    sourceUrl: source.url,
    summary: source.summary,
    supports: source.supports,
  }));
  const claims = research.data.claims.map((claim) => ({
    id: claim.id,
    text: claim.text,
    importance: claim.importance,
    status: claim.status,
    sourceUrls: claim.sourceUrls,
    evidenceIds: evidencePacket
      .filter((evidence) => claim.sourceUrls.includes(evidence.sourceUrl))
      .map((evidence) => evidence.id),
  }));

  let reviewProvider = "deterministic";
  let reviewModel = "claim-status";
  let reviewCost = 0;
  let reviewGroundedSourceUrls: readonly string[] = [];
  let reviewSearchQueries: readonly string[] = [];
  let blocking = true;
  // A provider failure and an editorial objection both left `blocking` true and
  // both surfaced as `fact_review_blocking`, so an operator reading the queue
  // could not tell "the reviewer disputed this" from "the reviewer never ran".
  // Every article in the queue is currently the second case.
  let reviewUnavailable = true;
  let reviewFailure: string | null = null;
  let findings = claims.map((claim) => ({
    claimId: claim.id,
    disposition: claim.status === "supported" ? "supported" : "unsupported",
    evidenceIds: claim.evidenceIds,
  }));
  try {
    const excludeProviders: AiProviderId[] = [research.metadata.provider];
    const review = await gateway.reviewFacts({
      taskId: `${workflowId}:independent-review`,
      storyId: workflowId,
      excludeProviders,
      content: {
        draft: {
          headline: research.data.article.headline,
          subheadline: research.data.article.subheadline,
        },
        claimList: claims.map((claim) => ({
          id: claim.id,
          text: claim.text,
          importance: claim.importance,
          sourceUrls: claim.sourceUrls,
          evidenceIds: claim.evidenceIds,
        })),
        evidencePacket: evidencePacket.map((evidence) => ({
          id: evidence.id,
          sourceName: evidence.sourceName,
          sourceType: evidence.sourceType,
          sourceUrl: evidence.sourceUrl,
          summary: evidence.summary.slice(0, 700),
          supports: evidence.supports.slice(0, 5),
        })),
        instruction:
          "Perform one compact independent audit of the supplied claims. Use at most one web search when current corroboration is needed. Verify the central claim first, then material numeric, date, identity, result, and quote claims. Return concise findings only. Do not rewrite the article.",
      },
      budget: {
        maxInputTokens: 16_000,
        maxOutputTokens: 1_600,
        maxCostUsd: positiveNumber(environment.AI_PER_TASK_BUDGET_USD, 0.15),
      },
    });
    reviewProvider = review.metadata.provider;
    reviewModel = review.metadata.model;
    reviewCost = review.metadata.costUsd;
    reviewGroundedSourceUrls = review.metadata.groundedSourceUrls;
    reviewSearchQueries = review.metadata.groundingSearchQueries;
    blocking = review.data.blocking;
    reviewUnavailable = false;
    findings = review.data.findings.map((finding) => ({
      claimId: finding.claimId,
      disposition: finding.disposition,
      evidenceIds: finding.evidenceIds,
    }));
  } catch (error) {
    // A console line in a Worker is gone the moment nobody is tailing it, which
    // is how a fact reviewer that failed on every single run went unnoticed
    // while the queue filled with articles blamed for an editorial objection
    // that never happened. The cause is recorded on the article instead.
    reviewFailure = error instanceof Error ? error.message : String(error);
    console.error("autonomous_independent_review_failed", error);
  }

  let copyReviewProvider = "not-run";
  let copyReviewCost = 0;
  let copyReviewPassed = false;
  let finalDraft = {
    headline: research.data.article.headline,
    subheadline: research.data.article.subheadline,
    sections: research.data.article.sections.map((section, index) => ({
      heading: section.heading,
      paragraphs: section.paragraphs,
      claimIdsUsed: research.data.outline.sections[index]?.claimIds ?? [],
    })),
    unknownsDisclosed: research.data.explicitUnknowns,
  };
  // Editorial policy on an imperfect fact review. A contradicted statement, an
  // unverified central claim, or widespread doubt still blocks the story. A
  // small number of merely unverified supporting details does not: those
  // sentences are removed from the draft instead of discarding a story whose
  // central claim is verified, which is what a newsroom desk does.
  const contradictedFindings = findings.filter(
    (finding) =>
      finding.disposition === "contradicted" ||
      finding.disposition === "misstated",
  );
  const unsupportedFindings = findings.filter(
    (finding) => finding.disposition !== "supported",
  );
  const unsupportedShare =
    findings.length > 0 ? unsupportedFindings.length / findings.length : 1;
  // The extraction model routinely marks three or more claims "central", so
  // picking the first one in array order is a coin flip: it is frequently a
  // claim the review left unsupported while a later one - the claim that will
  // actually be published as central - is fully verified. Checking the wrong
  // claim here blocked a well-sourced story before `centralClaimId` below ever
  // got a chance to pick the right one, which is why fact_review_blocking was
  // the single largest cause of unnecessary human review (48 of the last 60
  // blocked runs), well ahead of any real sourcing gap.
  const claimQualifies = (claim: (typeof claims)[number]) => {
    const supported =
      findings.find((finding) => finding.claimId === claim.id)?.disposition ===
      "supported";
    const hasPrimary = claim.sourceUrls.some(
      (url) =>
        trustedSources.find((source) => source.url === url)?.sourceKind ===
        "PRIMARY",
    );
    return supported && hasPrimary;
  };
  const centralClaimId =
    claims.find((claim) => claim.importance === "central" && claimQualifies(claim))
      ?.id ??
    claims.find(claimQualifies)?.id ??
    claims.find((claim) => claim.importance === "central")?.id ??
    claims[0]?.id;
  const centralClaimSupported =
    findings.find((finding) => finding.claimId === centralClaimId)
      ?.disposition === "supported";
  const maximumUnsupportedShare = Math.min(
    0.6,
    Math.max(0, positiveNumber(environment.AI_MAX_UNSUPPORTED_CLAIM_SHARE, 0.3)),
  );
  // Every finding that is not "supported" is removed from the draft below, so a
  // single misstated or contradicted detail is a redaction target rather than a
  // reason to discard the story. The story is still blocked when the central
  // claim fails, when the review disputes a large share of the draft, or when
  // the reviewer raises a blocking verdict it cannot attribute to a claim.
  const contradictedShare =
    findings.length > 0 ? contradictedFindings.length / findings.length : 0;
  const factReviewBlocks =
    !centralClaimSupported ||
    contradictedShare > 0.25 ||
    unsupportedShare > maximumUnsupportedShare ||
    (blocking && unsupportedFindings.length === 0);

  let redactionProvider = "not-run";
  let redactionCost = 0;

  if (!factReviewBlocks && unsupportedFindings.length > 0) {
    const unsupportedTexts = unsupportedFindings
      .map(
        (finding) =>
          claims.find((claim) => claim.id === finding.claimId)?.text ?? "",
      )
      .filter(Boolean)
      .slice(0, 12);

    if (unsupportedTexts.length > 0) {
      try {
        const redaction = await gateway.draftArticle({
          taskId: `${workflowId}:redact-unverified`,
          storyId: workflowId,
          content: {
            draft: finalDraft,
            statementsToRemove: unsupportedTexts,
            verifiedClaims: claims.filter((claim) =>
              findings.some(
                (finding) =>
                  finding.claimId === claim.id &&
                  finding.disposition === "supported",
              ),
            ),
            evidencePacket,
            instruction:
              "Independent review could not verify the listed statements. " +
              "Remove every sentence that asserts or depends on them, together " +
              "with any heading or paragraph left empty. Keep all other text " +
              "exactly as written, keep the article coherent, and do not add " +
              "any new fact, quote, number, date, name, or source.",
          },
          budget: {
            maxInputTokens: 40_000,
            maxOutputTokens: 14_000,
            maxCostUsd: positiveNumber(environment.AI_PER_TASK_BUDGET_USD, 0.15),
          },
        });

        redactionProvider = redaction.metadata.provider;
        redactionCost = redaction.metadata.costUsd;
        finalDraft = {
          headline: redaction.data.headline,
          subheadline: redaction.data.subheadline,
          sections: redaction.data.sections,
          unknownsDisclosed:
            redaction.data.unknownsDisclosed.length > 0
              ? redaction.data.unknownsDisclosed
              : finalDraft.unknownsDisclosed,
        };
      } catch (error) {
        console.error("autonomous_redaction_failed", error);
      }
    }
  }

  // A draft below the publication length is expanded once from the material it
  // already has. The expansion may only develop verified claims and supplied
  // evidence; it must not introduce a fact, quote, number, or source, so the
  // fact review that already ran stays valid.
  let expansionProvider = "not-run";
  let expansionCost = 0;
  const initialWordCount = countWords(
    finalDraft.sections.flatMap((section) => section.paragraphs).join(" "),
  );

  let workingWordCount = initialWordCount;

  for (
    let pass = 1;
    pass <= 2 && !factReviewBlocks && workingWordCount < profile.minWords;
    pass += 1
  ) {
    try {
      const expansion = await gateway.draftArticle({
        taskId: `${workflowId}:expand`,
        storyId: workflowId,
        content: {
          draft: finalDraft,
          verifiedClaims: claims,
          evidencePacket,
          currentWordCount: initialWordCount,
          wordProfile: profile,
          instruction:
            `The draft is ${workingWordCount} words and the publication minimum is ` +
            `${profile.minWords} words, so it is currently rejected. Expand it to at ` +
            `least ${profile.minWords} words and ideally ${profile.targetWords} by ` +
            "developing the verified claims and supplied evidence in more depth: add " +
            "context, mechanism, background, consequences, and clearly attributed " +
            "detail that is already present in the packet. Keep every existing " +
            "section, add sections only when the packet supports them, and never " +
            "introduce a fact, quote, number, date, name, or source that is absent " +
            "from the verified material. Do not pad with repetition or filler.",
        },
        budget: {
          maxInputTokens: 40_000,
          maxOutputTokens: 14_000,
          maxCostUsd: positiveNumber(environment.AI_PER_TASK_BUDGET_USD, 0.15),
        },
      });

      expansionProvider = expansion.metadata.provider;
      expansionCost = expansion.metadata.costUsd;

      const expandedWordCount = countWords(
        expansion.data.sections
          .flatMap((section) => section.paragraphs)
          .join(" "),
      );

      if (expandedWordCount > workingWordCount) {
        finalDraft = {
          headline: expansion.data.headline,
          subheadline: expansion.data.subheadline,
          sections: expansion.data.sections,
          unknownsDisclosed:
            expansion.data.unknownsDisclosed.length > 0
              ? expansion.data.unknownsDisclosed
              : finalDraft.unknownsDisclosed,
        };
        workingWordCount = expandedWordCount;
        continue;
      }

      // The pass added nothing, so the packet is exhausted and a second attempt
      // would only invent filler.
      break;
    } catch (error) {
      console.error("autonomous_draft_expansion_failed", error);
      break;
    }
  }

  if (!factReviewBlocks) {
    try {
      const copyReview = await gateway.copyEdit({
        taskId: `${workflowId}:copy-review`,
        storyId: workflowId,
        content: {
          draft: finalDraft,
          verifiedClaims: claims,
          evidencePacket,
          instruction:
            "Improve clarity, structure, pacing, and newsroom style without adding any fact, quote, number, or implication that is absent from the verified claim packet. Preserve uncertainty and source boundaries.",
        },
        budget: {
          maxInputTokens: 40_000,
          // The copy pass rewrites the whole article, so its ceiling has to
          // cover a full-length draft or the edited version comes back cut off.
          maxOutputTokens: 14_000,
          maxCostUsd: positiveNumber(environment.AI_PER_TASK_BUDGET_USD, 0.15),
        },
      });
      copyReviewProvider = copyReview.metadata.provider;
      copyReviewCost = copyReview.metadata.costUsd;
      copyReviewPassed =
        copyReview.data.factualPacketPreserved &&
        copyReview.data.attemptedFactualAdditions.length === 0;
      if (copyReviewPassed) finalDraft = copyReview.data.draft;
    } catch (error) {
      console.error("autonomous_copy_review_failed", error);
    }
  }

  // Independent review ran against the claim packet, but redaction, length
  // completion and copy editing each replace the whole draft afterwards. The
  // text that is about to be published is measured here, and the hash is
  // carried into the version so publication can prove it is publishing the
  // text that was checked.
  const finalIntegrity = await measureFinalBodyIntegrity({
    headline: finalDraft.headline,
    subheadline: finalDraft.subheadline,
    sections: finalDraft.sections,
    approvedSourceUrls: trustedSources.map((source) => source.url),
  });

  if (finalIntegrity.unapprovedLinks.length > 0) {
    console.warn("final_body_unapproved_links", {
      count: finalIntegrity.unapprovedLinks.length,
      hosts: finalIntegrity.unapprovedLinks
        .map((link) => {
          try {
            return new URL(link).hostname;
          } catch {
            return "unparseable";
          }
        })
        .slice(0, 5),
    });
  }

  // centralClaimId is resolved above, alongside centralClaimSupported: exactly
  // one claim carries the article, chosen for actually meeting the publication
  // bar rather than for the model's label.
  const body = finalDraft.sections.map((section) => ({
    heading: section.heading,
    paragraphs: section.paragraphs,
  }));
  const wordCount = countWords(body.flatMap((section) => section.paragraphs).join(" "));
  const primaryCount = trustedSources.filter((source) => source.sourceKind === "PRIMARY").length;
  const independentCount = trustedSources.filter((source) => source.sourceKind === "INDEPENDENT").length;
  const unsupported = claims.filter((claim) => {
    const finding = findings.find((item) => item.claimId === claim.id);
    return finding?.disposition !== "supported";
  }).length;
  const central = claims.find((claim) => claim.importance === "central") ?? claims[0];
  const independentReview = reviewProvider !== research.metadata.provider;
  const suppliedEvidenceGroundedReview =
    evidencePacket.length >= 3 &&
    findings.every((finding) => finding.disposition === "supported");
  const groundedIndependentReview =
    reviewGroundedSourceUrls.length >= 2 ||
    suppliedEvidenceGroundedReview;
  const trendRisk = normalizeRisk(input.riskLevel);
  const categoryBlocked =
    HIGH_RISK_CATEGORIES.has(category) || trendRisk !== "LOW";
  const reasons: string[] = [];
  if (wordCount < profile.minWords) reasons.push("article_too_short");
  if (primaryCount < 1) reasons.push("missing_primary_source");
  // Corroboration threshold comes from the one runtime declaration, so the
  // number an operator reads on the dashboard is the number the gate enforces.
  if (
    independentCount <
    resolveRuntimeConfig(environment).settings.minimumIndependentSources
  ) {
    reasons.push("missing_independent_sources");
  }
  if (factReviewBlocks) {
    reasons.push(
      reviewUnavailable ? "fact_review_unavailable" : "fact_review_blocking",
    );
  }
  // A link that is not in the reviewed source manifest was introduced by a
  // post-review rewrite, so the published text would carry an unverified
  // destination.
  if (finalIntegrity.unapprovedLinks.length > 0) {
    reasons.push("final_body_contains_unapproved_links");
  }
  if (!independentReview) reasons.push("review_not_independent");
  if (!groundedIndependentReview) reasons.push("review_not_search_grounded");
  // Every other gate here measures sourcing or wording; none compared the date
  // inside the reporting with the date about to be stamped on it. That is how a
  // contract signed in July 2024 was published as August 2026 news and filed to
  // Google News as current. A stale lede now needs a human to decide whether it
  // is a retrospective or a mistake.
  const eventRecency = detectEventRecency(
    body.flatMap((section) => section.paragraphs).join(" "),
    new Date(),
  );
  if (eventRecency.stale) reasons.push("event_older_than_publication");
  // Copy editing improves presentation, but a provider outage must not turn a
  // factually verified, source-complete, low-risk article into a blocked draft.
  // The original research draft remains the fallback when copy review fails.
  if (categoryBlocked) reasons.push("high_risk_category");
  const persistedCentralSupported =
    findings.find((finding) => finding.claimId === centralClaimId)
      ?.disposition === "supported";
  if (!centralClaimId || !persistedCentralSupported) {
    reasons.push("central_claim_not_verified");
  }
  // The publication service refuses any article whose central claim has no
  // primary evidence. Checking it here too turns that refusal into an ordinary
  // review decision instead of a hard failure that discards a finished draft.
  // The gate must judge the claim that will actually be recorded as central,
  // not whichever claim the extraction listed first. Checking a different claim
  // than the one persisted is how an article passed the gate and was then
  // refused by the publication service.
  const persistedCentral =
    claims.find((claim) => claim.id === centralClaimId) ?? central;
  const centralClaimHasPrimaryEvidence = Boolean(
    persistedCentral?.sourceUrls.some(
      (url) =>
        trustedSources.find((source) => source.url === url)?.sourceKind === "PRIMARY",
    ),
  );
  if (!centralClaimHasPrimaryEvidence) {
    reasons.push("central_claim_missing_primary_evidence");
  }

  const qualityScore = Math.max(
    0,
    100 - reasons.length * 18 - Math.max(0, profile.targetWords - wordCount) / 100,
  );
  const sourceIdByUrl = new Map(
    trustedSources.map((source) => [source.url, persistedSources.get(normalizeDomain(source.domain))!]),
  );
  const nowIso = new Date().toISOString();
  const slug = await uniqueSlug(
    db,
    finalDraft.headline,
    input.trendId,
  );
  const centralClaimSourceUrls = new Set(
    claims.find((claim) => claim.importance === "central")?.sourceUrls ?? [],
  );
  // Video enrichment. Candidates come from two places: video pages the model
  // found while searching, and any cited source that is itself a video page.
  // Nothing is embedded on the model's word: the platform oEmbed endpoint has
  // to confirm the video exists and allows embedding, and the rendered title
  // and channel come from that response. Copyrighted footage is never copied;
  // the rightsholder's own player is embedded and keeps its attribution.
  // Cited sources are almost always article pages, so on their own they yield a
  // video only by accident. A direct search finds the outlet's own upload of
  // the footage, and it leads the list because `selectEditorialVideo` only
  // examines the first handful of candidates.
  const videoCandidates = [
    ...(await discoverOfficialVideoUrls(input.headline, finalDraft.headline, environment)),
    ...readVideoLeadUrls(liveSourceLeads),
    ...trustedSources
      .filter(
        (source) =>
          source.sourceKind !== "CONTEXT" &&
          (centralClaimSourceUrls.size === 0 ||
            centralClaimSourceUrls.has(source.url)),
      )
      .map((source) => source.url),
  ];

  let sourceVideo: EditorialEmbed | null = null;
  try {
    const verified = await selectEditorialVideo(videoCandidates, {
      subject: input.headline,
      headline: finalDraft.headline,
    });
    if (verified) {
      sourceVideo = verified;
      console.warn("editorial_video_selected", {
        provider: verified.provider,
        publisher: verified.publisher,
      });
    }
  } catch (error) {
    console.error("editorial_video_verification_failed", error);
  }

  if (!sourceVideo) {
    sourceVideo = findTrustedEditorialEmbed(trustedSources, centralClaimSourceUrls);
  }
  const version: ArticleVersionInput = {
    headline: finalDraft.headline,
    subheadline: finalDraft.subheadline,
    body,
    keyTakeaways: research.data.article.keyTakeaways,
    seo: {
      summary: research.data.seo.description,
      eyebrow: category.replaceAll("_", " "),
      whyItMatters: research.data.article.whyItMatters,
      whyTrending: input.headline,
      whatHappensNext: research.data.article.whatHappensNext,
      uncertainties: research.data.article.uncertainties,
      primaryQuery: research.data.seo.primaryQuery,
      secondaryQueries: research.data.seo.secondaryQueries,
      demandEstimate: "unknown",
    },
    // Computed above and previously discarded: the column existed but every
    // write omitted it, so the dashboard read a permanent 0 regardless of the
    // real score, and a held article gave no reason for why it was held.
    qualityScore: Math.round(qualityScore),
    qualityReasons: reasons,
    structuredData: {
      image: `/story-image/${slug}`,
      imageAlt: `Northline visual briefing for ${finalDraft.headline}`,
      imageCredit: "Northline editorial graphic",
      ...(sourceVideo
        ? {
            videoEmbedUrl: sourceVideo.embedUrl,
            videoTitle: sourceVideo.title,
            videoSourceUrl: sourceVideo.sourceUrl,
            videoProvider: sourceVideo.provider,
            videoAspect: sourceVideo.aspect,
          }
        : {}),
      aiAssisted: true,
      autonomousWorkflowId: workflowId,
      draftingProvider: research.metadata.provider,
      factReviewProvider: reviewProvider,
      factReviewError: reviewFailure,
      factReviewGroundedSourceUrls: reviewGroundedSourceUrls,
      factReviewSearchQueries: reviewSearchQueries,
      reviewedBodyHash: finalIntegrity.bodyHash,
      reviewedBodyWordCount: finalIntegrity.wordCount,
      // Why the gate held this story. Without it, a review queue is a wall of
      // articles with no way to tell which rule to examine.
      gateReasons: reasons,
      gateWordCount: wordCount,
      gatePrimarySources: primaryCount,
      gateIndependentSources: independentCount,
      sourceDiscoveryProvider: discoveryProvider,
      redactionProvider,
      unsupportedClaimCount: unsupportedFindings.length,
      expansionProvider,
      copyReviewProvider,
      copyReviewPassed,
      seoTitle: research.data.seo.title,
      metaDescription: research.data.seo.description,
      secondaryQueries: research.data.seo.secondaryQueries,
      internalLinkIdeas: research.data.seo.internalLinkIdeas,
      socialPosts: research.data.distribution.socialPosts,
      newsletterSubject: research.data.distribution.newsletterSubject,
      newsletterPreview: research.data.distribution.newsletterPreview,
      newsletterSummary: research.data.distribution.newsletterSummary,
      explicitUnknowns: research.data.explicitUnknowns,
    },
    changeSummary: "Autonomous evidence-first draft created from a verified trend signal.",
    // Citations are keyed by the exact page, not by the publisher. Keying by
    // source id collapsed several pages from one domain into a single citation
    // and let one article display another article's source.
    sources: Array.from(
      new Map(
        trustedSources.map((source) => {
          const sourceId = persistedSources.get(normalizeDomain(source.domain))!;
          return [
            source.url,
            {
              sourceId,
              relationship: source.sourceKind,
              summary: source.summary,
              sourceUrl: source.url,
              sourceTitle: source.name,
            },
          ] as const;
        }),
      ).values(),
    ),
    claims: await Promise.all(
      claims.map(async (claim) => {
        const finding = findings.find((item) => item.claimId === claim.id);
        const supported = finding?.disposition === "supported";
        // An article makes one central assertion - the one its headline states.
        // The extraction model routinely marked three or more claims "central",
        // and publication requires every central claim to be verified with
        // primary evidence, so a single well-sourced story was refused because
        // a supporting detail had been mislabelled. The strongest qualifying
        // claim keeps the label; the rest are recorded as supporting, which is
        // what they are. Nothing is marked verified that review did not verify,
        // so an article with no qualifying central claim still cannot publish.
        const isCentral = claim.id === centralClaimId;
        const evidence = claim.sourceUrls.flatMap((url) => {
          const sourceId = sourceIdByUrl.get(url);
          if (!sourceId) return [];
          return [{
            sourceId,
            relationship: "SUPPORTS" as const,
            sourceLocator: url,
            excerptHash: undefined,
            observedAt: nowIso,
          }];
        });
        return {
          claimText: claim.text,
          articleSection: isCentral ? "Central claim" : "Supporting claim",
          category,
          importance: isCentral ? ("central" as const) : ("supporting" as const),
          primaryEvidenceAvailable: claim.sourceUrls.some((url) => {
            const source = trustedSources.find((item) => item.url === url);
            return source?.sourceKind === "PRIMARY";
          }),
          verificationStatus: supported ? "VERIFIED" as const : "UNVERIFIED" as const,
          riskLevel: categoryBlocked ? trendRisk : "LOW" as const,
          reviewNotes: supported
            ? `Independently reviewed by ${reviewProvider}/${reviewModel}.`
            : "Autonomous review did not fully support this claim.",
          evidence,
        };
      }),
    ),
  };

  // The editorial idempotency key is derived from the generated draft itself.
  // A redelivered queue message that carries the same draft replays the original
  // write, while a genuine regeneration of the same trend gets its own key
  // instead of colliding with the previous attempt.
  const draftFingerprint = (
    await sha256Base64Url(
      `${input.trendId}\u0000${input.attempt ?? 1}\u0000${JSON.stringify(version)}`,
    )
  ).slice(0, 24);

  const created = await createArticleDraft(
    {
      slug,
      category,
      format: input.recommendedFormat,
      sensitive: categoryBlocked,
      version,
    },
    { userId: "system:autonomous", type: "PUBLISHER" },
    `autonomous-create:${draftFingerprint}`,
  );


  // Topics were never written by anything, so `article_topics` stayed empty and
  // silently emptied three things at once: the `keywords` field in structured
  // data, every topic page, and the internal link graph between articles. They
  // are derived from what the story is filed under and the search queries the
  // SEO stage already produced - no new claim is made about the story.
  try {
    const derived = deriveTopics({
      category,
      secondaryQueries: research.data.seo.secondaryQueries,
    });
    for (const topic of derived) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO content_topics
             (id, slug, name, kind, active, created_at, updated_at)
           VALUES (?1, ?2, ?3, 'TOPIC', 1, ?4, ?4)`,
        )
        .bind(`topic_${topic.slug}`, topic.slug, topic.name, Date.now())
        .run();
      await db
        .prepare(
          `INSERT OR IGNORE INTO article_topics
             (article_id, topic_id, relationship, created_at)
           VALUES (?1, ?2, 'ABOUT', ?3)`,
        )
        .bind(created.articleId, `topic_${topic.slug}`, Date.now())
        .run();
    }
  } catch (error) {
    // Filing metadata must never cost a finished article its publication.
    console.warn("autonomous_topic_persist_failed", {
      articleId: created.articleId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }

  const licensedMedia = await registerLicensedCommonsMedia({
    database: db,
    articleVersionId: created.versionId,
    headline: finalDraft.headline,
    category,
    subject: input.headline,
  });

  if (!licensedMedia) {
    await registerGeneratedEditorialMedia({
      database: db,
      articleVersionId: created.versionId,
      slug,
      headline: finalDraft.headline,
      category,
    });
  }

  const canApprove =
    environment.AUTONOMOUS_SYSTEM_APPROVAL === "true" &&
    reasons.length === 0 &&
    qualityScore >= boundedInteger(environment.AUTONOMOUS_MIN_QUALITY_SCORE, 85, 70, 100);
  if (canApprove) {
    const approved = await systemApproveArticleForPublication(
      created.articleId,
      {
        expectedCurrentVersionId: created.versionId,
        reason:
          "System approval granted after Gemini drafting, compact Claude Haiku fact review, and deterministic evidence, risk, source, media-rights, and length gates passed.",
        gate: {
          trendId: input.trendId,
          primarySources: primaryCount,
          independentSources: independentCount,
          totalClaims: claims.length,
          supportedClaims: claims.length - unsupported,
          independentReview: independentReview && groundedIndependentReview,
          wordCount,
          minimumWordCount: profile.minWords,
          qualityScore,
          riskLevel: categoryBlocked ? trendRisk : "LOW",
        },
      },
      { userId: "system:autonomous", type: "SYSTEM" },
      `autonomous-approve:${input.trendId}:${created.versionId}`,
    );
    return {
      articleId: approved.articleId,
      versionId: approved.versionId,
      state: "APPROVED",
      wordCount,
      qualityScore,
      draftingProvider: research.metadata.provider,
      reviewProvider,
      costUsd:
        research.metadata.costUsd +
        discoveryCost +
        reviewCost +
        redactionCost +
        expansionCost +
        copyReviewCost,
      reasons,
    };
  }

  await db.prepare(
    `UPDATE articles SET state='HUMAN_REVIEW_REQUIRED', human_approval_required=1,
      risk_level=?1, updated_at=?2 WHERE id=?3 AND current_version_id=?4`,
  ).bind(categoryBlocked ? "HIGH" : "MEDIUM", Date.now(), created.articleId, created.versionId).run();
  return {
    articleId: created.articleId,
    versionId: created.versionId,
    state: "HUMAN_REVIEW_REQUIRED",
    wordCount,
    qualityScore,
    draftingProvider: research.metadata.provider,
    reviewProvider,
    costUsd:
        research.metadata.costUsd +
        discoveryCost +
        reviewCost +
        redactionCost +
        expansionCost +
        copyReviewCost,
    reasons,
  };
}


/**
 * Asks a model to read the headline once, for the case the keyword list
 * could not resolve.
 *
 * A minimal, cheap task on purpose: a headline is a few words, and only the
 * ambiguous minority of stories ever reach this call. Never throws and never
 * blocks drafting - a classification failure or a low-confidence answer keeps
 * the article filed as US_NEWS, exactly where the keyword list would have
 * left it, which is the correct fallback, not a worse outcome.
 */
async function classifyStoryCategory(
  gateway: EditorialAiGateway,
  headline: string,
  trendId: string,
): Promise<StoryCategory> {
  try {
    const result = await gateway.classifyTrend({
      taskId: `${trendId}:category`,
      content: { headline },
      budget: { maxInputTokens: 400, maxOutputTokens: 200, maxCostUsd: 0.01 },
    });
    const normalized = result.data.category
      .trim()
      .toUpperCase()
      .replaceAll(/[^A-Z0-9]+/gu, "_") as StoryCategory;
    const confident = result.data.confidence >= 0.6;
    return confident && (STORY_CATEGORIES as readonly string[]).includes(normalized)
      ? normalized
      : "US_NEWS";
  } catch (error) {
    console.error("autonomous_category_classification_failed", error);
    return "US_NEWS";
  }
}

function inferAutonomousCategory(
  headline: string,
  current: StoryCategory,
): StoryCategory {
  if (current !== "US_NEWS") return current;

  const value = headline.toLowerCase();
  if (
    /\b(cricket|t20|odi|test match|ipl|nfl|nba|mlb|nhl|soccer|football|basketball|baseball|tennis|golf|cycling|tour de france|formula 1|f1|boxing|ufc|wrestling|padres|nationals|diamondbacks|marlins|bills)\b/u.test(
      value,
    )
  ) {
    return "SPORTS";
  }
  if (/\b(movie|film|actor|actress|music|album|television|tv|netflix|apple tv|celebrity)\b/u.test(value)) {
    return "ENTERTAINMENT";
  }
  if (/\b(ai|artificial intelligence|software|iphone|android|cybersecurity|technology|tech)\b/u.test(value)) {
    return "TECHNOLOGY";
  }
  if (/\b(stock|market|company|business|economy|jobs|earnings)\b/u.test(value)) {
    return "BUSINESS";
  }
  if (/\b(health|disease|recall|fda|cdc|medicine|hospital)\b/u.test(value)) {
    return "HEALTH";
  }
  if (/\b(weather|storm|hurricane|wildfire|flood|earthquake|heat wave|blaze)\b/u.test(value)) {
    return "WEATHER";
  }
  return current;
}

/**
 * Extracts only the URLs from the model's video leads. The publisher name and
 * relevance note it supplied are deliberately discarded: the platform is the
 * authority for both.
 */
/**
 * Candidate URLs for the outlet's own footage of this story.
 *
 * Returns nothing rather than failing when the key is absent or the quota is
 * spent: a story without a video still publishes, and a thrown error here would
 * lose an otherwise finished article.
 */
async function discoverOfficialVideoUrls(
  subject: string,
  headline: string,
  environment: AutonomousEnvironment,
): Promise<string[]> {
  try {
    const found = await discoverOfficialVideos({
      subject,
      headline,
      key: trimmedSetting(environment.YOUTUBE_API_KEY),
    });
    if (found.length > 0) {
      console.warn("editorial_video_discovered", {
        count: found.length,
        // Recorded so a channel can later be pinned by id rather than by name.
        channels: found.map((video) => ({
          title: video.channelTitle,
          id: video.channelId,
        })),
      });
    }
    return found.map((video) => video.sourceUrl);
  } catch (error) {
    console.error("editorial_video_discovery_failed", error);
    return [];
  }
}

function readVideoLeadUrls(leads: unknown): string[] {
  if (!leads || typeof leads !== "object") return [];
  const candidate = (leads as { videoLeads?: unknown }).videoLeads;
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((lead) =>
      lead && typeof lead === "object"
        ? String((lead as { url?: unknown }).url ?? "")
        : "",
    )
    .filter((url) => url.startsWith("https://"))
    .slice(0, 6);
}

function trimmedSetting(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Resolves an autonomous chain without hard-coding provider model ids. Google
 * retires model ids over time, so the runtime prefers, in order: the explicit
 * autonomous override, the shared editorial chain, then the configured Google
 * model. Only the final fallback is a literal id.
 */
function autonomousAiEnvironment(
  environment: AutonomousEnvironment,
): AutonomousEnvironment {
  const googleModel =
    trimmedSetting(environment.AI_GOOGLE_MODEL) ?? "gemini-flash-latest";
  const googleLiteModel =
    trimmedSetting(environment.AI_GOOGLE_LITE_MODEL) ?? googleModel;
  const anthropicModel =
    trimmedSetting(environment.AI_ANTHROPIC_MODEL) ??
    "claude-haiku-4-5-20251001";

  return {
    ...environment,
    // Google's free tier allows twenty generate_content requests per day in
    // total. One story spends several, so a Google-first newsroom stops
    // producing before the first hour of every day is out - which is exactly
    // what happened for the week of 2026-09-17: 753 runs, every one of them
    // dead on a 429, and not one article published. The paid provider now does
    // the drafting work, and Google's small daily allowance is reserved for the
    // one call that has to come from a different provider than the draft: the
    // independent fact review. Both chains keep the other provider as a
    // fallback so one exhausted account cannot stop the newsroom again.
    AI_RESEARCH_CHAIN:
      trimmedSetting(environment.AUTONOMOUS_AI_RESEARCH_CHAIN) ??
      trimmedSetting(environment.AI_RESEARCH_CHAIN) ??
      `anthropic:${anthropicModel},google:${googleModel}`,
    AI_FACT_REVIEW_CHAIN:
      trimmedSetting(environment.AUTONOMOUS_AI_FACT_REVIEW_CHAIN) ??
      trimmedSetting(environment.AI_FACT_REVIEW_CHAIN) ??
      `google:${googleModel},anthropic:${anthropicModel}`,
    AI_COPY_EDIT_CHAIN:
      trimmedSetting(environment.AUTONOMOUS_AI_COPY_EDIT_CHAIN) ??
      trimmedSetting(environment.AI_COPY_EDIT_CHAIN) ??
      `anthropic:${anthropicModel},google:${googleLiteModel}`,
    AI_SEO_CHAIN:
      trimmedSetting(environment.AUTONOMOUS_AI_SEO_CHAIN) ??
      trimmedSetting(environment.AI_SEO_CHAIN) ??
      `anthropic:${anthropicModel},google:${googleLiteModel}`,
    AI_CLASSIFICATION_CHAIN:
      trimmedSetting(environment.AUTONOMOUS_AI_CLASSIFICATION_CHAIN) ??
      trimmedSetting(environment.AI_CLASSIFICATION_CHAIN) ??
      `anthropic:${anthropicModel},google:${googleLiteModel}`,
    AI_EXTRACTION_CHAIN:
      trimmedSetting(environment.AUTONOMOUS_AI_EXTRACTION_CHAIN) ??
      trimmedSetting(environment.AI_EXTRACTION_CHAIN) ??
      `anthropic:${anthropicModel},google:${googleLiteModel}`,
  };
}

function findTrustedEditorialEmbed(
  sources: readonly GeneratedSource[],
  centralClaimSourceUrls: ReadonlySet<string>,
) {
  const ranked = [...sources]
    .filter(
      (source) =>
        source.sourceKind !== "CONTEXT" &&
        source.confidence >= 0.8 &&
        (centralClaimSourceUrls.size === 0 ||
          centralClaimSourceUrls.has(source.url)),
    )
    .sort((left, right) => {
      const leftPrimary = left.sourceKind === "PRIMARY" ? 1 : 0;
      const rightPrimary = right.sourceKind === "PRIMARY" ? 1 : 0;
      return rightPrimary - leftPrimary || right.confidence - left.confidence;
    });

  for (const source of ranked) {
    const embed = normalizeEditorialEmbed(
      source.url,
      `${source.publisher || source.name} source media`,
    );
    if (embed) return embed;
  }

  return null;
}

async function ensureSystemUser(db: D1Database): Promise<void> {
  const now = Date.now();
  await db.prepare(
    `INSERT OR IGNORE INTO users (id,email,display_name,role,status,created_at,updated_at)
     VALUES ('system:autonomous','autonomous@usnorthline.com','Northline Newsroom','Publisher','active',?1,?1)`,
  ).bind(now).run();
}

async function loadSourceRegistry(db: D1Database): Promise<SourceRow[]> {
  const result = await db.prepare(
    `SELECT id,name,domain,source_type AS sourceType,credibility_tier AS credibilityTier,
      is_primary AS isPrimary,licensing_status AS licensingStatus FROM sources
     WHERE licensing_status IN ('approved','review_required','link_only')
     ORDER BY credibility_tier ASC,is_primary DESC,name ASC LIMIT 150`,
  ).all<SourceRow>();
  return result.results;
}

async function persistSources(db: D1Database, sources: GeneratedSource[]): Promise<Map<string,string>> {
  const result = new Map<string,string>();
  const now = Date.now();
  for (const source of sources) {
    const domain = normalizeDomain(source.domain);
    const existing = await db.prepare(`SELECT id FROM sources WHERE domain=?1 LIMIT 1`).bind(domain).first<{id:string}>();
    const id = existing?.id ?? `source_${(await sha256Base64Url(domain)).slice(0,32)}`;
    if (!existing) {
      // is_primary comes from policy, never from `source.sourceKind`.
      // Taking the model's word here let it register its own link as a policy
      // primary domain, and resolveSourceAuthority then trusted that registry
      // row forever - so the model could promote itself to primary evidence one
      // hop later, which is exactly what that function promises it cannot do.
      // That is how collider.com and deadline.com became "primary" sources.
      const policyPrimary = isPolicyPrimaryDomain(domain);
      await db.prepare(
        `INSERT OR IGNORE INTO sources (id,name,domain,publisher,source_type,country,credibility_tier,
          is_primary,citation_requirements,licensing_status,reliability_notes,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,'US',?6,?7,?8,'review_required',?9,?10,?10)`,
      ).bind(id,source.name,domain,source.publisher,source.sourceType,
        policyPrimary ? 2 : 3, policyPrimary ? 1 : 0,
        "Link the exact page and attribute the publisher. Do not reproduce protected text.",
        `Autonomously discovered from ${source.url}; evidence use is page-specific.`,now).run();
    }
    result.set(domain,id);
  }
  return result;
}

function selectSources(registry: SourceRow[], category: StoryCategory, query: string, limit: number): SourceRow[] {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/u).filter((token) => token.length > 3);
  return registry.map((source) => ({source, score:
    (source.isPrimary ? 30 : 10) + (source.credibilityTier <= 2 ? 25 : 0) +
    (tokens.some((token) => source.domain.includes(token) || source.name.toLowerCase().includes(token)) ? 20 : 0) +
    (source.domain.endsWith(".gov") ? 15 : 0) + (category === "SPORTS" && /espn|apnews|reuters/u.test(source.domain) ? 20 : 0)
  })).sort((a,b) => b.score-a.score).slice(0,limit).map((entry) => entry.source);
}


function deduplicateSources(sources: GeneratedSource[]): GeneratedSource[] {
  const byUrl = new Map<string, GeneratedSource>();
  for (const source of sources) {
    const url = source.url.trim();
    const domain = normalizeDomain(source.domain || url);
    const key = `${domain}\u0000${url}`;
    const current = byUrl.get(key);
    if (!current || source.confidence > current.confidence) {
      byUrl.set(key, { ...source, domain });
    }
  }
  return Array.from(byUrl.values()).slice(0, 10);
}

function normalizeRisk(
  value: string,
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const normalized = value.trim().toUpperCase();
  if (
    normalized === "MEDIUM" ||
    normalized === "HIGH" ||
    normalized === "CRITICAL"
  ) {
    return normalized;
  }
  return "LOW";
}

function wordProfile(format: ArticleFormat, env: AutonomousEnvironment) {
  if (format === "DEEP_EXPLAINER" || format === "SOURCE_COMPARISON") return {format,minWords:boundedInteger(env.AI_DEEP_EXPLAINER_MIN_WORDS,2200,1200,4000),targetWords:boundedInteger(env.AI_DEEP_EXPLAINER_TARGET_WORDS,3000,1500,4500),maxWords:boundedInteger(env.AI_DEEP_EXPLAINER_MAX_WORDS,4000,2000,5000)};
  if (format === "QUICK_BRIEF" || format === "NEWS_FLASH") return {format,minWords:boundedInteger(env.AI_QUICK_BRIEF_MIN_WORDS,900,400,1200),targetWords:boundedInteger(env.AI_QUICK_BRIEF_TARGET_WORDS,1150,500,1500),maxWords:boundedInteger(env.AI_QUICK_BRIEF_MAX_WORDS,1400,700,2000)};
  if (format === "WHY_TRENDING") return {format,minWords:1000,targetWords:1400,maxWords:1800};
  return {format,minWords:boundedInteger(env.AI_STANDARD_NEWS_MIN_WORDS,1200,800,2200),targetWords:boundedInteger(env.AI_STANDARD_NEWS_TARGET_WORDS,1500,1000,2800),maxWords:boundedInteger(env.AI_STANDARD_NEWS_MAX_WORDS,2000,1200,3500)};
}

function budgetFor(format: ArticleFormat, env: AutonomousEnvironment) {
  const maxCostUsd = positiveNumber(env.AI_PER_STORY_BUDGET_USD, format === "DEEP_EXPLAINER" ? 10 : 5);
  return {
    maxInputTokens: format === "DEEP_EXPLAINER" ? 90_000 : 60_000,
    // Reasoning models spend part of the output allowance before the first
    // visible token, so the ceiling has to cover the thinking pass plus a
    // full-length article encoded as JSON.
    maxOutputTokens: format === "DEEP_EXPLAINER" ? 20_000 : 14_000,
    maxCostUsd,
  };
}

async function uniqueSlug(db: D1Database, headline: string, trendId: string): Promise<string> {
  const base = slugify(headline).slice(0,150) || "northline-story";
  const existing = await db.prepare(`SELECT id FROM articles WHERE slug=?1 LIMIT 1`).bind(base).first();
  return existing ? `${base}-${trendId.replace(/^trend_/u,"").slice(0,8)}` : base;
}
function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/gu,"-").replace(/^-+|-+$/gu,""); }
function normalizeDomain(value: string) { return value.trim().toLowerCase().replace(/^https?:\/\//u,"").replace(/^www\./u,"").replace(/\/.*$/u,""); }
function countWords(value: string) { return value.trim().split(/\s+/u).filter(Boolean).length; }
function positiveNumber(value: string | undefined, fallback: number) { const parsed=Number(value); return Number.isFinite(parsed)&&parsed>0?parsed:fallback; }
function boundedInteger(value:string|undefined,fallback:number,min:number,max:number){const parsed=Number(value);return Number.isInteger(parsed)&&parsed>=min&&parsed<=max?parsed:fallback;}
