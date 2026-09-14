import { sha256Base64Url } from "../security/crypto";
import { ArticleAudioError } from "./errors";
import type { ArticleAudioGenerationRepository } from "./workflow";
import type {
  ArticleAudioRecord,
  ArticleAudioVariant,
  AudioTiming,
  ServerAudioProvider,
} from "./types";
import type { ArticleAudioRequestRepository } from "./service";

type AudioRow = {
  id: string;
  articleId: string;
  articleVersionId: string;
  variant: ArticleAudioVariant;
  state: ArticleAudioRecord["state"];
  inputHash: string;
  provider: ServerAudioProvider | null;
  modelId: string | null;
  voiceId: string | null;
  characterCount: number;
  chunkCount: number;
  generationAttempt: number;
  estimatedCostMicros: number;
  actualCostMicros: number | null;
  storageKey: string | null;
  contentType: string | null;
  durationMs: number | null;
  cooldownUntil: number | null;
  queueJobId: string | null;
  requestedAt: number | null;
  updatedAt: number;
};

type PublishedVersionRow = {
  articleId: string;
  articleVersionId: string;
  versionNumber: number;
  publishedAt: number;
  headline: string;
  subheadline: string | null;
  bodyJson: string;
  keyTakeawaysJson: string;
  category: string;
  sensitive: number;
};

type ChunkRow = {
  ordinal: number;
  textHash: string;
  storageKey: string;
  contentType: string;
  durationMs: number;
  costMicros: number;
  timingJson: string;
};

export function createD1ArticleAudioRepository(
  database: D1Database,
): ArticleAudioRequestRepository & ArticleAudioGenerationRepository {
  return {
    async loadCurrentPublishedVersion(articleId, expectedArticleVersionId) {
      validateIdentifier(articleId);
      validateIdentifier(expectedArticleVersionId);
      const row = await database
        .prepare(
          `SELECT a.id AS articleId, v.id AS articleVersionId,
             v.version AS versionNumber, v.published_at AS publishedAt,
             v.headline AS headline, v.subheadline AS subheadline,
             v.body_json AS bodyJson,
             v.key_takeaways_json AS keyTakeawaysJson,
             a.category AS category, a.sensitive AS sensitive
           FROM articles a
           INNER JOIN article_versions v
             ON v.id = a.current_version_id AND v.article_id = a.id
           WHERE a.id = ?1 AND v.id = ?2
             AND v.published_at IS NOT NULL
             AND a.published_at IS NOT NULL
             AND a.state IN ('PUBLISHED','DEVELOPING','UPDATED','CORRECTED','ARCHIVED')
           LIMIT 1`,
        )
        .bind(articleId, expectedArticleVersionId)
        .first<PublishedVersionRow>();
      return row
        ? {
            articleId: row.articleId,
            articleVersionId: row.articleVersionId,
            versionNumber: row.versionNumber,
            publishedAt: new Date(row.publishedAt),
            headline: row.headline,
            subheadline: row.subheadline,
            bodyJson: row.bodyJson,
            keyTakeawaysJson: row.keyTakeawaysJson,
            category: row.category,
            sensitive: row.sensitive === 1,
          }
        : null;
    },

    async findByVersion(articleVersionId, variant) {
      validateIdentifier(articleVersionId);
      validateVariant(variant);
      const row = await selectAudioByVersion(
        database,
        articleVersionId,
        variant,
      );
      return row ? mapAudioRow(row) : null;
    },

    async dailyCommittedCostMicros(budgetDate) {
      validateBudgetDate(budgetDate);
      const row = await database
        .prepare(
          `SELECT COALESCE(SUM(
             CASE entry_type
               WHEN 'RESERVATION' THEN amount_micros
               WHEN 'ACTUAL' THEN amount_micros
               WHEN 'RELEASE' THEN -amount_micros
               ELSE 0
             END
           ), 0) AS committed
           FROM article_audio_cost_ledger
           WHERE budget_date = ?1`,
        )
        .bind(budgetDate)
        .first<{ committed: number }>();
      return Math.max(0, Number(row?.committed ?? 0));
    },

    async queueGeneration(input) {
      validateIdentifier(input.article.articleId);
      validateIdentifier(input.article.articleVersionId);
      validateVariant(input.variant);
      validateQueueInput(input);
      const budgetDate = input.now.toISOString().slice(0, 10);
      let row = await selectAudioByVersion(
        database,
        input.article.articleVersionId,
        input.variant,
      );
      const activeStates = new Set(["QUEUED", "GENERATING", "PROCESSING", "READY"]);
      // The retry counter has to advance whenever a previous attempt already
      // wrote a reservation, not only when generation actually started. An
      // attempt that was abandoned before generating leaves generationAttempt
      // at zero, so keying on it reproduced the previous reservation key
      // forever; the insert then conflicted and every retry was reported as a
      // budget failure that had not happened.
      const priorReservations = row
        ? await database
            .prepare(
              `SELECT COUNT(*) AS total
               FROM article_audio_cost_ledger
               WHERE article_audio_version_id = ?1
                 AND entry_type = 'RESERVATION'`,
            )
            .bind(row.id)
            .first<{ total: number }>()
        : null;
      let retryAttempt =
        row && !activeStates.has(row.state)
          ? Math.max(row.generationAttempt, Number(priorReservations?.total ?? 0))
          : 0;
      let idempotencyKeyHash = await sha256Base64Url(
        `article-audio-reservation\u0000${input.requestIdempotencyKey}${
          retryAttempt > 0 ? `\u0000retry:${retryAttempt}` : ""
        }`,
      );
      const existingReservation = await database
        .prepare(
          `SELECT article_audio_version_id AS audioVersionId
           FROM article_audio_cost_ledger
           WHERE idempotency_key_hash = ?1 LIMIT 1`,
        )
        .bind(idempotencyKeyHash)
        .first<{ audioVersionId: string }>();
      if (existingReservation && row && activeStates.has(row.state)) {
        return { audio: mapAudioRow(row), replayed: true };
      }
      // A key derived purely from a counter can deadlock: a collision aborts
      // the request before any reservation is written, so the counter never
      // advances and the next attempt rebuilds the same colliding key forever.
      // Walk forward from the counter to the first key that is actually free.
      if (existingReservation && row && !activeStates.has(row.state)) {
        for (let probe = 0; probe < 50; probe += 1) {
          retryAttempt += 1;
          idempotencyKeyHash = await sha256Base64Url(
            [
              "article-audio-reservation",
              input.requestIdempotencyKey,
              "retry:" + String(retryAttempt),
            ].join(" "),
          );
          const taken = await database
            .prepare(
              `SELECT 1 AS present FROM article_audio_cost_ledger
               WHERE idempotency_key_hash = ?1 LIMIT 1`,
            )
            .bind(idempotencyKeyHash)
            .first<{ present: number }>();
          if (!taken) break;
        }
      }
      const audioVersionId = row?.id ?? `audio_${crypto.randomUUID()}`;
      if (!row) {
        await database
          .prepare(
            `INSERT INTO article_audio_versions (
               id, article_id, article_version_id, variant, state, input_hash,
               narration_policy_version, provider, model_id, voice_id,
               output_format, character_count, chunk_count,
               estimated_cost_micros, storage_bucket, download_allowed,
               generation_attempt, requested_by_id, requested_at,
               cooldown_until, created_at, updated_at
             ) VALUES (
               ?1, ?2, ?3, ?4, 'NOT_REQUESTED', ?5, ?6, ?7, ?8, ?9,
               ?10, ?11, ?12, ?13, ?14, ?15, 0, ?16, ?17, ?18, ?17, ?17
             )`,
          )
          .bind(
            audioVersionId,
            input.article.articleId,
            input.article.articleVersionId,
            input.variant,
            input.documentInputHash,
            input.narrationPolicyVersion,
            input.provider,
            input.modelId,
            input.voiceId,
            input.outputFormat,
            input.characterCount,
            input.chunkCount,
            input.estimatedCostMicros,
            input.storageBucket,
            input.downloadAllowed ? 1 : 0,
            input.requestedById,
            input.now.getTime(),
            input.cooldownUntil.getTime(),
          )
          .run();
      } else if (row.state === "READY") {
        await database
          .prepare(
            `UPDATE article_audio_versions
             SET state = 'STALE', stale_at = ?2, updated_at = ?2
             WHERE id = ?1 AND state = 'READY'`,
          )
          .bind(audioVersionId, input.now.getTime())
          .run();
      } else if (
        ["QUEUED", "GENERATING", "PROCESSING"].includes(row.state)
      ) {
        return { audio: mapAudioRow(row), replayed: true };
      }

      const reservation = await database
        .prepare(
          `INSERT INTO article_audio_cost_ledger (
             id, article_audio_version_id, article_version_id, provider,
             entry_type, amount_micros, budget_date,
             idempotency_key_hash, recorded_at
           )
           SELECT ?1, ?2, ?3, ?4, 'RESERVATION', ?5, ?6, ?7, ?8
           WHERE ?5 <= ?9 - COALESCE((
             SELECT SUM(
               CASE entry_type
                 WHEN 'RESERVATION' THEN amount_micros
                 WHEN 'ACTUAL' THEN amount_micros
                 WHEN 'RELEASE' THEN -amount_micros
                 ELSE 0
               END
             )
             FROM article_audio_cost_ledger
             WHERE budget_date = ?6
           ), 0)
           ON CONFLICT(idempotency_key_hash) DO NOTHING`,
        )
        .bind(
          `audio_cost_${crypto.randomUUID()}`,
          audioVersionId,
          input.article.articleVersionId,
          input.provider,
          input.estimatedCostMicros,
          budgetDate,
          idempotencyKeyHash,
          input.now.getTime(),
          input.dailyBudgetMicros,
        )
        .run();
      if (Number(reservation.meta.changes ?? 0) !== 1) {
        // Zero rows means either the budget guard in the WHERE clause refused
        // the spend or the idempotency key already existed. Those are entirely
        // different failures and must not share a code: reporting a duplicate
        // key as DAILY_BUDGET hides a stuck pipeline behind a spending limit.
        const duplicateKey = await database
          .prepare(
            `SELECT 1 AS present FROM article_audio_cost_ledger
             WHERE idempotency_key_hash = ?1 LIMIT 1`,
          )
          .bind(idempotencyKeyHash)
          .first<{ present: number }>();
        if (duplicateKey) {
          throw new ArticleAudioError(
            "STATE_CONFLICT",
            "A reservation for this request already exists; the retry key did not advance.",
          );
        }
        await database
          .prepare(
            `UPDATE article_audio_versions
             SET state = 'REJECTED', failure_code = 'DAILY_BUDGET',
                 rejected_at = ?2, updated_at = ?2
             WHERE id = ?1 AND state IN ('NOT_REQUESTED','STALE','FAILED','REJECTED')`,
          )
          .bind(audioVersionId, input.now.getTime())
          .run();
        throw new ArticleAudioError(
          "BUDGET_EXCEEDED",
          "The atomic daily TTS budget reservation was denied.",
        );
      }
      const queued = await database
        .prepare(
          `UPDATE article_audio_versions
           SET state = 'QUEUED', input_hash = ?2,
               narration_policy_version = ?3, provider = ?4,
               model_id = ?5, voice_id = ?6, output_format = ?7,
               character_count = ?8, chunk_count = ?9,
               estimated_cost_micros = ?10, actual_cost_micros = NULL,
               storage_bucket = ?11, storage_key = NULL,
               storage_etag = NULL, storage_checksum = NULL,
               storage_byte_length = NULL, content_type = NULL,
               duration_ms = NULL, chapter_timings_json = '[]',
               speech_timings_json = '[]', download_allowed = ?12,
               generation_attempt = generation_attempt + 1,
               requested_by_id = ?13, requested_at = ?14,
               cooldown_until = ?15, failure_code = NULL,
               failure_digest = NULL, failed_at = NULL, rejected_at = NULL,
               ready_at = NULL, updated_at = ?14
           WHERE id = ?1
             AND state IN ('NOT_REQUESTED','FAILED','STALE','REJECTED')`,
        )
        .bind(
          audioVersionId,
          input.documentInputHash,
          input.narrationPolicyVersion,
          input.provider,
          input.modelId,
          input.voiceId,
          input.outputFormat,
          input.characterCount,
          input.chunkCount,
          input.estimatedCostMicros,
          input.storageBucket,
          input.downloadAllowed ? 1 : 0,
          input.requestedById,
          input.now.getTime(),
          input.cooldownUntil.getTime(),
        )
        .run();
      if (Number(queued.meta.changes ?? 0) !== 1) {
        throw new ArticleAudioError(
          "STATE_CONFLICT",
          "Article audio could not be queued from its current state.",
          true,
        );
      }
      row = await selectAudioById(database, audioVersionId);
      if (!row) {
        throw new ArticleAudioError(
          "ARTICLE_NOT_FOUND",
          "Queued article audio could not be reloaded.",
        );
      }
      return { audio: mapAudioRow(row), replayed: false };
    },

    async rejectGeneration(input) {
      validateIdentifier(input.article.articleId);
      validateIdentifier(input.article.articleVersionId);
      validateVariant(input.variant);
      const existing = await selectAudioByVersion(
        database,
        input.article.articleVersionId,
        input.variant,
      );
      if (existing) return mapAudioRow(existing);
      const id = `audio_${crypto.randomUUID()}`;
      await database
        .prepare(
          `INSERT INTO article_audio_versions (
             id, article_id, article_version_id, variant, state, input_hash,
             narration_policy_version, character_count, requested_by_id,
             failure_code, rejected_at, created_at, updated_at
           ) VALUES (
             ?1, ?2, ?3, ?4, 'REJECTED', ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?10
           )`,
        )
        .bind(
          id,
          input.article.articleId,
          input.article.articleVersionId,
          input.variant,
          input.documentInputHash,
          input.narrationPolicyVersion,
          input.characterCount,
          input.requestedById,
          input.reason.slice(0, 80),
          input.now.getTime(),
        )
        .run();
      const row = await selectAudioById(database, id);
      if (!row) throw new Error("Rejected article audio could not be reloaded.");
      return mapAudioRow(row);
    },

    async attachQueueJob(audioVersionId, queueJobId, now) {
      validateIdentifier(audioVersionId);
      validateIdentifier(queueJobId);
      await database
        .prepare(
          `UPDATE article_audio_versions
           SET queue_job_id = ?2, updated_at = ?3
           WHERE id = ?1 AND state = 'QUEUED'
             AND (queue_job_id IS NULL OR queue_job_id = ?2)`,
        )
        .bind(audioVersionId, queueJobId, now.getTime())
        .run();
    },

    async claimGeneration(input) {
      validateIdentifier(input.audioVersionId);
      const current = await selectAudioById(database, input.audioVersionId);
      if (
        current?.state === "READY" &&
        current.inputHash === input.inputHash
      ) {
        return "REPLAY_READY";
      }
      // A record that has already been abandoned is not waiting for this
      // delivery. Reporting that as a retryable conflict made the queue redeliver
      // the same message indefinitely: twelve rows left FAILED by an exhausted
      // provider allowance kept every narration job failing long after the
      // provider itself had recovered. The message is refused once, and dropped.
      if (current && (current.state === "FAILED" || current.state === "REJECTED")) {
        throw new ArticleAudioError(
          "STATE_CONFLICT",
          `Article audio ${input.audioVersionId} is ${current.state} and is not awaiting generation.`,
          false,
        );
      }
      const result = await database
        .prepare(
          // A retry of the same delivery must be able to resume a record its
          // own earlier attempt already claimed. Accepting only QUEUED meant
          // the first failure flipped the row to GENERATING, every retry then
          // died on the claim instead of the real cause, and the original error
          // was overwritten - the record stayed wedged until the stale sweep.
          // Re-claiming is safe because the identity below pins it to the same
          // work, and completed chunks are reused rather than regenerated.
          `UPDATE article_audio_versions
           SET state = 'GENERATING', generation_started_at = ?6,
               updated_at = ?6
           WHERE id = ?1 AND state IN ('QUEUED','GENERATING') AND input_hash = ?2
             AND provider = ?3 AND model_id = ?4 AND voice_id = ?5`,
        )
        .bind(
          input.audioVersionId,
          input.inputHash,
          input.provider,
          input.modelId,
          input.voiceId,
          input.now.getTime(),
        )
        .run();
      if (Number(result.meta.changes ?? 0) !== 1) {
        throw new ArticleAudioError(
          "STATE_CONFLICT",
          "Article audio generation could not claim the queued record.",
          true,
        );
      }
      return "CLAIMED";
    },

    async findCompletedChunk(input) {
      validateIdentifier(input.audioVersionId);
      const row = await database
        .prepare(
          `SELECT ordinal AS ordinal, text_hash AS textHash,
             temporary_storage_key AS storageKey,
             content_type AS contentType, duration_ms AS durationMs,
             cost_micros AS costMicros, timing_json AS timingJson
           FROM article_audio_chunks
           WHERE article_audio_version_id = ?1 AND ordinal = ?2
             AND text_hash = ?3 AND state = 'READY'
           LIMIT 1`,
        )
        .bind(input.audioVersionId, input.ordinal, input.textHash)
        .first<ChunkRow>();
      return row
        ? {
            ordinal: row.ordinal,
            textHash: row.textHash,
            storageKey: row.storageKey,
            contentType: row.contentType,
            durationMs: row.durationMs,
            costMicros: row.costMicros,
            timings: safeTimings(row.timingJson),
          }
        : null;
    },

    async saveCompletedChunk(input) {
      validateIdentifier(input.audioVersionId);
      const existing = await database
        .prepare(
          `SELECT text_hash AS textHash, state
           FROM article_audio_chunks
           WHERE article_audio_version_id = ?1 AND ordinal = ?2 LIMIT 1`,
        )
        .bind(input.audioVersionId, input.chunk.ordinal)
        .first<{ textHash: string; state: string }>();
      if (existing?.state === "READY") {
        if (existing.textHash !== input.chunk.textHash) {
          throw new ArticleAudioError(
            "ARTICLE_VERSION_CONFLICT",
            "A completed audio chunk has a different immutable text hash.",
          );
        }
        return;
      }
      if (existing) {
        await database
          .prepare(
            `UPDATE article_audio_chunks
             SET state = 'READY', text_hash = ?3, chapter_index = ?4,
                 character_count = ?5, provider_request_id_hash = ?6,
                 content_type = ?7, temporary_storage_key = ?8,
                 duration_ms = ?9, cost_micros = ?10, timing_json = ?11,
                 failure_code = NULL, updated_at = ?12
             WHERE article_audio_version_id = ?1 AND ordinal = ?2`,
          )
          .bind(
            input.audioVersionId,
            input.chunk.ordinal,
            input.chunk.textHash,
            input.chunk.chapterIndex,
            input.chunk.characterCount,
            input.providerRequestIdHash,
            input.artifact.contentType,
            input.artifact.storageKey,
            input.artifact.durationMs,
            input.artifact.costMicros,
            JSON.stringify(input.artifact.timings),
            input.now.getTime(),
          )
          .run();
        return;
      }
      const parent = await selectAudioById(database, input.audioVersionId);
      if (!parent?.provider) {
        throw new ArticleAudioError(
          "STATE_CONFLICT",
          "The parent audio generation has no provider.",
        );
      }
      await database
        .prepare(
          // generation_attempt is NOT NULL with a CHECK of >= 1. Omitting it
          // made every chunk write fail, so no narration ever reached storage
          // no matter which provider or budget was configured.
          `INSERT INTO article_audio_chunks (
             id, article_audio_version_id, ordinal, chapter_index, text_hash,
             character_count, state, provider, provider_request_id_hash,
             content_type, temporary_storage_key, duration_ms, cost_micros,
             generation_attempt, timing_json, created_at, updated_at
           ) VALUES (
             ?1, ?2, ?3, ?4, ?5, ?6, 'READY', ?7, ?8, ?9, ?10, ?11,
             ?12, ?13, ?14, ?15, ?15
           )`,
        )
        .bind(
          `audio_chunk_${crypto.randomUUID()}`,
          input.audioVersionId,
          input.chunk.ordinal,
          input.chunk.chapterIndex,
          input.chunk.textHash,
          input.chunk.characterCount,
          parent.provider,
          input.providerRequestIdHash,
          input.artifact.contentType,
          input.artifact.storageKey,
          input.artifact.durationMs,
          input.artifact.costMicros,
          Math.max(1, Number(parent.generationAttempt ?? 1)),
          JSON.stringify(input.artifact.timings),
          input.now.getTime(),
        )
        .run();
    },

    async markProcessing(audioVersionId, now) {
      validateIdentifier(audioVersionId);
      const result = await database
        .prepare(
          `UPDATE article_audio_versions
           SET state = 'PROCESSING', processing_started_at = ?2,
               updated_at = ?2
           WHERE id = ?1 AND state = 'GENERATING'`,
        )
        .bind(audioVersionId, now.getTime())
        .run();
      if (Number(result.meta.changes ?? 0) !== 1) {
        throw new ArticleAudioError(
          "STATE_CONFLICT",
          "Article audio could not enter post-processing.",
        );
      }
    },

    async markReady(input) {
      validateIdentifier(input.audioVersionId);
      const row = await selectAudioById(database, input.audioVersionId);
      if (!row?.provider) {
        throw new ArticleAudioError(
          "STATE_CONFLICT",
          "Article audio provider metadata is missing.",
        );
      }
      const nowMs = input.now.getTime();
      const budgetDate = new Date(row.requestedAt ?? nowMs)
        .toISOString()
        .slice(0, 10);
      const releaseHash = await sha256Base64Url(
        `article-audio-release\u0000${input.audioVersionId}`,
      );
      const actualHash = await sha256Base64Url(
        `article-audio-actual\u0000${input.audioVersionId}`,
      );
      await database.batch([
        database
          .prepare(
            `UPDATE article_audio_versions
             SET state = 'READY', storage_key = ?2, storage_etag = ?3,
                 storage_checksum = ?4, storage_byte_length = ?5,
                 content_type = ?6, duration_ms = ?7,
                 actual_cost_micros = ?8, chapter_timings_json = ?9,
                 speech_timings_json = ?10, ready_at = ?11,
                 cooldown_until = NULL, updated_at = ?11
             WHERE id = ?1 AND state = 'PROCESSING'`,
          )
          .bind(
            input.audioVersionId,
            input.object.key,
            input.object.etag,
            input.object.checksum,
            input.object.byteLength,
            input.contentType,
            input.durationMs,
            input.actualCostMicros,
            JSON.stringify(input.chapterTimings),
            JSON.stringify(input.timings),
            nowMs,
          ),
        ledgerStatement(database, {
          audioVersionId: input.audioVersionId,
          articleVersionId: row.articleVersionId,
          provider: row.provider,
          entryType: "RELEASE",
          amountMicros: row.estimatedCostMicros,
          budgetDate,
          idempotencyHash: releaseHash,
          nowMs,
        }),
        ledgerStatement(database, {
          audioVersionId: input.audioVersionId,
          articleVersionId: row.articleVersionId,
          provider: row.provider,
          entryType: "ACTUAL",
          amountMicros: input.actualCostMicros,
          budgetDate,
          idempotencyHash: actualHash,
          nowMs,
        }),
      ]);
    },

    async markFailed(input) {
      validateIdentifier(input.audioVersionId);
      const row = await selectAudioById(database, input.audioVersionId);
      if (!row || row.state === "FAILED") return;
      if (!row.provider) {
        throw new ArticleAudioError(
          "STATE_CONFLICT",
          "Failed audio generation has no provider metadata.",
        );
      }
      const cost = await database
        .prepare(
          `SELECT COALESCE(SUM(cost_micros), 0) AS amount
           FROM article_audio_chunks
           WHERE article_audio_version_id = ?1 AND state = 'READY'`,
        )
        .bind(input.audioVersionId)
        .first<{ amount: number }>();
      const nowMs = input.now.getTime();
      const budgetDate = new Date(row.requestedAt ?? nowMs)
        .toISOString()
        .slice(0, 10);
      const releaseHash = await sha256Base64Url(
        `article-audio-release\u0000${input.audioVersionId}`,
      );
      const actualHash = await sha256Base64Url(
        `article-audio-failed-actual\u0000${input.audioVersionId}`,
      );
      await database.batch([
        database
          .prepare(
            `UPDATE article_audio_versions
             SET state = 'FAILED', failure_code = ?2,
                 failure_digest = ?3, actual_cost_micros = ?4,
                 failed_at = ?5, cooldown_until = ?6, updated_at = ?5
             WHERE id = ?1 AND state IN ('QUEUED','GENERATING','PROCESSING')`,
          )
          .bind(
            input.audioVersionId,
            input.code.slice(0, 80),
            input.errorDigest.slice(0, 256),
            Number(cost?.amount ?? 0),
            nowMs,
            input.cooldownUntil.getTime(),
          ),
        ledgerStatement(database, {
          audioVersionId: input.audioVersionId,
          articleVersionId: row.articleVersionId,
          provider: row.provider,
          entryType: "RELEASE",
          amountMicros: row.estimatedCostMicros,
          budgetDate,
          idempotencyHash: releaseHash,
          nowMs,
        }),
        ledgerStatement(database, {
          audioVersionId: input.audioVersionId,
          articleVersionId: row.articleVersionId,
          provider: row.provider,
          entryType: "ACTUAL",
          amountMicros: Number(cost?.amount ?? 0),
          budgetDate,
          idempotencyHash: actualHash,
          nowMs,
        }),
      ]);
    },
  };
}

async function selectAudioByVersion(
  database: D1Database,
  articleVersionId: string,
  variant: ArticleAudioVariant,
): Promise<AudioRow | null> {
  return database
    .prepare(
      `${AUDIO_SELECT}
       WHERE article_version_id = ?1 AND variant = ?2 LIMIT 1`,
    )
    .bind(articleVersionId, variant)
    .first<AudioRow>();
}

async function selectAudioById(
  database: D1Database,
  id: string,
): Promise<AudioRow | null> {
  return database
    .prepare(`${AUDIO_SELECT} WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<AudioRow>();
}

const AUDIO_SELECT = `SELECT id, article_id AS articleId,
  article_version_id AS articleVersionId, variant, state,
  input_hash AS inputHash, provider, model_id AS modelId,
  voice_id AS voiceId, character_count AS characterCount,
  chunk_count AS chunkCount, generation_attempt AS generationAttempt,
  estimated_cost_micros AS estimatedCostMicros,
  actual_cost_micros AS actualCostMicros, storage_key AS storageKey,
  content_type AS contentType, duration_ms AS durationMs,
  cooldown_until AS cooldownUntil, queue_job_id AS queueJobId,
  requested_at AS requestedAt,
  updated_at AS updatedAt
  FROM article_audio_versions`;

function mapAudioRow(row: AudioRow): ArticleAudioRecord {
  return {
    ...row,
    cooldownUntil:
      row.cooldownUntil === null ? null : new Date(row.cooldownUntil),
    requestedAt:
      row.requestedAt === null ? null : new Date(row.requestedAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function ledgerStatement(
  database: D1Database,
  input: {
    audioVersionId: string;
    articleVersionId: string;
    provider: ServerAudioProvider;
    entryType: "ACTUAL" | "RELEASE";
    amountMicros: number;
    budgetDate: string;
    idempotencyHash: string;
    nowMs: number;
  },
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO article_audio_cost_ledger (
         id, article_audio_version_id, article_version_id, provider,
         entry_type, amount_micros, budget_date, idempotency_key_hash,
         recorded_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(idempotency_key_hash) DO NOTHING`,
    )
    .bind(
      `audio_cost_${crypto.randomUUID()}`,
      input.audioVersionId,
      input.articleVersionId,
      input.provider,
      input.entryType,
      input.amountMicros,
      input.budgetDate,
      input.idempotencyHash,
      input.nowMs,
    );
}

function safeTimings(value: string): AudioTiming[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAudioTiming);
  } catch {
    return [];
  }
}

function isAudioTiming(value: unknown): value is AudioTiming {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const timing = value as Partial<AudioTiming>;
  return (
    typeof timing.text === "string" &&
    Number.isInteger(timing.startMs) &&
    Number.isInteger(timing.endMs) &&
    Number.isInteger(timing.chapterIndex) &&
    Number(timing.startMs) >= 0 &&
    Number(timing.endMs) >= Number(timing.startMs)
  );
}

function validateIdentifier(value: string): void {
  if (!/^[A-Za-z0-9:_-]{8,160}$/u.test(value)) {
    throw new TypeError("Article audio identifier is invalid.");
  }
}

function validateVariant(value: ArticleAudioVariant): void {
  if (value !== "FULL_ARTICLE" && value !== "QUICK_BRIEF") {
    throw new TypeError("Article audio variant is invalid.");
  }
}

function validateBudgetDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new TypeError("TTS budget date is invalid.");
  }
}

function validateQueueInput(input: {
  estimatedCostMicros: number;
  dailyBudgetMicros: number;
  characterCount: number;
  chunkCount: number;
  provider: string;
  modelId: string;
  voiceId: string;
  storageBucket: string;
}): void {
  if (
    !Number.isInteger(input.estimatedCostMicros) ||
    input.estimatedCostMicros < 0 ||
    !Number.isInteger(input.dailyBudgetMicros) ||
    input.dailyBudgetMicros <= 0 ||
    !Number.isInteger(input.characterCount) ||
    input.characterCount <= 0 ||
    !Number.isInteger(input.chunkCount) ||
    input.chunkCount <= 0 ||
    !input.provider ||
    !input.modelId.trim() ||
    !input.voiceId.trim() ||
    !input.storageBucket.trim()
  ) {
    throw new TypeError("Article audio queue input is invalid.");
  }
}
