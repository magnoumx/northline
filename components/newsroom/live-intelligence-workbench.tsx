import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Database,
  FileSearch,
  Gauge,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { IntelligenceWorkspaceData } from "@/lib/newsroom/editorial-read-service";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, StatusPill, WorkspaceHeading } from "./primitives";

export function LiveIntelligenceWorkbench({
  data,
}: {
  data: IntelligenceWorkspaceData;
}) {
  const metricCards = [
    ["Trend records", data.metrics.totalTrends],
    ["Signal observations", data.metrics.observedSignals],
    ["Research candidates", data.metrics.researchCandidates],
    ["Active opportunities", data.metrics.activeOpportunities],
    ["Drafts", data.metrics.draftArticles],
    ["Human review", data.metrics.reviewArticles],
    ["Approved", data.metrics.approvedArticles],
    ["Published", data.metrics.publishedArticles],
  ] as const;

  return (
    <NewsroomFrame activePath="/newsroom/intelligence">
      <div className="newsroom-content">
        <WorkspaceHeading
          eyebrow="LIVE DECISION SUPPORT"
          title="Newsroom intelligence"
          description="Prioritize verified signals, monitor editorial throughput, and inspect explainable opportunities from D1-backed records."
          action={
            <Link className="button-primary" href="/newsroom/research">
              Open Research Desk <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        <NewsroomNotice>
          <strong>Operational intelligence, not invented analytics.</strong>
          <span>
            These counts and recommendations come from stored signals, observations, jobs, opportunities, and articles. Empty datasets remain empty.
          </span>
        </NewsroomNotice>

        <div className="intelligence-live-metrics">
          {metricCards.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value.toLocaleString("en-US")}</strong>
            </article>
          ))}
        </div>

        <div className="intelligence-live-grid">
          <section className="newsroom-panel intelligence-opportunities">
            <div className="panel-heading">
              <div>
                <span>OPPORTUNITY ENGINE</span>
                <h2>Ranked editorial opportunities</h2>
              </div>
              <Sparkles aria-hidden="true" />
            </div>
            {data.opportunities.length ? (
              <div className="intelligence-opportunity-list">
                {data.opportunities.map((opportunity) => (
                  <article key={opportunity.id}>
                    <div className="intelligence-opportunity-list__rank">
                      <strong>{Math.round(opportunity.score)}</strong>
                      <span>/100</span>
                    </div>
                    <div>
                      <div className="intelligence-opportunity-list__title">
                        <h3>{opportunity.term}</h3>
                        <StatusPill tone={opportunity.state === "RESEARCH" ? "success" : opportunity.state === "WATCH" ? "warning" : "neutral"}>
                          {opportunity.state}
                        </StatusPill>
                      </div>
                      <p>{opportunity.explanation}</p>
                      <small>
                        {opportunity.category} · {opportunity.recommendedFormat} · {opportunity.risk} risk · Updated {new Date(opportunity.updatedAt).toLocaleString("en-US")}
                      </small>
                    </div>
                    <Link href={`/newsroom/editor?trendId=${encodeURIComponent(opportunity.trendId)}&headline=${encodeURIComponent(opportunity.term)}&category=${encodeURIComponent(opportunity.category)}&primaryQuery=${encodeURIComponent(opportunity.term)}`}>
                      Draft <ArrowRight aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="research-empty-state compact">
                <Gauge aria-hidden="true" />
                <h3>No opportunity has been scored yet</h3>
                <p>Run discovery and let the scheduled opportunity rescore job classify the stored signals.</p>
                <Link className="button-primary" href="/newsroom/trends">
                  Open Trend Desk <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            )}
          </section>

          <aside className="intelligence-live-sidebar">
            <section className="newsroom-panel">
              <div className="panel-heading">
                <div>
                  <span>CATEGORY MIX</span>
                  <h2>Active signals</h2>
                </div>
                <BarChart3 aria-hidden="true" />
              </div>
              {data.categories.length ? (
                <div className="intelligence-category-list">
                  {data.categories.map((entry) => {
                    const maximum = Math.max(...data.categories.map((item) => item.count), 1);
                    return (
                      <article key={entry.category}>
                        <div><span>{entry.category}</span><strong>{entry.count}</strong></div>
                        <span><i style={{ width: `${Math.max(4, (entry.count / maximum) * 100)}%` }} /></span>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="operational-empty">No active category distribution is available.</p>
              )}
            </section>

            <section className="newsroom-panel">
              <div className="panel-heading">
                <div>
                  <span>PIPELINE HEALTH</span>
                  <h2>Recent jobs</h2>
                </div>
                <Activity aria-hidden="true" />
              </div>
              {data.jobs.length ? (
                <div className="intelligence-job-list">
                  {data.jobs.map((job) => (
                    <article key={job.id}>
                      <div>
                        {job.state === "FAILED" ? <ShieldAlert aria-hidden="true" /> : <Database aria-hidden="true" />}
                        <span><strong>{job.jobType}</strong><small>{new Date(job.startedAt).toLocaleString("en-US")}</small></span>
                      </div>
                      <StatusPill tone={job.state === "COMPLETED" ? "success" : job.state === "FAILED" ? "warning" : "neutral"}>
                        {job.state}
                      </StatusPill>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="operational-empty">No job run has been recorded.</p>
              )}
              <Link className="text-link" href="/newsroom/jobs">
                <FileSearch aria-hidden="true" /> Inspect background jobs
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </NewsroomFrame>
  );
}
