"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CircleAlert,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { EmptyWorkspaceState, StatusPill } from "./primitives";

type GenericRecord = Record<string, unknown>;

type WorkspaceKind =
  | "analytics"
  | "jobs"
  | "audit"
  | "users"
  | "roles"
  | "integrations";

const endpointByKind: Record<WorkspaceKind, string> = {
  analytics: "/api/newsroom/analytics/summary?days=30",
  jobs: "/api/newsroom/jobs?limit=100",
  audit: "/api/newsroom/audit?limit=100",
  users: "/api/newsroom/users",
  roles: "/api/newsroom/users",
  integrations: "/api/newsroom/integrations",
};

export function OperationalWorkspace({ kind }: { kind: WorkspaceKind }) {
  const [payload, setPayload] = useState<GenericRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const endpoint = endpointByKind[kind];

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await response.json()) as GenericRecord & {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "The protected report is unavailable.");
      }
      setPayload(body);
    } catch (caught) {
      setPayload(null);
      setError(caught instanceof Error ? caught.message : "The protected report is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  if (loading) {
    return (
      <div className="operational-loading" role="status">
        <RefreshCw aria-hidden="true" /> Loading verified data…
      </div>
    );
  }
  if (error || !payload) {
    return (
      <EmptyWorkspaceState
        icon={CircleAlert}
        title="The operational report could not be loaded"
        description={error ?? "The backing service did not return a report."}
      />
    );
  }

  return (
    <div className="operational-workspace">
      <div className="operational-workspace__toolbar">
        <p>Live database-backed report. No sample metrics are inserted.</p>
        <button className="button-secondary" type="button" onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" /> Refresh
        </button>
      </div>
      {kind === "analytics" ? <AnalyticsReport payload={payload} /> : null}
      {kind === "jobs" ? <JobsReport payload={payload} /> : null}
      {kind === "audit" ? <AuditReport payload={payload} /> : null}
      {kind === "users" ? <UsersReport payload={payload} /> : null}
      {kind === "roles" ? <RolesReport payload={payload} /> : null}
      {kind === "integrations" ? <IntegrationsReport payload={payload} /> : null}
    </div>
  );
}

function AnalyticsReport({ payload }: { payload: GenericRecord }) {
  const totals = asRecord(payload.totals);
  const articles = asRecords(payload.articles);
  const ai = asRecords(payload.ai);
  const metricEntries = Object.entries(totals);
  return (
    <>
      <div className="operational-metrics">
        {metricEntries.length ? (
          metricEntries.slice(0, 8).map(([label, value]) => (
            <article key={label}>
              <span>{humanize(label)}</span>
              <strong>{formatNumber(value)}</strong>
            </article>
          ))
        ) : (
          <article>
            <span>Reader events</span>
            <strong>0</strong>
          </article>
        )}
      </div>
      <DataSection title="Article performance" icon={BarChart3}>
        <DataTable
          rows={articles}
          columns={[
            ["headline", "Article"],
            ["pageviews", "Pageviews"],
            ["readers", "Readers"],
            ["completions", "Completions"],
          ]}
        />
      </DataSection>
      <DataSection title="AI cost ledger" icon={Activity}>
        <DataTable
          rows={ai}
          columns={[
            ["provider", "Provider"],
            ["model", "Model"],
            ["inputTokens", "Input tokens"],
            ["outputTokens", "Output tokens"],
            ["costUsd", "Cost (USD)"],
          ]}
        />
      </DataSection>
      <SearchConsoleSection />
    </>
  );
}

/**
 * What Google actually did with what was published - the feedback loop the
 * autonomous pipeline never had. A separate fetch from a separate route: the
 * connector can be unconfigured or Google can be unreachable without taking
 * down the pageview and cost data above it, which read from this site's own
 * database and have no reason to fail alongside it.
 */
function SearchConsoleSection() {
  const [payload, setPayload] = useState<GenericRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/newsroom/analytics/search-console?days=28", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const body = (await response.json()) as GenericRecord & { error?: { message?: string } };
        if (cancelled) return;
        if (!response.ok) throw new Error(body.error?.message ?? "Search Console is unavailable.");
        setPayload(body);
      } catch (caught) {
        if (cancelled) return;
        setPayload(null);
        setError(caught instanceof Error ? caught.message : "Search Console is unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <DataSection title="Google Search Console" icon={Search}>
        <p className="operational-empty">Loading Search Console data…</p>
      </DataSection>
    );
  }
  if (error || !payload) {
    return (
      <DataSection title="Google Search Console" icon={Search}>
        <p className="operational-empty">{error ?? "Search Console is not connected."}</p>
      </DataSection>
    );
  }

  const topQueries = asRecords(payload.topQueries);
  const lowCtrPages = asRecords(payload.lowCtrPages);

  return (
    <DataSection title="Google Search Console" icon={Search}>
      <div className="operational-metrics">
        <Metric label="Clicks" value={Number(payload.clicks ?? 0)} />
        <Metric label="Impressions" value={Number(payload.impressions ?? 0)} />
        <article>
          <span>Average CTR</span>
          <strong>{(Number(payload.ctr ?? 0) * 100).toFixed(2)}%</strong>
        </article>
        <article>
          <span>Average position</span>
          <strong>{Number(payload.averagePosition ?? 0).toFixed(1)}</strong>
        </article>
      </div>
      <h3>Top queries</h3>
      <DataTable
        rows={topQueries.map((row) => ({
          query: (row.keys as string[] | undefined)?.[0] ?? "",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }))}
        columns={[
          ["query", "Query"],
          ["clicks", "Clicks"],
          ["impressions", "Impressions"],
          ["position", "Position"],
        ]}
      />
      <h3>Shown often, rarely clicked</h3>
      <p className="operational-caption">
        At least 20 impressions and under 1% CTR - a title or deck worth revisiting.
      </p>
      <DataTable
        rows={lowCtrPages.map((row) => ({
          page: (row.keys as string[] | undefined)?.[0] ?? "",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }))}
        columns={[
          ["page", "Page"],
          ["impressions", "Impressions"],
          ["ctr", "CTR"],
          ["position", "Position"],
        ]}
      />
    </DataSection>
  );
}

function JobsReport({ payload }: { payload: GenericRecord }) {
  const durable = asRecords(payload.durableJobs);
  const runs = asRecords(payload.recentRuns);
  const deadLetters = asRecords(payload.deadLetters);
  return (
    <>
      <div className="operational-metrics">
        <Metric label="Durable jobs" value={durable.length} />
        <Metric label="Recent runs" value={runs.length} />
        <Metric label="Dead letters" value={deadLetters.length} />
      </div>
      <DataSection title="Durable queue state" icon={Wrench}>
        <DataTable
          rows={durable}
          columns={[
            ["kind", "Kind"],
            ["queue", "Queue"],
            ["state", "State"],
            ["attemptCount", "Attempts"],
            ["updatedAt", "Updated"],
          ]}
        />
      </DataSection>
      <DataSection title="Dead-letter queue" icon={CircleAlert}>
        <DataTable
          rows={deadLetters}
          columns={[
            ["jobId", "Job"],
            ["finalErrorCategory", "Category"],
            ["finalErrorDigest", "Error digest"],
            ["createdAt", "Created"],
          ]}
        />
      </DataSection>
    </>
  );
}

function AuditReport({ payload }: { payload: GenericRecord }) {
  return (
    <DataSection title="Immutable audit trail" icon={ShieldCheck}>
      <DataTable
        rows={asRecords(payload.events)}
        columns={[
          ["occurredAt", "Time"],
          ["actorName", "Actor"],
          ["action", "Action"],
          ["targetType", "Target"],
          ["decision", "Decision"],
          ["reason", "Reason"],
        ]}
      />
    </DataSection>
  );
}

function UsersReport({ payload }: { payload: GenericRecord }) {
  const users = asRecords(payload.users).map((user) => ({
    ...user,
    roles: parseJsonList(user.rolesJson).join(", ") || "No active role",
  }));
  return (
    <DataSection title="Staff directory" icon={Users}>
      <DataTable
        rows={users}
        columns={[
          ["displayName", "Name"],
          ["email", "Email"],
          ["status", "Status"],
          ["roles", "Roles"],
          ["updatedAt", "Updated"],
        ]}
      />
    </DataSection>
  );
}

function RolesReport({ payload }: { payload: GenericRecord }) {
  return (
    <DataSection title="Role and permission map" icon={ShieldCheck}>
      <DataTable
        rows={asRecords(payload.roles)}
        columns={[
          ["name", "Role"],
          ["key", "Key"],
          ["scope", "Scope"],
          ["permissionCount", "Permissions"],
          ["description", "Description"],
        ]}
      />
    </DataSection>
  );
}

function IntegrationsReport({ payload }: { payload: GenericRecord }) {
  const integrations = asRecords(payload.integrations);
  const configuredCount = integrations.filter((item) => item.enabled === true && item.configured === true).length;
  const incompleteCount = integrations.filter((item) => item.enabled === true && item.configured !== true).length;
  const disabledCount = integrations.filter((item) => item.enabled !== true).length;
  return (
    <div className="integration-report">
      <div className="integration-summary" aria-label="Integration configuration summary">
        <article><span>Configured</span><strong>{configuredCount}</strong></article>
        <article><span>Needs attention</span><strong>{incompleteCount}</strong></article>
        <article><span>Disabled</span><strong>{disabledCount}</strong></article>
      </div>
      <p className="integration-verification-note">
        “Configured” confirms bindings and required values are present. Provider connectivity is proven by a successful job, email, upload, or monitored test event.
      </p>
      <div className="integration-status-grid">
        {integrations.map((item) => {
          const enabled = item.enabled === true;
          const configured = item.configured === true;
          return (
            <article key={String(item.id)} data-state={enabled && configured ? "configured" : enabled ? "attention" : "disabled"}>
              <div>
                <Database aria-hidden="true" />
                <strong>{String(item.label ?? item.id)}</strong>
              </div>
              <StatusPill tone={enabled && configured ? "success" : enabled ? "warning" : "neutral"}>
                {enabled && configured ? "Configured" : enabled ? "Missing values" : "Disabled"}
              </StatusPill>
              <p>{String(item.note ?? "")}</p>
              {Array.isArray(item.requiredValues) && item.requiredValues.length ? (
                <small>Required: {item.requiredValues.join(", ")}</small>
              ) : (
                <small>No credential value is required for this integration.</small>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DataSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Activity;
  children: ReactNode;
}) {
  return (
    <section className="operational-section">
      <h2><Icon aria-hidden="true" /> {title}</h2>
      {children}
    </section>
  );
}

function DataTable({
  rows,
  columns,
}: {
  rows: GenericRecord[];
  columns: Array<[string, string]>;
}) {
  if (!rows.length) {
    return <p className="operational-empty">No verified records are available yet.</p>;
  }
  return (
    <div className="operational-table-wrap">
      <table className="operational-table">
        <thead>
          <tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? row.slug ?? `${index}`)}>
              {columns.map(([key]) => <td key={key}>{formatCell(row[key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article><span>{label}</span><strong>{value.toLocaleString("en-US")}</strong></article>;
}

function asRecord(value: unknown): GenericRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as GenericRecord : {};
}
function asRecords(value: unknown): GenericRecord[] {
  return Array.isArray(value) ? value.filter((item): item is GenericRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}
function formatNumber(value: unknown): string {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString("en-US") : "0";
}
function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (value > 1_000_000_000_000) return new Date(value).toLocaleString("en-US");
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value);
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}
function humanize(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}
function parseJsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter((item) => item && item !== "null");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter((item) => item && item !== "null") : [];
  } catch {
    return [];
  }
}
