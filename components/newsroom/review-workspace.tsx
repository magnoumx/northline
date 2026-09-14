"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, StatusPill } from "./primitives";
import { ProductionDeskState } from "./production-desk-state";
import { useNewsroomSession } from "./session";

const reviewAreas = [
  { label: "Facts", passed: 11, open: 1 },
  { label: "Sources", passed: 7, open: 0 },
  { label: "Legal risk", passed: 3, open: 1 },
  { label: "Media rights", passed: 4, open: 0 },
  { label: "SEO", passed: 8, open: 2 },
  { label: "Accessibility", passed: 9, open: 0 },
] as const;

const factChecks = [
  {
    claim: "Five neighborhoods are participating in the two-week pilot.",
    state: "Verified by primary source",
    sources: "Operating bulletin · Commissioning record",
    blocker: false,
  },
  {
    claim:
      "Four sites recorded lower evening demand during the first two activations.",
    state: "Partially verified",
    sources: "Operating bulletin only",
    blocker: true,
  },
  {
    claim: "The fifth site held energy for a cooling center.",
    state: "Verified",
    sources: "Operating bulletin · Operator note",
    blocker: false,
  },
] as const;

export function ReviewWorkspace() {
  const session = useNewsroomSession();
  const [selected, setSelected] = useState("Facts");
  if (!session.demoMode) {
    return (
      <ProductionDeskState
        activePath="/newsroom/review"
        eyebrow="FINAL REVIEW"
        title="Human publication review"
        description="Production decisions appear only after a database draft enters the review workflow."
        primaryHref="/newsroom/editor"
        primaryLabel="Open article editor"
        secondaryHref="/newsroom/audit"
        secondaryLabel="View audit log"
      />
    );
  }
  const selectedArea =
    reviewAreas.find((area) => area.label === selected) ?? reviewAreas[0];

  return (
    <NewsroomFrame activePath="/newsroom/review">
      <div className="review-workspace">
        <header className="review-header">
          <div>
            <Link href="/newsroom" aria-label="Return to newsroom dashboard">
              <ArrowLeft aria-hidden="true" />
            </Link>
            <div>
              <span>FINAL REVIEW · FICTIONAL DEMO</span>
              <h1>Neighborhood batteries get their first real test</h1>
            </div>
          </div>
          <StatusPill tone="warning">Medium editorial risk</StatusPill>
        </header>

        <NewsroomNotice tone="warning">
          <strong>Review decisions are read-only.</strong>
          <span>
            This route demonstrates review gates but cannot request revisions,
            approve, publish, or write to an audit log.
          </span>
        </NewsroomNotice>

        <div className="review-layout">
          <aside className="review-nav">
            <p>REVIEW AREAS</p>
            {reviewAreas.map((area) => (
              <button
                aria-pressed={selected === area.label}
                className={[
                  selected === area.label ? "active" : "",
                  area.open > 0 ? "has-issues" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                onClick={() => setSelected(area.label)}
                key={area.label}
              >
                {area.open === 0 ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : (
                  <AlertTriangle aria-hidden="true" />
                )}
                <span>{area.label}</span>
                <small>
                  {area.open === 0 ? `${area.passed} passed` : `${area.open} open`}
                </small>
              </button>
            ))}
          </aside>

          <section className="review-center" aria-labelledby="review-area-title">
            <div className="review-center__head">
              <div>
                <p>REVIEW PANEL</p>
                <h2 id="review-area-title">{selectedArea.label}</h2>
              </div>
              <span>
                {selectedArea.passed} passed · {selectedArea.open} open
              </span>
            </div>
            {selected === "Facts" ? (
              <div className="fact-review-list">
                {factChecks.map((item, index) => (
                  <article className={item.blocker ? "issue" : undefined} key={item.claim}>
                    <div>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{item.claim}</p>
                      <StatusPill tone={item.blocker ? "warning" : "success"}>
                        {item.state}
                      </StatusPill>
                    </div>
                    <p className="fact-review-list__sources">
                      <FileText aria-hidden="true" /> {item.sources}
                    </p>
                    {item.blocker ? (
                      <div className="review-blocker">
                        <ShieldAlert aria-hidden="true" />
                        <p>
                          <strong>Publication blocker</strong>
                          A central claim has one supporting record and no
                          independent confirmation.
                        </p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="review-summary">
                {selectedArea.open === 0 ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : (
                  <AlertTriangle aria-hidden="true" />
                )}
                <h3>
                  {selectedArea.open === 0
                    ? `${selectedArea.label} checks passed`
                    : `${selectedArea.open} ${selectedArea.label.toLowerCase()} item needs attention`}
                </h3>
                <p>
                  These are fixed fictional review results. There is no
                  production rule engine attached to this preview.
                </p>
              </div>
            )}
          </section>

          <aside className="review-preview">
            <div>
              <span>ARTICLE PREVIEW</span>
              <Link href="/story/neighborhood-batteries-heat-grid" target="_blank">
                Open public demo <ExternalLink aria-hidden="true" />
              </Link>
            </div>
            <article>
              <p>SCIENCE · ENERGY</p>
              <h2>
                Neighborhood batteries get their first real test during a week
                of extreme heat
              </h2>
              <span>
                Five pilot communities are measuring whether shared storage can
                cut peak demand.
              </span>
            </article>
            <div className="review-decision-state">
              <ShieldAlert aria-hidden="true" />
              <p>
                <strong>Decision unavailable</strong>
                Resolve the central claim in a production review system before
                approval can be recorded.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </NewsroomFrame>
  );
}
