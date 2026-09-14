"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import styles from "./portal.module.css";

export interface AdvertiserOrganizationSummary {
  id: string;
  organizationId?: string;
  advertiserId?: string;
  displayName: string;
  legalName?: string;
  organizationName?: string;
  organizationSlug?: string;
  role: string;
}

export interface CampaignSummary {
  id: string;
  advertiserOrganizationId: string;
  name: string;
  objective: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt?: string;
}

export function PortalOverview({ enabled }: { enabled: boolean }) {
  const [organizations, setOrganizations] = useState<AdvertiserOrganizationSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    enabled ? "loading" : "ready",
  );
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch("/api/advertiser/organizations", {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        organizations?: AdvertiserOrganizationSummary[];
      };
      if (!response.ok) throw new Error("unavailable");
      setOrganizations(result.organizations ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [enabled]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <PortalHeading
        eyebrow="Advertiser workspace"
        title="Campaigns begin with a real organization."
        description="Access is scoped to active memberships. Estimates, approvals, delivery, and billing remain separate states."
      />
      {status === "loading" ? <p className={styles.loading}>Loading organizations…</p> : null}
      {status === "error" ? (
        <p className={styles.error} role="alert">
          Organization access could not be loaded. No commercial data was shown.
        </p>
      ) : null}
      {status === "ready" && organizations.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>No advertiser organization yet</h2>
          <p>
            Create one only for a real company you are authorized to represent.
            Creation is audited and does not approve a campaign.
          </p>
          {enabled ? <OrganizationForm onCreated={load} /> : null}
        </section>
      ) : null}
      {organizations.length > 0 ? (
        <section className={styles.resourceList}>
          <div className={styles.resourceHeader}>
            <h2>Your organizations</h2>
            <Link href="/advertiser/campaigns/new">Request a campaign</Link>
          </div>
          {organizations.map((organization) => (
            <article key={organization.id}>
              <div>
                <strong>{organization.organizationName ?? organization.displayName}</strong>
                <span>{organization.displayName}</span>
              </div>
              <span className={styles.status}>{organization.role}</span>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}

export function CampaignsView({ enabled }: { enabled: boolean }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [organizations, setOrganizations] = useState<AdvertiserOrganizationSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    enabled ? "loading" : "ready",
  );
  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      try {
        const organizationsResponse = await fetch(
          "/api/advertiser/organizations",
          { cache: "no-store" },
        );
        const organizationsResult = (await organizationsResponse.json()) as {
          organizations?: AdvertiserOrganizationSummary[];
        };
        if (!organizationsResponse.ok) throw new Error("organizations");
        const accessible = organizationsResult.organizations ?? [];
        setOrganizations(accessible);
        const all: CampaignSummary[] = [];
        for (const organization of accessible) {
          const response = await fetch(
            `/api/advertiser/campaigns?advertiserOrganizationId=${encodeURIComponent(organization.id)}`,
            { cache: "no-store" },
          );
          const result = (await response.json()) as {
            campaigns?: CampaignSummary[];
          };
          if (!response.ok) throw new Error("campaigns");
          all.push(...(result.campaigns ?? []));
        }
        setCampaigns(all);
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, [enabled]);
  return (
    <>
      <PortalHeading
        eyebrow="Campaigns"
        title="Requests, approvals, and delivery are different states."
        description="Advertisers may request a campaign. Only commercial staff can approve or activate it."
      />
      {state === "loading" ? <p className={styles.loading}>Loading campaigns…</p> : null}
      {state === "error" ? (
        <p className={styles.error} role="alert">Campaigns could not be loaded.</p>
      ) : null}
      {state === "ready" && campaigns.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>No campaign requests</h2>
          <p>
            A request can be created after an organization membership exists.
          </p>
          {enabled && organizations.length > 0 ? (
            <Link className={styles.primaryLink} href="/advertiser/campaigns/new">
              Create campaign request
            </Link>
          ) : null}
        </section>
      ) : null}
      {campaigns.length > 0 ? (
        <section className={styles.resourceList}>
          <div className={styles.resourceHeader}>
            <h2>Campaign records</h2>
            <Link href="/advertiser/campaigns/new">New request</Link>
          </div>
          {campaigns.map((campaign) => (
            <article key={campaign.id}>
              <div>
                <strong>{campaign.name}</strong>
                <span>{campaign.objective}</span>
              </div>
              <span className={styles.status}>{campaign.status}</span>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}

export function CampaignRequestForm({ enabled }: { enabled: boolean }) {
  const [organizations, setOrganizations] = useState<AdvertiserOrganizationSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    void fetch("/api/advertiser/organizations", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as {
          organizations?: AdvertiserOrganizationSummary[];
        };
        if (response.ok) setOrganizations(body.organizations ?? []);
      })
      .catch(() => setMessage("Organizations could not be loaded."));
  }, [enabled]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || sending) return;
    setSending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const csrfResponse = await fetch("/api/advertiser/csrf", { cache: "no-store" });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrfResponse.ok || !csrf.csrfToken) throw new Error("csrf");
      const response = await fetch("/api/advertiser/campaigns", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf.csrfToken,
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          advertiserOrganizationId: String(form.get("advertiserOrganizationId") ?? ""),
          name: String(form.get("name") ?? ""),
          objective: String(form.get("objective") ?? ""),
          startsAt: isoDate(String(form.get("startsAt") ?? ""), false),
          endsAt: isoDate(String(form.get("endsAt") ?? ""), true),
        }),
      });
      const result = (await response.json()) as {
        campaign?: CampaignSummary;
        error?: { message?: string };
      };
      if (!response.ok) {
        setMessage(result.error?.message ?? "Campaign request was not accepted.");
      } else {
        setMessage(
          `Campaign request ${result.campaign?.name ?? ""} was saved as a draft for review.`,
        );
        event.currentTarget.reset();
      }
    } catch {
      setMessage("Campaign request security or storage is temporarily unavailable.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PortalHeading
        eyebrow="New campaign"
        title="Request a campaign—do not publish one."
        description="Dates and an objective begin an internal estimate. Budgets, placements, creative, terms, and approval follow in separate controlled steps."
      />
      {organizations.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>An organization is required</h2>
          <p>Create or join an advertiser organization before making a campaign request.</p>
          <Link href="/advertiser">Go to overview</Link>
        </section>
      ) : (
        <form className={styles.portalForm} onSubmit={submit}>
          <label>
            <span>Advertiser organization</span>
            <select name="advertiserOrganizationId" required>
              {organizations.map((organization) => (
                <option value={organization.id} key={organization.id}>
                  {organization.organizationName ?? organization.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Campaign name</span>
            <input name="name" minLength={2} maxLength={160} required />
          </label>
          <label className={styles.full}>
            <span>Objective</span>
            <select name="objective" required defaultValue="BRAND_AWARENESS">
              <option value="BRAND_AWARENESS">Brand awareness</option>
              <option value="TRAFFIC">Qualified traffic</option>
              <option value="LEAD_GENERATION">Lead generation</option>
              <option value="CONVERSIONS">Conversions</option>
              <option value="SPONSORED_CONTENT">Sponsored content</option>
              <option value="NEWSLETTER_SPONSORSHIP">Newsletter sponsorship</option>
            </select>
          </label>
          <label>
            <span>Preferred start</span>
            <input name="startsAt" type="date" />
          </label>
          <label>
            <span>Preferred end</span>
            <input name="endsAt" type="date" />
          </label>
          {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
          <button type="submit" disabled={!enabled || sending}>
            {sending ? "Saving…" : "Save campaign request"}
          </button>
        </form>
      )}
    </>
  );
}

export function ReadOnlyPortalPage({
  eyebrow,
  title,
  description,
  explanation,
}: {
  eyebrow: string;
  title: string;
  description: string;
  explanation: string;
}) {
  return (
    <>
      <PortalHeading eyebrow={eyebrow} title={title} description={description} />
      <section className={styles.emptyState}>
        <h2>No records available</h2>
        <p>{explanation}</p>
      </section>
    </>
  );
}

function OrganizationForm({ onCreated }: { onCreated(): Promise<void> }) {
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    const form = new FormData(event.currentTarget);
    try {
      const csrfResponse = await fetch("/api/advertiser/csrf", { cache: "no-store" });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrfResponse.ok || !csrf.csrfToken) throw new Error("csrf");
      const response = await fetch("/api/advertiser/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf.csrfToken,
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          legalName: String(form.get("legalName") ?? ""),
          displayName: String(form.get("displayName") ?? ""),
          websiteUrl: String(form.get("websiteUrl") ?? ""),
          organizationName: String(form.get("organizationName") ?? ""),
          organizationSlug: String(form.get("organizationSlug") ?? ""),
          industry: String(form.get("industry") ?? "") || undefined,
          billingEmail: String(form.get("billingEmail") ?? "") || undefined,
        }),
      });
      const result = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setMessage(result.error?.message ?? "Organization was not created.");
      } else {
        setMessage("Organization created with you as its owner.");
        event.currentTarget.reset();
        await onCreated();
      }
    } catch {
      setMessage("Organization security or storage is temporarily unavailable.");
    } finally {
      setSending(false);
    }
  }
  return (
    <form className={styles.portalForm} onSubmit={submit}>
      <label><span>Legal name</span><input name="legalName" required /></label>
      <label><span>Public display name</span><input name="displayName" required /></label>
      <label><span>Company website</span><input name="websiteUrl" type="url" placeholder="https://" required /></label>
      <label><span>Workspace name</span><input name="organizationName" required /></label>
      <label><span>Workspace slug</span><input name="organizationSlug" pattern="[a-z0-9-]+" required /></label>
      <label><span>Industry (optional)</span><input name="industry" /></label>
      <label className={styles.full}><span>Billing email (optional)</span><input name="billingEmail" type="email" /></label>
      {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
      <button type="submit" disabled={sending}>{sending ? "Creating…" : "Create organization"}</button>
    </form>
  );
}

function PortalHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className={styles.portalHeading}>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </header>
  );
}

function isoDate(value: string, endOfDay: boolean): string | undefined {
  if (!value) return undefined;
  return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
}
