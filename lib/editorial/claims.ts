export const CLAIM_VERIFICATION_STATUSES = [
  "VERIFIED",
  "VERIFIED_BY_PRIMARY_SOURCE",
  "PARTIALLY_VERIFIED",
  "CONFLICTING_REPORTS",
  "UNVERIFIED",
  "OUTDATED",
  "FALSE",
] as const;

export type ClaimVerificationStatus =
  (typeof CLAIM_VERIFICATION_STATUSES)[number];

export type ClaimRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface EditorialClaim {
  readonly id: string;
  readonly text: string;
  readonly articleSection: string;
  readonly category: string;
  readonly isCentral: boolean;
  readonly supportingSourceIds: readonly string[];
  readonly contradictingSourceIds: readonly string[];
  readonly primaryEvidenceAvailable: boolean;
  readonly observedAt: string;
  readonly verificationStatus: ClaimVerificationStatus;
  readonly riskLevel: ClaimRiskLevel;
  readonly reviewerId?: string;
  readonly reviewNotes?: string;
}

export interface ConflictCoverageDeclaration {
  readonly mode: "REPORTING_THE_CONFLICT";
  readonly claimIds: readonly string[];
  readonly accuratelyAttributed: boolean;
  readonly materialDisagreementPresented: boolean;
}

export type ClaimGateBlockerCode =
  | "NO_CLAIMS"
  | "NO_CENTRAL_CLAIM"
  | "DUPLICATE_CLAIM_ID"
  | "CENTRAL_CLAIM_UNVERIFIED"
  | "CENTRAL_CLAIM_FALSE"
  | "CENTRAL_CLAIM_CONFLICTING"
  | "CENTRAL_CLAIM_OUTDATED"
  | "CENTRAL_CLAIM_MISSING_EVIDENCE"
  | "PRIMARY_VERIFICATION_WITHOUT_PRIMARY_EVIDENCE";

export interface ClaimGateFinding {
  readonly claimId?: string;
  readonly code: ClaimGateBlockerCode;
  readonly message: string;
}

export interface ClaimPublicationGateResult {
  readonly allowed: boolean;
  readonly blockers: readonly ClaimGateFinding[];
  readonly warnings: readonly string[];
  readonly conflictCoverageClaimIds: readonly string[];
}

function conflictExceptionApplies(
  claim: EditorialClaim,
  declaration: ConflictCoverageDeclaration | undefined,
): boolean {
  const supportingSources = new Set(claim.supportingSourceIds);
  const hasDistinctContradictingEvidence = claim.contradictingSourceIds.some(
    (sourceId) => !supportingSources.has(sourceId),
  );
  return Boolean(
    declaration &&
      declaration.mode === "REPORTING_THE_CONFLICT" &&
      declaration.claimIds.includes(claim.id) &&
      declaration.accuratelyAttributed &&
      declaration.materialDisagreementPresented &&
      claim.supportingSourceIds.length > 0 &&
      hasDistinctContradictingEvidence,
  );
}

export function evaluateClaimPublicationGate(
  claims: readonly EditorialClaim[],
  conflictCoverage?: ConflictCoverageDeclaration,
): ClaimPublicationGateResult {
  const blockers: ClaimGateFinding[] = [];
  const warnings: string[] = [];
  const conflictCoverageClaimIds: string[] = [];

  if (claims.length === 0) {
    blockers.push({
      code: "NO_CLAIMS",
      message: "Publication requires an extracted claim record.",
    });
  }
  if (!claims.some((claim) => claim.isCentral)) {
    blockers.push({
      code: "NO_CENTRAL_CLAIM",
      message: "Publication requires at least one explicitly identified central claim.",
    });
  }

  const seenIds = new Set<string>();
  for (const claim of claims) {
    if (seenIds.has(claim.id)) {
      blockers.push({
        claimId: claim.id,
        code: "DUPLICATE_CLAIM_ID",
        message: `Claim id "${claim.id}" is duplicated.`,
      });
      continue;
    }
    seenIds.add(claim.id);

    if (!claim.isCentral) {
      if (
        claim.verificationStatus === "UNVERIFIED" ||
        claim.verificationStatus === "FALSE" ||
        claim.verificationStatus === "CONFLICTING_REPORTS" ||
        claim.verificationStatus === "OUTDATED"
      ) {
        warnings.push(
          `Non-central claim "${claim.id}" is ${claim.verificationStatus.toLocaleLowerCase(
            "en-US",
          )} and should be removed, qualified, or reviewed.`,
        );
      }
      continue;
    }

    if (claim.verificationStatus === "UNVERIFIED") {
      blockers.push({
        claimId: claim.id,
        code: "CENTRAL_CLAIM_UNVERIFIED",
        message: "An unverified central claim cannot be published.",
      });
    } else if (claim.verificationStatus === "FALSE") {
      blockers.push({
        claimId: claim.id,
        code: "CENTRAL_CLAIM_FALSE",
        message: "A false central claim cannot be published.",
      });
    } else if (claim.verificationStatus === "CONFLICTING_REPORTS") {
      if (conflictExceptionApplies(claim, conflictCoverage)) {
        conflictCoverageClaimIds.push(claim.id);
        warnings.push(
          `Claim "${claim.id}" is publishable only as accurately attributed coverage of the conflict.`,
        );
      } else {
        blockers.push({
          claimId: claim.id,
          code: "CENTRAL_CLAIM_CONFLICTING",
          message:
            "A conflicting central claim requires an explicit, accurately attributed conflict-coverage declaration and evidence from both sides.",
        });
      }
    } else if (claim.verificationStatus === "OUTDATED") {
      blockers.push({
        claimId: claim.id,
        code: "CENTRAL_CLAIM_OUTDATED",
        message: "An outdated central claim must be refreshed before publication.",
      });
    }

    if (
      (claim.verificationStatus === "VERIFIED" ||
        claim.verificationStatus === "VERIFIED_BY_PRIMARY_SOURCE" ||
        claim.verificationStatus === "PARTIALLY_VERIFIED") &&
      claim.supportingSourceIds.length === 0
    ) {
      blockers.push({
        claimId: claim.id,
        code: "CENTRAL_CLAIM_MISSING_EVIDENCE",
        message: "A central claim marked as verified must link to supporting evidence.",
      });
    }

    if (
      claim.verificationStatus === "VERIFIED_BY_PRIMARY_SOURCE" &&
      !claim.primaryEvidenceAvailable
    ) {
      blockers.push({
        claimId: claim.id,
        code: "PRIMARY_VERIFICATION_WITHOUT_PRIMARY_EVIDENCE",
        message:
          "A claim cannot be marked verified by primary source when no primary evidence is recorded.",
      });
    }

    if (claim.verificationStatus === "PARTIALLY_VERIFIED") {
      warnings.push(
        `Central claim "${claim.id}" is only partially verified and requires editorial judgment.`,
      );
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    conflictCoverageClaimIds,
  };
}
