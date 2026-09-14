import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { RecordScrollytelling } from "@/components/record/record-scrollytelling";
import { readVerificationRecord } from "@/lib/record/read-verification-record";
import { resolveSiteOrigin } from "@/lib/site/origin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TITLE = "What Northline Didn't Publish";
const DESCRIPTION =
  "Every article this newsroom has drafted, including the ones refused before a reader ever saw them. Figures read live from the publication record.";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await resolveSiteOrigin();
  return {
    title: { absolute: `${TITLE} · Northline` },
    description: DESCRIPTION,
    alternates: { canonical: "/record" },
    openGraph: {
      type: "article",
      url: `${origin}/record`,
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

const RELATIONSHIP_COPY: Readonly<Record<string, string>> = {
  PRIMARY: "First-party — an official statement, filing, or release",
  INDEPENDENT: "Independent newsroom reporting the same event",
  CONTEXT: "Background that frames the story without establishing it",
  CONTRADICTS: "Material that disputes a claim in the story",
};

const TIER_COPY: Readonly<Record<number, string>> = {
  1: "Official record and first-party publication",
  2: "Established newsroom with editorial accountability",
  3: "Reported coverage used for corroboration",
  4: "Everything else, used only for context",
};

export default async function RecordPage() {
  const record = await readVerificationRecord();
  const refused = record.drafted - record.published;
  const maxOutcome = Math.max(...record.outcomes.map((row) => row.count), 1);
  const maxTier = Math.max(...record.byTier.map((row) => row.count), 1);
  const maxCited = Math.max(...record.mostCited.map((row) => row.citations), 1);

  return (
    <PageShell>
      <RecordScrollytelling>
        <header className="record__open">
          <p className="record__eyebrow">The verification record</p>
          <h1>{TITLE}</h1>
          <p className="record__lede">
            Every newsroom publishes what it decided to run. This is the other
            half of that decision. Each figure below is read from Northline&rsquo;s
            publication tables when this page loads — nothing is averaged,
            projected, or rounded in the newsroom&rsquo;s favour.
          </p>
        </header>

        <section className="record__headline-figure" aria-labelledby="funnel-title">
          <h2 id="funnel-title" className="visually-hidden">
            Outcomes for every article drafted
          </h2>
          <p className="record__big" data-rise>
            <span>{refused}</span> of {record.drafted} drafts never reached a
            reader.
          </p>
          <ul className="record__bars">
            {record.outcomes.map((outcome) => (
              <li key={outcome.state}>
                <span className="record__bar-label">{outcome.label}</span>
                <span className="record__bar-track">
                  <span
                    className={`record__bar record__bar--${outcome.state.toLowerCase()}`}
                    style={{ width: `${(outcome.count / maxOutcome) * 100}%` }}
                    data-grow
                  />
                </span>
                <span className="record__bar-value">
                  {outcome.count}
                  <small>{percent(outcome.count, record.drafted)}%</small>
                </span>
              </li>
            ))}
          </ul>
          <p className="record__note" data-rise>
            A refusal is not a failure of the story. It means the evidence
            required to publish it was not found, so it was not published.
          </p>
        </section>

        <section className="record__section" aria-labelledby="evidence-title">
          <h2 id="evidence-title" data-rise>
            What backs the {record.published} that did
          </h2>
          <p className="record__lede" data-rise>
            {record.citations} citations across {record.published} live
            articles — an average of {record.citationsPerArticle} per story.
            Every one is listed on the article it supports.
          </p>
          <ul className="record__definitions">
            {record.byRelationship.map((row) => (
              <li key={row.relationship} data-rise>
                <span className="record__kind">{row.relationship}</span>
                <span className="record__count">{row.count}</span>
                <span className="record__meaning">
                  {RELATIONSHIP_COPY[row.relationship] ?? row.relationship}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="record__section" aria-labelledby="tier-title">
          <h2 id="tier-title" data-rise>
            How far each citation sits from the event
          </h2>
          <ul className="record__bars record__bars--tier">
            {record.byTier.map((row) => (
              <li key={row.tier}>
                <span className="record__bar-label">
                  Tier {row.tier}
                  <small>{TIER_COPY[row.tier] ?? "Unclassified"}</small>
                </span>
                <span className="record__bar-track">
                  <span
                    className="record__bar record__bar--tier"
                    style={{ width: `${(row.count / maxTier) * 100}%` }}
                    data-grow
                  />
                </span>
                <span className="record__bar-value">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="record__section" aria-labelledby="cited-title">
          <h2 id="cited-title" data-rise>
            Who Northline cites most
          </h2>
          <ul className="record__bars record__bars--cited">
            {record.mostCited.map((row) => (
              <li key={row.name}>
                <span className="record__bar-label">{row.name}</span>
                <span className="record__bar-track">
                  <span
                    className="record__bar record__bar--cited"
                    style={{ width: `${(row.citations / maxCited) * 100}%` }}
                    data-grow
                  />
                </span>
                <span className="record__bar-value">{row.citations}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="record__close" aria-labelledby="close-title">
          <h2 id="close-title" data-rise>
            Read this page again tomorrow
          </h2>
          <p data-rise>
            The figures are queried live, so they move as the newsroom works.
            Retractions stay in the count permanently — an article withdrawn is
            part of the record, not removed from it.
          </p>
          <p className="record__measured" data-rise>
            Measured{" "}
            <time dateTime={record.measuredAtIso}>
              {new Date(record.measuredAtIso).toUTCString()}
            </time>
          </p>
        </section>
      </RecordScrollytelling>
    </PageShell>
  );
}
