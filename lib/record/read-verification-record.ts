import { getD1Binding } from "@/db";

/**
 * Northline's own verification record, read from the newsroom's live tables.
 *
 * Every outlet publishes what it decided to run. Almost none publish what they
 * decided not to. This is the one dataset Northline has that exists nowhere
 * else, and it is the site's stated thesis made checkable: if the claim is that
 * sourcing decides publication, the record of refusals is the evidence for it.
 *
 * Nothing here is estimated or rounded up. If a number would flatter the
 * newsroom it is still the number in the table.
 */

export type VerificationRecord = {
  /** Every article the newsroom has ever drafted, by outcome. */
  outcomes: { state: string; label: string; count: number }[];
  drafted: number;
  published: number;
  /** Live source citations. */
  citations: number;
  citationsPerArticle: number;
  byRelationship: { relationship: string; count: number }[];
  byTier: { tier: number; count: number }[];
  mostCited: { name: string; citations: number }[];
  /** When these figures were read. */
  measuredAtIso: string;
};

const OUTCOME_LABELS: Readonly<Record<string, string>> = {
  PUBLISHED: "Published",
  REJECTED_EARLY: "Refused before drafting",
  HUMAN_REVIEW_REQUIRED: "Held for a person",
  RETRACTED: "Retracted after publication",
  DRAFTING: "Still drafting",
  APPROVED: "Approved, not yet released",
};

export async function readVerificationRecord(): Promise<VerificationRecord> {
  const db = await getD1Binding();

  const [outcomeRows, citationRow, relationshipRows, tierRows, citedRows] =
    await Promise.all([
      db
        .prepare(
          `SELECT state, COUNT(*) AS count FROM articles
           GROUP BY state ORDER BY count DESC`,
        )
        .all<{ state: string; count: number }>(),
      db
        .prepare(
          `SELECT COUNT(DISTINCT a.id) AS articles, COUNT(l.id) AS citations
             FROM articles a
             JOIN article_source_links l ON l.article_version_id = a.current_version_id
            WHERE a.state = 'PUBLISHED'`,
        )
        .first<{ articles: number; citations: number }>(),
      db
        .prepare(
          `SELECT l.relationship, COUNT(*) AS count
             FROM articles a
             JOIN article_source_links l ON l.article_version_id = a.current_version_id
            WHERE a.state = 'PUBLISHED'
            GROUP BY l.relationship ORDER BY count DESC`,
        )
        .all<{ relationship: string; count: number }>(),
      db
        .prepare(
          `SELECT s.credibility_tier AS tier, COUNT(*) AS count
             FROM articles a
             JOIN article_source_links l ON l.article_version_id = a.current_version_id
             JOIN sources s ON s.id = l.source_id
            WHERE a.state = 'PUBLISHED'
            GROUP BY s.credibility_tier ORDER BY tier`,
        )
        .all<{ tier: number; count: number }>(),
      db
        .prepare(
          `SELECT s.name, COUNT(*) AS citations
             FROM articles a
             JOIN article_source_links l ON l.article_version_id = a.current_version_id
             JOIN sources s ON s.id = l.source_id
            WHERE a.state = 'PUBLISHED'
            GROUP BY s.name ORDER BY citations DESC LIMIT 8`,
        )
        .all<{ name: string; citations: number }>(),
    ]);

  const outcomes = (outcomeRows.results ?? []).map((row) => ({
    state: row.state,
    label: OUTCOME_LABELS[row.state] ?? row.state,
    count: Number(row.count),
  }));

  const drafted = outcomes.reduce((total, row) => total + row.count, 0);
  const published =
    outcomes.find((row) => row.state === "PUBLISHED")?.count ?? 0;
  const articles = Number(citationRow?.articles ?? 0);
  const citations = Number(citationRow?.citations ?? 0);

  return {
    outcomes,
    drafted,
    published,
    citations,
    // One decimal, and never presented as more precise than that.
    citationsPerArticle: articles
      ? Math.round((citations / articles) * 10) / 10
      : 0,
    byRelationship: (relationshipRows.results ?? []).map((row) => ({
      relationship: row.relationship,
      count: Number(row.count),
    })),
    byTier: (tierRows.results ?? []).map((row) => ({
      tier: Number(row.tier),
      count: Number(row.count),
    })),
    mostCited: (citedRows.results ?? []).map((row) => ({
      name: row.name,
      citations: Number(row.citations),
    })),
    measuredAtIso: new Date().toISOString(),
  };
}
