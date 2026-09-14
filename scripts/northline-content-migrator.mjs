const PUBLIC_STATES = [
  "PUBLISHED",
  "UPDATED",
  "CORRECTED",
  "DEVELOPING",
  "APPROVED",
];

const ACCEPTED_LICENSE = /\b(?:CC0|PUBLIC DOMAIN|CC BY(?:-SA)?(?: [1-4]\.0)?)\b/iu;
const STOP_WORDS = new Set([
  "after", "against", "amid", "and", "as", "at", "before", "but", "by",
  "for", "from", "in", "into", "is", "its", "of", "on", "over", "the",
  "to", "vs", "with", "wins", "win", "claims", "takes", "makes", "live",
  "blog", "breaking", "latest",
]);

export default {
  async fetch(request, environment) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return json({ ok: true, service: "northline-content-migrator" });
      }

      if (request.method !== "POST") {
        return json({ error: "METHOD_NOT_ALLOWED" }, 405);
      }
      if (
        !environment.MIGRATION_KEY ||
        request.headers.get("x-northline-migration-key") !== environment.MIGRATION_KEY
      ) {
        return json({ error: "UNAUTHORIZED" }, 401);
      }

      const limit = boundedInteger(url.searchParams.get("limit"), 1, 5, 3);
      if (url.pathname === "/migrate") {
        return json(
          await migratePublishedArticles(environment, {
            limit,
            afterTime: Number(url.searchParams.get("afterTime") ?? 0),
            afterId: url.searchParams.get("afterId") ?? "",
          }),
        );
      }
      if (url.pathname === "/enrich") {
        return json(await enrichProductionMedia(environment, limit));
      }
      return json({ error: "NOT_FOUND" }, 404);
    } catch (error) {
      return json(
        {
          error: "MIGRATOR_RUNTIME_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
};

async function migratePublishedArticles(
  environment,
  { limit, afterTime, afterId },
) {
  const articles = await all(
    environment.PREVIEW_DB,
    `SELECT * FROM articles
     WHERE state IN (${PUBLIC_STATES.map(() => "?").join(",")})
       AND (
         COALESCE(published_at, updated_at) > ?
         OR (
           COALESCE(published_at, updated_at) = ?
           AND id > ?
         )
       )
     ORDER BY COALESCE(published_at, updated_at) ASC, id ASC
     LIMIT ?`,
    [...PUBLIC_STATES, afterTime, afterTime, afterId, limit],
  );

  let copied = 0;
  let skipped = 0;
  const errors = [];

  for (const article of articles) {
    try {
      const existing = await first(
        environment.PRODUCTION_DB,
        "SELECT id FROM articles WHERE slug=?1 OR id=?2 LIMIT 1",
        [article.slug, article.id],
      );
      if (existing) {
        skipped += 1;
        continue;
      }

      const storyClusterId = await copyStoryCluster(
        environment,
        article.story_cluster_id,
      );
      const authorId = await copyUser(environment, article.author_id);
      // A public article row is rejected on insert until its frozen current
      // version exists, so the article lands in a private state first and is
      // promoted back to its real state once the versions are in place.
      const articleCopy = {
        ...article,
        story_cluster_id: storyClusterId,
        author_id: authorId,
        current_version_id: null,
        state: "DRAFTING",
        published_at: null,
      };
      await insertIgnore(environment.PRODUCTION_DB, "articles", articleCopy);

      const versions = await all(
        environment.PREVIEW_DB,
        "SELECT * FROM article_versions WHERE article_id=?1 ORDER BY version ASC",
        [article.id],
      );
      // Versions are copied unfrozen. A version with `published_at` set makes its
      // source links, claims and media immutable, which would block the rest of
      // the copy, so the freeze timestamp is applied after the dependent rows.
      const frozenAt = article.published_at ?? article.updated_at ?? Date.now();
      for (const version of versions) {
        const createdById = await copyUser(environment, version.created_by_id);
        await insertIgnore(environment.PRODUCTION_DB, "article_versions", {
          ...version,
          created_by_id: createdById,
          published_at: null,
        });
      }

      // Source links, claims and media are immutable once an article is public,
      // so every dependent row is copied while the article is still a draft and
      // the public state is restored last.
      await copySourcesClaimsAndMedia(environment, article.id, versions);
      await copyTopicsAndAssignments(environment, article.id);

      if (article.current_version_id) {
        for (const version of versions) {
          if (!version.published_at) continue;
          await run(
            environment.PRODUCTION_DB,
            "UPDATE article_versions SET published_at=?1 WHERE id=?2",
            [version.published_at, version.id],
          );
        }
        await run(
          environment.PRODUCTION_DB,
          "UPDATE article_versions SET published_at=?1 WHERE id=?2 AND published_at IS NULL",
          [frozenAt, article.current_version_id],
        );
        await run(
          environment.PRODUCTION_DB,
          `UPDATE articles
           SET current_version_id=?1, state=?2, published_at=?3, updated_at=?4
           WHERE id=?5`,
          [
            article.current_version_id,
            article.state,
            article.published_at ?? frozenAt,
            article.updated_at ?? frozenAt,
            article.id,
          ],
        );
      }

      copied += 1;
    } catch (error) {
      errors.push({
        slug: String(article.slug),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const last = articles.at(-1);
  return {
    copied,
    skipped,
    scanned: articles.length,
    nextCursor: last
      ? {
          afterTime: Number(last.published_at ?? last.updated_at ?? 0),
          afterId: String(last.id),
        }
      : null,
    errors: errors.slice(0, 20),
  };
}

async function copySourcesClaimsAndMedia(environment, articleId, versions) {
  for (const version of versions) {
    const links = await all(
      environment.PREVIEW_DB,
      "SELECT * FROM article_source_links WHERE article_version_id=?1",
      [version.id],
    );
    for (const link of links) {
      const sourceId = await copySource(environment, link.source_id);
      if (!sourceId) continue;
      await insertIgnore(environment.PRODUCTION_DB, "article_source_links", {
        ...link,
        source_id: sourceId,
      });
    }

    const claimRows = await all(
      environment.PREVIEW_DB,
      "SELECT * FROM claims WHERE article_version_id=?1",
      [version.id],
    );
    for (const claim of claimRows) {
      const reviewerId = await copyUser(environment, claim.reviewer_id);
      await insertIgnore(environment.PRODUCTION_DB, "claims", {
        ...claim,
        reviewer_id: reviewerId,
      });
      const evidenceRows = await all(
        environment.PREVIEW_DB,
        "SELECT * FROM evidence WHERE claim_id=?1",
        [claim.id],
      );
      for (const evidence of evidenceRows) {
        const sourceId = await copySource(environment, evidence.source_id);
        if (!sourceId) continue;
        await insertIgnore(environment.PRODUCTION_DB, "evidence", {
          ...evidence,
          source_id: sourceId,
        });
      }
    }

    const mediaRows = await all(
      environment.PREVIEW_DB,
      `SELECT am.*, ma.*
       FROM article_media am
       JOIN media_assets ma ON ma.id=am.media_asset_id
       WHERE am.article_version_id=?1`,
      [version.id],
    );
    for (const media of mediaRows) {
      const mediaId = await copyMediaAsset(environment, media);
      if (!mediaId) continue;
      await insertIgnore(environment.PRODUCTION_DB, "article_media", {
        article_version_id: media.article_version_id,
        media_asset_id: mediaId,
        role: media.role,
        position: media.position,
        alt_text: media.alt_text,
        caption: media.caption,
        created_at: media.created_at,
      });
    }
  }
}

async function copyTopicsAndAssignments(environment, articleId) {
  const topicRows = await all(
    environment.PREVIEW_DB,
    `SELECT at.*, ct.*
     FROM article_topics at
     JOIN content_topics ct ON ct.id=at.topic_id
     WHERE at.article_id=?1`,
    [articleId],
  );
  for (const row of topicRows) {
    const existing = await first(
      environment.PRODUCTION_DB,
      "SELECT id FROM content_topics WHERE id=?1 OR (kind=?2 AND slug=?3) LIMIT 1",
      [row.topic_id, row.kind, row.slug],
    );
    const topicId = existing?.id ?? row.topic_id;
    if (!existing) {
      await insertIgnore(environment.PRODUCTION_DB, "content_topics", {
        id: row.topic_id,
        slug: row.slug,
        name: row.name,
        kind: row.kind,
        description: row.description,
        canonical_url: row.canonical_url,
        active: row.active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
    await insertIgnore(environment.PRODUCTION_DB, "article_topics", {
      article_id: articleId,
      topic_id: topicId,
      relationship: row.relationship,
      created_at: row.created_at,
    });
  }

  const assignments = await all(
    environment.PREVIEW_DB,
    "SELECT * FROM article_assignments WHERE article_id=?1",
    [articleId],
  );
  for (const assignment of assignments) {
    const userId = await copyUser(environment, assignment.user_id);
    const assignedById = await copyUser(environment, assignment.assigned_by_id);
    if (!userId) continue;
    await insertIgnore(environment.PRODUCTION_DB, "article_assignments", {
      ...assignment,
      user_id: userId,
      assigned_by_id: assignedById,
    });
  }
}

async function copyUser(environment, userId) {
  if (!userId) return null;
  const source = await first(
    environment.PREVIEW_DB,
    "SELECT * FROM users WHERE id=?1 LIMIT 1",
    [userId],
  );
  if (!source) return null;
  const existing = await first(
    environment.PRODUCTION_DB,
    "SELECT id FROM users WHERE id=?1 OR email=?2 LIMIT 1",
    [source.id, source.email],
  );
  if (existing) return existing.id;
  await insertIgnore(environment.PRODUCTION_DB, "users", source);
  return source.id;
}

async function copyStoryCluster(environment, clusterId) {
  if (!clusterId) return null;
  const source = await first(
    environment.PREVIEW_DB,
    "SELECT * FROM story_clusters WHERE id=?1 LIMIT 1",
    [clusterId],
  );
  if (!source) return null;
  const existing = await first(
    environment.PRODUCTION_DB,
    "SELECT id FROM story_clusters WHERE id=?1 OR slug=?2 LIMIT 1",
    [source.id, source.slug],
  );
  if (existing) return existing.id;
  await insertIgnore(environment.PRODUCTION_DB, "story_clusters", source);
  return source.id;
}

async function copySource(environment, sourceId) {
  if (!sourceId) return null;
  const source = await first(
    environment.PREVIEW_DB,
    "SELECT * FROM sources WHERE id=?1 LIMIT 1",
    [sourceId],
  );
  if (!source) return null;
  const existing = await first(
    environment.PRODUCTION_DB,
    "SELECT id FROM sources WHERE id=?1 OR domain=?2 LIMIT 1",
    [source.id, source.domain],
  );
  if (existing) return existing.id;
  await insertIgnore(environment.PRODUCTION_DB, "sources", source);
  return source.id;
}

async function copyMediaAsset(environment, joinedRow) {
  const existing = await first(
    environment.PRODUCTION_DB,
    `SELECT id FROM media_assets
     WHERE id=?1 OR storage_key=?2 OR checksum_sha256=?3 LIMIT 1`,
    [joinedRow.media_asset_id, joinedRow.storage_key, joinedRow.checksum_sha256],
  );
  if (existing) return existing.id;
  await insertIgnore(environment.PRODUCTION_DB, "media_assets", {
    id: joinedRow.media_asset_id,
    storage_key: joinedRow.storage_key,
    public_url: joinedRow.public_url,
    workflow_state: joinedRow.workflow_state,
    mime_type: joinedRow.mime_type,
    byte_size: joinedRow.byte_size,
    width: joinedRow.width,
    height: joinedRow.height,
    frame_count: joinedRow.frame_count,
    checksum_sha256: joinedRow.checksum_sha256,
    creator: joinedRow.creator,
    copyright_owner: joinedRow.copyright_owner,
    original_url: joinedRow.original_url,
    license: joinedRow.license,
    license_url: joinedRow.license_url,
    usage_permission: joinedRow.usage_permission,
    attribution: joinedRow.attribution,
    downloaded_at: joinedRow.downloaded_at,
    expires_at: joinedRow.expires_at,
    verification_state: joinedRow.verification_state,
    malware_scan_reference: joinedRow.malware_scan_reference,
    metadata_stripped_at: joinedRow.metadata_stripped_at,
    created_at: joinedRow.created_at,
    updated_at: joinedRow.updated_at,
  });
  return joinedRow.media_asset_id;
}

async function enrichProductionMedia(environment, limit) {
  const stories = await all(
    environment.PRODUCTION_DB,
    `SELECT a.id AS article_id, a.slug, a.category,
       av.id AS version_id, av.headline, av.structured_data_json
     FROM articles a
     JOIN article_versions av ON av.id=a.current_version_id
     LEFT JOIN article_media am
       ON am.article_version_id=av.id AND am.role='HERO'
     LEFT JOIN media_assets ma ON ma.id=am.media_asset_id
     WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING','APPROVED')
       AND (ma.id IS NULL OR ma.public_url LIKE '/story-image/%')
       AND COALESCE(
         json_extract(av.structured_data_json, '$.mediaEnrichmentVersion'),
         ''
       ) != 'v2'
     GROUP BY av.id
     ORDER BY COALESCE(a.published_at,a.updated_at) DESC
     LIMIT ?`,
    [limit],
  );

  let enriched = 0;
  let videos = 0;
  const failures = [];

  for (const story of stories) {
    try {
      const candidate = await findCommonsCandidate(story.headline, story.category);
      let structured = safeJsonRecord(story.structured_data_json);
      if (candidate) {
        const checksum = await sha256(
          `commons:${candidate.publicUrl}:${candidate.license}`,
        );
        const mediaId = `media_commons_${checksum.slice(0, 32)}`;
        await insertIgnore(environment.PRODUCTION_DB, "media_assets", {
          id: mediaId,
          storage_key: `licensed/commons/${checksum.slice(0, 40)}`,
          public_url: candidate.publicUrl,
          workflow_state: "APPROVED",
          mime_type: candidate.mimeType,
          byte_size: candidate.byteSize,
          width: candidate.width,
          height: candidate.height,
          frame_count: 1,
          checksum_sha256: checksum,
          creator: candidate.creator,
          copyright_owner: candidate.creator,
          original_url: candidate.originalUrl,
          license: candidate.license,
          license_url: candidate.licenseUrl,
          usage_permission: "LICENSED_REUSE",
          attribution: candidate.attribution,
          downloaded_at: null,
          expires_at: null,
          verification_state: "VERIFIED",
          malware_scan_reference: "COMMONS_METADATA_API",
          metadata_stripped_at: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
        await run(
          environment.PRODUCTION_DB,
          "DELETE FROM article_media WHERE article_version_id=?1 AND role='HERO'",
          [story.version_id],
        );
        await insertIgnore(environment.PRODUCTION_DB, "article_media", {
          article_version_id: story.version_id,
          media_asset_id: mediaId,
          role: "HERO",
          position: 0,
          alt_text: candidate.description || story.headline,
          caption: `${candidate.description} - ${candidate.attribution}`.slice(0, 500),
          created_at: Date.now(),
        });
        structured.image = candidate.publicUrl;
        structured.imageAlt = candidate.description || story.headline;
        structured.imageCredit = candidate.attribution;
        enriched += 1;
      }

      if (!structured.videoEmbedUrl) {
        const evidence = await first(
          environment.PRODUCTION_DB,
          `SELECT e.source_locator AS url, s.name AS source_name
           FROM claims c
           JOIN evidence e ON e.claim_id=c.id
           JOIN sources s ON s.id=e.source_id
           WHERE c.article_version_id=?1
             AND c.importance='central'
             AND c.verification_status='VERIFIED'
             AND s.credibility_tier <= 2
             AND (
               e.source_locator LIKE '%youtube.com/%'
               OR e.source_locator LIKE '%youtu.be/%'
               OR e.source_locator LIKE '%vimeo.com/%'
               OR e.source_locator LIKE '%tiktok.com/%'
               OR e.source_locator LIKE '%facebook.com/%'
               OR e.source_locator LIKE '%fb.watch/%'
               OR e.source_locator LIKE '%instagram.com/%'
               OR e.source_locator LIKE '%x.com/%'
               OR e.source_locator LIKE '%twitter.com/%'
             )
           ORDER BY CASE WHEN e.relationship='PRIMARY' THEN 0 ELSE 1 END
           LIMIT 1`,
          [story.version_id],
        );
        const embed = normalizeEditorialEmbed(
          evidence?.url,
          `${evidence?.source_name ?? story.headline} source media`,
        );
        if (embed) {
          structured.videoEmbedUrl = embed.embedUrl;
          structured.videoTitle = embed.title;
          structured.videoSourceUrl = embed.sourceUrl;
          structured.videoProvider = embed.provider;
          structured.videoAspect = embed.aspect;
          videos += 1;
        }
      }

      structured.mediaEnrichmentVersion = "v2";
      structured.mediaEnrichmentAttemptedAt = Date.now();
      await run(
        environment.PRODUCTION_DB,
        "UPDATE article_versions SET structured_data_json=?1 WHERE id=?2",
        [JSON.stringify(structured), story.version_id],
      );
    } catch (error) {
      failures.push({
        slug: story.slug,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { scanned: stories.length, enriched, videos, failures: failures.slice(0, 20) };
}

async function findCommonsCandidate(headline, category) {
  for (const query of searchQueries(headline, category)) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "8");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|mime|size|extmetadata|user");
    url.searchParams.set("iiurlwidth", "1600");
    url.searchParams.set("origin", "*");

    let response;
    try {
      response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "NorthlineEditorialMedia/1.0 (https://usnorthline.com)",
        },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const payload = await response.json();
    for (const page of Object.values(payload.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const metadata = info.extmetadata ?? {};
      const license = cleanHtml(
        metadata.LicenseShortName?.value ?? metadata.UsageTerms?.value ?? "",
      ).toUpperCase();
      if (!ACCEPTED_LICENSE.test(license)) continue;
      const restrictions = cleanHtml(metadata.Restrictions?.value ?? "");
      if (restrictions && !/^none$/iu.test(restrictions)) continue;
      const publicUrl = safeHttpsUrl(info.thumburl ?? info.url);
      const originalUrl = safeHttpsUrl(info.descriptionurl ?? info.url);
      if (!publicUrl || !originalUrl) continue;
      const mimeType = String(info.mime ?? "").toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) continue;
      const creator = cleanHtml(
        metadata.Artist?.value ?? metadata.Credit?.value ?? info.user ??
          "Wikimedia Commons contributor",
      ).slice(0, 500);
      const description = cleanHtml(
        metadata.ImageDescription?.value ?? page.title ?? query,
      ).slice(0, 500);
      const candidate = {
        pageTitle: page.title ?? query,
        publicUrl,
        originalUrl,
        mimeType,
        byteSize: Math.max(1, Math.trunc(Number(info.size ?? 1))),
        width: Number(info.width) > 0 ? Math.trunc(Number(info.width)) : null,
        height: Number(info.height) > 0 ? Math.trunc(Number(info.height)) : null,
        creator,
        license,
        licenseUrl: safeHttpsUrl(metadata.LicenseUrl?.value),
        attribution: `${creator} / Wikimedia Commons / ${license}`.slice(0, 500),
        description,
      };
      if (isRelevant(candidate, headline)) return candidate;
    }
  }
  return null;
}

function isRelevant(candidate, headline) {
  const headlineTerms = meaningfulTerms(headline);
  const candidateTerms = new Set(
    meaningfulTerms(`${candidate.pageTitle} ${candidate.description}`),
  );
  const overlap = headlineTerms.filter((term) => candidateTerms.has(term));
  return overlap.length >= Math.min(2, headlineTerms.length);
}

function searchQueries(headline, category) {
  const terms = meaningfulTerms(headline);
  // Commons indexes entities, not editorial headlines. The proper-noun phrases
  // inside the headline are tried first because "Colton Smith" finds a
  // photograph while the full headline finds nothing.
  return Array.from(new Set([
    ...properNounPhrases(headline),
    terms.slice(0, 5).join(" "),
    terms.slice(0, 9).join(" "),
    `${terms.slice(0, 5).join(" ")} ${String(category).replaceAll("_", " ")}`,
  ].filter((value) => value.trim().length >= 3))).slice(0, 5);
}

function properNounPhrases(headline) {
  const words = String(headline)
    .replaceAll(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);
  const phrases = [];
  let current = [];

  for (const word of words) {
    const isProper =
      /^\p{Lu}/u.test(word) &&
      word.length >= 3 &&
      !STOP_WORDS.has(word.toLowerCase());
    if (isProper) {
      current.push(word);
      continue;
    }
    if (current.length >= 2) phrases.push(current.slice(0, 3).join(" "));
    current = [];
  }
  if (current.length >= 2) phrases.push(current.slice(0, 3).join(" "));

  return phrases.slice(0, 3);
}

function meaningfulTerms(value) {
  return String(value)
    .replaceAll(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/u)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term) && !/^(?:19|20)\d{2}$/u.test(term));
}

function normalizeEditorialEmbed(value, title = "Source media") {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./u, "");
    const parts = url.pathname.split("/").filter(Boolean);

    let candidate = "";
    if (hostname === "youtu.be") {
      candidate = parts[0] ?? "";
    } else if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "youtube-nocookie.com"
    ) {
      candidate =
        url.pathname === "/watch"
          ? url.searchParams.get("v") ?? ""
          : ["embed", "shorts", "live"].includes(parts[0] ?? "")
            ? parts[1] ?? ""
            : "";
    }
    if (/^[A-Za-z0-9_-]{11}$/u.test(candidate)) {
      return {
        provider: "YouTube",
        embedUrl:
          `https://www.youtube-nocookie.com/embed/${candidate}` +
          "?rel=0&playsinline=1",
        sourceUrl: canonicalSourceUrl(url),
        title,
        aspect: "landscape",
      };
    }

    if (hostname === "vimeo.com" || hostname === "player.vimeo.com") {
      candidate = parts[0] === "video" ? parts[1] ?? "" : parts[0] ?? "";
      if (/^\d{6,24}$/u.test(candidate)) {
        return {
          provider: "Vimeo",
          embedUrl:
            `https://player.vimeo.com/video/${candidate}` +
            "?dnt=1&title=1&byline=1&portrait=0",
          sourceUrl: canonicalSourceUrl(url),
          title,
          aspect: "landscape",
        };
      }
    }

    if (hostname === "tiktok.com" || hostname === "m.tiktok.com") {
      const videoIndex = parts.indexOf("video");
      const playerIndex = parts.indexOf("v1");
      candidate =
        videoIndex >= 0
          ? parts[videoIndex + 1] ?? ""
          : playerIndex >= 0
            ? parts[playerIndex + 1] ?? ""
            : "";
      if (/^\d{6,24}$/u.test(candidate)) {
        return {
          provider: "TikTok",
          embedUrl:
            `https://www.tiktok.com/player/v1/${candidate}` +
            "?controls=1&progress_bar=1&play_button=1&volume_control=1" +
            "&fullscreen_button=1&timestamp=1&autoplay=0&rel=0&description=1",
          sourceUrl: canonicalSourceUrl(url),
          title,
          aspect: "portrait",
        };
      }
    }

    if (hostname === "instagram.com") {
      const kind = parts[0];
      candidate = parts[1] ?? "";
      if (
        ["p", "reel", "tv"].includes(kind) &&
        /^[A-Za-z0-9_-]{5,32}$/u.test(candidate)
      ) {
        return {
          provider: "Instagram",
          embedUrl:
            `https://www.instagram.com/${kind}/${candidate}/embed/captioned/`,
          sourceUrl: canonicalSourceUrl(url),
          title,
          aspect: "portrait",
        };
      }
    }

    if (
      hostname === "facebook.com" ||
      hostname === "m.facebook.com" ||
      hostname === "fb.watch"
    ) {
      const sourceUrl = canonicalSourceUrl(url);
      const isVideo =
        hostname === "fb.watch" ||
        url.pathname.includes("/videos/") ||
        url.pathname.startsWith("/watch") ||
        url.pathname.startsWith("/reel/") ||
        Boolean(url.searchParams.get("v"));
      if (isVideo) {
        return {
          provider: "Facebook",
          embedUrl:
            "https://www.facebook.com/plugins/video.php?show_text=0&width=1280" +
            `&href=${encodeURIComponent(sourceUrl)}`,
          sourceUrl,
          title,
          aspect: "landscape",
        };
      }
    }

    if (hostname === "x.com" || hostname === "twitter.com") {
      const statusIndex = parts.indexOf("status");
      candidate = statusIndex >= 0 ? parts[statusIndex + 1] ?? "" : "";
      if (/^\d{6,24}$/u.test(candidate)) {
        return {
          provider: "X",
          embedUrl:
            `https://platform.twitter.com/embed/Tweet.html?id=${candidate}` +
            "&dnt=true&theme=dark",
          sourceUrl: canonicalSourceUrl(url),
          title,
          aspect: "social",
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function canonicalSourceUrl(url) {
  url.hash = "";
  return url.toString();
}

function boundedInteger(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function all(database, statement, values = []) {
  const result = await database.prepare(statement).bind(...values).all();
  return result.results ?? [];
}

async function first(database, statement, values = []) {
  return database.prepare(statement).bind(...values).first();
}

async function run(database, statement, values = []) {
  return database.prepare(statement).bind(...values).run();
}

async function insertIgnore(database, table, row) {
  const entries = Object.entries(row).filter(([key]) => /^[a-z0-9_]+$/u.test(key));
  if (entries.length === 0 || !/^[a-z0-9_]+$/u.test(table)) {
    throw new TypeError("Unsafe or empty database insert.");
  }
  const columns = entries.map(([key]) => key);
  const placeholders = columns.map((_, index) => `?${index + 1}`);
  await database
    .prepare(
      `INSERT OR IGNORE INTO ${table} (${columns.join(",")}) VALUES (${placeholders.join(",")})`,
    )
    .bind(...entries.map(([, value]) => value))
    .run();
}

function safeJsonRecord(value) {
  try {
    const parsed = JSON.parse(String(value ?? "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function safeHttpsUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(cleanHtml(String(value)));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanHtml(value) {
  return String(value)
    .replaceAll(/<[^>]*>/gu, " ")
    .replaceAll(/&nbsp;/giu, " ")
    .replaceAll(/&amp;/giu, "&")
    .replaceAll(/&quot;/giu, '"')
    .replaceAll(/&#0*39;/giu, "'")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
