import { sha256Base64Url } from "../security/crypto";

export type GeneratedEditorialMediaInput = {
  database: D1Database;
  articleVersionId: string;
  slug: string;
  headline: string;
  category: string;
};

export async function registerGeneratedEditorialMedia(
  input: GeneratedEditorialMediaInput,
): Promise<{ mediaId: string; publicUrl: string }> {
  const publicUrl = `/story-image/${input.slug}`;
  const storageKey = `generated/story-image/${input.slug}.svg`;
  const checksum = await sha256Base64Url(
    `northline-generated-editorial:${input.articleVersionId}:${publicUrl}`,
  );
  const mediaId = `media_generated_${checksum.slice(0, 32)}`;
  const byteSize = new TextEncoder().encode(
    JSON.stringify({
      version: input.articleVersionId,
      slug: input.slug,
      headline: input.headline,
      category: input.category,
    }),
  ).byteLength;
  const now = Date.now();

  await input.database
    .prepare(
      `INSERT OR IGNORE INTO media_assets (
         id, storage_key, public_url, workflow_state, mime_type, byte_size,
         width, height, frame_count, checksum_sha256, creator,
         copyright_owner, original_url, license, license_url,
         usage_permission, attribution, downloaded_at, expires_at,
         verification_state, malware_scan_reference, metadata_stripped_at,
         created_at, updated_at
       ) VALUES (
         ?1, ?2, ?3, 'APPROVED', 'image/svg+xml', ?4,
         1600, 900, 1, ?5, 'Northline Editorial Systems',
         'Northline', ?3, 'Northline-owned editorial graphic', NULL,
         'OWNED_BY_PUBLISHER', 'Northline editorial graphic', NULL, NULL,
         'VERIFIED', 'GENERATED_INTERNAL', ?6, ?6, ?6
       )`,
    )
    .bind(mediaId, storageKey, publicUrl, Math.max(1, byteSize), checksum, now)
    .run();

  await input.database
    .prepare(
      `INSERT OR IGNORE INTO article_media (
         article_version_id, media_asset_id, role, position,
         alt_text, caption, created_at
       ) VALUES (?1, ?2, 'HERO', 0, ?3, ?4, ?5)`,
    )
    .bind(
      input.articleVersionId,
      mediaId,
      `Northline visual briefing for ${input.headline}`.slice(0, 500),
      `Original Northline editorial graphic for ${input.category.replaceAll("_", " ")}.`.slice(
        0,
        500,
      ),
      now,
    )
    .run();

  return { mediaId, publicUrl };
}
