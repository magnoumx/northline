import Link from "next/link";
import { getBrandConfig } from "@/lib/brand/config";

export default function NotFound() {
  const brand = getBrandConfig();
  return (
    <main className="system-state">
      {/* A 404 was served "index, follow". vinext ignores `metadata` exported
          from not-found, so the tag is rendered here and React hoists it into
          the head; where two robots tags disagree, Google applies the stricter. */}
      <meta name="robots" content="noindex, follow" />
      <Link className="system-state__brand" href="/">
        {brand.name}
      </Link>
      <div>
        <span>404</span>
        <h1>We could not trace that page.</h1>
        <p>
          The address may have changed, the story may have been removed, or the
          page may not be available in this edition.
        </p>
        <form action="/search">
          <input
            name="q"
            placeholder={`Search ${brand.name}`}
            aria-label={`Search ${brand.name}`}
          />
          <button type="submit">Search</button>
        </form>
        <Link href="/">Return to today’s briefing</Link>
      </div>
    </main>
  );
}
