"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Clock3,
  Database,
  FileSearch,
  Gauge,
  MapPin,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import type { Trend } from "@/lib/site/types";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, StatusPill, WorkspaceHeading } from "./primitives";
import { useNewsroomSession } from "./session";
import { TrendRefreshControl } from "./trend-refresh-control";
import { TrendDecisionControls } from "./trend-decision-controls";

export function TrendDesk({ trends }: { trends: Trend[] }) {
  const session = useNewsroomSession();
  const [selected, setSelected] = useState(0);
  if (!session.demoMode && trends.length === 0) {
    return (
      <NewsroomFrame activePath="/newsroom/trends">
        <div className="newsroom-content">
          <WorkspaceHeading
            eyebrow="DISCOVERY"
            title="Verified trend signals"
            description="Google Trends and GDELT observations appear here after the protected queue completes a real ingestion run."
            action={<TrendRefreshControl />}
          />
          <NewsroomNotice>
            <strong>The database is healthy, but no discovery record has landed yet.</strong>
            <span>
              This is usually a first-run state, a disabled connector, or a queue/cron delivery problem—not a content problem.
            </span>
          </NewsroomNotice>
          <div className="trend-launch-grid">
            <section className="newsroom-panel trend-launch-primary">
              <div className="trend-launch-primary__icon"><Radio aria-hidden="true" /></div>
              <div>
                <span>DISCOVERY PIPELINE</span>
                <h2>No verified signals have been stored</h2>
                <p>
                  Start a manual refresh now, then inspect the job queue. The page will remain empty instead of inventing trends when providers return no eligible result.
                </p>
              </div>
              <TrendRefreshControl />
            </section>
            <aside className="trend-launch-checks" aria-label="Discovery launch checks">
              <article>
                <strong>1. Configuration</strong>
                <span>Google Trends and GDELT must be enabled in Integrations.</span>
                <Link href="/newsroom/integrations">Open integrations <ArrowRight aria-hidden="true" /></Link>
              </article>
              <article>
                <strong>2. Delivery</strong>
                <span>The editorial queue consumer must receive and acknowledge trend.refresh.</span>
                <Link href="/newsroom/jobs">Inspect jobs <ArrowRight aria-hidden="true" /></Link>
              </article>
              <article>
                <strong>3. Persistence</strong>
                <span>Eligible, deduplicated observations are written to D1 and then rendered here.</span>
                <Link href="/newsroom/audit">Open audit log <ArrowRight aria-hidden="true" /></Link>
              </article>
            </aside>
          </div>
        </div>
      </NewsroomFrame>
    );
  }
  const trend = trends[selected];
  if (!trend) {
    return (
      <NewsroomFrame activePath="/newsroom/trends">
        <div className="newsroom-content">
          <WorkspaceHeading
            eyebrow="DISCOVERY"
            title="Trend Desk"
            description="No connector has produced an eligible signal."
          />
          <NewsroomNotice>
            <strong>No trend signals available.</strong>
            <span>
              Connector failures and empty results do not create fictional
              candidates.
            </span>
          </NewsroomNotice>
        </div>
      </NewsroomFrame>
    );
  }

  if (!session.demoMode) {
    return (
      <NewsroomFrame activePath="/newsroom/trends">
        <div className="newsroom-content">
          <WorkspaceHeading
            eyebrow="LIVE DISCOVERY"
            title="Trend Desk"
            description="Inspect verified Google Trends and GDELT observations, record an editorial decision, and move eligible signals into research."
            action={<TrendRefreshControl />}
          />
          <NewsroomNotice>
            <strong>Live D1-backed signals.</strong>
            <span>
              Scores support prioritization only. Every reporting decision and claim still requires human review and attributable evidence.
            </span>
          </NewsroomNotice>

          <div className="trend-workspace live">
            <section className="trend-list" aria-labelledby="trend-list-title">
              <div className="panel-heading">
                <div>
                  <span>ACTIVE SIGNALS</span>
                  <h2 id="trend-list-title">Candidate signals</h2>
                </div>
                <StatusPill tone="success">{trends.length} live</StatusPill>
              </div>
              <div className="trend-list__items">
                {trends.map((item, index) => (
                  <button
                    type="button"
                    aria-pressed={selected === index}
                    className={selected === index ? "active" : undefined}
                    onClick={() => setSelected(index)}
                    key={item.id ?? item.term}
                  >
                    <span>{String(item.rank).padStart(2, "0")}</span>
                    <span>
                      <strong>{item.term}</strong>
                      <small>{item.category} · {item.state ?? "SIGNAL_DETECTED"}</small>
                    </span>
                    <span>{Math.round(item.score ?? item.velocity)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="trend-inspector" aria-labelledby="trend-inspector-title">
              <div className="trend-inspector__heading">
                <div>
                  <span>
                    <Radio aria-hidden="true" /> Selected live signal
                  </span>
                  <h2 id="trend-inspector-title">{trend.term}</h2>
                  <p>{trend.explanation}</p>
                </div>
                <StatusPill tone={(trend.risk ?? "LOW") === "LOW" ? "success" : "warning"}>
                  {trend.risk ?? "LOW"} risk
                </StatusPill>
              </div>
              <dl className="trend-facts live">
                <div>
                  <dt><MapPin aria-hidden="true" /> Market</dt>
                  <dd>{trend.regions.join(", ")}</dd>
                </div>
                <div>
                  <dt><Gauge aria-hidden="true" /> Editorial score</dt>
                  <dd>{Math.round(trend.score ?? 0)}/100</dd>
                </div>
                <div>
                  <dt><Activity aria-hidden="true" /> Search velocity</dt>
                  <dd>{trend.velocity}/100</dd>
                </div>
                <div>
                  <dt><Database aria-hidden="true" /> Observations</dt>
                  <dd>{trend.observationCount ?? 0}</dd>
                </div>
                <div>
                  <dt><ShieldCheck aria-hidden="true" /> Source families</dt>
                  <dd>{trend.sourceFamilies?.join(", ") || "Not recorded"}</dd>
                </div>
                <div>
                  <dt><Clock3 aria-hidden="true" /> Last detected</dt>
                  <dd>{trend.latestDetectedAt ? new Date(trend.latestDetectedAt).toLocaleString("en-US") : "Unknown"}</dd>
                </div>
              </dl>
              <div className="trend-rationale">
                <h3>Editorial boundary</h3>
                <ul>
                  <li>The signal is metadata, not a verified article claim.</li>
                  <li>Research must identify primary and independent sources before drafting.</li>
                  <li>High-risk topics remain subject to mandatory human approval.</li>
                </ul>
              </div>
              {trend.id ? (
                <TrendDecisionControls trendId={trend.id} state={trend.state ?? "SIGNAL_DETECTED"} />
              ) : null}
            </section>
          </div>
        </div>
      </NewsroomFrame>
    );
  }

  return (
    <NewsroomFrame activePath="/newsroom/trends">
      <div className="newsroom-content">
        <WorkspaceHeading
          eyebrow="DISCOVERY · FICTIONAL SNAPSHOT"
          title="Trend Desk"
          description="Inspect the evidence behind a demo signal before deciding whether it deserves reporting."
        />
        <NewsroomNotice>
          <strong>No live signal service is connected.</strong>
          <span>
            Selecting a row changes the inspector locally. Reject, merge, and
            refresh writes are intentionally unavailable.
          </span>
        </NewsroomNotice>

        <div className="trend-workspace">
          <section className="trend-list" aria-labelledby="trend-list-title">
            <div className="panel-heading">
              <div>
                <span>DEMO SIGNALS</span>
                <h2 id="trend-list-title">Candidate signals</h2>
              </div>
              <StatusPill tone="warning">Snapshot</StatusPill>
            </div>
            <div className="trend-list__items">
              {trends.map((item, index) => (
                <button
                  type="button"
                  aria-pressed={selected === index}
                  className={selected === index ? "active" : undefined}
                  onClick={() => setSelected(index)}
                  key={item.term}
                >
                  <span>{String(item.rank).padStart(2, "0")}</span>
                  <span>
                    <strong>{item.term}</strong>
                    <small>{item.category}</small>
                  </span>
                  <span>+{item.velocity}%</span>
                </button>
              ))}
            </div>
          </section>

          <section className="trend-inspector" aria-labelledby="trend-inspector-title">
            <div className="trend-inspector__heading">
              <div>
                <span>
                  <Radio aria-hidden="true" /> Selected demo signal
                </span>
                <h2 id="trend-inspector-title">{trend.term}</h2>
                <p>{trend.related.join(" · ")}</p>
              </div>
              <StatusPill tone="info">{trend.confidence} confidence</StatusPill>
            </div>
            <dl className="trend-facts">
              <div>
                <dt>
                  <MapPin aria-hidden="true" /> Regions
                </dt>
                <dd>{trend.regions.join(", ")}</dd>
              </div>
              <div>
                <dt>
                  <ShieldCheck aria-hidden="true" /> Evidence boundary
                </dt>
                <dd>Demo sources only</dd>
              </div>
              <div>
                <dt>Velocity</dt>
                <dd>+{trend.velocity}% in the fictional dataset</dd>
              </div>
            </dl>
            <div className="trend-rationale">
              <h3>Why this signal is visible</h3>
              <ul>
                <li>It appears across more than one fictional source family.</li>
                <li>Its regional relevance is explicit rather than inferred.</li>
                <li>A human must still validate importance, duplication, and risk.</li>
              </ul>
            </div>
            <div className="newsroom-action-row">
              <span>Signal decisions are read-only in this preview.</span>
              <Link className="button-primary" href="/newsroom/research">
                Open research demo <FileSearch aria-hidden="true" />
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </NewsroomFrame>
  );
}
