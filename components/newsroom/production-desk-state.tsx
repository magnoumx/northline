"use client";

import Link from "next/link";
import { ArrowRight, Database, ShieldCheck } from "lucide-react";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, WorkspaceHeading } from "./primitives";

export function ProductionDeskState({
  activePath,
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  activePath: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <NewsroomFrame activePath={activePath}>
      <div className="newsroom-content">
        <WorkspaceHeading eyebrow={eyebrow} title={title} description={description} />
        <NewsroomNotice>
          <ShieldCheck aria-hidden="true" />
          <strong>Production records only.</strong>
          <span>
            Fixture dossiers and synthetic operational metrics are hidden outside development.
            Create or ingest a verified record to populate this desk.
          </span>
        </NewsroomNotice>
        <section className="newsroom-panel production-desk-empty" aria-label={`${title} empty state`}>
          <Database aria-hidden="true" />
          <div>
            <h2>No verified records yet</h2>
            <p>
              This is an intentional fail-closed state. The workspace will not substitute
              fictional examples when the production database is empty.
            </p>
          </div>
          <div className="production-desk-empty__actions">
            <Link className="button-primary" href={primaryHref}>
              {primaryLabel} <ArrowRight aria-hidden="true" />
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            ) : null}
          </div>
        </section>
      </div>
    </NewsroomFrame>
  );
}
