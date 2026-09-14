"use client";

import Link from "next/link";
import {
  ArrowRight,
  Database,
  FilePenLine,
  FileSearch,
  Link2,
  ShieldCheck,
} from "lucide-react";
import type { ResearchWorkspaceData } from "@/lib/newsroom/editorial-read-service";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, StatusPill, WorkspaceHeading } from "./primitives";
import { TrendDecisionControls } from "./trend-decision-controls";

export function LiveResearchDesk({ data }: { data: ResearchWorkspaceData }) {
  const primarySources = data.sources.filter((source) => source.isPrimary).length;
  const readyCandidates = data.candidates.filter(
    (candidate) => candidate.opportunityState === "RESEARCH" || candidate.state === "RESEARCHING",
  ).length;

  return (
    <NewsroomFrame activePath="/newsroom/research">
      <div className="newsroom-content">
        <WorkspaceHeading
          eyebrow="LIVE RESEARCH"
          title="Research Desk"
          description="Turn verified discovery signals into source-bounded reporting packets and accountable article drafts."
          action={
            <Link className="button-primary" href="/newsroom/sources">
              Manage sources <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        <NewsroomNotice>
          <strong>Research is evidence-first.</strong>
          <span>
            A trend is not evidence. Select primary and independent sources in the Article Editor before running the AI review package.
          </span>
        </NewsroomNotice>

        <div className="research-live-metrics">
          <article><span>Active candidates</span><strong>{data.candidates.length}</strong></article>
          <article><span>Ready for research</span><strong>{readyCandidates}</strong></article>
          <article><span>Approved sources</span><strong>{data.sources.length}</strong></article>
          <article><span>Primary sources</span><strong>{primarySources}</strong></article>
        </div>

        <div className="research-live-layout">
          <section className="newsroom-panel research-candidate-panel">
            <div className="panel-heading">
              <div>
                <span>DISCOVERY QUEUE</span>
                <h2>Research candidates</h2>
              </div>
              <StatusPill tone={data.candidates.length ? "success" : "neutral"}>
                {data.candidates.length} records
              </StatusPill>
            </div>
            {data.candidates.length ? (
              <div className="research-candidate-list">
                {data.candidates.map((candidate) => (
                  <article key={candidate.id}>
                    <div className="research-candidate-list__head">
                      <div>
                        <span>{candidate.category}</span>
                        <h3>{candidate.term}</h3>
                      </div>
                      <StatusPill tone={candidate.risk === "LOW" ? "success" : "warning"}>
                        {candidate.risk} risk
                      </StatusPill>
                    </div>
                    <p>{candidate.explanation}</p>
                    <dl>
                      <div><dt>Score</dt><dd>{Math.round(candidate.score)}/100</dd></div>
                      <div><dt>State</dt><dd>{candidate.state}</dd></div>
                      <div><dt>Observations</dt><dd>{candidate.observationCount}</dd></div>
                      <div><dt>Sources</dt><dd>{candidate.sourceFamilies.join(", ") || "Pending"}</dd></div>
                      <div><dt>Format</dt><dd>{candidate.recommendedFormat ?? "Not selected"}</dd></div>
                      <div><dt>Detected</dt><dd>{new Date(candidate.latestDetectedAt).toLocaleString("en-US")}</dd></div>
                    </dl>
                    <div className="research-candidate-list__actions">
                      <Link
                        className="button-primary"
                        href={editorHref(candidate)}
                      >
                        <FilePenLine aria-hidden="true" /> Create draft
                      </Link>
                      <TrendDecisionControls
                        compact
                        trendId={candidate.id}
                        state={candidate.state}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="research-empty-state">
                <FileSearch aria-hidden="true" />
                <h3>No live research candidate exists yet</h3>
                <p>Run discovery, then promote an eligible signal from Trend Desk.</p>
                <Link className="button-primary" href="/newsroom/trends">
                  Open Trend Desk <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            )}
          </section>

          <aside className="research-live-sidebar">
            <section className="newsroom-panel">
              <div className="panel-heading">
                <div>
                  <span>EVIDENCE DIRECTORY</span>
                  <h2>Available sources</h2>
                </div>
                <Database aria-hidden="true" />
              </div>
              {data.sources.length ? (
                <div className="research-source-list">
                  {data.sources.slice(0, 12).map((source) => (
                    <article key={source.id}>
                      <div>
                        <strong>{source.name}</strong>
                        <span>{source.domain}</span>
                      </div>
                      <small>
                        T{source.credibilityTier} · {source.isPrimary ? "Primary" : source.sourceType} · {source.licensingStatus}
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="operational-empty">No source record is available. Add primary and independent sources before drafting.</p>
              )}
              <Link className="text-link" href="/newsroom/sources">
                <Link2 aria-hidden="true" /> Open source operations
              </Link>
            </section>

            <section className="newsroom-panel">
              <div className="panel-heading">
                <div>
                  <span>EDITORIAL OUTPUT</span>
                  <h2>Recent drafts</h2>
                </div>
                <ShieldCheck aria-hidden="true" />
              </div>
              {data.articles.length ? (
                <div className="research-draft-list">
                  {data.articles.slice(0, 10).map((article) => (
                    <article key={article.id}>
                      <div>
                        <strong>{article.headline ?? article.slug}</strong>
                        <span>{article.category} · {article.state}</span>
                      </div>
                      <time>{new Date(article.updatedAt).toLocaleString("en-US")}</time>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="operational-empty">No database-backed draft has been created.</p>
              )}
              <Link className="text-link" href="/newsroom/editor">
                <FilePenLine aria-hidden="true" /> Open Article Editor
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </NewsroomFrame>
  );
}

function editorHref(candidate: ResearchWorkspaceData["candidates"][number]): string {
  const params = new URLSearchParams({
    trendId: candidate.id,
    headline: candidate.term,
    category: normalizedCategory(candidate.category),
    format: candidate.recommendedFormat === "STANDARD_STORY" ? "STANDARD_NEWS" : candidate.recommendedFormat ?? "STANDARD_NEWS",
    primaryQuery: candidate.term,
  });
  return `/newsroom/editor?${params.toString()}`;
}

function normalizedCategory(category: string): string {
  const normalized = category.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/gu, "_");
  const allowed = new Set([
    "US_NEWS",
    "POLITICS",
    "TECHNOLOGY",
    "BUSINESS",
    "ENTERTAINMENT",
    "SPORTS",
    "GAMING",
    "SCIENCE",
    "INTERNET_TRENDS",
    "WORLD",
    "HEALTH",
    "FINANCE",
    "WEATHER",
  ]);
  return allowed.has(normalized) ? normalized : "US_NEWS";
}
