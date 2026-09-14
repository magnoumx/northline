import { desc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  indexingChanges,
  siteSettings,
} from "../../db/schema-v3-operations";
import { sha256Base64Url } from "../security/crypto";
import {
  indexingEnvironmentGate,
  type IndexingEnvironment,
} from "./indexing";

export const INDEXING_LAUNCH_GATES = [
  "realContentOnly",
  "finalDomainVerified",
  "canonicalsVerified",
  "structuredDataValidated",
  "sitemapsRealAndEligible",
  "trustAndAuthorPagesComplete",
  "mediaRightsVerified",
  "performanceAccepted",
  "securityReviewAccepted",
  "monitoringOperational",
] as const;

export type IndexingLaunchGate = (typeof INDEXING_LAUNCH_GATES)[number];
export type IndexingChecklist = Record<IndexingLaunchGate, boolean>;

export type IndexingDecision = {
  enabled: boolean;
  environment: string;
  checklistHash: string;
  ownerId: string;
  reason: string;
  occurredAt: Date;
};

export async function readLatestIndexingDecision(): Promise<IndexingDecision | null> {
  const db = await getDb();
  const [decision] = await db
    .select()
    .from(indexingChanges)
    .orderBy(desc(indexingChanges.occurredAt))
    .limit(1);
  return decision ?? null;
}

export async function recordIndexingDecision({
  enabled,
  ownerId,
  reason,
  checklist,
  environment = process.env as IndexingEnvironment,
}: {
  enabled: boolean;
  ownerId: string;
  reason: string;
  checklist: IndexingChecklist;
  environment?: IndexingEnvironment;
}): Promise<IndexingDecision> {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 20 || trimmedReason.length > 500) {
    throw new IndexingControlError(
      "INVALID_REASON",
      "Record a 20 to 500 character launch or rollback reason.",
    );
  }
  if (enabled) {
    const missing = INDEXING_LAUNCH_GATES.filter((gate) => !checklist[gate]);
    if (missing.length > 0) {
      throw new IndexingControlError(
        "CHECKLIST_INCOMPLETE",
        `Indexing remains disabled; ${missing.length} launch gate(s) are not attested.`,
      );
    }
    if (!indexingEnvironmentGate(environment)) {
      throw new IndexingControlError(
        "ENVIRONMENT_GATE_CLOSED",
        "The production HTTPS, demo-content, and environment indexing gates are not open.",
      );
    }
  }

  const occurredAt = new Date();
  const checklistHash = await sha256Base64Url(
    JSON.stringify(
      INDEXING_LAUNCH_GATES.map((gate) => [gate, checklist[gate] === true]),
    ),
  );
  const decision: IndexingDecision = {
    enabled,
    environment: environment.APP_ENV ?? "development",
    checklistHash,
    ownerId,
    reason: trimmedReason,
    occurredAt,
  };
  const db = await getDb();
  await db.batch([
    db
      .insert(siteSettings)
      .values({
        key: "search_indexing",
        valueJson: JSON.stringify({ enabled }),
        sensitive: false,
        updatedById: ownerId,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: {
          valueJson: JSON.stringify({ enabled }),
          updatedById: ownerId,
          updatedAt: occurredAt,
        },
      }),
    db.insert(indexingChanges).values({
      id: crypto.randomUUID(),
      ...decision,
    }),
  ]);
  return decision;
}

export class IndexingControlError extends Error {
  constructor(
    readonly code:
      | "INVALID_REASON"
      | "CHECKLIST_INCOMPLETE"
      | "ENVIRONMENT_GATE_CLOSED",
    message: string,
  ) {
    super(message);
    this.name = "IndexingControlError";
  }
}
