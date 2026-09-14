import Link from "next/link";

/**
 * Shown where an Intelligence view has no live implementation yet.
 *
 * These routes previously rendered a fixture view model in production: 120
 * fictional records with invented publishers, audience totals and rankings, and
 * nothing on screen to say so. An operator reading that page could not tell
 * which numbers were real, and none of them were.
 *
 * An empty state that names what is missing is more useful than a full page of
 * numbers that are not true.
 */
export function IntelligenceUnavailable({
  view,
  requires,
}: {
  view: string;
  requires: string;
}) {
  return (
    <section className="newsroom-empty" aria-labelledby="intel-unavailable">
      <p className="newsroom-empty__eyebrow">Not available</p>
      <h1 id="intel-unavailable">{view} is not measured yet</h1>
      <p>{requires}</p>
      <p>
        This view previously displayed sample data. It now shows nothing rather
        than presenting figures that were never measured.
      </p>
      <Link href="/newsroom/intelligence">Back to the live overview</Link>
    </section>
  );
}
