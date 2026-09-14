import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { getDb } from "../../db";
import {
  campaigns,
  creativeApprovals,
  creatives,
  creativeVersions,
  lineItemCreatives,
  lineItems,
} from "../../db/schema-v2";
import type { AdTokenPayload } from "./tokens";
import {
  parseApprovedDestinationHosts,
  validateAdvertiserDestination,
} from "./destinations";

type Database = Awaited<ReturnType<typeof getDb>>;

export type DeliveryClaimValidation =
  | {
      valid: true;
      destination: URL;
      creativeId: string;
    }
  | { valid: false };

export async function validateDeliveryClaims(
  db: Database,
  payload: AdTokenPayload,
  approvedDestinationHosts: readonly string[],
): Promise<DeliveryClaimValidation> {
  const [record] = await db
    .select({
      creativeId: creatives.id,
      destination: creatives.destinationUrlNormalized,
    })
    .from(creativeVersions)
    .innerJoin(creatives, eq(creatives.id, creativeVersions.creativeId))
    .innerJoin(
      lineItemCreatives,
      eq(lineItemCreatives.creativeId, creatives.id),
    )
    .innerJoin(lineItems, eq(lineItems.id, lineItemCreatives.lineItemId))
    .innerJoin(campaigns, eq(campaigns.id, lineItems.campaignId))
    .where(
      and(
        eq(creativeVersions.id, payload.creativeVersionId),
        eq(lineItems.id, payload.lineItemId),
        eq(campaigns.id, payload.campaignId),
        inArray(lineItems.status, ["READY", "DELIVERING"]),
        inArray(campaigns.status, ["APPROVED", "READY", "DELIVERING"]),
        eq(creatives.status, "APPROVED"),
        eq(creativeVersions.scanStatus, "APPROVED"),
        isNull(creatives.killedAt),
        isNull(campaigns.killedAt),
      ),
    )
    .limit(1);
  if (!record) return { valid: false };
  const [approval] = await db
    .select({ decision: creativeApprovals.decision })
    .from(creativeApprovals)
    .where(eq(creativeApprovals.creativeVersionId, payload.creativeVersionId))
    .orderBy(desc(creativeApprovals.occurredAt))
    .limit(1);
  if (approval?.decision !== "APPROVED") return { valid: false };
  const destination = validateAdvertiserDestination(
    record.destination,
    approvedDestinationHosts,
  );
  if (
    !destination.valid ||
    (payload.destination !== undefined &&
      destination.url.toString() !== payload.destination)
  ) {
    return { valid: false };
  }
  return {
    valid: true,
    destination: destination.url,
    creativeId: record.creativeId,
  };
}

export function configuredApprovedDestinationHosts(): string[] {
  return parseApprovedDestinationHosts(process.env.AD_APPROVED_DESTINATION_HOSTS);
}

