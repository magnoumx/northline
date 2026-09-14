import { sha256BytesBase64Url } from "../security/crypto";
import {
  validateSafeFetchTarget,
  validateSafeRedirect,
} from "../security/ssrf";
import type {
  AcquiredSource,
  SafeSourceAcquisitionDependencies,
} from "./types";
import { SourceAcquisitionError } from "./types";

const SUPPORTED_CONTENT_TYPES = new Set([
  "text/html",
  "text/plain",
  "application/json",
  "application/ld+json",
  "application/xml",
  "text/xml",
  "application/rss+xml",
  "application/atom+xml",
]);

export type SourceAcquisitionEnvironment = {
  FEATURE_SOURCE_ACQUISITION?: string;
  AI_ALLOWED_FETCH_HOSTS?: string;
};

export async function acquireUntrustedSource(
  sourceUrl: string,
  dependencies: SafeSourceAcquisitionDependencies,
  {
    environment = process.env as SourceAcquisitionEnvironment,
    maximumBytes = 1_500_000,
    maximumRedirects = 3,
    timeoutMs = 15_000,
    now = new Date(),
  }: {
    environment?: SourceAcquisitionEnvironment;
    maximumBytes?: number;
    maximumRedirects?: number;
    timeoutMs?: number;
    now?: Date;
  } = {},
): Promise<AcquiredSource> {
  if (environment.FEATURE_SOURCE_ACQUISITION !== "true") {
    throw new SourceAcquisitionError(
      "FEATURE_DISABLED",
      "Controlled source acquisition is disabled.",
    );
  }
  assertBounds(maximumBytes, maximumRedirects, timeoutMs);
  const allowedHosts = parseAllowedHosts(environment.AI_ALLOWED_FETCH_HOSTS);
  if (allowedHosts.length === 0) {
    throw new SourceAcquisitionError(
      "FEATURE_DISABLED",
      "Controlled source acquisition requires an explicit hostname allowlist.",
    );
  }

  const validationOptions = {
    resolver: dependencies.resolver,
    allowedHosts,
    requireHttps: true,
    allowedPorts: [443],
  } as const;
  let target = await validateSafeFetchTarget(sourceUrl, validationOptions);
  if (!target.safe) {
    throw new SourceAcquisitionError(
      "UNSAFE_TARGET",
      `Source target rejected: ${target.reason}.`,
    );
  }

  let redirects = 0;
  while (true) {
    const response = await dependencies.transport.fetchPinned({
      url: target.url,
      pinnedAddresses: target.pinnedAddresses,
      maximumBytes,
      timeoutMs,
    });
    if (!target.pinnedAddresses.includes(response.connectedAddress)) {
      throw new SourceAcquisitionError(
        "TRANSPORT_IDENTITY_MISMATCH",
        "The egress transport connected to an address outside the pinned set.",
      );
    }
    if (isRedirect(response.status)) {
      if (redirects >= maximumRedirects) {
        throw new SourceAcquisitionError(
          "REDIRECT_LIMIT",
          "The source exceeded the redirect limit.",
        );
      }
      const location = response.headers.location;
      if (!location) {
        throw new SourceAcquisitionError(
          "HTTP_STATUS",
          "The source returned an incomplete redirect.",
        );
      }
      const redirected = await validateSafeRedirect(
        location,
        target,
        validationOptions,
      );
      if (!redirected.safe) {
        throw new SourceAcquisitionError(
          "UNSAFE_TARGET",
          `Redirect target rejected: ${redirected.reason}.`,
        );
      }
      target = redirected;
      redirects += 1;
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new SourceAcquisitionError(
        "HTTP_STATUS",
        `The source returned HTTP ${response.status}.`,
      );
    }
    if (response.body.byteLength > maximumBytes) {
      throw new SourceAcquisitionError(
        "OVERSIZED_RESPONSE",
        "The source exceeded the maximum response size.",
      );
    }
    const contentType = normalizeContentType(response.headers["content-type"]);
    if (!contentType || !SUPPORTED_CONTENT_TYPES.has(contentType)) {
      throw new SourceAcquisitionError(
        "UNSUPPORTED_CONTENT",
        "The source response type is not permitted.",
      );
    }
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
      response.body,
    );
    const untrustedText = normalizeUntrustedText(decoded, contentType);
    if (!untrustedText) {
      throw new SourceAcquisitionError(
        "EMPTY_CONTENT",
        "The source contained no usable text.",
      );
    }
    const contentHash = await sha256BytesBase64Url(response.body);
    const fetchedAt = now.toISOString();
    const injectionIndicators = findInjectionIndicators(untrustedText);
    const stored = dependencies.snapshotWriter
      ? await dependencies.snapshotWriter.store({
          sourceUrl,
          finalUrl: target.url.toString(),
          contentHash,
          contentType,
          byteLength: response.body.byteLength,
          fetchedAt,
          untrustedText,
          injectionIndicators,
        })
      : null;
    return {
      sourceUrl,
      finalUrl: target.url.toString(),
      contentType,
      byteLength: response.body.byteLength,
      contentHash,
      fetchedAt,
      untrustedText,
      injectionIndicators,
      storageKey: stored?.storageKey ?? null,
      redirects,
    };
  }
}

export function parseAllowedHosts(value: string | undefined): string[] {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(
          (entry) =>
            /^[a-z0-9.-]+$/u.test(entry) &&
            !entry.startsWith(".") &&
            !entry.endsWith("."),
        ),
    ),
  );
}

export function findInjectionIndicators(text: string): string[] {
  const indicators = [
    ["instruction_override", /ignore (?:all|any|the) previous instructions/iu],
    ["system_prompt_request", /(?:reveal|show|print).{0,24}system prompt/iu],
    ["tool_command", /(?:call|invoke|execute).{0,24}(?:tool|function)/iu],
    ["data_exfiltration", /(?:send|upload|exfiltrate).{0,32}(?:secret|token|key)/iu],
  ] as const;
  return indicators
    .filter(([, expression]) => expression.test(text))
    .map(([name]) => name);
}

function normalizeContentType(value: string | undefined): string | null {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase();
  return normalized || null;
}

function normalizeUntrustedText(value: string, contentType: string): string {
  const withoutExecutableMarkup =
    contentType === "text/html"
      ? value
          .replace(
            /<(script|style|noscript|template|svg|form|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/giu,
            " ",
          )
          .replace(/<!--[\s\S]*?-->/gu, " ")
          .replace(/<[^>]+>/gu, " ")
      : value;
  return decodeBasicEntities(withoutExecutableMarkup)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 250_000);
}

function decodeBasicEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function assertBounds(
  maximumBytes: number,
  maximumRedirects: number,
  timeoutMs: number,
): void {
  if (
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes < 1_024 ||
    maximumBytes > 5_000_000 ||
    !Number.isSafeInteger(maximumRedirects) ||
    maximumRedirects < 0 ||
    maximumRedirects > 5 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1_000 ||
    timeoutMs > 30_000
  ) {
    throw new RangeError("Source acquisition bounds are outside policy.");
  }
}
