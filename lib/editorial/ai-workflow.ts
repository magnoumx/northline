import type { EditorialAiGateway } from "../ai";
import type { AiTaskBudget, AiTaskMetadata } from "../ai";

type EditorialAiOperations = Pick<
  EditorialAiGateway,
  | "normalizeEntities"
  | "extractClaims"
  | "compareEvidence"
  | "planArticle"
  | "draftArticle"
  | "reviewFacts"
  | "copyEdit"
  | "generateSeoBrief"
  | "generateHeadlineCandidates"
>;

export type SelectedEvidence = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: "PRIMARY" | "INDEPENDENT" | "CONTEXT";
  summary: string;
  excerptHash: string;
  observedAt: string;
};

export type AiWorkflowLedger = {
  record(input: {
    workflowId: string;
    stage: string;
    disposition: "COMPLETED" | "BLOCKED" | "FAILED";
    metadata?: AiTaskMetadata;
    detail: string;
    occurredAt: string;
  }): Promise<void>;
};

export type AiReviewPackage = {
  workflowId: string;
  state: "HUMAN_REVIEW_REQUIRED" | "REVISION_REQUIRED";
  verifiedClaimIds: string[];
  explicitUnknowns: string[];
  outline: unknown;
  draft: unknown;
  factReview: unknown;
  copyEditedDraft: unknown | null;
  seoBrief: unknown | null;
  headlineCandidates: unknown | null;
  taskMetadata: AiTaskMetadata[];
  publishableByModel: false;
};

/**
 * Executes discrete, auditable model operations and stops at a human review
 * package. It has no approval or publication dependency by design.
 */
export async function prepareAiReviewPackage({
  workflowId,
  sourcePacket,
  operations,
  ledger,
  budget,
  now = () => new Date(),
}: {
  workflowId: string;
  sourcePacket: readonly SelectedEvidence[];
  operations: EditorialAiOperations;
  ledger: AiWorkflowLedger;
  budget: AiTaskBudget;
  now?: () => Date;
}): Promise<AiReviewPackage> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(workflowId)) {
    throw new TypeError("Workflow id is invalid.");
  }
  assertSourcePacket(sourcePacket);
  const taskMetadata: AiTaskMetadata[] = [];
  const entities = await operations.normalizeEntities({
    taskId: `${workflowId}:entities`,
    content: { evidence: sourcePacket },
    budget,
  });
  await record("NORMALIZED", entities.metadata, "Entities normalized.");

  const extracted = await operations.extractClaims({
    taskId: `${workflowId}:claims`,
    content: { evidence: sourcePacket, entities: entities.data },
    budget,
  });
  await record("CLAIM_EXTRACTION", extracted.metadata, "Claims extracted.");

  const comparison = await operations.compareEvidence({
    taskId: `${workflowId}:evidence`,
    content: {
      claims: extracted.data.claims,
      evidence: sourcePacket,
    },
    budget,
  });
  await record(
    "FACT_REVIEW",
    comparison.metadata,
    "Evidence compared independently of drafting.",
  );

  const supported = new Set(
    comparison.data.findings
      .filter((finding) => finding.disposition === "supported")
      .map((finding) => finding.claimId),
  );
  const verifiedClaims = extracted.data.claims.filter(
    (claim) =>
      claim.status === "supported" &&
      supported.has(claim.id) &&
      claim.evidenceIds.length > 0,
  );
  if (
    verifiedClaims.length === 0 ||
    !verifiedClaims.some((claim) => claim.importance === "central")
  ) {
    await ledger.record({
      workflowId,
      stage: "SOURCE_INSUFFICIENT",
      disposition: "BLOCKED",
      detail: "No independently supported central claim is available.",
      occurredAt: now().toISOString(),
    });
    return blockedPackage(
      workflowId,
      extracted.data.explicitUnknowns,
      comparison.data,
      taskMetadata,
    );
  }

  const outline = await operations.planArticle({
    taskId: `${workflowId}:outline`,
    content: {
      verifiedClaims,
      explicitUnknowns: extracted.data.explicitUnknowns,
      sourceSummaries: sourcePacket.map(publicEvidenceSummary),
    },
    budget,
  });
  await record("OUTLINING", outline.metadata, "Outline created from verified claims.");

  const draft = await operations.draftArticle({
    taskId: `${workflowId}:draft`,
    content: {
      approvedOutline: outline.data,
      verifiedClaims,
      attributedEvidence: sourcePacket.map(publicEvidenceSummary),
      explicitUnknowns: extracted.data.explicitUnknowns,
      styleRules: {
        locale: "en-US",
        voice: "clear, direct, calm",
        prohibited: ["invented facts", "invented quotes", "keyword stuffing"],
      },
    },
    budget,
  });
  await record("DRAFTING", draft.metadata, "Draft created from the locked packet.");

  const factReview = await operations.reviewFacts({
    taskId: `${workflowId}:fact-review`,
    content: {
      draft: draft.data,
      claimList: verifiedClaims,
      evidencePacket: sourcePacket,
    },
    budget,
    excludeProviders: [draft.metadata.provider],
  });
  await record(
    "FACT_REVIEW",
    factReview.metadata,
    "Draft checked by a provider other than the drafting provider.",
  );
  if (factReview.data.blocking) {
    await ledger.record({
      workflowId,
      stage: "REVISION_REQUIRED",
      disposition: "BLOCKED",
      detail: "Independent fact review returned blocking findings.",
      occurredAt: now().toISOString(),
    });
    return {
      workflowId,
      state: "REVISION_REQUIRED",
      verifiedClaimIds: verifiedClaims.map((claim) => claim.id),
      explicitUnknowns: extracted.data.explicitUnknowns,
      outline: outline.data,
      draft: draft.data,
      factReview: factReview.data,
      copyEditedDraft: null,
      seoBrief: null,
      headlineCandidates: null,
      taskMetadata,
      publishableByModel: false,
    };
  }

  const copyEdit = await operations.copyEdit({
    taskId: `${workflowId}:copy-edit`,
    content: {
      draft: draft.data,
      lockedClaims: verifiedClaims,
      factReview: factReview.data,
      instruction: "Language changes only; the factual packet is locked.",
    },
    budget,
  });
  await record("COPY_REVIEW", copyEdit.metadata, "Copy edit completed.");
  if (
    !copyEdit.data.factualPacketPreserved ||
    copyEdit.data.attemptedFactualAdditions.length > 0
  ) {
    await ledger.record({
      workflowId,
      stage: "REVISION_REQUIRED",
      disposition: "BLOCKED",
      detail: "Copy review attempted to alter the locked factual packet.",
      occurredAt: now().toISOString(),
    });
    return {
      workflowId,
      state: "REVISION_REQUIRED",
      verifiedClaimIds: verifiedClaims.map((claim) => claim.id),
      explicitUnknowns: extracted.data.explicitUnknowns,
      outline: outline.data,
      draft: draft.data,
      factReview: factReview.data,
      copyEditedDraft: null,
      seoBrief: null,
      headlineCandidates: null,
      taskMetadata,
      publishableByModel: false,
    };
  }

  const [seoBrief, headlines] = await Promise.all([
    operations.generateSeoBrief({
      taskId: `${workflowId}:seo`,
      content: {
        draft: copyEdit.data.draft,
        entities: entities.data,
        knownExternalDemand: "unknown",
      },
      budget,
    }),
    operations.generateHeadlineCandidates({
      taskId: `${workflowId}:headlines`,
      content: {
        draft: copyEdit.data.draft,
        verifiedClaims,
      },
      budget,
    }),
  ]);
  await record("SEO_REVIEW", seoBrief.metadata, "SEO brief completed.");
  await record("SEO_REVIEW", headlines.metadata, "Headline candidates completed.");
  await ledger.record({
    workflowId,
    stage: "HUMAN_REVIEW_REQUIRED",
    disposition: "COMPLETED",
    detail: "Review package created; no approval or publication occurred.",
    occurredAt: now().toISOString(),
  });
  return {
    workflowId,
    state: "HUMAN_REVIEW_REQUIRED",
    verifiedClaimIds: verifiedClaims.map((claim) => claim.id),
    explicitUnknowns: extracted.data.explicitUnknowns,
    outline: outline.data,
    draft: draft.data,
    factReview: factReview.data,
    copyEditedDraft: copyEdit.data.draft,
    seoBrief: seoBrief.data,
    headlineCandidates: headlines.data,
    taskMetadata,
    publishableByModel: false,
  };

  async function record(
    stage: string,
    metadata: AiTaskMetadata,
    detail: string,
  ): Promise<void> {
    taskMetadata.push(metadata);
    await ledger.record({
      workflowId,
      stage,
      disposition: "COMPLETED",
      metadata,
      detail,
      occurredAt: now().toISOString(),
    });
  }
}

function publicEvidenceSummary(evidence: SelectedEvidence) {
  return {
    id: evidence.id,
    sourceId: evidence.sourceId,
    sourceName: evidence.sourceName,
    sourceType: evidence.sourceType,
    summary: evidence.summary,
    excerptHash: evidence.excerptHash,
    observedAt: evidence.observedAt,
  };
}

function assertSourcePacket(sourcePacket: readonly SelectedEvidence[]): void {
  if (
    sourcePacket.length < 2 ||
    !sourcePacket.some((source) => source.sourceType === "PRIMARY") ||
    sourcePacket.some(
      (source) =>
        !source.id.trim() ||
        !source.sourceId.trim() ||
        !source.summary.trim() ||
        !/^[A-Za-z0-9_-]{32,128}$/u.test(source.excerptHash) ||
        !Number.isFinite(Date.parse(source.observedAt)),
    )
  ) {
    throw new TypeError(
      "AI research requires two selected sources, including primary evidence.",
    );
  }
}

function blockedPackage(
  workflowId: string,
  explicitUnknowns: string[],
  factReview: unknown,
  taskMetadata: AiTaskMetadata[],
): AiReviewPackage {
  return {
    workflowId,
    state: "REVISION_REQUIRED",
    verifiedClaimIds: [],
    explicitUnknowns,
    outline: null,
    draft: null,
    factReview,
    copyEditedDraft: null,
    seoBrief: null,
    headlineCandidates: null,
    taskMetadata,
    publishableByModel: false,
  };
}
