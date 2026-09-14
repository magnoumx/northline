import { Database, Settings, ShieldCheck, Wrench } from "lucide-react";
import { NewsroomFrame } from "./frame";
import {
  EmptyWorkspaceState,
  NewsroomNotice,
  WorkspaceHeading,
} from "./primitives";
import { IndexingLaunchControl } from "./indexing-control";
import { ConnectorRegistry } from "./connector-registry";
import { SettingsLanding } from "./settings-pages";
import { OperationalWorkspace } from "./operational-workspace";
import { SourceWorkspace } from "./source-workspace";
import { MediaWorkspace } from "./media-workspace";
import { NewsletterWorkspace } from "./newsletter-workspace";
import { EditorialContentWorkspace } from "./editorial-content-workspace";
import { FeatureFlagWorkspace } from "./feature-flag-workspace";
import { AutonomousWorkspace } from "./autonomous-workspace";

type UtilityPageConfig = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  href?: string;
  linkLabel?: string;
};

const utilityPageConfig: Record<string, UtilityPageConfig> = {
  sources: {
    title: "Source operations",
    description: "Manage verified source records and ingestion policy.",
    emptyTitle: "Source management is not connected",
    emptyDescription:
      "The public demo source directory is available, but this internal route has no production source write service.",
    href: "/sources",
    linkLabel: "Open public demo sources",
  },
  media: {
    title: "Media operations",
    description: "Review rights, provenance, and approval state.",
    emptyTitle: "No media workflow is connected",
    emptyDescription:
      "Uploads, rights review, and asset approval are intentionally unavailable in this preview.",
  },
  autonomous: {
    title: "Autonomous newsroom",
    description: "Monitor automated research, verification, approval, publication, and narration.",
    emptyTitle: "Autonomous newsroom is unavailable",
    emptyDescription:
      "Enable the autonomous queue, AI providers, and D1 migration before using this control plane.",
  },
  jobs: {
    title: "Background jobs",
    description: "Inspect operational job execution and retry state.",
    emptyTitle: "No job monitor is connected",
    emptyDescription:
      "This page does not infer queue health or display fictional operational incidents.",
  },
  analytics: {
    title: "Editorial analytics",
    description: "Inspect privacy-safe editorial and operational reporting.",
    emptyTitle: "Analytics reporting is unavailable",
    emptyDescription:
      "No analytics provider is connected, so this preview shows no traffic, audience, or performance estimates.",
  },
  audit: {
    title: "Audit log",
    description: "Review immutable decisions and protected workspace events.",
    emptyTitle: "No audit reader is connected",
    emptyDescription:
      "Audit entries are not simulated. Connect the production audit store before relying on this surface.",
  },
  ads: {
    title: "Advertising",
    description: "The protected advertising workspace has moved.",
    emptyTitle: "Use Ad Operations",
    emptyDescription:
      "Leads, campaigns, inventory, pricing, invoices, reports, and settings now live in a dedicated role-gated workspace.",
    href: "/newsroom/advertising",
    linkLabel: "Open Ad Operations",
  },
  advertisers: {
    title: "Advertisers",
    description: "The protected advertiser reader has moved.",
    emptyTitle: "Use the advertiser register",
    emptyDescription:
      "Database-backed advertiser records now live under the dedicated Ad Operations workspace.",
    href: "/newsroom/advertising/advertisers",
    linkLabel: "Open advertiser register",
  },
  users: {
    title: "Users",
    description: "Manage staff access and identity assignments.",
    emptyTitle: "User administration is unavailable",
    emptyDescription:
      "Role assignments remain server-configured. This preview does not expose identity mutation controls.",
  },
  roles: {
    title: "Roles",
    description: "Inspect workspace roles and permissions.",
    emptyTitle: "Role editing is unavailable",
    emptyDescription:
      "The current server authorization map remains the source of truth. No role changes can be made here.",
  },
  settings: {
    title: "Workspace settings",
    description: "Configure protected newsroom behavior.",
    emptyTitle: "Settings writes are unavailable",
    emptyDescription:
      "This preview does not expose controls that appear to save configuration.",
  },
  integrations: {
    title: "Integrations",
    description: "Inspect connected newsroom services.",
    emptyTitle: "No integration registry is connected",
    emptyDescription:
      "This preview does not claim that a provider is healthy or configured without a verified connection.",
  },
  connectors: {
    title: "Connectors",
    description: "Inspect source and workflow connectors.",
    emptyTitle: "No connector registry is connected",
    emptyDescription:
      "Connector state is unavailable and is not synthesized for the demo.",
  },
  "feature-flags": {
    title: "Feature flags",
    description: "Inspect controlled workspace rollouts.",
    emptyTitle: "Feature flag management is unavailable",
    emptyDescription:
      "No remote flag service is attached, so this page exposes no decorative toggles.",
  },
  newsletters: {
    title: "Newsletter desk",
    description: "Prepare and review editorial briefings.",
    emptyTitle: "Newsletter production is not connected",
    emptyDescription:
      "The public signup experience is available, but editorial newsletter composition has no write service here.",
    href: "/newsletter",
    linkLabel: "Open public newsletter page",
  },
  homepage: {
    title: "Homepage desk",
    description: "Review homepage programming and story order.",
    emptyTitle: "Homepage programming is read-only",
    emptyDescription:
      "The public homepage is available for inspection, but this preview cannot reorder or promote stories.",
    href: "/",
    linkLabel: "Open public homepage",
  },
  live: {
    title: "Live desk",
    description: "Coordinate verified live updates.",
    emptyTitle: "Live publishing is unavailable",
    emptyDescription:
      "The route demonstrates access boundaries without offering controls that imply an update can be published.",
  },
};

export const newsroomUtilitySections = Object.keys(utilityPageConfig);

export function NewsroomUtilityPage({ section }: { section: string }) {
  if (section === "settings") return <SettingsLanding />;
  const config = utilityPageConfig[section] ?? {
    title: "Workspace module",
    description: "Protected newsroom module.",
    emptyTitle: "Module unavailable",
    emptyDescription:
      "No production service is connected to this route in the preview.",
  };
  const Icon =
    section === "audit"
      ? ShieldCheck
      : section === "settings" || section === "feature-flags"
        ? Settings
        : section === "jobs" || section === "integrations"
          ? Wrench
          : Database;

  return (
    <NewsroomFrame activePath={`/newsroom/${section}`}>
      <div className="newsroom-content">
        <WorkspaceHeading
          eyebrow="PROTECTED OPERATIONS"
          title={config.title}
          description={config.description}
        />
        <NewsroomNotice>
          <strong>Verified operational data only.</strong>
          <span>
            Connected modules read from protected services and show explicit empty
            or unavailable states instead of invented metrics.
          </span>
        </NewsroomNotice>
        <section className="newsroom-panel">
          {section === "autonomous" ? (
            <AutonomousWorkspace />
          ) : section === "sources" ? (
            <SourceWorkspace />
          ) : section === "media" ? (
            <MediaWorkspace />
          ) : section === "newsletters" ? (
            <NewsletterWorkspace />
          ) : section === "integrations" ? (
            <OperationalWorkspace kind="integrations" />
          ) : section === "live" ? (
            <EditorialContentWorkspace mode="live" />
          ) : section === "homepage" ? (
            <EditorialContentWorkspace mode="homepage" />
          ) : section === "feature-flags" ? (
            <FeatureFlagWorkspace />
          ) : section === "connectors" ? (
            <ConnectorRegistry />
          ) : section === "analytics" || section === "jobs" || section === "audit" || section === "users" || section === "roles" ? (
            <OperationalWorkspace kind={section} />
          ) : section === "settings" ? (
            <IndexingLaunchControl />
          ) : (
            <EmptyWorkspaceState
              title={config.emptyTitle}
              description={config.emptyDescription}
              href={config.href}
              linkLabel={config.linkLabel}
              icon={Icon}
            />
          )}
        </section>
      </div>
    </NewsroomFrame>
  );
}
