/**
 * Generates the remediation SQL from the audit export.
 *
 * Two separate corrections, and the order between them matters:
 *
 *  1. Articles whose lede narrates an event far older than their publication
 *     date are retracted. A contract signed in July 2024 cannot be edited into
 *     August 2026 news; the only honest options were retraction or re-dating,
 *     and retraction was chosen.
 *
 *  2. Articles whose hero image cannot be tied to their subject get a new
 *     version with no hero attached, falling back to the house graphic. Media
 *     links on a published version are immutable by design, so this has to be a
 *     revision rather than an update - and the source links must be copied onto
 *     the new version before it is frozen, or the article would render as
 *     sourced while carrying no evidence.
 *
 * Articles in both sets are only retracted; there is no point revising the
 * imagery of something being withdrawn.
 */
import { readFileSync, writeFileSync } from "node:fs";

const MONTHS = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };
const ANCHOR = new RegExp(
  String.raw`\b(?:in|on|during|back in|throughout|since|as of|ahead of|following|after)\s+(?:the\s+)?` +
  String.raw`(?:(january|february|march|april|may|june|july|august|september|october|november|december)\s+)?((?:19|20)\d{2})\b`, "giu");
const QUALIFIED = new RegExp(
  String.raw`\b((?:19|20)\d{2})\s+(?:season|campaign|spring training|draft|playoffs|tournament|championship|series|olympics|world cup)\b`, "giu");

function recency(body, now, maxMonths = 6) {
  const lede = body.slice(0, 700).toLowerCase();
  let year, month;
  const consider = (y, m) => {
    if (year === undefined || y > year) { year = y; month = m; return; }
    if (y === year && m !== undefined && (month === undefined || m > month)) month = m;
  };
  for (const m of lede.matchAll(ANCHOR)) consider(Number(m[2]), m[1] ? MONTHS[m[1]] : undefined);
  for (const m of lede.matchAll(QUALIFIED)) consider(Number(m[1]));
  if (year === undefined) return { stale: false };
  const py = now.getUTCFullYear(), pm = now.getUTCMonth() + 1;
  const eff = month ?? (year < py ? 12 : pm);
  return { stale: (py - year) * 12 + (pm - eff) > maxMonths, year, month };
}

const STOP = new Set(["the","and","for","with","from","that","this","its","his","her","their","new","how","why","what","when","are","was","were","has","have","will","into","over","after","before","amid","against","as","at","by","in","of","on","to","a","an"]);
const terms = (v) => v.replaceAll(/[^\p{L}\p{N}\s-]+/gu," ").split(/\s+/u)
  .map((w)=>w.trim().toLowerCase())
  .filter((w)=>w.length>=3 && !STOP.has(w) && !/^(?:19|20)\d{2}$/u.test(w));

const raw = readFileSync(process.argv[2], "utf8");
const rows = JSON.parse(raw.slice(raw.indexOf("[")))[0].results;

const byId = new Map();
for (const r of rows) {
  if (!byId.has(r.id)) byId.set(r.id, { ...r, heroes: [] });
  if (r.img) byId.get(r.id).heroes.push({ url: r.img, alt: r.img_alt, license: r.img_license });
}

const now = new Date("2026-08-17T07:00:00Z");
const retract = [];
const stripImage = [];

for (const a of byId.values()) {
  let lede = a.lede || "";
  try {
    lede = JSON.parse(a.lede.endsWith("]") ? a.lede : a.lede + '"]}]').flatMap((s)=>s.paragraphs||[]).join(" ");
  } catch { lede = a.lede.replace(/[{}\[\]"]/g," ").replace(/heading|paragraphs/g," "); }

  if (recency(lede, now).stale) { retract.push(a); continue; }

  const hero = a.heroes[0];
  if (!hero) continue;
  const isGenerated = hero.license === "AI_GENERATED" || hero.url.includes("/story-image/");
  if (isGenerated) continue; // already the house graphic; nothing to strip

  const head = new Set(terms(a.headline));
  const overlap = terms(hero.alt || "").filter((t) => head.has(t)).length;
  if (overlap < 2) stripImage.push(a);
}

const esc = (s) => String(s).replaceAll("'", "''");

let sql = `-- Retract ${retract.length} articles whose lede narrates a materially older event.\n`;
sql += `-- Their versions stay frozen and intact; only the article state changes, so the\n`;
sql += `-- record of what was published remains auditable.\n\n`;
for (const a of retract) {
  sql += `UPDATE articles SET state='RETRACTED', updated_at=unixepoch()*1000 WHERE id='${esc(a.id)}';\n`;
}

let sql2 = `-- Strip unverifiable hero imagery from ${stripImage.length} articles.\n`;
sql2 += `-- Each gets a new version carrying identical text and identical sources, with no\n`;
sql2 += `-- hero attached, so the page falls back to the house graphic rather than showing\n`;
sql2 += `-- a photograph of the wrong subject.\n\n`;
for (const [i, a] of stripImage.entries()) {
  const vid = `version_strip_${i}_${Date.now().toString(36)}`;
  sql2 += `-- ${a.slug}\n`;
  sql2 += `INSERT INTO article_versions (id, article_id, version, headline, subheadline, body_json, key_takeaways_json, seo_json, structured_data_json, quality_score, quality_explanation_json, change_summary, created_by_id, created_at, published_at)\n`;
  sql2 += `SELECT '${vid}', article_id, (SELECT MAX(version)+1 FROM article_versions WHERE article_id='${esc(a.id)}'), headline, subheadline, body_json, key_takeaways_json, seo_json, structured_data_json, quality_score, quality_explanation_json, 'Removed a hero image that could not be verified as depicting the subject.', 'system:autonomous', unixepoch()*1000, NULL FROM article_versions WHERE id=(SELECT current_version_id FROM articles WHERE id='${esc(a.id)}');\n`;
  sql2 += `INSERT INTO article_source_links (id, article_version_id, source_id, relationship, summary, citation_order, source_url, source_title)\n`;
  sql2 += `SELECT '${vid}_' || substr(id,1,12), '${vid}', source_id, relationship, summary, citation_order, source_url, source_title FROM article_source_links WHERE article_version_id=(SELECT current_version_id FROM articles WHERE id='${esc(a.id)}');\n`;
  sql2 += `UPDATE article_versions SET published_at=unixepoch()*1000 WHERE id='${vid}';\n`;
  sql2 += `UPDATE articles SET current_version_id='${vid}', updated_at=unixepoch()*1000 WHERE id='${esc(a.id)}';\n\n`;
}

writeFileSync(process.argv[3], sql);
writeFileSync(process.argv[4], sql2);
console.log(`retract: ${retract.length} articles`);
console.log(`strip image: ${stripImage.length} articles`);
console.log(`\nretracting:`);
for (const a of retract) console.log(`  - ${a.slug}`);
