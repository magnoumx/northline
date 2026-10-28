import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const executors = readFileSync(
  fileURLToPath(new URL("../../lib/jobs/executors.ts", import.meta.url)),
  "utf8",
);
const flat = executors.replace(/\s+/gu, " ");

describe("video backfill runs as its own pass", () => {
  it("selects on whether a video is present, not on the hero", () => {
    // The hero pass skips any article that already has artwork. The AI
    // illustration fallback filled every article in the archive, which
    // permanently excluded all of them - so no published story could ever gain
    // a video however good discovery became.
    expect(flat).toContain("v.structured_data_json NOT LIKE '%videoEmbedUrl%'");
    const videoQuery = flat.indexOf("NOT LIKE '%videoEmbedUrl%'");
    const heroQuery = flat.indexOf("s.public_url NOT LIKE '/story-image/%'");
    expect(heroQuery).toBeGreaterThan(-1);
    expect(videoQuery).toBeGreaterThan(-1);
    expect(videoQuery).not.toBe(heroQuery);
  });

  it("runs after the hero pass rather than instead of it", () => {
    expect(flat).toContain("await backfillArticleVideos(db, environment, limit);");
    const heroLoop = flat.indexOf("attachArchiveMedia({");
    const videoPass = flat.indexOf("await backfillArticleVideos(");
    expect(videoPass).toBeGreaterThan(heroLoop);
  });

  it("goes through a media-only revision, not a direct write to the live row", () => {
    // Reader text must be proven unchanged before anything is promoted.
    const pass = flat.slice(flat.indexOf("async function backfillArticleVideos"));
    expect(pass).toContain("createMediaOnlyRevision(");
    expect(pass).toContain("Reporting unchanged.");
  });

  it("treats no footage found as ordinary, not as a failure", () => {
    // Otherwise every story without a video logs an error every 15 minutes and
    // buries the real faults.
    const pass = flat.slice(flat.indexOf("async function backfillArticleVideos"));
    expect(pass).toContain('code === "NOTHING_TO_ATTACH"');
    const nothing = pass.indexOf('"NOTHING_TO_ATTACH"');
    const failed = pass.indexOf('"video_failed"');
    expect(nothing).toBeLessThan(failed);
  });

  it("records that it searched and found nothing", () => {
    // Silence here is indistinguishable from the job never running, which is
    // how the narration outage stayed invisible for weeks.
    const pass = flat.slice(flat.indexOf("async function backfillArticleVideos"));
    expect(pass).toContain('"video_none_found"');
  });

  it("moves through the backlog instead of retrying the newest few", () => {
    // ORDER BY published_at DESC LIMIT n alone took the same three articles
    // every run, so the other eighteen were never reached.
    const pass = flat.slice(flat.indexOf("async function backfillArticleVideos"));
    expect(pass).toContain("decision = 'video_none_found'");
    expect(pass).toContain("occurred_at > ?1");
    expect(pass).toContain("24 * 60 * 60 * 1000");
    expect(pass).toContain("!skip.has(article.articleId)");
  });

  it("reads the cooldown through the target index, never a per-article LIKE", () => {
    // The correlated metadata_json LIKE '%' || a.id || '%' scanned all of
    // audit_logs once per article every fifteen minutes: 69 billion D1 rows
    // in a month, the October 2026 invoice.
    const pass = flat.slice(
      flat.indexOf("async function backfillArticleVideos"),
      flat.indexOf("export async function executeArchiveMediaBackfill"),
    );
    expect(pass).not.toContain("LIKE '%' || a.id");
    expect(pass).toContain("target_type = 'JOB'");
    expect(pass).toContain("target_id = 'archive.media_backfill'");
  });

  it("keeps one article's failure from stopping the batch", () => {
    const pass = flat.slice(
      flat.indexOf("async function backfillArticleVideos"),
      flat.indexOf("export async function executeArchiveMediaBackfill"),
    );
    expect(pass).toContain("try {");
    expect(pass).toContain("} catch (error) {");
  });

  it("still verifies the video through oEmbed before embedding it", () => {
    // Discovery proves a video exists; only the platform confirms it may be
    // embedded and supplies the real title and channel.
    const attach = flat.slice(
      flat.indexOf("async function attachArticleVideo"),
      flat.indexOf("async function backfillArticleVideos"),
    );
    expect(attach).toContain("discoverOfficialVideos({");
    expect(attach).toContain("selectEditorialVideo(");
    const discover = attach.indexOf("discoverOfficialVideos(");
    const verify = attach.indexOf("selectEditorialVideo(");
    expect(verify).toBeGreaterThan(discover);
  });
});
