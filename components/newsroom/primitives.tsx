import Link from "next/link";
import {
  CircleAlert,
  Database,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export function WorkspaceHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="workspace-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}

export function NewsroomNotice({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warning" | "success";
}) {
  return (
    <div className={`newsroom-notice newsroom-notice--${tone}`} role="note">
      <CircleAlert aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyWorkspaceState({
  title,
  description,
  href,
  linkLabel,
  icon: Icon = Database,
}: {
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="newsroom-empty">
      <Icon aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {href && linkLabel ? (
        <Link href={href}>
          {linkLabel} <ExternalLink aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <span className={`newsroom-status newsroom-status--${tone}`}>
      {children}
    </span>
  );
}
