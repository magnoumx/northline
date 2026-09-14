import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { authorizeStaffIdentity } from "@/lib/auth/rbac";
import {
  loadAdvertisingOverview,
  loadAdvertisingSection,
  type AdvertisingRecord,
  type AdvertisingSection,
} from "./advertising-data";
import { NewsroomFrame } from "./frame";
import {
  EmptyWorkspaceState,
  NewsroomNotice,
  StatusPill,
  WorkspaceHeading,
} from "./primitives";

const sectionDetails: Record<
  AdvertisingSection,
  { title: string; description: string; singular: string }
> = {
  leads: {
    title: "Advertising leads",
    description:
      "Read campaign inquiries captured by the protected advertising lead workflow.",
    singular: "lead",
  },
  advertisers: {
    title: "Advertiser register",
    description:
      "Read advertiser identity, review status, and organization metadata.",
    singular: "advertiser",
  },
  campaigns: {
    title: "Campaigns",
    description: "Read campaign objectives, schedules, and approval state.",
    singular: "campaign",
  },
  orders: {
    title: "Campaign orders",
    description: "Read insertion-order state and contracted totals.",
    singular: "order",
  },
  "line-items": {
    title: "Line items",
    description: "Read delivery windows, pacing, priority, and budget state.",
    singular: "line item",
  },
  creatives: {
    title: "Creative review",
    description:
      "Read creative type, destination host, lifecycle, and kill state.",
    singular: "creative",
  },
  inventory: {
    title: "Inventory",
    description:
      "Read configured placements and their current enablement state.",
    singular: "placement",
  },
  pricing: {
    title: "Pricing rules",
    description:
      "Read explicit database pricing rules without estimating market rates.",
    singular: "pricing rule",
  },
  invoices: {
    title: "Invoices",
    description: "Read invoice status, totals, payment, and due state.",
    singular: "invoice",
  },
  reports: {
    title: "Campaign reports",
    description:
      "Read stored report windows and validated event counts without extrapolation.",
    singular: "report",
  },
  settings: {
    title: "Advertising controls",
    description:
      "Read kill-switch state. Configuration mutations are not exposed here.",
    singular: "kill switch",
  },
};

export async function AdvertisingOperationsPage({
  section,
}: {
  section?: AdvertisingSection;
}) {
  // Keep the database reader independently protected even though the layout and
  // route gate also enforce access. This prevents a future route composition
  // mistake from evaluating commercial queries for an unauthorized identity.
  const user = await getChatGPTUser();
  const authorization = user
    ? await authorizeStaffIdentity(user, ["ad.manage"])
    : null;
  if (!authorization?.allowed) return null;

  if (!section) {
    return <AdvertisingOverview />;
  }

  const result = await loadAdvertisingSection(section);
  const details = sectionDetails[section];

  return (
    <NewsroomFrame activePath={`/newsroom/advertising/${section}`}>
      <div className="newsroom-content ad-operations">
        <WorkspaceHeading
          eyebrow="AD OPERATIONS · PROTECTED READ"
          title={details.title}
          description={details.description}
          action={
            <Link className="button-secondary" href="/newsroom/advertising">
              <ArrowLeft aria-hidden="true" /> Overview
            </Link>
          }
        />
        <NewsroomNotice>
          <strong>Read-only commercial surface.</strong>
          <span>
            Values appear only when the protected D1 query succeeds. Create,
            edit, approve, invoice, export, and configuration controls are not
            available in this workspace.
          </span>
        </NewsroomNotice>

        {result.state === "unavailable" ? (
          <section className="newsroom-panel">
            <EmptyWorkspaceState
              title="Advertising data is unavailable"
              description={result.message}
              icon={LockKeyhole}
            />
          </section>
        ) : result.records.length === 0 ? (
          <section className="newsroom-panel">
            <EmptyWorkspaceState
              title={`No ${details.singular} records`}
              description={`The database query succeeded and returned zero ${details.singular} records. No examples have been fabricated.`}
              icon={Database}
            />
          </section>
        ) : (
          <section className="newsroom-panel" aria-labelledby="ad-records-title">
            <div className="panel-heading">
              <div>
                <span>DATABASE RESULTS</span>
                <h2 id="ad-records-title">
                  {result.total} {result.total === 1 ? details.singular : `${details.singular}s`}
                </h2>
              </div>
              <span>
                Showing {result.records.length}
                {result.total > result.records.length ? ` of ${result.total}` : ""}
              </span>
            </div>
            <div className="ad-record-list">
              {result.records.map((record) => (
                <AdvertisingRecordCard record={record} key={record.id} />
              ))}
            </div>
          </section>
        )}
      </div>
    </NewsroomFrame>
  );
}

async function AdvertisingOverview() {
  const result = await loadAdvertisingOverview();
  return (
    <NewsroomFrame activePath="/newsroom/advertising">
      <div className="newsroom-content ad-operations">
        <WorkspaceHeading
          eyebrow="AD OPERATIONS · PROTECTED READ"
          title="Commercial operations"
          description="Database-backed registers for the advertising lifecycle, separated from editorial work."
        />
        <NewsroomNotice>
          <strong>No fabricated commercial performance.</strong>
          <span>
            Cards below are record counts, not revenue or delivery claims. If D1
            cannot be read, the entire count surface is withheld.
          </span>
        </NewsroomNotice>

        {result.state === "unavailable" ? (
          <section className="newsroom-panel">
            <EmptyWorkspaceState
              title="Advertising data is unavailable"
              description={result.message}
              icon={LockKeyhole}
            />
          </section>
        ) : (
          <section aria-labelledby="ad-registers-title">
            <div className="section-heading">
              <p>DATABASE REGISTERS</p>
              <h2 id="ad-registers-title">Commercial records</h2>
            </div>
            <div className="ad-register-grid">
              {result.counts.map((item) => (
                <Link href={item.href} key={item.href}>
                  <Database aria-hidden="true" />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
              <Link href="/newsroom/advertising/settings">
                <ShieldCheck aria-hidden="true" />
                <span>Controls</span>
                <strong aria-label="Open advertising controls">View</strong>
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </NewsroomFrame>
  );
}

function AdvertisingRecordCard({ record }: { record: AdvertisingRecord }) {
  return (
    <article className="ad-record-card">
      <div className="ad-record-card__heading">
        <div>
          <h3>{record.title}</h3>
          {record.subtitle ? <p>{record.subtitle}</p> : null}
        </div>
        {record.status ? (
          <StatusPill tone={statusTone(record.status)}>
            {record.status.replaceAll("_", " ")}
          </StatusPill>
        ) : null}
      </div>
      <dl>
        {record.fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function statusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" | "info" {
  const normalized = status.toUpperCase();
  if (
    normalized.includes("ACTIVE") ||
    normalized.includes("PAID") ||
    normalized.includes("APPROVED") ||
    normalized.includes("ENABLED") ||
    normalized.includes("WON") ||
    normalized.includes("DELIVERING")
  ) {
    return "success";
  }
  if (
    normalized.includes("KILL") ||
    normalized.includes("REJECT") ||
    normalized.includes("FAILED") ||
    normalized.includes("OVERDUE") ||
    normalized.includes("SPAM")
  ) {
    return "danger";
  }
  if (
    normalized.includes("PENDING") ||
    normalized.includes("REVIEW") ||
    normalized.includes("QUALIFY") ||
    normalized.includes("NEGOTIAT") ||
    normalized.includes("SENT")
  ) {
    return "warning";
  }
  if (normalized.includes("DRAFT") || normalized.includes("NEW")) return "info";
  return "neutral";
}
