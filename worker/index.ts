/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  buildContentSecurityPolicy,
  createCspNonce,
  withSecurityHeaders,
} from "../lib/security/headers";
import {
  cloneRequestWithHeaders,
  hardenIncomingRequest,
  runtimeAuthEnvironment,
} from "../lib/security/request-trust";
import { isKnownNewsroomCron, schedulesForCron } from "../lib/jobs/cron-routing";
import { createDefaultJobRegistry } from "../lib/jobs/handlers";
import { dispatchQueueMessage } from "../lib/jobs/consumer";
import { createMonitoringReporter } from "../lib/monitoring/reporter";
import {
  INTERNAL_ACCESS_JWT_COOKIE,
  INTERNAL_ACCESS_JWT_HEADER,
  normalizeTeamOrigin,
  readCloudflareAccessToken,
  verifyCloudflareAccessJwt,
} from "../lib/auth/cloudflare-access";

interface Env {
  ASSETS?: Fetcher;
  DB?: D1Database;
  ARTICLE_AUDIO?: R2Bucket;
  MEDIA?: R2Bucket;
  MEDIA_QUARANTINE?: R2Bucket;
  EDITORIAL_QUEUE?: Queue<unknown>;
  EDITORIAL_DLQ?: Queue<unknown>;
  MEDIA_QUEUE?: Queue<unknown>;
  MEDIA_DLQ?: Queue<unknown>;
  AD_EVENT_QUEUE?: Queue<unknown>;
  AD_EVENT_DLQ?: Queue<unknown>;
  FEATURE_ADSENSE?: string;
  AD_GLOBAL_KILL?: string;
  FEATURE_SCHEDULED_INGESTION?: string;
  FEATURE_DURABLE_JOBS?: string;
  SENTRY_DSN?: string;
  APP_RELEASE?: string;
  APP_ENV?: string;
  AUTH_PROVIDER?: string;
  AUTH_SESSION_SECRET?: string;
  AUTH_TRUSTED_PROXY_MODE?: string;
  AUTH_TRUSTED_PROXY_PLATFORM?: string;
  AUTH_TRUSTED_PROXY_SECRET?: string;
  CLOUDFLARE_ACCESS_ENABLED?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  INDEXNOW_KEY?: string;
  CSP_REPORT_ONLY?: string;
  CSP_REPORT_ENDPOINT?: string;
  TRUSTED_TYPES_ENFORCE?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledController {
  readonly cron: string;
  readonly scheduledTime: number;
  noRetry(): void;
}

interface QueueMessage {
  readonly body: unknown;
  readonly id: string;
  readonly timestamp: number;
  readonly attempts: number;
  ack(): void;
  retry(): void;
}

interface MessageBatch {
  readonly queue: string;
  readonly messages: readonly QueueMessage[];
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

function stringBinding(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function runtimeHash(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return Array.from(digest.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function startQueueJobRun(input: {
  db?: D1Database;
  queue: string;
  message: QueueMessage;
}): Promise<string | null> {
  if (!input.db) return null;
  const bodyJson = JSON.stringify(input.message.body ?? null);
  const idempotencyKey = `cloudflare-queue:${input.queue}:${input.message.id}`;
  const jobRunId = `run_${await runtimeHash(idempotencyKey)}`;
  const inputHash = await runtimeHash(bodyJson);
  const now = Date.now();
  try {
    await input.db
      .prepare(
        `INSERT INTO job_runs (
           id, job_type, idempotency_key, state, attempt, input_hash,
           output_json, error_code, error_message, started_at, completed_at, next_retry_at
         ) VALUES (?1, ?2, ?3, 'RUNNING', ?4, ?5, NULL, NULL, NULL, ?6, NULL, NULL)
         ON CONFLICT(idempotency_key) DO UPDATE SET
           state='RUNNING', attempt=excluded.attempt, input_hash=excluded.input_hash,
           output_json=NULL, error_code=NULL, error_message=NULL,
           started_at=excluded.started_at, completed_at=NULL, next_retry_at=NULL`,
      )
      .bind(
        jobRunId,
        typeof (input.message.body as { kind?: unknown } | null)?.kind === "string"
          ? String((input.message.body as { kind: string }).kind)
          : "unknown",
        idempotencyKey,
        Math.max(1, input.message.attempts || 1),
        inputHash,
        now,
      )
      .run();
    return jobRunId;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "queue_job_telemetry_start_failed",
        queue: input.queue,
        messageId: input.message.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }
}

async function finishQueueJobRun(input: {
  db?: D1Database;
  jobRunId: string | null;
  state: "COMPLETED" | "SKIPPED" | "RETRY_WAIT" | "FAILED";
  reason?: string;
  errorDigest?: string;
}): Promise<void> {
  if (!input.db || !input.jobRunId) return;
  const completedAt =
    input.state === "COMPLETED" ||
    input.state === "SKIPPED" ||
    input.state === "FAILED"
      ? Date.now()
      : null;
  const nextRetryAt =
    input.state === "RETRY_WAIT" ? Date.now() + 15_000 : null;
  try {
    await input.db
      .prepare(
        `UPDATE job_runs SET
           state=?1, output_json=?2, error_code=?3, error_message=?4,
           completed_at=?5, next_retry_at=?6
         WHERE id=?7`,
      )
      .bind(
        input.state,
        JSON.stringify({ reason: input.reason ?? null }),
        input.errorDigest ? "QUEUE_HANDLER_ERROR" : null,
        input.errorDigest ?? null,
        completedAt,
        nextRetryAt,
        input.jobRunId,
      )
      .run();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "queue_job_telemetry_finish_failed",
        jobRunId: input.jobRunId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

function upsertRequestCookie(
  cookieHeader: string | null,
  name: string,
  value: string,
): string {
  const encoded = encodeURIComponent(value);
  const parts = (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.slice(0, part.indexOf("=")).trim().toLowerCase() !== name.toLowerCase());
  parts.push(`${name}=${encoded}`);
  return parts.join("; ");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "verified";
  return `${local.slice(0, 2)}***@${domain}`;
}


/**
 * Rewrites a cache header on a response the Worker did not construct.
 *
 * Headers on a response returned by a downstream handler are immutable, so
 * `response.headers.set` there is silently a no-op - which is why the public
 * pages kept serving `no-store` after the cache policy was added. Copying the
 * response is the only way to change them.
 */
function withCacheControl(response: Response, value: string): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const worker = {
  async fetch(
    request: Request,
    env?: Env,
    ctx?: ExecutionContext,
  ): Promise<Response> {
    const bindings = env ?? {};
    const executionContext = ctx ?? {
      waitUntil() {},
      passThroughOnException() {},
    };
    const runtimeEnvironment = {
      ...runtimeAuthEnvironment(bindings as Record<string, unknown>),
      ...bindings,
    };
    const trustedRequest = await hardenIncomingRequest(
      request,
      runtimeEnvironment,
    );
    const nonce = createCspNonce();
    const cspOptions = {
      nonce,
      reportOnly:
        (bindings.CSP_REPORT_ONLY ?? process.env.CSP_REPORT_ONLY) === "true",
      reportUri:
        bindings.CSP_REPORT_ENDPOINT ?? process.env.CSP_REPORT_ENDPOINT,
      trustedTypes:
        (bindings.TRUSTED_TYPES_ENFORCE ??
          process.env.TRUSTED_TYPES_ENFORCE) === "true",
      adsense:
        stringBinding(runtimeEnvironment.FEATURE_ADSENSE) === "true" &&
        stringBinding(runtimeEnvironment.AD_GLOBAL_KILL) === "false",
    };
    const requestHeaders = new Headers(trustedRequest.headers);
    // This bridge header is trusted only when created by this Worker. Strip any
    // caller-supplied value, verify the original Access token at the raw Worker
    // boundary, then forward the verified JWT through vinext. This avoids losing
    // Cloudflare's injected assertion header during framework request wrapping.
    requestHeaders.delete(INTERNAL_ACCESS_JWT_HEADER);
    const sourceAccessToken = readCloudflareAccessToken(request.headers, {
      allowInternalBridge: false,
    });
    let accessIdentity: Awaited<ReturnType<typeof verifyCloudflareAccessJwt>> | null = null;
    let accessFailure: string | null = null;
    if (sourceAccessToken) {
      const audience = stringBinding(runtimeEnvironment.CLOUDFLARE_ACCESS_AUD);
      const teamOrigin = normalizeTeamOrigin(
        stringBinding(runtimeEnvironment.CLOUDFLARE_ACCESS_TEAM_DOMAIN) ?? undefined,
      );
      if (!audience || !teamOrigin) {
        accessFailure = "access_configuration_invalid";
      } else {
        try {
          accessIdentity = await verifyCloudflareAccessJwt(sourceAccessToken, {
            audience,
            teamOrigin,
          });
        } catch (error) {
          accessFailure =
            error instanceof Error ? error.message : "access_verification_failed";
        }
      }
      if (accessIdentity) {
        requestHeaders.set(INTERNAL_ACCESS_JWT_HEADER, sourceAccessToken);
        requestHeaders.set(
          "cookie",
          upsertRequestCookie(
            requestHeaders.get("cookie"),
            INTERNAL_ACCESS_JWT_COOKIE,
            sourceAccessToken,
          ),
        );
      }
    } else {
      accessFailure = "access_token_missing";
    }
    // Next/vinext reads the request policy and applies its nonce to framework
    // scripts. The same policy is installed on the final response below.
    requestHeaders.set(
      "content-security-policy",
      buildContentSecurityPolicy(cspOptions),
    );
    const securedRequest = cloneRequestWithHeaders(
      trustedRequest,
      requestHeaders,
    );
    const url = new URL(securedRequest.url);

    if (url.hostname.toLowerCase() === "www.usnorthline.com") {
      url.hostname = "usnorthline.com";
      return withSecurityHeaders(
        Response.redirect(url.toString(), 301),
        cspOptions,
      );
    }

    if (
      url.pathname === "/api/health/access-diagnostic" &&
      stringBinding(runtimeEnvironment.APP_ENV) !== "production"
    ) {
      const response = Response.json(
        {
          status: accessIdentity ? "verified" : "not_verified",
          host: url.hostname,
          access_header_present: Boolean(
            request.headers.get("cf-access-jwt-assertion"),
          ),
          access_cookie_present: /(?:^|;\s*)CF_Authorization=/i.test(
            request.headers.get("cookie") ?? "",
          ),
          authenticated_email_header_present: Boolean(
            request.headers.get("cf-access-authenticated-user-email"),
          ),
          auth_provider:
            stringBinding(runtimeEnvironment.AUTH_PROVIDER) ?? "unset",
          access_enabled:
            stringBinding(runtimeEnvironment.CLOUDFLARE_ACCESS_ENABLED) === "true",
          audience_configured: Boolean(
            stringBinding(runtimeEnvironment.CLOUDFLARE_ACCESS_AUD),
          ),
          team_domain_configured: Boolean(
            normalizeTeamOrigin(
              stringBinding(runtimeEnvironment.CLOUDFLARE_ACCESS_TEAM_DOMAIN) ?? undefined,
            ),
          ),
          verified_email: accessIdentity
            ? maskEmail(accessIdentity.email)
            : null,
          failure: accessFailure,
        },
        {
          status: accessIdentity ? 200 : 503,
          headers: { "cache-control": "private, no-store" },
        },
      );
      return withSecurityHeaders(response, cspOptions);
    }

    // IndexNow ownership verification.
    //
    // The protocol fetches https://host/<key>.txt and expects exactly the key.
    // The app router's catch-all claims every path, so a route file returned
    // the 404 page instead; the Worker answers first. Serving from
    // configuration also keeps the key out of the repository and the release
    // archive, and lets it be rotated with a secret change.
    {
      const indexNowKey = stringBinding(runtimeEnvironment.INDEXNOW_KEY);
      if (indexNowKey && url.pathname === `/${indexNowKey}.txt`) {
        return withSecurityHeaders(
          new Response(indexNowKey, {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "public, max-age=86400",
              "x-content-type-options": "nosniff",
            },
          }),
          cspOptions,
        );
      }
    }

    if (url.pathname === "/_vinext/image") {
      if (!bindings.ASSETS || !bindings.IMAGES) {
        return withSecurityHeaders(
          new Response("Image optimization is unavailable.", {
            status: 503,
            headers: { "cache-control": "no-store" },
          }),
          cspOptions,
        );
      }
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(securedRequest, {
        fetchAsset: (path) =>
          bindings.ASSETS!.fetch(
            new Request(new URL(path, securedRequest.url)),
          ),
        transformImage: async (body, { width, format, quality }) => {
          const result = await bindings.IMAGES!.input(body)
            .transform(width > 0 ? { width } : {})
            .output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(response, cspOptions);
    }

    const reporter = createMonitoringReporter({
      dsn: bindings.SENTRY_DSN ?? null,
      environment: bindings.APP_ENV ?? "development",
      release: bindings.APP_RELEASE ?? null,
    });
    let response: Response;
    try {
      response = withSecurityHeaders(
        await handler.fetch(securedRequest, bindings, executionContext),
        cspOptions,
      );
    } catch (error) {
      await reporter.captureError(error, {
        path: url.pathname,
        method: securedRequest.method,
      });
      response = withSecurityHeaders(
        new Response("Northline is temporarily unavailable.", {
          status: 500,
          headers: { "cache-control": "no-store" },
        }),
        cspOptions,
      );
    }
    if (
      url.pathname.startsWith("/newsroom") ||
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/account") ||
      url.pathname === "/newsletter/confirm"
    ) {
      return withCacheControl(response, "private, no-store");
    }

    // Public reader pages were served `no-store`, so every visit rendered from
    // the origin and queried D1 - nothing was ever cached at the edge. Article
    // text is immutable once published, so a short shared cache with background
    // revalidation costs nothing in freshness: a correction reaches readers
    // inside a minute, and the archive stops re-rendering for every request.
    //
    // A response that sets a cookie is specific to one reader and is never
    // shared, however cacheable the path looks.
    const cacheable =
      // HEAD is a GET without a body; a cache policy that ignored it made
      // the page look uncacheable to every monitoring probe.
      (request.method === "GET" || request.method === "HEAD") &&
      response.status === 200 &&
      !response.headers.has("set-cookie") &&
      (response.headers.get("content-type") ?? "").includes("text/html");

    // `s-maxage` stays short on purpose - a correction on a news site has to
    // reach readers in about a minute, and a test enforces that bound.
    //
    // The five-minute revalidation window was the part costing us: past it the
    // edge had nothing to serve and every request waited on the origin and D1,
    // which is why TTFB measured 0.78-0.93s. `stale-while-revalidate` exists for
    // exactly this - the edge answers instantly from the stale copy and fetches
    // a fresh one behind the request, so the reader never waits and the next
    // reader gets the update. Widening only that window buys the latency back
    // without weakening the correction guarantee.
    return cacheable
      ? withCacheControl(
          response,
          "public, s-maxage=60, stale-while-revalidate=86400",
        )
      : response;
  },

  async scheduled(
    controller: ScheduledController,
    env?: Env,
    ctx?: ExecutionContext,
  ): Promise<void> {
    const bindings = env ?? {};
    const executionContext = ctx ?? {
      waitUntil() {},
      passThroughOnException() {},
    };

    // stringBinding trims. Comparing the raw value meant a secret carrying a
    // trailing newline silently disabled every scheduled job while cron kept
    // reporting Success.
    if (
      stringBinding(bindings.FEATURE_SCHEDULED_INGESTION) !== "true" ||
      stringBinding(bindings.FEATURE_DURABLE_JOBS) !== "true"
    ) {
      return;
    }
    if (!isKnownNewsroomCron(controller.cron)) {
      return;
    }
    const queue = bindings.EDITORIAL_QUEUE;
    if (!queue) {
      return;
    }
    const kinds = schedulesForCron(controller.cron);
    const scheduledTime = new Date(controller.scheduledTime).toISOString();
    executionContext.waitUntil(
      (async () => {
        for (const kind of kinds) {
          await queue.send({
            kind,
            scheduledTime,
            source: "cron",
          });
        }
      })(),
    );
  },

  async queue(
    batch: MessageBatch,
    env?: Env,
  ): Promise<void> {
    const bindings = env ?? {};
    if (stringBinding(bindings.FEATURE_DURABLE_JOBS) !== "true") {
      for (const message of batch.messages) message.ack();
      return;
    }
    const registry = createDefaultJobRegistry();
    const services = {
      ...bindings,
      featureFlags: bindings as Record<string, unknown>,
    };
    // Messages are handled one at a time. Running a batch with Promise.all let
    // two AI-bearing jobs call a provider simultaneously, which broke the
    // one-concurrent-job invariant and produced avoidable 429 responses.
    for (const message of batch.messages) {
      {
        const jobRunId = await startQueueJobRun({
          db: bindings.DB,
          queue: batch.queue,
          message,
        });
        const result = await dispatchQueueMessage({
          message: message.body,
          registry,
          services,
          attemptCount: message.attempts || 1,
        });
        const state =
          result.disposition === "ACK"
            ? result.reason === "completed"
              ? "COMPLETED"
              : "SKIPPED"
            : result.disposition === "RETRY"
              ? "RETRY_WAIT"
              : "FAILED";
        await finishQueueJobRun({
          db: bindings.DB,
          jobRunId,
          state,
          reason: result.reason,
          errorDigest: result.errorDigest,
        });
        console.log(
          JSON.stringify({
            event: "queue_job_result",
            queue: batch.queue,
            messageId: message.id,
            jobRunId,
            kind:
              typeof (message.body as { kind?: unknown } | null)?.kind === "string"
                ? (message.body as { kind: string }).kind
                : "unknown",
            attempt: message.attempts || 1,
            disposition: result.disposition,
            reason: result.reason ?? null,
            errorDigest: result.errorDigest ?? null,
          }),
        );
        if (result.disposition === "ACK") {
          message.ack();
        } else {
          message.retry();
        }
      }
    }
  },
};

export default worker;
