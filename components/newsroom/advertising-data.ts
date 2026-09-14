import { count, desc } from "drizzle-orm";
import { getDb } from "@/db";
import {
  adKillSwitches,
  adPlacements,
  advertisers,
  advertisingLeads,
  campaignOrders,
  campaignReports,
  campaigns,
  creatives,
  invoices,
  lineItems,
  pricingRules,
} from "@/db/schema-v2";

export const advertisingSections = [
  "leads",
  "advertisers",
  "campaigns",
  "orders",
  "line-items",
  "creatives",
  "inventory",
  "pricing",
  "invoices",
  "reports",
  "settings",
] as const;

export type AdvertisingSection = (typeof advertisingSections)[number];

export type AdvertisingRecord = {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  fields: Array<{ label: string; value: string }>;
};

export type AdvertisingListResult =
  | {
      state: "ready";
      total: number;
      records: AdvertisingRecord[];
    }
  | {
      state: "unavailable";
      message: string;
    };

export type AdvertisingOverviewResult =
  | {
      state: "ready";
      counts: Array<{
        label: string;
        value: number;
        href: string;
      }>;
    }
  | {
      state: "unavailable";
      message: string;
    };

const unavailableMessage =
  "The advertising database could not be read in this environment. No counts, records, revenue, delivery, or customer state are being inferred.";

function formatDate(value: Date | null | undefined): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

function formatMoney(
  cents: number | null | undefined,
  currency = "USD",
): string {
  if (cents === null || cents === undefined) return "Not set";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatStoredMinorUnits(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "Not set";
  return `${new Intl.NumberFormat("en-US").format(cents)} minor currency units`;
}

async function tableCount(
  query: PromiseLike<Array<{ value: number }>>,
): Promise<number> {
  const rows = await query;
  return rows[0]?.value ?? 0;
}

export async function loadAdvertisingOverview(): Promise<AdvertisingOverviewResult> {
  try {
    const db = await getDb();
    const values = await Promise.all([
      tableCount(db.select({ value: count() }).from(advertisingLeads)),
      tableCount(db.select({ value: count() }).from(advertisers)),
      tableCount(db.select({ value: count() }).from(campaigns)),
      tableCount(db.select({ value: count() }).from(campaignOrders)),
      tableCount(db.select({ value: count() }).from(lineItems)),
      tableCount(db.select({ value: count() }).from(creatives)),
      tableCount(db.select({ value: count() }).from(adPlacements)),
      tableCount(db.select({ value: count() }).from(pricingRules)),
      tableCount(db.select({ value: count() }).from(invoices)),
      tableCount(db.select({ value: count() }).from(campaignReports)),
    ]);
    const definitions = [
      ["Leads", "leads"],
      ["Advertisers", "advertisers"],
      ["Campaigns", "campaigns"],
      ["Orders", "orders"],
      ["Line items", "line-items"],
      ["Creatives", "creatives"],
      ["Placements", "inventory"],
      ["Pricing rules", "pricing"],
      ["Invoices", "invoices"],
      ["Reports", "reports"],
    ] as const;

    return {
      state: "ready",
      counts: definitions.map(([label, section], index) => ({
        label,
        value: values[index],
        href: `/newsroom/advertising/${section}`,
      })),
    };
  } catch {
    return { state: "unavailable", message: unavailableMessage };
  }
}

export async function loadAdvertisingSection(
  section: AdvertisingSection,
): Promise<AdvertisingListResult> {
  try {
    const db = await getDb();

    if (section === "leads") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(advertisingLeads)),
        db
          .select()
          .from(advertisingLeads)
          .orderBy(desc(advertisingLeads.createdAt))
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.company,
          subtitle: row.fullName,
          status: row.status,
          fields: [
            { label: "Objective", value: row.campaignObjective },
            {
              label: "Estimated budget",
              value: formatStoredMinorUnits(row.estimatedBudgetCents),
            },
            {
              label: "Desired window",
              value: `${formatDate(row.desiredStartAt)} – ${formatDate(row.desiredEndAt)}`,
            },
            { label: "Received", value: formatDate(row.createdAt) },
          ],
        })),
      };
    }

    if (section === "advertisers") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(advertisers)),
        db
          .select()
          .from(advertisers)
          .orderBy(desc(advertisers.createdAt))
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.displayName,
          subtitle: row.legalName,
          status: row.status,
          fields: [
            { label: "Industry", value: row.industry || "Not set" },
            { label: "Risk review", value: row.riskLevel },
            { label: "Website", value: row.websiteUrl },
            { label: "Created", value: formatDate(row.createdAt) },
          ],
        })),
      };
    }

    if (section === "campaigns") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(campaigns)),
        db
          .select()
          .from(campaigns)
          .orderBy(desc(campaigns.createdAt))
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.objective,
          status: row.status,
          fields: [
            { label: "Currency", value: row.currency },
            {
              label: "Schedule",
              value: `${formatDate(row.startsAt)} – ${formatDate(row.endsAt)}`,
            },
            { label: "Approved", value: formatDate(row.approvedAt) },
            { label: "Created", value: formatDate(row.createdAt) },
          ],
        })),
      };
    }

    if (section === "orders") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(campaignOrders)),
        db
          .select()
          .from(campaignOrders)
          .orderBy(desc(campaignOrders.createdAt))
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.orderNumber,
          status: row.status,
          fields: [
            {
              label: "Order total",
              value: formatStoredMinorUnits(row.totalCents),
            },
            { label: "Signed", value: formatDate(row.signedAt) },
            { label: "Created", value: formatDate(row.createdAt) },
          ],
        })),
      };
    }

    if (section === "line-items") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(lineItems)),
        db
          .select()
          .from(lineItems)
          .orderBy(desc(lineItems.createdAt))
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.pricingModel,
          status: row.status,
          fields: [
            {
              label: "Schedule",
              value: `${formatDate(row.startsAt)} – ${formatDate(row.endsAt)}`,
            },
            {
              label: "Total budget",
              value: formatStoredMinorUnits(row.totalBudgetCents),
            },
            { label: "Pacing", value: row.pacing },
            { label: "Priority", value: String(row.priority) },
          ],
        })),
      };
    }

    if (section === "creatives") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(creatives)),
        db
          .select()
          .from(creatives)
          .orderBy(desc(creatives.createdAt))
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.creativeType,
          status: row.status,
          fields: [
            { label: "Destination host", value: row.destinationHost },
            { label: "Killed", value: formatDate(row.killedAt) },
            { label: "Created", value: formatDate(row.createdAt) },
          ],
        })),
      };
    }

    if (section === "inventory") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(adPlacements)),
        db
          .select()
          .from(adPlacements)
          .orderBy(adPlacements.code)
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.code,
          status: row.enabled ? "ENABLED" : "DISABLED",
          fields: [
            { label: "Mobile behavior", value: row.mobileBehavior },
            {
              label: "Maximum file size",
              value: `${Math.round(row.maximumFileBytes / 1024)} KB`,
            },
            {
              label: "Maximum density",
              value: String(row.maximumDensity),
            },
            { label: "Fallback", value: row.fallbackBehavior },
          ],
        })),
      };
    }

    if (section === "pricing") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(pricingRules)),
        db
          .select()
          .from(pricingRules)
          .orderBy(desc(pricingRules.createdAt))
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.pricingModel.replaceAll("_", " "),
          status: row.enabled ? "ENABLED" : "DISABLED",
          fields: [
            {
              label: "Unit price",
              value: formatMoney(row.unitPriceCents, row.currency),
            },
            {
              label: "Minimum spend",
              value: formatMoney(row.minimumSpendCents, row.currency),
            },
            {
              label: "Effective window",
              value: `${formatDate(row.startsAt)} – ${formatDate(row.endsAt)}`,
            },
          ],
        })),
      };
    }

    if (section === "invoices") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(invoices)),
        db
          .select()
          .from(invoices)
          .orderBy(desc(invoices.createdAt))
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.invoiceNumber,
          subtitle: row.provider,
          status: row.status,
          fields: [
            {
              label: "Total",
              value: formatMoney(row.totalCents, row.currency),
            },
            {
              label: "Amount paid",
              value: formatMoney(row.amountPaidCents, row.currency),
            },
            { label: "Due", value: formatDate(row.dueAt) },
            { label: "Created", value: formatDate(row.createdAt) },
          ],
        })),
      };
    }

    if (section === "reports") {
      const [total, rows] = await Promise.all([
        tableCount(db.select({ value: count() }).from(campaignReports)),
        db
          .select()
          .from(campaignReports)
          .orderBy(desc(campaignReports.generatedAt))
          .limit(50),
      ]);
      return {
        state: "ready",
        total,
        records: rows.map((row) => ({
          id: row.id,
          title: row.reportType.replaceAll("_", " "),
          subtitle: `Campaign ${row.campaignId}`,
          fields: [
            {
              label: "Window",
              value: `${formatDate(row.windowStartsAt)} – ${formatDate(row.windowEndsAt)}`,
            },
            { label: "Raw events", value: String(row.rawEvents) },
            { label: "Validated events", value: String(row.validatedEvents) },
            { label: "Billable events", value: String(row.billableEvents) },
            { label: "Generated", value: formatDate(row.generatedAt) },
          ],
        })),
      };
    }

    const [total, rows] = await Promise.all([
      tableCount(db.select({ value: count() }).from(adKillSwitches)),
      db
        .select()
        .from(adKillSwitches)
        .orderBy(desc(adKillSwitches.activatedAt))
        .limit(50),
    ]);
    return {
      state: "ready",
      total,
      records: rows.map((row) => ({
        id: row.id,
        title: `${row.scopeType}: ${row.scopeId}`,
        subtitle: row.reason,
        status: row.active ? "ACTIVE" : "RELEASED",
        fields: [
          { label: "Activated", value: formatDate(row.activatedAt) },
          { label: "Released", value: formatDate(row.releasedAt) },
        ],
      })),
    };
  } catch {
    return { state: "unavailable", message: unavailableMessage };
  }
}
