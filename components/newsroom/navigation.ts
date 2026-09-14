import type { Permission } from "@/lib/auth/permissions";

export type NewsroomNavItem = {
  label: string;
  href: string;
  required: readonly Permission[];
};

export type NewsroomNavGroup = {
  label: string;
  items: readonly NewsroomNavItem[];
  collapsible?: boolean;
};

export const newsroomNavigation: readonly NewsroomNavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Dashboard",
        href: "/newsroom",
        required: ["workspace.access"],
      },
    ],
  },
  {
    label: "Editorial",
    items: [
      {
        label: "Trend Desk",
        href: "/newsroom/trends",
        required: ["trend.manage"],
      },
      {
        label: "Intelligence",
        href: "/newsroom/intelligence",
        required: ["trend.manage", "audit.view"],
      },
      {
        label: "Research Desk",
        href: "/newsroom/research",
        required: [
          "source.manage",
          "article.create",
          "article.edit.own",
          "article.edit.any",
        ],
      },
      {
        label: "Article Editor",
        href: "/newsroom/editor",
        required: ["article.create", "article.edit.own", "article.edit.any"],
      },
      {
        label: "Review Workspace",
        href: "/newsroom/review",
        required: ["article.approve", "article.edit.any", "audit.view"],
      },
      {
        label: "Sources",
        href: "/newsroom/sources",
        required: ["source.manage", "article.edit.any"],
      },
      {
        label: "Live Desk",
        href: "/newsroom/live",
        required: ["article.edit.own", "article.edit.any"],
      },
      {
        label: "Newsletters",
        href: "/newsroom/newsletters",
        required: ["article.edit.any"],
      },
      {
        label: "Homepage",
        href: "/newsroom/homepage",
        required: ["article.edit.any"],
      },
    ],
  },
  {
    label: "Ad Operations",
    collapsible: true,
    items: [
      {
        label: "Overview",
        href: "/newsroom/advertising",
        required: ["ad.manage"],
      },
      {
        label: "Leads",
        href: "/newsroom/advertising/leads",
        required: ["ad.manage"],
      },
      {
        label: "Advertisers",
        href: "/newsroom/advertising/advertisers",
        required: ["ad.manage"],
      },
      {
        label: "Campaigns",
        href: "/newsroom/advertising/campaigns",
        required: ["ad.manage"],
      },
      {
        label: "Orders",
        href: "/newsroom/advertising/orders",
        required: ["ad.manage"],
      },
      {
        label: "Line items",
        href: "/newsroom/advertising/line-items",
        required: ["ad.manage"],
      },
      {
        label: "Creatives",
        href: "/newsroom/advertising/creatives",
        required: ["ad.manage"],
      },
      {
        label: "Inventory",
        href: "/newsroom/advertising/inventory",
        required: ["ad.manage"],
      },
      {
        label: "Pricing",
        href: "/newsroom/advertising/pricing",
        required: ["ad.manage"],
      },
      {
        label: "Invoices",
        href: "/newsroom/advertising/invoices",
        required: ["ad.manage"],
      },
      {
        label: "Reports",
        href: "/newsroom/advertising/reports",
        required: ["ad.manage"],
      },
      {
        label: "Settings",
        href: "/newsroom/advertising/settings",
        required: ["ad.manage"],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Autonomous Desk",
        href: "/newsroom/autonomous",
        required: ["settings.manage", "audit.view"],
      },
      {
        label: "Jobs",
        href: "/newsroom/jobs",
        required: ["settings.manage", "audit.view"],
      },
      {
        label: "Analytics",
        href: "/newsroom/analytics",
        required: ["audit.view"],
      },
      {
        label: "Audit log",
        href: "/newsroom/audit",
        required: ["audit.view"],
      },
      {
        label: "Media",
        href: "/newsroom/media",
        required: ["media.approve", "article.edit.any"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Users",
        href: "/newsroom/users",
        required: ["user.manage"],
      },
      {
        label: "Roles",
        href: "/newsroom/roles",
        required: ["user.manage"],
      },
      {
        label: "Workspace settings",
        href: "/newsroom/settings/general",
        required: ["settings.manage"],
      },
      {
        label: "Integrations",
        href: "/newsroom/integrations",
        required: ["settings.manage"],
      },
      {
        label: "Feature flags",
        href: "/newsroom/feature-flags",
        required: ["settings.manage"],
      },
    ],
  },
] as const;
