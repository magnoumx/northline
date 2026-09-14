"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Database,
  FileChartColumn,
  FileSearch,
  FileText,
  Flag,
  Gauge,
  Image as ImageIcon,
  LayoutDashboard,
  ListChecks,
  Menu,
  Newspaper,
  PackageCheck,
  PenLine,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tags,
  TrendingUp,
  Users,
  X,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { newsroomNavigation } from "./navigation";
import {
  hasNewsroomPermission,
  useNewsroomSession,
} from "./session";

const navigationIcons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  "Trend Desk": TrendingUp,
  Intelligence: BarChart3,
  "Research Desk": FileSearch,
  "Article Editor": PenLine,
  "Review Workspace": ListChecks,
  Sources: Database,
  "Live Desk": Activity,
  Newsletters: Newspaper,
  Homepage: LayoutDashboard,
  Overview: Gauge,
  Leads: BriefcaseBusiness,
  Advertisers: Building2,
  Campaigns: ClipboardList,
  Orders: PackageCheck,
  "Line items": FileText,
  Creatives: ImageIcon,
  Inventory: Database,
  Pricing: Tags,
  Invoices: ReceiptText,
  Reports: FileChartColumn,
  Settings,
  "Autonomous Desk": Bot,
  Jobs: Activity,
  Analytics: BarChart3,
  "Audit log": ShieldCheck,
  Media: ImageIcon,
  Users,
  Roles: Users,
  "Workspace settings": Settings,
  Integrations: Database,
  "Feature flags": Flag,
};

export function NewsroomFrame({
  activePath,
  children,
}: {
  activePath: string;
  children: ReactNode;
}) {
  const session = useNewsroomSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleGroups = useMemo(
    () =>
      newsroomNavigation
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            hasNewsroomPermission(session, item.required),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [session],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const currentLabel =
    visibleGroups
      .flatMap((group) => group.items)
      .find((item) => isNewsroomNavItemActive(activePath, item.href))?.label ??
    "Newsroom";
  const initials = session.email
    .split("@")[0]
    .split(/[._-]/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="newsroom-app">
      {menuOpen ? (
        <button
          type="button"
          className="newsroom-scrim"
          aria-label="Close newsroom navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        className={`newsroom-sidebar${menuOpen ? " is-open" : ""}`}
        id="newsroom-sidebar"
      >
        <div className="newsroom-brand">
          <Link href="/" aria-label={`${session.brandName} public site`}>
            <span aria-hidden="true">{session.brandShortName.charAt(0)}</span>
            <div>
              <strong>{session.brandName}</strong>
              <small>NEWSROOM</small>
            </div>
          </Link>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Newsroom">
          {visibleGroups.map((group) =>
            group.collapsible ? (
              <details
                className="newsroom-nav-group"
                open={
                  activePath.startsWith("/newsroom/advertising")
                    ? true
                    : undefined
                }
                key={group.label}
              >
                <summary>{group.label}</summary>
                <div>
                  {group.items.map((item) => (
                    <NewsroomNavLink
                      active={isNewsroomNavItemActive(activePath, item.href)}
                      href={item.href}
                      key={item.href}
                      label={item.label}
                      onNavigate={() => setMenuOpen(false)}
                    />
                  ))}
                </div>
              </details>
            ) : (
              <section className="newsroom-nav-group" key={group.label}>
                <h2>{group.label}</h2>
                <div>
                  {group.items.map((item) => (
                    <NewsroomNavLink
                      active={isNewsroomNavItemActive(activePath, item.href)}
                      href={item.href}
                      key={item.href}
                      label={item.label}
                      onNavigate={() => setMenuOpen(false)}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
        </nav>

        <div className="newsroom-user">
          <span aria-hidden="true">{initials || "NR"}</span>
          <div>
            <strong>{session.role}</strong>
            <small>{session.email}</small>
          </div>
        </div>
      </aside>

      <div className="newsroom-main">
        <header className="newsroom-topbar">
          <button
            type="button"
            className="newsroom-menu"
            aria-controls="newsroom-sidebar"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu aria-hidden="true" />
            <span className="sr-only">Open newsroom navigation</span>
          </button>
          <div className="newsroom-location">
            <span>Newsroom</span>
            <strong>{currentLabel}</strong>
          </div>
          <div className="newsroom-topbar__actions">
            <span className="demo-workspace-label">
              {session.demoMode ? "DEMO WORKSPACE" : "LIVE CONTROL PLANE"}
            </span>
            <Link href="/" target="_blank" rel="noreferrer">
              View site <ExternalLink aria-hidden="true" />
            </Link>
          </div>
        </header>
        <main id="newsroom-main">{children}</main>
      </div>
    </div>
  );
}

function isNewsroomNavItemActive(activePath: string, href: string): boolean {
  return (
    href === activePath ||
    (href !== "/newsroom" && activePath.startsWith(`${href}/`))
  );
}

function NewsroomNavLink({
  active,
  href,
  label,
  onNavigate,
}: {
  active: boolean;
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  const Icon = navigationIcons[label] ?? FileText;
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={active ? "active" : undefined}
      href={href}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" />
      {label}
    </Link>
  );
}
