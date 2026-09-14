/**
 * One-off audit of every published article.
 *
 * Reads the export produced by `wrangler d1 execute ... --json` and reports, per
 * article: whether the lede anchors the story in a materially older period, and
 * whether the hero image can be tied to the article's subject at all.
 *
 * The recency logic is deliberately a copy of `lib/editorial/event-recency.ts`
 * rather than an import, because this script runs under plain node against a
 * JSON dump and the production module is TypeScript. The two must be kept in
 * step; the tests in tests/editorial/event-recency.test.ts are the reference.
 */
import { readFileSync } from "node:fs";

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const ANCHOR = new RegExp(
  String.raw`\b(?:in|on|during|back in|throughout|since|as of|ahead of|following|after)\s+` +
    String.raw`(?:the\s+)?` +
    String.raw`(?:(january|february|march|april|may|june|july|august|september|october|november|december)\s+)?` +
    String.raw`((?:19|20)\d{2})\b`,
  "giu",
);
const QUALIFIED = new RegExp(
  String.raw`\b((?:19|20)\d{2})\s+(?:season|campaign|spring training|draft|playoffs|tournament|championship|series|olympics|world cup)\b`,
  "giu",
);

function detectEventRecency(body, publishedAt, maximumAgeMonths = 6) {
  const lede = body.slice(0, 700).toLowerCase();
  let year, month;
  const consider = (y, m) => {
    if (year === undefined || y > year) { year = y; month = m; return; }
    if (y === year && m !== undefined && (month === undefined || m > month)) month = m;
  };
  for (const m of lede.matchAll(ANCHOR)) consider(Number(m[2]), m[1] ? MONTHS[m[1]] : undefined);
  for (const m of lede.matchAll(QUALIFIED)) consider(Number(m[1]));
  if (year === undefined) return { stale: false };
  const py = publishedAt.getUTCFullYear();
  const pm = publishedAt.getUTCMonth() + 1;
  const effective = month ?? (year < py ? 12 : pm);
  const monthsBehind = (py - year) * 12 + (pm - effective);
  return { stale: monthsBehind > maximumAgeMonths, anchorYear: year, anchorMonth: month, monthsBehind };
}

const STOP = new Set(["the","and","for","with","from","that","this","its","his","her","their","new","how","why","what","when","are","was","were","has","have","will","into","over","after","before","amid","against","as","at","by","in","of","on","to","a","an"]);
const terms = (v) => v.replaceAll(/[^\p{L}\p{N}\s-]+/gu, " ").split(/\s+/u)
  .map((w) => w.trim().toLowerCase())
  .filter((w) => w.length >= 3 && !STOP.has(w) && !/^(?:19|20)\d{2}$/u.test(w));

const raw = readFileSync(process.argv[2], "utf8");
const rows = JSON.parse(raw.slice(raw.indexOf("[")))[0].results;

// Collapse duplicate HERO rows so each article is judged once.
const byId = new Map();
for (const r of rows) {
  if (!byId.has(r.id)) byId.set(r.id, { ...r, heroes: [] });
  if (r.img) byId.get(r.id).heroes.push({ url: r.img, alt: r.img_alt, license: r.img_license });
}
const articles = [...byId.values()];

const now = new Date("2026-08-17T07:00:00Z");
const stale = [];
const mismatched = [];
const noRealPhoto = [];
const multipleHeroes = [];

for (const a of articles) {
  let lede = a.lede || "";
  try {
    const parsed = JSON.parse(a.lede.endsWith("]") ? a.lede : a.lede + '"]}]');
    lede = parsed.flatMap((s) => s.paragraphs || []).join(" ");
  } catch { lede = a.lede.replace(/[{}\[\]"]/g, " ").replace(/heading|paragraphs/g, " "); }

  const rec = detectEventRecency(lede, now);
  if (rec.stale) stale.push({ slug: a.slug, headline: a.headline, anchor: `${rec.anchorMonth ?? "?"}/${rec.anchorYear}`, monthsBehind: rec.monthsBehind });

  if (a.heroes.length > 1) multipleHeroes.push({ slug: a.slug, count: a.heroes.length });

  const hero = a.heroes[0];
  if (!hero) { noRealPhoto.push({ slug: a.slug, why: "no hero" }); continue; }
  if (hero.license === "AI_GENERATED" || hero.url.includes("/story-image/")) {
    noRealPhoto.push({ slug: a.slug, why: hero.license === "AI_GENERATED" ? "AI illustration" : "SVG placeholder" });
    continue;
  }
  // Does the alt text share two meaningful terms with the headline?
  const headTerms = new Set(terms(a.headline));
  const altTerms = terms(hero.alt || "");
  const overlap = altTerms.filter((t) => headTerms.has(t)).length;
  if (overlap < 2) mismatched.push({ slug: a.slug, headline: a.headline.slice(0, 60), alt: hero.alt, overlap });
}

const pct = (n) => `${n} / ${articles.length} (${Math.round((n / articles.length) * 100)}%)`;
console.log(`\n=== AUDIT: ${articles.length} published articles ===\n`);
console.log(`Stale lede (event older than 6 months): ${pct(stale.length)}`);
console.log(`Hero image cannot be tied to headline:  ${pct(mismatched.length)}`);
console.log(`No real photograph (AI / placeholder):  ${pct(noRealPhoto.length)}`);
console.log(`Multiple HERO images on live version:   ${pct(multipleHeroes.length)}`);

console.log(`\n--- STALE LEDE (${stale.length}) ---`);
for (const s of stale.sort((a, b) => b.monthsBehind - a.monthsBehind)) {
  console.log(`  [${String(s.monthsBehind).padStart(3)}mo behind, anchor ${s.anchor}] ${s.slug}`);
}
console.log(`\n--- HERO IMAGE MISMATCH (${mismatched.length}) ---`);
for (const m of mismatched) console.log(`  overlap=${m.overlap} alt="${m.alt}" <- ${m.slug}`);
console.log(`\n--- NO REAL PHOTO (${noRealPhoto.length}) ---`);
for (const n of noRealPhoto) console.log(`  ${n.why}: ${n.slug}`);
