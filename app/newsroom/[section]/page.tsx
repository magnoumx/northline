import { NewsroomUtilityPage } from "@/components/newsroom-console";
import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import type { Permission } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";

const utilityPermissions: Record<string, readonly Permission[]> = {
  sources: ["source.manage", "article.edit.any"],
  media: ["media.approve", "article.edit.any"],
  autonomous: ["settings.manage", "audit.view"],
  jobs: ["settings.manage", "audit.view"],
  analytics: ["audit.view"],
  audit: ["audit.view"],
  ads: ["ad.manage"],
  advertisers: ["ad.manage"],
  users: ["user.manage"],
  roles: ["user.manage"],
  settings: ["settings.manage"],
  integrations: ["settings.manage"],
  connectors: ["settings.manage"],
  "feature-flags": ["settings.manage"],
  newsletters: ["article.edit.any"],
  homepage: ["article.edit.any"],
  live: ["article.edit.any", "article.edit.own"],
};

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const required = utilityPermissions[section];
  if (!required) notFound();

  return (
    <NewsroomPermissionGate permissions={required}>
      <NewsroomUtilityPage section={section} />
    </NewsroomPermissionGate>
  );
}
