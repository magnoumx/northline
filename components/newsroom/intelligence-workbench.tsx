"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleAlert,
  FileText,
  GitBranch,
  Lightbulb,
  Link2,
  MapPin,
  Minus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { ProductionDeskState } from "./production-desk-state";
import { useNewsroomSession } from "./session";
import {
  intelligenceCountries,
  intelligenceWindows,
  type HeadlineStrategy,
  type IntelligenceCountry,
  type IntelligenceDemoViewModel,
  type IntelligenceView,
  type IntelligenceWindow,
  type TrendSignal,
} from "@/lib/intelligence/types";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, StatusPill, WorkspaceHeading } from "./primitives";

const viewNavigation: readonly {
  view: IntelligenceView;
  label: string;
  shortLabel: string;
}[] = [
  { view: "overview", label: "Intelligence overview", shortLabel: "Overview" },
  { view: "top-content", label: "Top content", shortLabel: "Top content" },
  { view: "headlines", label: "Headline lab", shortLabel: "Headlines" },
  { view: "formats", label: "Article formats", shortLabel: "Formats" },
  { view: "publishers", label: "Publisher coverage", shortLabel: "Publishers" },
  { view: "opportunities", label: "Story opportunities", shortLabel: "Opportunities" },
] as const;

const windowLabels: Readonly<Record<IntelligenceWindow, string>> = {
  "4h": "4 hours",
  "12h": "12 hours",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  "12mo": "12 months",
  custom: "Custom",
};

export function IntelligenceWorkbench({
  model,
  view,
}: {
  model: IntelligenceDemoViewModel;
  view: IntelligenceView;
}) {
  const session = useNewsroomSession();
  const activePath =
    view === "overview"
      ? "/newsroom/intelligence"
      : `/newsroom/intelligence/${view}`;
  const page = viewNavigation.find((item) => item.view === view)!;

  if (!session.demoMode) {
    return (
      <ProductionDeskState
        activePath={activePath}
        eyebrow="DECISION SUPPORT"
        title="Verified newsroom intelligence"
        description="Production analysis is calculated only from first-party events, published content, and connected source records."
        primaryHref="/newsroom/analytics"
        primaryLabel="Open analytics"
        secondaryHref="/newsroom/jobs"
        secondaryLabel="Inspect jobs"
      />
    );
  }

  return (
    <NewsroomFrame activePath={activePath}>
      <div className="newsroom-content intelligence-workbench">
        <WorkspaceHeading
          eyebrow="DECISION SUPPORT · FICTIONAL DEMO"
          title={page.label}
          description="Inspect explainable derived signals, format guidance, and editorial opportunities without claiming live audience demand or automating publication."
        />
        <NewsroomNotice>
          <strong>Protected synthetic workspace.</strong>
          <span>
            Every record on this desk is fictional or deterministically derived
            from a frozen fixture. No live provider is connected, no article
            body is copied, and no score is exposed to public story pages.
          </span>
        </NewsroomNotice>
        <IntelligenceNavigation activeView={view} />
        {view === "overview" ? <Overview model={model} /> : null}
        {view === "top-content" ? <TopContent model={model} /> : null}
        {view === "headlines" ? <HeadlineLab model={model} /> : null}
        {view === "formats" ? <Formats model={model} /> : null}
        {view === "publishers" ? <Publishers model={model} /> : null}
        {view === "opportunities" ? <Opportunities model={model} /> : null}
      </div>
    </NewsroomFrame>
  );
}

function IntelligenceNavigation({ activeView }: { activeView: IntelligenceView }) {
  return (
    <nav className="intelligence-tabs" aria-label="Newsroom intelligence">
      {viewNavigation.map((item) => {
        const href =
          item.view === "overview"
            ? "/newsroom/intelligence"
            : `/newsroom/intelligence/${item.view}`;
        return (
          <Link
            aria-current={item.view === activeView ? "page" : undefined}
            href={href}
            key={item.view}
          >
            {item.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}

function Overview({ model }: { model: IntelligenceDemoViewModel }) {
  return (
    <>
      <section className="intelligence-summary" aria-labelledby="snapshot-heading">
        <div className="section-heading">
          <p>FIXTURE SCOPE</p>
          <h2 id="snapshot-heading">Decision-support snapshot</h2>
        </div>
        <div className="intelligence-stat-grid">
          <SummaryCard
            icon={FileText}
            label={model.sampleLabel}
            value={String(model.sample.length)}
            detail="Synthetic monthly metadata records"
          />
          <SummaryCard
            icon={Building2}
            label="Source families"
            value={String(new Set(model.publishers.map((item) => item.sourceFamily)).size)}
            detail="Demo connector configurations"
          />
          <SummaryCard
            icon={Lightbulb}
            label="Opportunities"
            value={String(model.opportunities.length)}
            detail="Protected internal evaluations"
          />
          <SummaryCard
            icon={GitBranch}
            label="Link suggestions"
            value={String(model.linkSuggestions.length)}
            detail="Human review required"
          />
        </div>
      </section>

      <TrendExplorer model={model} />
      <KnowledgeGraph model={model} />
    </>
  );
}

function TrendExplorer({ model }: { model: IntelligenceDemoViewModel }) {
  const [country, setCountry] = useState<IntelligenceCountry>("US");
  const [window, setWindow] = useState<IntelligenceWindow>("24h");
  const [customStart, setCustomStart] = useState("2026-07-01");
  const [customEnd, setCustomEnd] = useState("2026-07-24");
  const snapshot = model.trendSnapshots[country][window];

  return (
    <section className="newsroom-panel intelligence-trends" aria-labelledby="trend-explorer-heading">
      <div className="panel-heading">
        <div>
          <span>COUNTRY + TIME</span>
          <h2 id="trend-explorer-heading">Trend discovery</h2>
        </div>
        <StatusPill tone="warning">Synthetic index</StatusPill>
      </div>
      <div className="intelligence-filterbar">
        <label>
          Country
          <select
            value={country}
            onChange={(event) =>
              setCountry(event.target.value as IntelligenceCountry)
            }
          >
            {intelligenceCountries.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Time window</legend>
          <div className="intelligence-window-options">
            {intelligenceWindows.map((item) => (
              <button
                aria-pressed={window === item}
                key={item}
                onClick={() => setWindow(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>
        {window === "custom" ? (
          <div className="intelligence-custom-range">
            <label>
              From
              <input
                max={customEnd}
                onChange={(event) => setCustomStart(event.target.value)}
                type="date"
                value={customStart}
              />
            </label>
            <label>
              Through
              <input
                min={customStart}
                onChange={(event) => setCustomEnd(event.target.value)}
                type="date"
                value={customEnd}
              />
            </label>
          </div>
        ) : null}
      </div>
      <div className="intelligence-provenance" role="note">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>{snapshot.metricLabel} · 0–100 normalized fixture scale</strong>
          <span>{snapshot.metricDefinition}</span>
          <small>
            {snapshot.provenanceLabel} · {snapshot.generatedAtLabel}
            {window === "custom"
              ? ` · selected range ${customStart} through ${customEnd}`
              : ` · ${windowLabels[window]} window`}
          </small>
        </div>
      </div>
      <ol className="intelligence-signal-list">
        {snapshot.signals.slice(0, 8).map((signal, index) => (
          <TrendRow index={index} key={signal.id} signal={signal} />
        ))}
      </ol>
    </section>
  );
}

function TrendRow({ index, signal }: { index: number; signal: TrendSignal }) {
  const movementLabel =
    signal.searchGrowthPercent > 0
      ? `Growth +${signal.searchGrowthPercent}%`
      : signal.searchGrowthPercent < 0
        ? `Growth ${signal.searchGrowthPercent}%`
        : "No change";
  const MovementIcon =
    signal.searchGrowthPercent > 0
      ? ArrowUp
      : signal.searchGrowthPercent < 0
        ? ArrowDown
        : Minus;
  return (
    <li>
      <span className="intelligence-rank">{index + 1}</span>
      <div className="intelligence-signal-copy">
        <strong>{signal.topic}</strong>
        <span>
          {signal.category} · {signal.sourceFamilies} demo source families
        </span>
        <small>{signal.provenance}</small>
      </div>
      <div
        aria-label={`Relative search interest ${signal.relativeSearchInterest} out of 100`}
        className="intelligence-index"
      >
        <span
          aria-hidden="true"
          style={
            {
              "--intelligence-index": `${signal.relativeSearchInterest}%`,
            } as CSSProperties
          }
        />
        <strong>{signal.relativeSearchInterest}</strong>
      </div>
      <span className="intelligence-movement">
        <MovementIcon aria-hidden="true" />
        {movementLabel}
      </span>
      <details className="intelligence-signal-details">
        <summary>Inspect metric definitions and evidence</summary>
        <dl>
          <TrendFact label="Normalized topic" value={signal.topic} />
          <TrendFact label="Original query" value={signal.originalQuery} />
          <TrendFact label="Country" value={signal.country} />
          <TrendFact label="Region" value={signal.region ?? "Not available"} />
          <TrendFact label="Language" value={signal.language} />
          <TrendFact label="Category" value={signal.category} />
          <TrendFact label="Related entities" value={signal.relatedEntities.join(", ")} />
          <TrendFact label="First detected" value={signal.firstDetectedLabel} />
          <TrendFact label="Last detected" value={signal.lastDetectedLabel} />
          <TrendFact label="Peak time" value={signal.peakTimeLabel} />
          <TrendFact
            label="Relative search interest"
            value={`${signal.relativeSearchInterest}/100 synthetic fixture`}
          />
          <TrendFact
            label="Estimated monthly searches"
            value="Unknown · demand provider not connected"
          />
          <TrendFact
            label="Search growth"
            value={`${signal.searchGrowthPercent}% within fixture`}
          />
          <TrendFact label="News-source velocity" value={humanize(signal.newsSourceVelocity)} />
          <TrendFact label="Social velocity" value="Unknown · provider not connected" />
          <TrendFact label="Video velocity" value="Unknown · provider not connected" />
          <TrendFact label="Wikipedia interest" value="Unknown · provider not connected" />
          <TrendFact label="Related queries" value={signal.relatedQueries.join(", ")} />
          <TrendFact label="Rising queries" value={signal.risingQueries.join(", ")} />
          <TrendFact
            label="Primary-source availability"
            value={humanize(signal.primarySourceAvailability)}
          />
          <TrendFact label="Image availability" value="Unknown · not reviewed" />
          <TrendFact label="Video availability" value="Unknown · not reviewed" />
          <TrendFact
            label="Existing story cluster"
            value={signal.existingStoryCluster ?? "None in fixture"}
          />
          <TrendFact
            label="Existing site coverage"
            value={humanize(signal.existingSiteCoverage)}
          />
          <TrendFact label="Competition" value={humanize(signal.competition)} />
          <TrendFact label="Freshness" value={humanize(signal.freshness)} />
          <TrendFact label="Risk" value={humanize(signal.risk)} />
          <TrendFact label="Commercial suitability" value="Not evaluated" />
          <TrendFact
            label="Recommended format"
            value={humanize(signal.recommendedFormat)}
          />
          <TrendFact label="Recommended deadline" value={signal.recommendedDeadline} />
          <TrendFact label="Expected lifespan" value={signal.expectedLifespan} />
          <TrendFact label="Trend explanation" value={signal.explanation} />
          <TrendFact label="Metric source" value="Synthetic V4 fixture" />
          <TrendFact label="Metric confidence" value="Demo only" />
        </dl>
      </details>
    </li>
  );
}

function TopContent({ model }: { model: IntelligenceDemoViewModel }) {
  const [category, setCategory] = useState("ALL");
  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(model.sample.map((item) => item.category)))],
    [model.sample],
  );
  const records = useMemo(
    () =>
      model.sample
        .filter((item) => category === "ALL" || item.category === category)
        .toSorted(
          (left, right) =>
            right.relativeAttentionIndex - left.relativeAttentionIndex,
        )
        .slice(0, 20),
    [category, model.sample],
  );
  return (
    <section className="newsroom-panel intelligence-table-panel" aria-labelledby="top-content-heading">
      <div className="panel-heading">
        <div>
          <span>{model.sampleLabel.toUpperCase()}</span>
          <h2 id="top-content-heading">Derived monthly ranking</h2>
        </div>
        <StatusPill tone="warning">{model.sample.length} demo records</StatusPill>
      </div>
      <div className="intelligence-panel-note">
        <BarChart3 aria-hidden="true" />
        <p>
          <strong>{model.sampleLabel}.</strong> {model.sampleDisclosure}
          Ranking uses only a normalized fixture index; it is not a claim about
          visits, searches, shares, or publisher performance.
        </p>
      </div>
      <div className="intelligence-inline-filter">
        <label htmlFor="top-content-category">Category</label>
        <select
          id="top-content-category"
          onChange={(event) => setCategory(event.target.value)}
          value={category}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item === "ALL" ? "All categories" : item}
            </option>
          ))}
        </select>
        <span aria-live="polite">{records.length} records shown</span>
      </div>
      <div className="newsroom-table-wrap">
        <table className="newsroom-table intelligence-table">
          <caption className="sr-only">
            Top records in the fictional High-Signal Article Sample
          </caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Synthetic record</th>
              <th scope="col">Category</th>
              <th scope="col">Format</th>
              <th scope="col">Fixture index</th>
              <th scope="col">Provenance</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => (
              <tr key={record.id}>
                <td>{index + 1}</td>
                <th scope="row">{record.headlineLabel}</th>
                <td>{record.category}</td>
                <td>{humanize(record.format)}</td>
                <td>{record.relativeAttentionIndex}/100</td>
                <td>Derived metadata only</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PatternAnalysis model={model} />
    </section>
  );
}

function PatternAnalysis({ model }: { model: IntelligenceDemoViewModel }) {
  const sampleSize = model.sample.length;
  const averageWords = Math.round(
    model.sample.reduce((sum, record) => sum + record.wordCount, 0) /
      sampleSize,
  );
  const averageLinks = (
    model.sample.reduce((sum, record) => sum + record.internalLinkCount, 0) /
    sampleSize
  ).toFixed(1);
  const updatedRecords = model.sample.filter(
    (record) => record.updateFrequency !== "ONCE",
  ).length;
  const visualRecords = model.sample.filter(
    (record) =>
      record.imageCount > 0 ||
      record.videoCount > 0 ||
      record.chartCount > 0,
  ).length;
  const structuredRecords = model.sample.filter(
    (record) => record.faqPresent || record.timelinePresent,
  ).length;
  const lowAdRecords = model.sample.filter(
    (record) =>
      record.advertisementDensity === "LOW" ||
      record.advertisementDensity === "NONE",
  ).length;
  const patterns = [
    {
      label: "Depth",
      value: `${averageWords.toLocaleString("en-US")} avg. fixture words`,
      recommendation:
        "Compare utility by format before setting depth; never turn this average into a quota.",
    },
    {
      label: "Updates",
      value: `${updatedRecords}/${sampleSize} update-shaped records`,
      recommendation:
        "Make material-update timestamps and what-changed notes easy to find.",
    },
    {
      label: "Media",
      value: `${visualRecords}/${sampleSize} include a visual signal`,
      recommendation:
        "Choose rights-cleared media only when it explains something the text cannot.",
    },
    {
      label: "Internal links",
      value: `${averageLinks} avg. fixture links`,
      recommendation:
        "Evaluate destination usefulness and placement, not raw link count.",
    },
    {
      label: "Structured help",
      value: `${structuredRecords}/${sampleSize} use FAQ or timeline metadata`,
      recommendation:
        "Use a timeline or FAQ only when chronology or recurring questions warrant it.",
    },
    {
      label: "Commercial layout",
      value: `${lowAdRecords}/${sampleSize} low-or-no-ad fixtures`,
      recommendation:
        "Protect reading continuity and measure viewability without crowding content.",
    },
  ];
  return (
    <section className="pattern-analysis" aria-labelledby="pattern-analysis-heading">
      <div>
        <span>DERIVED PATTERNS</span>
        <h3 id="pattern-analysis-heading">Actionable questions, not copied formulas</h3>
        <p>
          These observations describe only the synthetic sample. They do not
          establish what performs best on the internet.
        </p>
      </div>
      <div>
        {patterns.map((pattern) => (
          <article key={pattern.label}>
            <span>{pattern.label}</span>
            <strong>{pattern.value}</strong>
            <p>{pattern.recommendation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HeadlineLab({ model }: { model: IntelligenceDemoViewModel }) {
  const [strategy, setStrategy] = useState<HeadlineStrategy | "ALL">("ALL");
  const strategies = Array.from(
    new Set(model.headlines.map((headline) => headline.strategy)),
  );
  const headlines = model.headlines.filter(
    (headline) => strategy === "ALL" || headline.strategy === strategy,
  );
  return (
    <>
      <section className="intelligence-callout" aria-labelledby="headline-brief-heading">
        <div>
          <Sparkles aria-hidden="true" />
          <div>
            <span>MAJOR STORY EXERCISE</span>
            <h2 id="headline-brief-heading">24 truthful candidates, one human decision</h2>
            <p>
              Fictional brief: a regional utility commission outlines a grid
              resilience proposal. Scores compare this candidate set only and
              never predict clicks.
            </p>
          </div>
        </div>
        <StatusPill tone="info">Protected heuristics</StatusPill>
      </section>
      <section className="newsroom-panel intelligence-table-panel">
        <div className="intelligence-inline-filter">
          <label htmlFor="headline-strategy">Strategy</label>
          <select
            id="headline-strategy"
            onChange={(event) =>
              setStrategy(event.target.value as HeadlineStrategy | "ALL")
            }
            value={strategy}
          >
            <option value="ALL">All strategies</option>
            {strategies.map((item) => (
              <option key={item} value={item}>
                {humanize(item)}
              </option>
            ))}
          </select>
          <span aria-live="polite">
            {headlines.length} of {model.headlines.length} candidates
          </span>
        </div>
        <div className="headline-candidate-list">
          {headlines.map((headline) => (
            <article
              className={headline.hardRejectReason ? "is-rejected" : undefined}
              key={headline.id}
            >
              <div>
                <StatusPill tone={headline.hardRejectReason ? "danger" : "info"}>
                  {headline.hardRejectReason ? "Hard reject" : humanize(headline.strategy)}
                </StatusPill>
                <span>Internal score {headline.internalScore}/100</span>
              </div>
              <h3>{headline.text}</h3>
              {headline.hardRejectReason ? (
                <p>
                  <CircleAlert aria-hidden="true" />
                  {headline.hardRejectReason}
                </p>
              ) : (
                <dl>
                  <div><dt>Clarity</dt><dd>{headline.clarity}</dd></div>
                  <div><dt>Specificity</dt><dd>{headline.specificity}</dd></div>
                  <div><dt>Accuracy</dt><dd>{headline.accuracy}</dd></div>
                  <div><dt>Usefulness</dt><dd>{headline.usefulness}</dd></div>
                </dl>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="intelligence-disabled-test" aria-labelledby="headline-test-heading">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h2 id="headline-test-heading">Truthful headline experiments</h2>
          <p>
            No traffic system is connected, so the demo does not name a winner
            or invent uplift. A production experiment must pre-register
            variants, allocation, metric, minimum sample, stop rule, and safety
            review.
          </p>
        </div>
        <button disabled type="button">Experiment unavailable</button>
      </section>
    </>
  );
}

function Formats({ model }: { model: IntelligenceDemoViewModel }) {
  return (
    <>
      <section className="intelligence-callout">
        <div>
          <FileText aria-hidden="true" />
          <div>
            <span>ADAPTIVE DEPTH</span>
            <h2>Match article depth to verified scope</h2>
            <p>
              Word ranges are guardrails, not quotas. The no-padding rule wins
              whenever the evidence can be explained more briefly.
            </p>
          </div>
        </div>
      </section>
      <section className="format-card-grid" aria-label="Article format guidance">
        {model.formats.map((format) => (
          <article key={format.format}>
            <div>
              <StatusPill tone="info">{humanize(format.format)}</StatusPill>
              <strong>
                {format.targetWords
                  ? `${format.targetWords[0]}–${format.targetWords[1]} words`
                  : "Continuous verified updates"}
              </strong>
            </div>
            <h2>{format.rationale}</h2>
            <p>{format.noPaddingRule}</p>
            <span>
              <CheckCircle2 aria-hidden="true" />
              Human editor chooses the final depth
            </span>
          </article>
        ))}
      </section>
    </>
  );
}

function Publishers({ model }: { model: IntelligenceDemoViewModel }) {
  const total = model.publishers.reduce(
    (sum, publisher) => sum + publisher.sampleRecordCount,
    0,
  );
  return (
    <section className="newsroom-panel intelligence-table-panel" aria-labelledby="publisher-heading">
      <div className="panel-heading">
        <div>
          <span>CONFIGURABLE SOURCE SHAPES</span>
          <h2 id="publisher-heading">Publisher coverage</h2>
        </div>
        <StatusPill tone="warning">Not connected</StatusPill>
      </div>
      <div className="intelligence-panel-note">
        <ShieldCheck aria-hidden="true" />
        <p>
          These are fictional connector configurations, not claims of a
          commercial relationship. A production connector may ingest public
          metadata and permitted excerpts only—never bypass a paywall or copy
          article bodies. The sample allocates {total} synthetic records across
          these shapes.
        </p>
      </div>
      <div className="publisher-card-grid">
        {model.publishers.map((publisher) => (
          <article key={publisher.id}>
            <div>
              <Building2 aria-hidden="true" />
              <StatusPill>{humanize(publisher.sourceFamily)}</StatusPill>
            </div>
            <h3>{publisher.label}</h3>
            <p>
              <MapPin aria-hidden="true" />
              {publisher.geography}
            </p>
            <dl>
              <div>
                <dt>Demo allocation</dt>
                <dd>{publisher.sampleRecordCount} metadata records</dd>
              </div>
              <div>
                <dt>Rights boundary</dt>
                <dd>Links + derived public metadata only</dd>
              </div>
              <div>
                <dt>Schedule</dt>
                <dd>{publisher.schedule}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="connector-registry-heading">
        <span>COLLECTION FOUNDATION</span>
        <h3>Configurable intelligence connectors</h3>
        <p>
          All connectors are disabled until credentials, terms, robots,
          licensing, retention, quotas, and budget controls are verified.
        </p>
      </div>
      <div className="connector-registry-list">
        {model.connectors.map((connector) => (
          <article key={connector.id}>
            <div>
              <strong>{connector.label}</strong>
              <StatusPill tone="warning">Not configured</StatusPill>
            </div>
            <p>{connector.dataBoundary}</p>
            <dl>
              <div>
                <dt>Terms boundary</dt>
                <dd>{connector.termsBoundary}</dd>
              </div>
              <div>
                <dt>Refresh class</dt>
                <dd>{humanize(connector.refreshClass)}</dd>
              </div>
              <div>
                <dt>Credential</dt>
                <dd>{connector.requiresCredential ? "Required" : "Provider dependent"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function Opportunities({ model }: { model: IntelligenceDemoViewModel }) {
  return (
    <>
      <section className="intelligence-callout">
        <div>
          <Lightbulb aria-hidden="true" />
          <div>
            <span>EXPLAINABLE TRIAGE</span>
            <h2>Story Opportunity engine</h2>
            <p>
              Protected scores combine evidence, reader relevance, momentum,
              distinctiveness, feasibility, and risk. They suggest a reporting
              state; they cannot create or publish an article.
            </p>
          </div>
        </div>
        <StatusPill tone="warning">Internal only</StatusPill>
      </section>
      <section className="opportunity-list" aria-label="Fictional story opportunities">
        {model.opportunities.map((opportunity) => (
          <article key={opportunity.id}>
            <header>
              <div>
                <StatusPill
                  tone={
                    opportunity.state === "REJECT"
                      ? "danger"
                      : opportunity.state === "WATCH" ||
                          opportunity.state === "RESEARCH"
                        ? "warning"
                        : "info"
                  }
                >
                  {humanize(opportunity.state)}
                </StatusPill>
                <span>Protected score {opportunity.internalScore}/100</span>
              </div>
              <h2>{opportunity.topic}</h2>
              <p>
                Recommended shape: {humanize(opportunity.recommendedFormat)}
              </p>
            </header>
            <div>
              <section>
                <h3>Why it reached this state</h3>
                <ul>
                  {opportunity.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>Reporting cautions</h3>
                <ul>
                  {opportunity.cautions.map((caution) => (
                    <li key={caution}>{caution}</li>
                  ))}
                </ul>
              </section>
            </div>
            <footer>
              <span>Demo decision only · no workflow write occurred</span>
              <Link href="/newsroom/research">
                Open research desk <ArrowRight aria-hidden="true" />
              </Link>
            </footer>
          </article>
        ))}
      </section>
    </>
  );
}

function KnowledgeGraph({ model }: { model: IntelligenceDemoViewModel }) {
  const storyById = new Map(model.stories.map((story) => [story.id, story]));
  return (
    <section className="newsroom-panel intelligence-graph" aria-labelledby="knowledge-graph-heading">
      <div className="panel-heading">
        <div>
          <span>ENTITY + LINK FOUNDATION</span>
          <h2 id="knowledge-graph-heading">Knowledge graph suggestions</h2>
        </div>
        <StatusPill tone="info">Human review</StatusPill>
      </div>
      <div className="intelligence-graph-grid">
        <div>
          <h3>Entity context</h3>
          <p>
            Select an entity for accessible context. Production hover cards
            must provide the same content on focus and touch.
          </p>
          <div className="entity-disclosures">
            {model.entities.map((entity) => (
              <details key={entity.id}>
                <summary>
                  {entity.label} <span>{humanize(entity.type)}</span>
                </summary>
                <p>{entity.context}</p>
              </details>
            ))}
          </div>
        </div>
        <div>
          <h3>Suggested internal links</h3>
          <p>
            Insert at the first useful mention, not the first possible mention.
            Editorial guideline: 3–6 useful links per 1,000 words.
          </p>
          <ol className="link-suggestion-list">
            {model.linkSuggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <Link2 aria-hidden="true" />
                <div>
                  <strong>
                    “{suggestion.anchorText}” →{" "}
                    {storyById.get(suggestion.targetStoryId)?.title}
                  </strong>
                  <span>{suggestion.insertionContext}</span>
                  <small>
                    {suggestion.confidence}% fixture confidence ·{" "}
                    {suggestion.reasons.join(" ")}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <article>
      <div>
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function TrendFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}
