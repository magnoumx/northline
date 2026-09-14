/**
 * Presentation-only revisions for already-published articles.
 *
 * D1 freezes a version the moment it is published: `published_media_links_
 * immutable_insert` and `published_source_links_immutable_insert` reject any
 * attempt to attach imagery or citations afterwards, and
 * `published_article_versions_no_update` rejects editing the version itself.
 * That is correct - a published claim must not change silently underneath a
 * reader - but it also meant the existing archive could never gain a hero image
 * or an exact citation, because both are attached to a version.
 *
 * The way through is a new version that changes nothing a reader would call
 * reporting: the headline, subheadline and body are carried across byte for
 * byte, and only the presentation layer is new. The caller proves that by
 * comparing the canonical text hash before and after.
 */

export type MediaRevisionSource = {
  sourceId: string;
  relationship: string;
  citationOrder: number;
  sourceUrl: string | null;
  sourceTitle: string | null;
  note: string | null;
};

export type MediaRevisionMedia = {
  mediaAssetId: string;
  role: string;
  position: number;
  altText: string | null;
  caption: string | null;
};

export type MediaRevisionInput = {
  articleId: string;
  /** The frozen version whose text is being carried forward unchanged. */
  currentVersionId: string;
  media: readonly MediaRevisionMedia[];
  sources: readonly MediaRevisionSource[];
  changeSummary: string;
  createdById: string;
  now: Date;
  /**
   * Runs against the freshly created draft, before it is frozen. Media
   * discovery writes its own `article_media` rows, and those inserts are only
   * accepted while `published_at` is still null - so discovery has to happen
   * here rather than being passed in as a finished list.
   */
  attachToDraft?: (draftVersionId: string) => Promise<number>;
};

export type MediaRevisionResult = {
  newVersionId: string;
  versionNumber: number;
  /** Text hash of the version that was copied, asserted against the new one. */
  bodyHash: string;
  mediaAttached: number;
  sourcesAttached: number;
};

export class MediaRevisionError extends Error {
  constructor(
    readonly code:
      | "ARTICLE_NOT_PUBLISHED"
      | "VERSION_MISMATCH"
      | "TEXT_CHANGED"
      | "NOTHING_TO_ATTACH",
    message: string,
  ) {
    super(message);
    this.name = "MediaRevisionError";
  }
}

type VersionRow = {
  id: string;
  articleId: string;
  version: number;
  headline: string;
  subheadline: string | null;
  bodyJson: string;
  keyTakeawaysJson: string;
  seoJson: string | null;
  structuredDataJson: string | null;
  qualityScore: number | null;
  qualityExplanationJson: string | null;
  publishedAt: number | null;
};

/**
 * The exact text a reader sees. Media, citations and quality metadata are
 * deliberately excluded - those are what this revision is allowed to change.
 */
export function readerTextOf(version: {
  headline: string;
  subheadline: string | null;
  bodyJson: string;
  keyTakeawaysJson: string;
}): string {
  return [
    version.headline.trim(),
    (version.subheadline ?? "").trim(),
    version.bodyJson,
    version.keyTakeawaysJson,
  ].join("\n");
}

export async function createMediaOnlyRevision(
  db: D1Database,
  input: MediaRevisionInput,
  hash: (value: string) => Promise<string>,
): Promise<MediaRevisionResult> {
  if (
    input.media.length === 0 &&
    input.sources.length === 0 &&
    !input.attachToDraft
  ) {
    throw new MediaRevisionError(
      "NOTHING_TO_ATTACH",
      "A media revision must attach at least one image or citation.",
    );
  }

  const current = await db
    .prepare(
      `SELECT v.id AS id, v.article_id AS articleId, v.version AS version,
         v.headline AS headline, v.subheadline AS subheadline,
         v.body_json AS bodyJson, v.key_takeaways_json AS keyTakeawaysJson,
         v.seo_json AS seoJson,
         v.structured_data_json AS structuredDataJson,
         v.quality_score AS qualityScore,
         v.quality_explanation_json AS qualityExplanationJson,
         v.published_at AS publishedAt
       FROM article_versions v
       INNER JOIN articles a ON a.id = v.article_id
       WHERE v.id = ?1 AND a.id = ?2 AND a.current_version_id = ?1
       LIMIT 1`,
    )
    .bind(input.currentVersionId, input.articleId)
    .first<VersionRow>();

  if (!current) {
    throw new MediaRevisionError(
      "VERSION_MISMATCH",
      "The supplied version is not the article's current version.",
    );
  }
  if (current.publishedAt === null) {
    throw new MediaRevisionError(
      "ARTICLE_NOT_PUBLISHED",
      "A draft can be edited directly; a media revision is for published text.",
    );
  }

  const bodyHash = await hash(readerTextOf(current));
  // The next number comes from the highest version the article has ever had,
  // not from the current one. An abandoned earlier attempt can leave a higher
  // version behind, and `current.version + 1` then collides with it on the
  // (article_id, version) unique index and blocks the article forever.
  const highest = await db
    .prepare(
      `SELECT MAX(version) AS top FROM article_versions WHERE article_id = ?1`,
    )
    .bind(input.articleId)
    .first<{ top: number | null }>();
  const nextVersion =
    Math.max(Number(current.version), Number(highest?.top ?? 0)) + 1;
  const newVersionId = `version_${input.articleId.replace(/^article_/u, "")}_${nextVersion}`;
  const nowMs = input.now.getTime();

  // Created as a draft. Media and citation links are only accepted while
  // published_at is still null, so the version is frozen last.
  await db
    .prepare(
      `INSERT INTO article_versions (
         id, article_id, version, headline, subheadline, body_json,
         key_takeaways_json, seo_json, structured_data_json, quality_score,
         quality_explanation_json, change_summary, created_by_id, created_at,
         published_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, NULL)`,
    )
    .bind(
      newVersionId,
      input.articleId,
      nextVersion,
      current.headline,
      current.subheadline,
      current.bodyJson,
      current.keyTakeawaysJson,
      current.seoJson,
      current.structuredDataJson,
      current.qualityScore,
      current.qualityExplanationJson,
      input.changeSummary,
      input.createdById,
      nowMs,
    )
    .run();

  // The previous version's evidence is carried forward first. Both tables are
  // keyed by article_version_id, so a version that starts empty has none of
  // its predecessor's sources or media no matter how well-sourced the article
  // actually is - every article this function ever revised went live on a
  // fresh version whose article_source_links was empty, publicly showing
  // "Verified" over a citation list of zero. Nothing here removes evidence;
  // it is additive by construction, matching what a presentation-only
  // revision is supposed to be.
  await db
    .prepare(
      `INSERT OR IGNORE INTO article_source_links (
         id, article_version_id, source_id, relationship, summary,
         source_url, source_title, citation_order, created_at
       )
       SELECT lower(hex(randomblob(16))), ?2, source_id, relationship, summary,
         source_url, source_title, citation_order, ?3
       FROM article_source_links
       WHERE article_version_id = ?1`,
    )
    .bind(current.id, newVersionId, nowMs)
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO article_media (
         article_version_id, media_asset_id, role, position, alt_text,
         caption, created_at
       )
       SELECT ?2, media_asset_id, role, position, alt_text, caption, ?3
       FROM article_media
       WHERE article_version_id = ?1`,
    )
    .bind(current.id, newVersionId, nowMs)
    .run();

  for (const item of input.media) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO article_media (
           article_version_id, media_asset_id, role, position, alt_text,
           caption, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(
        newVersionId,
        item.mediaAssetId,
        item.role,
        item.position,
        item.altText,
        item.caption,
        nowMs,
      )
      .run();
  }

  for (const source of input.sources) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO article_source_links (
           article_version_id, source_id, relationship, citation_order,
           source_url, source_title, note, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        newVersionId,
        source.sourceId,
        source.relationship,
        source.citationOrder,
        source.sourceUrl,
        source.sourceTitle,
        source.note,
        nowMs,
      )
      .run();
  }

  const discovered = input.attachToDraft
    ? await input.attachToDraft(newVersionId)
    : 0;
  if (
    input.media.length === 0 &&
    input.sources.length === 0 &&
    discovered === 0
  ) {
    // Discovery found nothing rights-clean. Publishing an identical version
    // with nothing new attached would churn the archive for no reader benefit.
    await db
      .prepare(`DELETE FROM article_versions WHERE id = ?1`)
      .bind(newVersionId)
      .run();
    throw new MediaRevisionError(
      "NOTHING_TO_ATTACH",
      "No licensed media or citation was found for this article.",
    );
  }

  // Prove the reader-facing text survived the copy before anything is frozen or
  // promoted. A mismatch here means this stopped being presentation-only.
  const copied = await db
    .prepare(
      `SELECT headline, subheadline AS subheadline, body_json AS bodyJson,
         key_takeaways_json AS keyTakeawaysJson
       FROM article_versions WHERE id = ?1 LIMIT 1`,
    )
    .bind(newVersionId)
    .first<Pick<VersionRow, "headline" | "subheadline" | "bodyJson" | "keyTakeawaysJson">>();
  const copiedHash = copied ? await hash(readerTextOf(copied)) : "";
  if (copiedHash !== bodyHash) {
    await db
      .prepare(`DELETE FROM article_versions WHERE id = ?1`)
      .bind(newVersionId)
      .run();
    throw new MediaRevisionError(
      "TEXT_CHANGED",
      "The copied version does not carry the published text unchanged.",
    );
  }

  // Freeze, then promote. `articles_public_update_requires_frozen_version`
  // refuses to point a public article at an unfrozen version, so the order is
  // not interchangeable.
  await db
    .prepare(
      `UPDATE article_versions SET published_at = ?2 WHERE id = ?1`,
    )
    .bind(newVersionId, nowMs)
    .run();
  await db
    .prepare(
      `UPDATE articles SET current_version_id = ?2, updated_at = ?3
       WHERE id = ?1`,
    )
    .bind(input.articleId, newVersionId, nowMs)
    .run();

  return {
    newVersionId,
    versionNumber: nextVersion,
    bodyHash,
    mediaAttached: input.media.length + discovered,
    sourcesAttached: input.sources.length,
  };
}
