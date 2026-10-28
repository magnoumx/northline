import { getD1Binding } from "../../db";
import {
  sha256Base64Url,
} from "../security/crypto";
import type {
  ArticleVersionInput,
  CorrectionInput,
  CreateArticleInput,
  PublishArticleInput,
  SaveArticleVersionInput,
} from "./article-input";
import type { AiReviewPackage } from "./ai-workflow";
import { EDITORIAL_TRANSITIONS } from "./state-machine";

const PUBLIC_STATES = new Set([
  "PUBLISHED",
  "DEVELOPING",
  "UPDATED",
  "CORRECTED",
  "RETRACTED",
  "ARCHIVED",
]);

export type EditorialWriteActor = {
  userId: string;
  type: "SYSTEM" | "EDITOR" | "REVIEWER" | "PUBLISHER";
};

export type EditorialWriteResult = {
  articleId: string;
  versionId: string;
  state: string;
  replayed: boolean;
};

/**
 * When `ownerUserId` is supplied the caller may only see articles they authored
 * or are actively assigned to. The restriction lives in the query so a client
 * cannot widen it, and so a Writer cannot enumerate other desks' unpublished
 * work through the list endpoint.
 */
export async function listEditorialArticles(
  limit = 50,
  ownerUserId?: string,
): Promise<
  Array<{
    id: string;
    slug: string;
    category: string;
    format: string;
    state: string;
    sensitive: boolean;
    currentVersionId: string | null;
    headline: string | null;
    centralClaimId: string | null;
    centralClaimStatus: string | null;
    centralClaimHasPrimaryEvidence: boolean;
    sourceCount: number;
    primarySourceCount: number;
    /** Why the gate held this article, so the queue can say so before anyone approves it. */
    qualityReasons: string[];
    qualityScore: number;
    updatedAt: string;
  }>
> {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const result = await (await getD1Binding())
    .prepare(
      `SELECT a.id, a.slug, a.category, a.format, a.state, a.sensitive,
        a.current_version_id AS currentVersionId, v.headline,
        (SELECT c.id FROM claims c
          WHERE c.article_version_id = a.current_version_id
            AND c.importance = 'central' LIMIT 1) AS centralClaimId,
        (SELECT c.verification_status FROM claims c
          WHERE c.article_version_id = a.current_version_id
            AND c.importance = 'central' LIMIT 1) AS centralClaimStatus,
        (SELECT c.primary_evidence_available FROM claims c
          WHERE c.article_version_id = a.current_version_id
            AND c.importance = 'central' LIMIT 1) AS centralClaimHasPrimaryEvidence,
        (SELECT COUNT(*) FROM article_source_links asl
          WHERE asl.article_version_id = a.current_version_id) AS sourceCount,
        (SELECT COUNT(*) FROM article_source_links asl
          WHERE asl.article_version_id = a.current_version_id
            AND asl.relationship = 'PRIMARY') AS primarySourceCount,
        v.quality_score AS qualityScore,
        v.quality_explanation_json AS qualityExplanationJson,
        a.updated_at AS updatedAt
       FROM articles a
       LEFT JOIN article_versions v ON v.id = a.current_version_id
       ${ownerUserId ? `WHERE a.author_id = ?2 OR EXISTS (
            SELECT 1 FROM article_assignments aa
            WHERE aa.article_id = a.id AND aa.user_id = ?2
          )` : ""}
       ORDER BY a.updated_at DESC LIMIT ?1`,
    )
    .bind(...(ownerUserId ? [boundedLimit, ownerUserId] : [boundedLimit]))
    .all<{
      id: string;
      slug: string;
      category: string;
      format: string;
      state: string;
      sensitive: number;
      currentVersionId: string | null;
      headline: string | null;
      centralClaimId: string | null;
      centralClaimStatus: string | null;
      centralClaimHasPrimaryEvidence: number | null;
      sourceCount: number;
      primarySourceCount: number;
      qualityScore: number | null;
      qualityExplanationJson: string | null;
      updatedAt: number;
    }>();
  return result.results.map((row) => ({
    ...row,
    sensitive: row.sensitive === 1,
    centralClaimHasPrimaryEvidence: row.centralClaimHasPrimaryEvidence === 1,
    // The gate already records why it refused an article. The queue was not
    // reading it, so an editor saw an Approve button and no reason not to press
    // it - which is how a story whose lede narrated a 2021 event, held for both
    // a failed fact review and a stale date, was approved and published.
    qualityReasons: parseQualityReasons(row.qualityExplanationJson),
    qualityScore: Number(row.qualityScore ?? 0),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));
}


/**
 * The gate stores its refusal reasons as a JSON array. Anything else in that
 * column is treated as "no recorded reason" rather than crashing the queue.
 */
function parseQualityReasons(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

export async function readEditorialArticle(
  articleId: string,
  ownerUserId?: string,
): Promise<{
  article: {
    id: string;
    slug: string;
    category: string;
    format: string;
    state: string;
    sensitive: boolean;
    currentVersionId: string | null;
  };
  versions: Array<{
    id: string;
    version: number;
    headline: string;
    subheadline: string | null;
    body: unknown;
    keyTakeaways: unknown;
    seo: unknown;
    changeSummary: string;
    publishedAt: string | null;
    createdAt: string;
  }>;
} | null> {
  const db = await getD1Binding();
  const article = await db
    .prepare(
      `SELECT a.id, a.slug, a.category, a.format, a.state, a.sensitive,
        a.current_version_id AS currentVersionId
       FROM articles a
       WHERE a.id = ?1${
         ownerUserId
           ? ` AND (a.author_id = ?2 OR EXISTS (
               SELECT 1 FROM article_assignments aa
               WHERE aa.article_id = a.id AND aa.user_id = ?2
             ))`
           : ""
       }`,
    )
    .bind(...(ownerUserId ? [articleId, ownerUserId] : [articleId]))
    .first<{
      id: string;
      slug: string;
      category: string;
      format: string;
      state: string;
      sensitive: number;
      currentVersionId: string | null;
    }>();
  if (!article) return null;
  const versions = await db
    .prepare(
      `SELECT id, version, headline, subheadline, body_json AS bodyJson,
        key_takeaways_json AS keyTakeawaysJson, seo_json AS seoJson,
        change_summary AS changeSummary, published_at AS publishedAt,
        created_at AS createdAt
       FROM article_versions WHERE article_id = ?
       ORDER BY version DESC LIMIT 100`,
    )
    .bind(articleId)
    .all<{
      id: string;
      version: number;
      headline: string;
      subheadline: string | null;
      bodyJson: string;
      keyTakeawaysJson: string;
      seoJson: string;
      changeSummary: string;
      publishedAt: number | null;
      createdAt: number;
    }>();
  return {
    article: { ...article, sensitive: article.sensitive === 1 },
    versions: versions.results.map((version) => ({
      id: version.id,
      version: version.version,
      headline: version.headline,
      subheadline: version.subheadline,
      body: safeJson(version.bodyJson),
      keyTakeaways: safeJson(version.keyTakeawaysJson),
      seo: safeJson(version.seoJson),
      changeSummary: version.changeSummary,
      publishedAt: version.publishedAt
        ? new Date(version.publishedAt).toISOString()
        : null,
      createdAt: new Date(version.createdAt).toISOString(),
    })),
  };
}

export async function createArticleDraft(
  input: CreateArticleInput,
  actor: EditorialWriteActor,
  idempotencyKey: string,
): Promise<EditorialWriteResult> {
  assertActor(actor, ["EDITOR", "PUBLISHER"]);
  const operation = await operationIdentity(
    "article-create",
    actor.userId,
    idempotencyKey,
    input,
  );
  const db = await getD1Binding();
  const replay = await readReplay(db, operation.auditId, operation.payloadHash);
  if (replay) return replay;

  const articleId = `article_${operation.digest.slice(0, 32)}`;
  const versionId = `version_${operation.digest.slice(0, 32)}_1`;
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `INSERT INTO articles
          (id, slug, category, format, state, sensitive,
           human_approval_required, author_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'DRAFTING', ?, ?, ?, ?, ?)`,
      )
      .bind(
        articleId,
        input.slug,
        input.category,
        input.format,
        input.sensitive ? 1 : 0,
        input.sensitive ? 1 : 0,
        actor.userId,
        now,
        now,
      ),
    versionInsert(db, versionId, articleId, 1, input.version, actor.userId, now),
    ...versionPacketStatements(db, versionId, input.version, actor.userId, now),
    db
      .prepare(
        `UPDATE articles
         SET current_version_id = ?, updated_at = ?
         WHERE id = ? AND current_version_id IS NULL`,
      )
      .bind(versionId, now, articleId),
    transitionInsert(
      db,
      operation.transitionId,
      articleId,
      null,
      "DRAFTING",
      actor.userId,
      input.version.changeSummary,
      now,
    ),
    auditInsert(
      db,
      operation.auditId,
      actor.userId,
      "ARTICLE_CREATED",
      articleId,
      operation.payloadHash,
      versionId,
      now,
    ),
  ];
  await runAtomicBatch(db, statements);
  return { articleId, versionId, state: "DRAFTING", replayed: false };
}

export async function saveArticleDraftVersion(
  articleId: string,
  input: SaveArticleVersionInput,
  actor: EditorialWriteActor,
  idempotencyKey: string,
): Promise<EditorialWriteResult> {
  assertActor(actor, ["EDITOR", "PUBLISHER"]);
  const operation = await operationIdentity(
    `article-version:${articleId}`,
    actor.userId,
    idempotencyKey,
    input,
  );
  const db = await getD1Binding();
  const replay = await readReplay(db, operation.auditId, operation.payloadHash);
  if (replay) return replay;
  const article = await readArticleHead(db, articleId);
  if (!article) throw new EditorialWriteError("NOT_FOUND", "Article not found.");
  if (PUBLIC_STATES.has(article.state)) {
    throw new EditorialWriteError(
      "IMMUTABLE_PUBLIC_VERSION",
      "A published article must be updated or corrected with a new public revision.",
    );
  }
  if (article.currentVersionId !== input.expectedCurrentVersionId) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "The article changed after this edit was opened.",
    );
  }
  const nextVersion = article.maximumVersion + 1;
  const versionId = `version_${operation.digest.slice(0, 32)}_${nextVersion}`;
  const now = Date.now();
  const statements = [
    conditionalVersionInsert(
      db,
      versionId,
      articleId,
      input.expectedCurrentVersionId,
      nextVersion,
      input.version,
      actor.userId,
      now,
    ),
    ...versionPacketStatements(db, versionId, input.version, actor.userId, now),
    db
      .prepare(
        `UPDATE articles
         SET current_version_id = ?, updated_at = ?
         WHERE id = ? AND current_version_id = ?
           AND state NOT IN ('PUBLISHED','DEVELOPING','UPDATED','CORRECTED','RETRACTED','ARCHIVED')`,
      )
      .bind(
        versionId,
        now,
        articleId,
        input.expectedCurrentVersionId,
      ),
    auditInsert(
      db,
      operation.auditId,
      actor.userId,
      "ARTICLE_VERSION_CREATED",
      articleId,
      operation.payloadHash,
      versionId,
      now,
    ),
  ];
  try {
    await runAtomicBatch(db, statements);
  } catch (error) {
    throw mapWriteFailure(error, "VERSION_CONFLICT");
  }
  return { articleId, versionId, state: article.state, replayed: false };
}

export async function submitArticleForHumanReview(
  articleId: string,
  input: PublishArticleInput,
  actor: EditorialWriteActor,
  idempotencyKey: string,
): Promise<EditorialWriteResult> {
  assertActor(actor, ["EDITOR", "PUBLISHER"]);
  const operation = await operationIdentity(
    `article-submit-review:${articleId}`,
    actor.userId,
    idempotencyKey,
    input,
  );
  const db = await getD1Binding();
  const replay = await readReplay(db, operation.auditId, operation.payloadHash);
  if (replay) return replay;
  const article = await readArticleHead(db, articleId);
  if (!article) throw new EditorialWriteError("NOT_FOUND", "Article not found.");
  if (
    !["DRAFTING", "REVISION_REQUIRED"].includes(article.state) ||
    article.currentVersionId !== input.expectedCurrentVersionId
  ) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "Submission requires the current draft version.",
    );
  }
  await assertPublicationPacket(db, input.expectedCurrentVersionId);
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `UPDATE articles
         SET state = 'HUMAN_REVIEW_REQUIRED', updated_at = ?
         WHERE id = ? AND state IN ('DRAFTING','REVISION_REQUIRED')
           AND current_version_id = ?`,
      )
      .bind(now, articleId, input.expectedCurrentVersionId),
    transitionInsert(
      db,
      operation.transitionId,
      articleId,
      article.state,
      "HUMAN_REVIEW_REQUIRED",
      actor.userId,
      input.reason,
      now,
    ),
    auditInsert(
      db,
      operation.auditId,
      actor.userId,
      "ARTICLE_SUBMITTED_FOR_REVIEW",
      articleId,
      operation.payloadHash,
      input.expectedCurrentVersionId,
      now,
    ),
  ];
  await runAtomicBatch(db, statements);
  return {
    articleId,
    versionId: input.expectedCurrentVersionId,
    state: "HUMAN_REVIEW_REQUIRED",
    replayed: false,
  };
}

export async function approveArticleForPublication(
  articleId: string,
  input: PublishArticleInput,
  actor: EditorialWriteActor,
  idempotencyKey: string,
): Promise<EditorialWriteResult> {
  assertActor(actor, ["REVIEWER", "PUBLISHER"]);
  const operation = await operationIdentity(
    `article-approve:${articleId}`,
    actor.userId,
    idempotencyKey,
    input,
  );
  const db = await getD1Binding();
  const replay = await readReplay(db, operation.auditId, operation.payloadHash);
  if (replay) return replay;
  const article = await readArticleHead(db, articleId);
  if (!article) throw new EditorialWriteError("NOT_FOUND", "Article not found.");
  if (
    article.state !== "HUMAN_REVIEW_REQUIRED" ||
    article.currentVersionId !== input.expectedCurrentVersionId
  ) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "Approval requires the current human-review version.",
    );
  }
  await assertPublicationPacket(db, input.expectedCurrentVersionId);
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `UPDATE articles
         SET state = 'APPROVED', updated_at = ?
         WHERE id = ? AND state = 'HUMAN_REVIEW_REQUIRED'
           AND current_version_id = ?`,
      )
      .bind(now, articleId, input.expectedCurrentVersionId),
    transitionInsert(
      db,
      operation.transitionId,
      articleId,
      "HUMAN_REVIEW_REQUIRED",
      "APPROVED",
      actor.userId,
      input.reason,
      now,
    ),
    auditInsert(
      db,
      operation.auditId,
      actor.userId,
      "ARTICLE_APPROVED",
      articleId,
      operation.payloadHash,
      input.expectedCurrentVersionId,
      now,
    ),
  ];
  await runAtomicBatch(db, statements);
  return {
    articleId,
    versionId: input.expectedCurrentVersionId,
    state: "APPROVED",
    replayed: false,
  };
}


export async function systemApproveArticleForPublication(
  articleId: string,
  input: PublishArticleInput & {
    gate: {
      trendId: string;
      primarySources: number;
      independentSources: number;
      totalClaims: number;
      supportedClaims: number;
      independentReview: boolean;
      wordCount: number;
      minimumWordCount: number;
      qualityScore: number;
      riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    };
  },
  actor: EditorialWriteActor,
  idempotencyKey: string,
): Promise<EditorialWriteResult> {
  assertActor(actor, ["SYSTEM"]);
  const gate = input.gate;
  if (
    gate.primarySources < 1 ||
    gate.independentSources < 2 ||
    gate.totalClaims < 1 ||
    gate.supportedClaims !== gate.totalClaims ||
    !gate.independentReview ||
    gate.wordCount < gate.minimumWordCount ||
    gate.qualityScore < 80 ||
    gate.riskLevel !== "LOW"
  ) {
    throw new EditorialWriteError(
      "PUBLICATION_PACKET_INCOMPLETE",
      "System approval requires a low-risk, independently reviewed, fully supported evidence packet.",
    );
  }
  const operation = await operationIdentity(
    `article-system-approve:${articleId}`,
    actor.userId,
    idempotencyKey,
    input,
  );
  const db = await getD1Binding();
  const replay = await readReplay(db, operation.auditId, operation.payloadHash);
  if (replay) return replay;
  const article = await readArticleHead(db, articleId);
  if (!article) throw new EditorialWriteError("NOT_FOUND", "Article not found.");
  if (
    !["DRAFTING", "HUMAN_REVIEW_REQUIRED"].includes(article.state) ||
    article.currentVersionId !== input.expectedCurrentVersionId
  ) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "System approval requires the current unpublished version.",
    );
  }
  await assertPublicationPacket(db, input.expectedCurrentVersionId);
  const now = Date.now();
  const statements = [
    db.prepare(
      `UPDATE articles SET state='APPROVED', risk_level='LOW',
       human_approval_required=0, updated_at=?1
       WHERE id=?2 AND current_version_id=?3
         AND state IN ('DRAFTING','HUMAN_REVIEW_REQUIRED')`,
    ).bind(now, articleId, input.expectedCurrentVersionId),
    conditionalTransitionInsert(
      db,
      operation.transitionId,
      articleId,
      article.state,
      "APPROVED",
      actor.userId,
      input.reason,
      now,
    ),
    conditionalAuditInsert(
      db,
      operation.auditId,
      actor.userId,
      "ARTICLE_SYSTEM_APPROVED",
      articleId,
      operation.payloadHash,
      input.expectedCurrentVersionId,
      now,
      "APPROVED",
    ),
  ];
  await runAtomicBatch(db, statements);
  const approved = await readArticleHead(db, articleId);
  if (
    approved?.state !== "APPROVED" ||
    approved.currentVersionId !== input.expectedCurrentVersionId
  ) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "The article changed before system approval completed.",
    );
  }
  return {
    articleId,
    versionId: input.expectedCurrentVersionId,
    state: "APPROVED",
    replayed: false,
  };
}

export async function promoteAiReviewPackage(
  articleId: string,
  {
    expectedCurrentVersionId,
    reviewPackage,
    reason,
    mediaReview,
    riskReview,
  }: {
    expectedCurrentVersionId: string;
    reviewPackage: AiReviewPackage;
    reason: string;
    mediaReview: { passed: boolean; reviewerId: string; reviewedAt: string };
    riskReview: { passed: boolean; reviewerId: string; reviewedAt: string };
  },
  actor: EditorialWriteActor,
  idempotencyKey: string,
): Promise<EditorialWriteResult> {
  assertActor(actor, ["SYSTEM"]);
  if (
    reviewPackage.state !== "HUMAN_REVIEW_REQUIRED" ||
    reviewPackage.publishableByModel !== false ||
    reviewPackage.workflowId !== articleId ||
    reason.trim().length < 20 ||
    !validIndependentReview(mediaReview) ||
    !validIndependentReview(riskReview)
  ) {
    throw new EditorialWriteError(
      "PUBLICATION_PACKET_INCOMPLETE",
      "Only a complete non-publishing AI review package can enter human review.",
    );
  }
  const drafting = reviewPackage.taskMetadata.find(
    (metadata) => metadata.promptId === "northline.article-draft",
  );
  const factReview = reviewPackage.taskMetadata.find(
    (metadata) => metadata.promptId === "northline.fact-review",
  );
  if (
    !drafting ||
    !factReview ||
    drafting.provider === factReview.provider ||
    !reviewPackage.taskMetadata.some(
      (metadata) => metadata.promptId === "northline.copy-edit",
    ) ||
    !reviewPackage.taskMetadata.some(
      (metadata) => metadata.promptId === "northline.seo-brief",
    )
  ) {
    throw new EditorialWriteError(
      "PUBLICATION_PACKET_INCOMPLETE",
      "The review package lacks separated drafting, fact, copy, or SEO evidence.",
    );
  }
  const operation = await operationIdentity(
    `article-ai-review:${articleId}`,
    actor.userId,
    idempotencyKey,
    {
      expectedCurrentVersionId,
      reason,
      mediaReview,
      riskReview,
      taskHashes: reviewPackage.taskMetadata.map(
        (metadata) => metadata.inputContentHash,
      ),
    },
  );
  const db = await getD1Binding();
  const replay = await readReplay(db, operation.auditId, operation.payloadHash);
  if (replay) return replay;
  const article = await readArticleHead(db, articleId);
  if (!article) throw new EditorialWriteError("NOT_FOUND", "Article not found.");
  if (
    !["DRAFTING", "REVISION_REQUIRED"].includes(article.state) ||
    article.currentVersionId !== expectedCurrentVersionId
  ) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "The AI review package does not match the current draft.",
    );
  }
  await assertPublicationPacket(db, expectedCurrentVersionId);
  const now = Date.now();
  const states = [
    "CLAIM_EXTRACTION",
    "FACT_REVIEW",
    "COPY_REVIEW",
    "SEO_REVIEW",
    "MEDIA_REVIEW",
    "RISK_REVIEW",
    "HUMAN_REVIEW_REQUIRED",
  ] as const;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE articles SET state = 'HUMAN_REVIEW_REQUIRED', updated_at = ?
         WHERE id = ? AND current_version_id = ?
           AND state IN ('DRAFTING','REVISION_REQUIRED')`,
      )
      .bind(now, articleId, expectedCurrentVersionId),
  ];
  let previous = article.state;
  states.forEach((state, index) => {
    statements.push(
      transitionInsert(
        db,
        `${operation.transitionId}_${index}`,
        articleId,
        previous,
        state,
        actor.userId,
        reason,
        now,
      ),
    );
    previous = state;
  });
  statements.push(
    conditionalAuditInsert(
      db,
      operation.auditId,
      actor.userId,
      "AI_REVIEW_PACKAGE_CREATED",
      articleId,
      operation.payloadHash,
      expectedCurrentVersionId,
      now,
      "HUMAN_REVIEW_REQUIRED",
    ),
  );
  await runAtomicBatch(db, statements);
  return {
    articleId,
    versionId: expectedCurrentVersionId,
    state: "HUMAN_REVIEW_REQUIRED",
    replayed: false,
  };
}

export async function publishApprovedArticle(
  articleId: string,
  input: PublishArticleInput,
  actor: EditorialWriteActor,
  idempotencyKey: string,
): Promise<EditorialWriteResult> {
  assertActor(actor, ["PUBLISHER"]);
  const operation = await operationIdentity(
    `article-publish:${articleId}`,
    actor.userId,
    idempotencyKey,
    input,
  );
  const db = await getD1Binding();
  const replay = await readReplay(db, operation.auditId, operation.payloadHash);
  if (replay) return replay;
  const article = await readArticleHead(db, articleId);
  if (!article) throw new EditorialWriteError("NOT_FOUND", "Article not found.");
  if (
    article.state !== "APPROVED" ||
    article.currentVersionId !== input.expectedCurrentVersionId
  ) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "Publication requires the current approved version.",
    );
  }
  await assertPublicationPacket(db, input.expectedCurrentVersionId);
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `UPDATE article_versions
         SET published_at = ?
         WHERE id = ? AND article_id = ? AND published_at IS NULL
           AND EXISTS (
             SELECT 1 FROM articles
             WHERE id = ? AND state = 'APPROVED' AND current_version_id = ?
           )`,
      )
      .bind(
        now,
        input.expectedCurrentVersionId,
        articleId,
        articleId,
        input.expectedCurrentVersionId,
      ),
    db
      .prepare(
        `UPDATE articles
         SET state = 'PUBLISHED', published_at = ?, updated_at = ?
         WHERE id = ? AND state = 'APPROVED' AND current_version_id = ?`,
      )
      .bind(now, now, articleId, input.expectedCurrentVersionId),
    conditionalTransitionInsert(
      db,
      operation.transitionId,
      articleId,
      "APPROVED",
      "PUBLISHED",
      actor.userId,
      input.reason,
      now,
    ),
    conditionalAuditInsert(
      db,
      operation.auditId,
      actor.userId,
      "ARTICLE_PUBLISHED",
      articleId,
      operation.payloadHash,
      input.expectedCurrentVersionId,
      now,
      "PUBLISHED",
    ),
  ];
  await runAtomicBatch(db, statements);
  const head = await readArticleHead(db, articleId);
  if (head?.state !== "PUBLISHED") {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "The approved version changed before publication.",
    );
  }
  return {
    articleId,
    versionId: input.expectedCurrentVersionId,
    state: "PUBLISHED",
    replayed: false,
  };
}

/**
 * Removes a story from public view.
 *
 * Withdrawal is a state change, never a delete. Published versions are frozen
 * by database triggers and the audit trail is append-only, so the record of
 * what was published and when survives - which is what a correction policy
 * requires. `ARCHIVED` quietly removes the page and its sitemap entry;
 * `RETRACTED` is the on-the-record withdrawal of a story that should not have
 * run, and it demands a reason.
 */
export async function withdrawArticle(
  articleId: string,
  input: { state: "ARCHIVED" | "RETRACTED"; reason: string },
  actor: EditorialWriteActor,
  idempotencyKey: string,
): Promise<EditorialWriteResult> {
  assertActor(actor, ["PUBLISHER"]);
  if (input.state === "RETRACTED" && input.reason.trim().length < 10) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "A retraction has to state why the story was withdrawn.",
    );
  }
  const operation = await operationIdentity(
    `article-withdraw:${articleId}`,
    actor.userId,
    idempotencyKey,
    input,
  );
  const db = await getD1Binding();
  const replay = await readReplay(db, operation.auditId, operation.payloadHash);
  if (replay) return replay;
  const article = await readArticleHead(db, articleId);
  if (!article) throw new EditorialWriteError("NOT_FOUND", "Article not found.");
  const allowed =
    EDITORIAL_TRANSITIONS[
      article.state as keyof typeof EDITORIAL_TRANSITIONS
    ] ?? [];
  if (!(allowed as readonly string[]).includes(input.state)) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      `An article in ${article.state} cannot move to ${input.state}.`,
    );
  }

  const now = Date.now();
  await runAtomicBatch(db, [
    db
      .prepare(
        `UPDATE articles SET state = ?1, updated_at = ?2
         WHERE id = ?3 AND state = ?4`,
      )
      .bind(input.state, now, articleId, article.state),
    conditionalTransitionInsert(
      db,
      operation.transitionId,
      articleId,
      article.state,
      input.state,
      actor.userId,
      input.reason,
      now,
    ),
    conditionalAuditInsert(
      db,
      operation.auditId,
      actor.userId,
      input.state === "RETRACTED" ? "ARTICLE_RETRACTED" : "ARTICLE_ARCHIVED",
      articleId,
      operation.payloadHash,
      article.currentVersionId ?? articleId,
      now,
      input.state,
    ),
  ]);

  const head = await readArticleHead(db, articleId);
  if (head?.state !== input.state) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "The article changed before it could be withdrawn.",
    );
  }
  return {
    articleId,
    versionId: head.currentVersionId ?? "",
    state: input.state,
    replayed: false,
  };
}

export async function publishArticleCorrection(
  articleId: string,
  input: CorrectionInput,
  actor: EditorialWriteActor,
  idempotencyKey: string,
): Promise<EditorialWriteResult> {
  assertActor(actor, ["PUBLISHER"]);
  assertInputPublicationPacket(input.version);
  const operation = await operationIdentity(
    `article-correct:${articleId}`,
    actor.userId,
    idempotencyKey,
    input,
  );
  const db = await getD1Binding();
  const replay = await readReplay(db, operation.auditId, operation.payloadHash);
  if (replay) return replay;
  const article = await readArticleHead(db, articleId);
  if (!article) throw new EditorialWriteError("NOT_FOUND", "Article not found.");
  if (
    !["PUBLISHED", "DEVELOPING", "UPDATED", "CORRECTED"].includes(
      article.state,
    ) ||
    article.currentVersionId !== input.expectedCurrentVersionId
  ) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "Correction requires the current public version.",
    );
  }
  const nextVersion = article.maximumVersion + 1;
  const versionId = `version_${operation.digest.slice(0, 32)}_${nextVersion}`;
  const correctionId = `correction_${operation.digest.slice(0, 32)}`;
  const now = Date.now();
  const statements = [
    conditionalPublicRevisionInsert(
      db,
      versionId,
      articleId,
      input.expectedCurrentVersionId,
      nextVersion,
      input.version,
      actor.userId,
      now,
    ),
    ...versionPacketStatements(db, versionId, input.version, actor.userId, now),
    db
      .prepare(
        `UPDATE article_versions SET published_at = ?
         WHERE id = ? AND article_id = ? AND published_at IS NULL`,
      )
      .bind(now, versionId, articleId),
    db
      .prepare(
        `UPDATE articles
         SET current_version_id = ?, state = 'CORRECTED', updated_at = ?
         WHERE id = ? AND current_version_id = ?
           AND state IN ('PUBLISHED','DEVELOPING','UPDATED','CORRECTED')`,
      )
      .bind(versionId, now, articleId, input.expectedCurrentVersionId),
    db
      .prepare(
        `INSERT INTO corrections
          (id, article_id, previous_version_id, corrected_version_id,
           public_notice, reason, corrected_by_id, visible, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
         FROM articles WHERE id = ? AND current_version_id = ? AND state = 'CORRECTED'`,
      )
      .bind(
        correctionId,
        articleId,
        input.expectedCurrentVersionId,
        versionId,
        input.publicNotice,
        input.reason,
        actor.userId,
        now,
        now,
        articleId,
        versionId,
      ),
    conditionalTransitionInsert(
      db,
      operation.transitionId,
      articleId,
      article.state,
      "CORRECTED",
      actor.userId,
      input.reason,
      now,
    ),
    conditionalAuditInsert(
      db,
      operation.auditId,
      actor.userId,
      "ARTICLE_CORRECTED",
      articleId,
      operation.payloadHash,
      versionId,
      now,
      "CORRECTED",
    ),
  ];
  try {
    await runAtomicBatch(db, statements);
  } catch (error) {
    throw mapWriteFailure(error, "VERSION_CONFLICT");
  }
  const head = await readArticleHead(db, articleId);
  if (
    head?.state !== "CORRECTED" ||
    head.currentVersionId !== versionId
  ) {
    throw new EditorialWriteError(
      "VERSION_CONFLICT",
      "The public version changed before correction.",
    );
  }
  return { articleId, versionId, state: "CORRECTED", replayed: false };
}

export class EditorialWriteError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN_ACTOR"
      | "IDEMPOTENCY_CONFLICT"
      | "VERSION_CONFLICT"
      | "PUBLICATION_PACKET_INCOMPLETE"
      | "IMMUTABLE_PUBLIC_VERSION"
      | "STORAGE_FAILURE",
    message: string,
  ) {
    super(message);
    this.name = "EditorialWriteError";
  }
}

type ArticleHead = {
  state: string;
  currentVersionId: string | null;
  maximumVersion: number;
};

async function readArticleHead(
  db: D1Database,
  articleId: string,
): Promise<ArticleHead | null> {
  return db
    .prepare(
      `SELECT a.state AS state, a.current_version_id AS currentVersionId,
        COALESCE(MAX(v.version), 0) AS maximumVersion
       FROM articles a
       LEFT JOIN article_versions v ON v.article_id = a.id
       WHERE a.id = ?
       GROUP BY a.id`,
    )
    .bind(articleId)
    .first<ArticleHead>();
}

async function assertPublicationPacket(
  db: D1Database,
  versionId: string,
): Promise<void> {
  const packet = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN importance = 'central' THEN 1 ELSE 0 END) AS centralCount,
        SUM(CASE WHEN importance = 'central'
          AND (verification_status <> 'VERIFIED'
            OR primary_evidence_available <> 1)
          THEN 1 ELSE 0 END) AS blockedCentral,
        (SELECT COUNT(*) FROM article_source_links
          WHERE article_version_id = ?) AS sourceCount,
        (SELECT COUNT(*) FROM article_source_links
          WHERE article_version_id = ? AND relationship = 'PRIMARY') AS primaryCount
       FROM claims WHERE article_version_id = ?`,
    )
    .bind(versionId, versionId, versionId)
    .first<{
      centralCount: number | null;
      blockedCentral: number | null;
      sourceCount: number;
      primaryCount: number;
    }>();
  if (
    !packet ||
    (packet.centralCount ?? 0) < 1 ||
    (packet.blockedCentral ?? 0) > 0 ||
    packet.sourceCount < 2 ||
    packet.primaryCount < 1
  ) {
    throw new EditorialWriteError(
      "PUBLICATION_PACKET_INCOMPLETE",
      "Publication requires verified central claims, primary evidence, and at least two linked sources.",
    );
  }
}

function assertInputPublicationPacket(version: ArticleVersionInput): void {
  const central = version.claims.filter(
    (claim) => claim.importance === "central",
  );
  if (
    central.length < 1 ||
    central.some(
      (claim) =>
        claim.verificationStatus !== "VERIFIED" ||
        !claim.primaryEvidenceAvailable,
    ) ||
    version.sources.length < 2 ||
    !version.sources.some((source) => source.relationship === "PRIMARY")
  ) {
    throw new EditorialWriteError(
      "PUBLICATION_PACKET_INCOMPLETE",
      "A correction must carry a complete verified evidence packet.",
    );
  }
}

function versionInsert(
  db: D1Database,
  versionId: string,
  articleId: string,
  version: number,
  input: ArticleVersionInput,
  actorId: string,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO article_versions
        (id, article_id, version, headline, subheadline, body_json,
         key_takeaways_json, seo_json, structured_data_json,
         quality_score, quality_explanation_json,
         change_summary, created_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      versionId,
      articleId,
      version,
      input.headline,
      input.subheadline,
      JSON.stringify(input.body),
      JSON.stringify(input.keyTakeaways),
      JSON.stringify(input.seo),
      JSON.stringify(input.structuredData),
      input.qualityScore ?? 0,
      JSON.stringify(input.qualityReasons ?? []),
      input.changeSummary,
      actorId,
      now,
    );
}

function conditionalVersionInsert(
  db: D1Database,
  versionId: string,
  articleId: string,
  expectedVersionId: string,
  version: number,
  input: ArticleVersionInput,
  actorId: string,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO article_versions
        (id, article_id, version, headline, subheadline, body_json,
         key_takeaways_json, seo_json, structured_data_json,
         quality_score, quality_explanation_json,
         change_summary, created_by_id, created_at)
       SELECT ?, id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM articles
       WHERE id = ? AND current_version_id = ?
         AND state NOT IN ('PUBLISHED','DEVELOPING','UPDATED','CORRECTED','RETRACTED','ARCHIVED')`,
    )
    .bind(
      versionId,
      version,
      input.headline,
      input.subheadline,
      JSON.stringify(input.body),
      JSON.stringify(input.keyTakeaways),
      JSON.stringify(input.seo),
      JSON.stringify(input.structuredData),
      input.qualityScore ?? 0,
      JSON.stringify(input.qualityReasons ?? []),
      input.changeSummary,
      actorId,
      now,
      articleId,
      expectedVersionId,
    );
}

function conditionalPublicRevisionInsert(
  db: D1Database,
  versionId: string,
  articleId: string,
  expectedVersionId: string,
  version: number,
  input: ArticleVersionInput,
  actorId: string,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO article_versions
        (id, article_id, version, headline, subheadline, body_json,
         key_takeaways_json, seo_json, structured_data_json,
         quality_score, quality_explanation_json,
         change_summary, created_by_id, created_at)
       SELECT ?, id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM articles
       WHERE id = ? AND current_version_id = ?
         AND state IN ('PUBLISHED','DEVELOPING','UPDATED','CORRECTED')`,
    )
    .bind(
      versionId,
      version,
      input.headline,
      input.subheadline,
      JSON.stringify(input.body),
      JSON.stringify(input.keyTakeaways),
      JSON.stringify(input.seo),
      JSON.stringify(input.structuredData),
      input.qualityScore ?? 0,
      JSON.stringify(input.qualityReasons ?? []),
      input.changeSummary,
      actorId,
      now,
      articleId,
      expectedVersionId,
    );
}

function versionPacketStatements(
  db: D1Database,
  versionId: string,
  input: ArticleVersionInput,
  actorId: string,
  now: number,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  input.sources.forEach((source, index) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO article_source_links
            (id, article_version_id, source_id, relationship, summary,
             source_url, source_title, citation_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          versionId,
          source.sourceId,
          source.relationship,
          source.summary,
          source.sourceUrl ?? null,
          source.sourceTitle ?? null,
          index,
          now,
        ),
    );
  });
  input.claims.forEach((claim) => {
    const claimId = crypto.randomUUID();
    statements.push(
      db
        .prepare(
          `INSERT INTO claims
            (id, article_version_id, claim_text, article_section, category,
             importance, primary_evidence_available, verification_status,
             risk_level, reviewer_id, review_notes, verified_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          claimId,
          versionId,
          claim.claimText,
          claim.articleSection,
          claim.category,
          claim.importance,
          claim.primaryEvidenceAvailable ? 1 : 0,
          claim.verificationStatus,
          claim.riskLevel,
          claim.verificationStatus === "VERIFIED" ? actorId : null,
          claim.reviewNotes ?? null,
          claim.verificationStatus === "VERIFIED" ? now : null,
          now,
        ),
    );
    claim.evidence.forEach((evidence) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO evidence
              (id, claim_id, source_id, relationship, source_locator,
               excerpt_hash, observed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            claimId,
            evidence.sourceId,
            evidence.relationship,
            evidence.sourceLocator,
            evidence.excerptHash ?? null,
            new Date(evidence.observedAt).getTime(),
            now,
          ),
      );
    });
  });
  return statements;
}

function transitionInsert(
  db: D1Database,
  id: string,
  articleId: string,
  from: string | null,
  to: string,
  actorId: string,
  reason: string,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO state_transitions
        (id, entity_type, entity_id, from_state, to_state, actor_id,
         reason, metadata_json, occurred_at)
       VALUES (?, 'article', ?, ?, ?, ?, ?, '{}', ?)`,
    )
    .bind(id, articleId, from, to, actorId, reason, now);
}

function conditionalTransitionInsert(
  db: D1Database,
  id: string,
  articleId: string,
  from: string,
  to: string,
  actorId: string,
  reason: string,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO state_transitions
        (id, entity_type, entity_id, from_state, to_state, actor_id,
         reason, metadata_json, occurred_at)
       SELECT ?, 'article', id, ?, ?, ?, ?, '{}', ?
       FROM articles WHERE id = ? AND state = ?`,
    )
    .bind(id, from, to, actorId, reason, now, articleId, to);
}

function auditInsert(
  db: D1Database,
  id: string,
  actorId: string,
  action: string,
  articleId: string,
  payloadHash: string,
  versionId: string,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_logs
        (id, actor_id, action, target_type, target_id, decision,
         reason, metadata_json, occurred_at)
       VALUES (?, ?, ?, 'article', ?, 'allowed', NULL, ?, ?)`,
    )
    .bind(
      id,
      actorId,
      action,
      articleId,
      JSON.stringify({ payloadHash, articleId, versionId }),
      now,
    );
}

function conditionalAuditInsert(
  db: D1Database,
  id: string,
  actorId: string,
  action: string,
  articleId: string,
  payloadHash: string,
  versionId: string,
  now: number,
  state: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_logs
        (id, actor_id, action, target_type, target_id, decision,
         reason, metadata_json, occurred_at)
       SELECT ?, ?, ?, 'article', id, 'allowed', NULL, ?, ?
       FROM articles WHERE id = ? AND state = ?`,
    )
    .bind(
      id,
      actorId,
      action,
      JSON.stringify({ payloadHash, articleId, versionId }),
      now,
      articleId,
      state,
    );
}

async function operationIdentity(
  scope: string,
  actorId: string,
  idempotencyKey: string,
  payload: unknown,
) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u.test(idempotencyKey)) {
    throw new TypeError("Invalid editorial idempotency key.");
  }
  const digest = await sha256Base64Url(
    `${scope}\u0000${actorId}\u0000${idempotencyKey}`,
  );
  return {
    digest,
    auditId: `audit_editorial_${digest.slice(0, 32)}`,
    transitionId: `transition_${digest.slice(0, 32)}`,
    payloadHash: await sha256Base64Url(JSON.stringify(payload)),
  };
}

async function readReplay(
  db: D1Database,
  auditId: string,
  payloadHash: string,
): Promise<EditorialWriteResult | null> {
  const row = await db
    .prepare(
      `SELECT target_id AS articleId, metadata_json AS metadataJson
       FROM audit_logs WHERE id = ?`,
    )
    .bind(auditId)
    .first<{ articleId: string; metadataJson: string }>();
  if (!row) return null;
  let metadata: { payloadHash?: string; versionId?: string };
  try {
    metadata = JSON.parse(row.metadataJson) as typeof metadata;
  } catch {
    throw new EditorialWriteError(
      "STORAGE_FAILURE",
      "The idempotency record is malformed.",
    );
  }
  if (metadata.payloadHash !== payloadHash || !metadata.versionId) {
    console.warn("editorial_idempotency_conflict", {
      auditId,
      articleId: row.articleId,
      hasVersionId: Boolean(metadata.versionId),
    });
    throw new EditorialWriteError(
      "IDEMPOTENCY_CONFLICT",
      "The idempotency key was already used for different editorial input.",
    );
  }
  const head = await readArticleHead(db, row.articleId);
  if (!head) {
    throw new EditorialWriteError(
      "STORAGE_FAILURE",
      "The idempotency record references a missing article.",
    );
  }
  return {
    articleId: row.articleId,
    versionId: metadata.versionId,
    state: head.state,
    replayed: true,
  };
}

async function runAtomicBatch(
  db: D1Database,
  statements: D1PreparedStatement[],
): Promise<void> {
  try {
    await db.batch(statements);
  } catch (error) {
    throw mapWriteFailure(error, "STORAGE_FAILURE");
  }
}

function mapWriteFailure(
  error: unknown,
  fallback: EditorialWriteError["code"],
): EditorialWriteError {
  if (error instanceof EditorialWriteError) return error;
  const message = error instanceof Error ? error.message : "";
  if (/UNIQUE|FOREIGN KEY|CONSTRAINT|current version/iu.test(message)) {
    // Keep which constraint fired. "Conflicted with current storage state"
    // alone hid 52 failed autonomous runs in two weeks behind one sentence.
    // SQLite constraint text names tables and columns, never row values.
    const constraint = message.replace(/^D1_ERROR:\s*/u, "").slice(0, 200);
    console.warn("editorial_write_constraint", { constraint });
    return new EditorialWriteError(
      "VERSION_CONFLICT",
      `The editorial write conflicted with current storage state (${constraint}).`,
    );
  }
  return new EditorialWriteError(
    fallback,
    "Editorial storage did not complete the atomic write.",
  );
}

function assertActor(
  actor: EditorialWriteActor,
  allowed: readonly EditorialWriteActor["type"][],
): void {
  if (!actor.userId.trim() || !allowed.includes(actor.type)) {
    throw new EditorialWriteError(
      "FORBIDDEN_ACTOR",
      "This actor cannot perform the editorial operation.",
    );
  }
}

function validIndependentReview(review: {
  passed: boolean;
  reviewerId: string;
  reviewedAt: string;
}): boolean {
  return (
    review.passed === true &&
    /^[A-Za-z0-9:_-]{8,128}$/u.test(review.reviewerId) &&
    Number.isFinite(Date.parse(review.reviewedAt))
  );
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
