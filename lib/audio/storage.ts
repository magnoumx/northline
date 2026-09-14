import { sha256BytesBase64Url } from "../security/crypto";
import { ArticleAudioError } from "./errors";
import type {
  ArticleAudioVariant,
  AudioFormat,
  ServerAudioProvider,
} from "./types";

export type AudioObjectMetadata = {
  articleId: string;
  articleVersionId: string;
  articleAudioVersionId: string;
  variant: ArticleAudioVariant;
  inputHash: string;
  provider: ServerAudioProvider;
  outputFormat: AudioFormat;
  immutable: "true";
};

export type StoredAudioObject = {
  key: string;
  etag: string | null;
  byteLength: number;
  checksum: string;
};

export interface ArticleAudioObjectStore {
  put(input: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
    metadata: AudioObjectMetadata;
    cacheControl: string;
  }): Promise<StoredAudioObject>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export type R2BucketLike = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
        contentDisposition?: string;
      };
      customMetadata?: Record<string, string>;
      onlyIf?: { etagDoesNotMatch?: string };
    },
  ): Promise<{ etag?: string } | null>;
  get(
    key: string,
  ): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  head(key: string): Promise<{
    etag?: string;
    size: number;
    customMetadata?: Record<string, string>;
  } | null>;
  delete(key: string): Promise<void>;
};

export function createR2ArticleAudioObjectStore(
  bucket: R2BucketLike,
): ArticleAudioObjectStore {
  return {
    async put(input) {
      assertSafeAudioKey(input.key);
      if (
        !(input.bytes instanceof Uint8Array) ||
        input.bytes.byteLength === 0 ||
        !input.contentType.startsWith("audio/")
      ) {
        throw new ArticleAudioError(
          "STORAGE_UNAVAILABLE",
          "Only non-empty audio objects can be stored.",
        );
      }
      const checksum = await sha256BytesBase64Url(input.bytes);
      const existing = await bucket.head(input.key);
      if (existing) {
        if (
          existing.customMetadata?.sha256 === checksum &&
          existing.size === input.bytes.byteLength
        ) {
          return {
            key: input.key,
            etag: existing.etag ?? null,
            byteLength: existing.size,
            checksum,
          };
        }
        throw new ArticleAudioError(
          "STORAGE_UNAVAILABLE",
          "An immutable audio object exists with different content.",
        );
      }
      const stored = await bucket.put(
        input.key,
        input.bytes.slice().buffer as ArrayBuffer,
        {
          httpMetadata: {
            contentType: input.contentType,
            cacheControl: input.cacheControl,
            contentDisposition: "inline",
          },
          customMetadata: {
            articleId: safeMetadata(input.metadata.articleId),
            articleVersionId: safeMetadata(input.metadata.articleVersionId),
            articleAudioVersionId: safeMetadata(
              input.metadata.articleAudioVersionId,
            ),
            variant: input.metadata.variant,
            inputHash: input.metadata.inputHash,
            provider: input.metadata.provider,
            outputFormat: input.metadata.outputFormat,
            immutable: "true",
            sha256: checksum,
          },
          onlyIf: { etagDoesNotMatch: "*" },
        },
      );
      if (!stored) {
        throw new ArticleAudioError(
          "STORAGE_UNAVAILABLE",
          "The immutable audio object already exists or could not be written.",
          true,
        );
      }
      return {
        key: input.key,
        etag: stored.etag ?? null,
        byteLength: input.bytes.byteLength,
        checksum,
      };
    },
    async get(key) {
      assertSafeAudioKey(key);
      const object = await bucket.get(key);
      return object
        ? new Uint8Array(await object.arrayBuffer())
        : null;
    },
    async delete(key) {
      assertSafeAudioKey(key);
      await bucket.delete(key);
    },
  };
}

export function buildFinalAudioObjectKey(input: {
  prefix: string;
  articleId: string;
  articleVersionId: string;
  variant: ArticleAudioVariant;
  inputHash: string;
  outputFormat: AudioFormat;
  generationAttempt: number;
}): string {
  if (
    !Number.isInteger(input.generationAttempt) ||
    input.generationAttempt < 1
  ) {
    throw new TypeError("Audio generation attempt is invalid.");
  }
  const extension = input.outputFormat.toLowerCase();
  const key = [
    input.prefix,
    safePathSegment(input.articleId),
    safePathSegment(input.articleVersionId),
    input.variant.toLowerCase(),
    `${safePathSegment(input.inputHash)}-a${input.generationAttempt}.${extension}`,
  ].join("/");
  assertSafeAudioKey(key);
  return key;
}

export function buildChunkAudioObjectKey(input: {
  prefix: string;
  articleAudioVersionId: string;
  ordinal: number;
  textHash: string;
  outputFormat: AudioFormat;
}): string {
  if (!Number.isInteger(input.ordinal) || input.ordinal < 0) {
    throw new TypeError("Audio chunk ordinal is invalid.");
  }
  const key = [
    input.prefix,
    "_chunks",
    safePathSegment(input.articleAudioVersionId),
    `${input.ordinal}-${safePathSegment(input.textHash)}.${input.outputFormat.toLowerCase()}`,
  ].join("/");
  assertSafeAudioKey(key);
  return key;
}

function assertSafeAudioKey(key: string): void {
  if (
    key.length < 3 ||
    key.length > 900 ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.split("/").some((part) => part === ".." || !part)
  ) {
    throw new TypeError("Audio object key is invalid.");
  }
}

function safePathSegment(value: string): string {
  if (
    value.includes("..") ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw new TypeError("Audio object path segment is invalid.");
  }
  const segment = value.trim().replace(/[^A-Za-z0-9_-]/gu, "_");
  if (!segment || segment.length > 160) {
    throw new TypeError("Audio object path segment is invalid.");
  }
  return segment;
}

function safeMetadata(value: string): string {
  return value.replace(/[^\x20-\x7E]/gu, "").slice(0, 256);
}
