import Link from "next/link";
import { SettingsWorkspace } from "./settings-workspace";
import { NewsroomFrame } from "./frame";
import { WorkspaceHeading } from "./primitives";
import {
  integrationSummaries,
  publicDefinitionsForCategory,
  SETTINGS_CATEGORIES,
  type SettingsCategory,
} from "@/lib/settings/registry";

const copy: Record<SettingsCategory, { title: string; description: string }> = {
  general: { title: "General settings", description: "Brand, locale, and reader-facing defaults." },
  editorial: { title: "Editorial settings", description: "Publishing limits and category review safeguards." },
  ai: { title: "AI settings", description: "Approved models, fallback order, and spend controls." },
  trends: { title: "Trend settings", description: "Refresh intervals and search geography." },
  audio: { title: "Audio settings", description: "Reader narration defaults without provider secrets." },
  newsletters: { title: "Newsletter settings", description: "Delivery schedule and product defaults." },
  advertising: { title: "Advertising settings", description: "Direct-sales pricing and safe delivery controls." },
  appearance: { title: "Appearance settings", description: "Reader-facing article presentation defaults." },
  integrations: { title: "Integrations", description: "Safe connection state and credential setup guidance." },
  security: { title: "Security settings", description: "Owner-controlled access and MFA requirements." },
};

export function SettingsLanding() {
  return (
    <NewsroomFrame activePath="/newsroom/settings">
      <div className="newsroom-content">
        <WorkspaceHeading
          eyebrow="PROTECTED CONFIGURATION"
          title="Workspace settings"
          description="Runtime product settings live in D1 with validation, version history, and audit records. Deployment secrets remain in Cloudflare."
        />
        <section className="settings-category-grid" aria-label="Settings categories">
          {SETTINGS_CATEGORIES.map((category) => (
            <Link key={category} href={`/newsroom/settings/${category}`}>
              <span>{category}</span>
              <strong>{copy[category].title}</strong>
              <small>{copy[category].description}</small>
            </Link>
          ))}
        </section>
      </div>
    </NewsroomFrame>
  );
}

export function SettingsCategoryPage({ category }: { category: SettingsCategory }) {
  const details = copy[category];
  return (
    <NewsroomFrame activePath={`/newsroom/settings/${category}`}>
      <div className="newsroom-content">
        <WorkspaceHeading eyebrow="PROTECTED CONFIGURATION" title={details.title} description={details.description} />
        <SettingsWorkspace
          category={category}
          definitions={publicDefinitionsForCategory(category)}
          integrations={integrationSummaries()}
        />
      </div>
    </NewsroomFrame>
  );
}
