import { describe, expect, it } from "vitest";

import {
  evaluateClaimPublicationGate,
  type EditorialClaim,
} from "../../lib/editorial/claims";

function centralClaim(
  overrides: Partial<EditorialClaim> = {},
): EditorialClaim {
  return {
    id: "claim-1",
    text: "The fictional device completed its announced demonstration.",
    articleSection: "What happened",
    category: "EVENT",
    isCentral: true,
    supportingSourceIds: ["source-a"],
    contradictingSourceIds: [],
    primaryEvidenceAvailable: false,
    observedAt: "2000-01-01T12:00:00.000Z",
    verificationStatus: "VERIFIED",
    riskLevel: "LOW",
    ...overrides,
  };
}

describe("claim publication gate", () => {
  it.each(["UNVERIFIED", "FALSE"] as const)(
    "blocks a central %s claim",
    (verificationStatus) => {
      const result = evaluateClaimPublicationGate([
        centralClaim({ verificationStatus }),
      ]);

      expect(result.allowed).toBe(false);
      expect(result.blockers[0]?.claimId).toBe("claim-1");
    },
  );

  it("blocks conflicting central claims unless the story explicitly covers the conflict", () => {
    const claim = centralClaim({
      verificationStatus: "CONFLICTING_REPORTS",
      contradictingSourceIds: ["source-b"],
    });

    expect(evaluateClaimPublicationGate([claim]).allowed).toBe(false);

    const result = evaluateClaimPublicationGate([claim], {
      mode: "REPORTING_THE_CONFLICT",
      claimIds: ["claim-1"],
      accuratelyAttributed: true,
      materialDisagreementPresented: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.conflictCoverageClaimIds).toEqual(["claim-1"]);
    expect(result.warnings[0]).toContain("publishable only");
  });

  it("does not let conflict framing excuse a false claim", () => {
    const result = evaluateClaimPublicationGate(
      [
        centralClaim({
          verificationStatus: "FALSE",
          contradictingSourceIds: ["source-b"],
        }),
      ],
      {
        mode: "REPORTING_THE_CONFLICT",
        claimIds: ["claim-1"],
        accuratelyAttributed: true,
        materialDisagreementPresented: true,
      },
    );

    expect(result.allowed).toBe(false);
    expect(result.blockers.map((finding) => finding.code)).toContain(
      "CENTRAL_CLAIM_FALSE",
    );
  });

  it("requires genuinely distinct evidence on the two sides of a conflict", () => {
    const result = evaluateClaimPublicationGate(
      [
        centralClaim({
          verificationStatus: "CONFLICTING_REPORTS",
          contradictingSourceIds: ["source-a"],
        }),
      ],
      {
        mode: "REPORTING_THE_CONFLICT",
        claimIds: ["claim-1"],
        accuratelyAttributed: true,
        materialDisagreementPresented: true,
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((finding) => finding.code)).toContain(
      "CENTRAL_CLAIM_CONFLICTING",
    );
  });

  it("requires evidence behind claims marked as verified", () => {
    const result = evaluateClaimPublicationGate([
      centralClaim({ supportingSourceIds: [] }),
    ]);
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((finding) => finding.code)).toContain(
      "CENTRAL_CLAIM_MISSING_EVIDENCE",
    );
  });
});
