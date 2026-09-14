"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  FileSearch,
  PenLine,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { NewsroomCandidate } from "@/lib/newsroom/editorial-read-service";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, StatusPill, WorkspaceHeading } from "./primitives";
import {
  hasNewsroomPermission,
  useNewsroomSession,
} from "./session";

export function NewsroomDashboard({
  candidates,
}: {
  candidates: NewsroomCandidate[];
}) {
  const session = useNewsroomSession();
  const canWrite = hasNewsroomPermission(session, [
    "article.create",
    "article.edit.own",
    "article.edit.any",
  ]);
  const canResearch = hasNewsroomPermission(session, [
    "source.manage",
    "trend.manage",
    "article.create",
    "article.edit.own",
    "article.edit.any",
  ]);
  const canReview = hasNewsroomPermission(session, [
    "article.approve",
    "article.edit.any",
    "audit.view",
  ]);
  const canAdvertise = hasNewsroomPermission(session, ["ad.manage"]);

  return (
    <NewsroomFrame activePath="/newsroom">
      <div className="newsroom-content">
        <WorkspaceHeading
          eyebrow="ROLE-AWARE WORKSPACE"
          title={`Newsroom overview for ${session.role}`}
          description="Only desks permitted by your server-side role appear in this workspace."
        />

        <NewsroomNotice>
          <strong>
            {session.demoMode
              ? "Fictional editorial demo."
              : "Database editorial workspace."}
          </strong>
          <span>
            {session.demoMode
              ? "Editorial examples below are product-preview records."
              : "Editorial records below are read from the protected database."}{" "}
            Commercial records are never synthesized.
          </span>
        </NewsroomNotice>

        <section className="newsroom-action-grid" aria-labelledby="available-desks">
          <div className="section-heading">
            <p>YOUR ACCESS</p>
            <h2 id="available-desks">Available desks</h2>
          </div>
          <div className="newsroom-card-grid">
            {canWrite ? (
              <DeskCard
                description={session.demoMode ? "Edit a development fixture and inspect the evidence boundary." : "Create and edit database-backed drafts with sources and review gates."}
                href="/newsroom/editor"
                icon={PenLine}
                label="Article Editor"
              />
            ) : null}
            {canResearch ? (
              <DeskCard
                description={session.demoMode ? "Review the development source set and unresolved claims." : "Manage verified sources and production research dossiers."}
                href="/newsroom/research"
                icon={FileSearch}
                label="Research Desk"
              />
            ) : null}
            {hasNewsroomPermission(session, ["trend.manage"]) ? (
              <DeskCard
                description={session.demoMode ? "Inspect an explainable development signal set." : "Inspect connected, deduplicated trend signals."}
                href="/newsroom/trends"
                icon={TrendingUp}
                label="Trend Desk"
              />
            ) : null}
            {hasNewsroomPermission(session, ["trend.manage", "audit.view"]) ? (
              <DeskCard
                description={session.demoMode ? "Compare development content patterns and opportunities." : "Review verified performance, opportunities, and editorial recommendations."}
                href="/newsroom/intelligence"
                icon={BarChart3}
                label="Intelligence"
              />
            ) : null}
            {canReview ? (
              <DeskCard
                description={session.demoMode ? "Inspect review gates without recording a production decision." : "Review drafts and record accountable publication decisions."}
                href="/newsroom/review"
                icon={ShieldCheck}
                label="Review Workspace"
              />
            ) : null}
            {canAdvertise ? (
              <DeskCard
                description="Read protected leads, campaigns, inventory, billing, and controls."
                href="/newsroom/advertising"
                icon={BriefcaseBusiness}
                label="Ad Operations"
              />
            ) : null}
          </div>
        </section>

        {canResearch || canWrite || canReview ? (
          <section className="newsroom-panel" aria-labelledby="candidate-queue">
            <div className="panel-heading">
              <div>
                <span>{session.demoMode ? "DEVELOPMENT FIXTURES" : "EDITORIAL DATABASE"}</span>
                <h2 id="candidate-queue">Candidate queue</h2>
              </div>
              {hasNewsroomPermission(session, ["trend.manage"]) ? (
                <Link href="/newsroom/trends">
                  Open Trend Desk <ArrowRight aria-hidden="true" />
                </Link>
              ) : null}
            </div>
            <div className="newsroom-table-wrap">
              <table className="newsroom-table">
                <thead>
                  <tr>
                    <th scope="col">Candidate</th>
                    <th scope="col">Category</th>
                    <th scope="col">Evidence</th>
                    <th scope="col">Risk</th>
                    <th scope="col">State</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.id}>
                      <th scope="row">{candidate.title}</th>
                      <td>{candidate.category}</td>
                      <td>
                        {candidate.sources} sources · {candidate.primary} primary
                      </td>
                      <td>
                        <StatusPill
                          tone={
                            candidate.risk === "High"
                              ? "danger"
                              : candidate.risk === "Medium"
                                ? "warning"
                                : "success"
                          }
                        >
                          {candidate.risk}
                        </StatusPill>
                      </td>
                      <td>
                        <StatusPill tone="info">
                          {candidate.state.replaceAll("_", " ")}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No active editorial candidates.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </NewsroomFrame>
  );
}

function DeskCard({
  description,
  href,
  icon: Icon,
  label,
}: {
  description: string;
  href: string;
  icon: typeof PenLine;
  label: string;
}) {
  return (
    <Link className="newsroom-desk-card" href={href}>
      <Icon aria-hidden="true" />
      <div>
        <h3>{label}</h3>
        <p>{description}</p>
      </div>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}
