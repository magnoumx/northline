/**
 * Rewrites over-length headlines as new article versions.
 *
 * A published version is immutable - a trigger refuses any UPDATE to one, which
 * is correct: the text a reader saw and the sources that supported it have to
 * stay recoverable. Shortening a headline is therefore a revision, exactly like
 * the media corrections: copy the version, change the one field, carry the
 * source links across while the copy is still unfrozen, then freeze and promote.
 */
import { readFileSync, writeFileSync } from "node:fs";

/** Long headline -> replacement, each front-loading the concrete subject. */
const REPLACEMENTS = new Map([
  ["Rochester International Airshow Takes Flight: Precision Jet Teams, Static Displays, and Airport Planning Highlight Western New York Event",
   "Rochester Airshow Returns With Precision Jet Teams"],
  ["Ian Happ Anchors the Chicago Cubs Core: Contract Stability, Defensive Excellence, and Middle-of-the-Order Impact",
   "Ian Happ Anchors the Cubs Core Through 2026"],
  ["Understanding Phoenix Weather: Heat Dynamics, Desert Microclimates, and Seasonal Shifts in the Valley of the Sun",
   "Why Phoenix Heat Behaves Unlike Any Other US City"],
  ["Rebecca Ferguson's Hollywood Command: How the Swedish Actress Became Streaming and Cinema's Most Versatile Star",
   "Rebecca Ferguson Becomes Streaming's Most Booked Star"],
  ["Justin Hartley Is Having a Moment: TV's No. 1 Star Inks New Deal, Hits Big Screens, and Preps Tracker Season 3",
   "Justin Hartley Signs New Deal, Preps Tracker Season 3"],
  ["Elina Svitolina's Dual Pursuit: Blending World-Class Tennis Competitiveness with Unwavering National Advocacy",
   "Elina Svitolina Balances Tennis and Advocacy"],
  ["Widespread Flood Watches Issued Across Mid-Atlantic and Northeast as Slow-Moving Storms Dump Heavy Rainfall",
   "Flood Watches Cover Mid-Atlantic and Northeast"],
  ["Alex Noren's Pursuit of Excellence: How Sweden's Dual-Tour Veteran Maintains Elite Standard on Global Stage",
   "Alex Noren Holds Elite Form Across Two Tours"],
  ["Inside Mayor Zohran Mamdani's City Hall: Democratic Socialism Meets the Realities of New York Governance",
   "Mamdani's First Months Running New York City Hall"],
  ["Understanding the Cailen Waddell and Liz Waddell Legal Updates: Facts, Court Filings, and Digital Impact",
   "What Court Filings Show in the Waddell Case"],
  ["Hysterectomy Trends in Modern Medicine: Clinical Trials, Technological Shifts, and Public Health Data",
   "Hysterectomy Rates Shift as Techniques Change"],
]);

const raw = readFileSync(process.argv[2], "utf8");
const rows = JSON.parse(raw.slice(raw.indexOf("[")))[0].results;
const esc = (s) => String(s).replaceAll("'", "''");

let sql = "-- Shorten over-length headlines as new versions (published versions are immutable).\n\n";
let count = 0;
const missing = [];

for (const row of rows) {
  const replacement = REPLACEMENTS.get(row.headline);
  if (!replacement) { missing.push(row.headline.slice(0, 50)); continue; }
  if (replacement.length > 100) throw new Error(`replacement still too long: ${replacement}`);

  const vid = `version_hl_${count}_${Math.random().toString(36).slice(2, 10)}`;
  sql += `-- ${row.slug}\n-- ${row.headline.length} -> ${replacement.length} chars\n`;
  sql += `INSERT INTO article_versions (id, article_id, version, headline, subheadline, body_json, key_takeaways_json, seo_json, structured_data_json, quality_score, quality_explanation_json, change_summary, created_by_id, created_at, published_at)\n`;
  sql += `SELECT '${vid}', article_id, (SELECT MAX(version)+1 FROM article_versions WHERE article_id='${esc(row.id)}'), '${esc(replacement)}', subheadline, body_json, key_takeaways_json, seo_json, structured_data_json, quality_score, quality_explanation_json, 'Shortened the headline so it fits a search result. Reporting and sources unchanged.', 'system:autonomous', unixepoch()*1000, NULL FROM article_versions WHERE id='${esc(row.versionId)}';\n`;
  sql += `INSERT INTO article_source_links (id, article_version_id, source_id, relationship, summary, citation_order, source_url, source_title)\n`;
  // Keying the new id on source_id plus citation order, rather than a prefix of
  // the old id, because prefixes collide: the ids already in this table share
  // long leading segments from earlier revisions.
  sql += `SELECT '${vid}_' || source_id || '_' || citation_order, '${vid}', source_id, relationship, summary, citation_order, source_url, source_title FROM article_source_links WHERE article_version_id='${esc(row.versionId)}';\n`;
  // Carry the hero across too, or a headline fix would silently drop the image.
  sql += `INSERT INTO article_media (article_version_id, media_asset_id, role, position, alt_text, caption)\n`;
  sql += `SELECT '${vid}', media_asset_id, role, position, alt_text, caption FROM article_media WHERE article_version_id='${esc(row.versionId)}';\n`;
  sql += `UPDATE article_versions SET published_at=unixepoch()*1000 WHERE id='${vid}';\n`;
  sql += `UPDATE articles SET current_version_id='${vid}', updated_at=unixepoch()*1000 WHERE id='${esc(row.id)}';\n\n`;
  count += 1;
}

writeFileSync(process.argv[3], sql);
console.log(`revisions generated: ${count} of ${rows.length}`);
if (missing.length) console.log("no replacement mapped for:", missing);
