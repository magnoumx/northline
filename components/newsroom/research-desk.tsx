"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { NewsroomFrame } from "./frame";
import { NewsroomNotice, StatusPill, WorkspaceHeading } from "./primitives";
import { ProductionDeskState } from "./production-desk-state";
import { useNewsroomSession } from "./session";

const sourceRecords = [
  {
    tier: "T1",
    name: "Lake Union Energy Cooperative",
    kind: "Primary",
    note: "Operating bulletin",
    state: "Verified",
  },
  {
    tier: "T1",
    name: "Regional Safety Commission",
    kind: "Primary",
    note: "Commissioning record",
    state: "Verified",
  },
  {
    tier: "T2",
    name: "Distributed Energy Review",
    kind: "Independent",
    note: "Technical analysis",
    state: "Verified",
  },
  {
    tier: "T2",
    name: "Metro Public Radio",
    kind: "Independent",
    note: "On-site reporting",
    state: "Needs review",
  },
] as const;

const claims = [
  {
    claim: "Five neighborhoods are participating in the pilot.",
    state: "Verified by primary source",
    support: "2 supporting records",
    central: true,
  },
  {
    claim: "Batteries discharge between 5 p.m. and 9 p.m.",
    state: "Verified",
    support: "3 supporting records",
    central: true,
  },
  {
    claim: "Four sites showed lower evening demand.",
    state: "Partially verified",
    support: "1 supporting record",
    central: true,
  },
  {
    claim: "The program will lower household bills.",
    state: "Unverified",
    support: "No supporting records",
    central: false,
  },
] as const;

export function ResearchDesk() {
  const session = useNewsroomSession();
  if (!session.demoMode) {
    return (
      <ProductionDeskState
        activePath="/newsroom/research"
        eyebrow="RESEARCH DESK"
        title="Verified research dossiers"
        description="Build dossiers from approved sources, atomic claims, conflicts, and open questions."
        primaryHref="/newsroom/sources"
        primaryLabel="Manage sources"
        secondaryHref="/newsroom/editor"
        secondaryLabel="Open article editor"
      />
    );
  }
  return (
    <NewsroomFrame activePath="/newsroom/research">
      <div className="newsroom-content">
        <WorkspaceHeading
          eyebrow="STORY DOSSIER · FICTIONAL DEMO"
          title="Neighborhood battery pilots enter peak-demand test"
          description="A read-only dossier showing source, claim, and conflict boundaries."
          action={
            <Link className="button-primary" href="/newsroom/editor">
              Open local draft <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        <NewsroomNotice>
          <strong>Dossier writes are unavailable.</strong>
          <span>
            Sources and claims below are fictional product-preview data. Nothing
            on this page records a research decision.
          </span>
        </NewsroomNotice>

        <div className="research-layout">
          <div className="research-main">
            <section className="newsroom-panel" aria-labelledby="dossier-sources">
              <div className="panel-heading">
                <div>
                  <span>EVIDENCE SET</span>
                  <h2 id="dossier-sources">Sources</h2>
                </div>
                <span>{sourceRecords.length} demo records</span>
              </div>
              <ul className="research-records">
                {sourceRecords.map((source) => (
                  <li key={source.name}>
                    <span className="source-tier-badge">{source.tier}</span>
                    <div>
                      <strong>{source.name}</strong>
                      <span>
                        {source.kind} · {source.note}
                      </span>
                    </div>
                    <StatusPill
                      tone={source.state === "Verified" ? "success" : "warning"}
                    >
                      {source.state}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            </section>

            <section className="newsroom-panel" aria-labelledby="dossier-claims">
              <div className="panel-heading">
                <div>
                  <span>ATOMIC FACTS</span>
                  <h2 id="dossier-claims">Extracted claims</h2>
                </div>
                <StatusPill tone="warning">2 need attention</StatusPill>
              </div>
              <ul className="claim-records">
                {claims.map((item) => {
                  const isVerified = item.state.startsWith("Verified");
                  return (
                    <li key={item.claim}>
                      <span
                        className={
                          isVerified
                            ? "claim-records__icon is-verified"
                            : "claim-records__icon"
                        }
                      >
                        {isVerified ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <AlertTriangle aria-hidden="true" />
                        )}
                      </span>
                      <div>
                        <p>{item.claim}</p>
                        <span>
                          {item.state} · {item.support}
                        </span>
                      </div>
                      {item.central ? (
                        <StatusPill tone="info">Central</StatusPill>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <aside className="research-aside" aria-label="Research gates">
            <section className="newsroom-panel compact-panel">
              <AlertTriangle aria-hidden="true" />
              <h2>Missing information</h2>
              <ul>
                <li>Final household cost allocation</li>
                <li>Independent multi-day performance</li>
              </ul>
            </section>
            <section className="newsroom-panel compact-panel">
              <FileText aria-hidden="true" />
              <h2>Source conflict</h2>
              <p>
                Peak reduction differs by 3.2 points because two fictional
                records use different comparison windows.
              </p>
            </section>
            <section className="newsroom-panel compact-panel">
              <ShieldCheck aria-hidden="true" />
              <h2>Research gate</h2>
              <p>
                Publication remains blocked until the partially verified central
                claim is resolved or qualified.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </NewsroomFrame>
  );
}
