import { runtimeFetch } from "../runtime/fetch";
export type MonitoringLevel = "debug" | "info" | "warning" | "error" | "fatal";

export type MonitoringContext = Record<string, string | number | boolean | undefined>;

export type SentryEnvelope = {
  type: "exception" | "message";
  level: MonitoringLevel;
  message: string;
  exception?: { name: string; message: string; stack?: string };
  context?: MonitoringContext;
  environment: string;
  release: string | null;
  timestamp: string;
};

export type MonitoringTransport = (envelope: SentryEnvelope) => Promise<void>;

export type MonitoringReporter = {
  enabled: boolean;
  captureError(error: unknown, context?: MonitoringContext): Promise<void>;
  captureMessage(message: string, level?: MonitoringLevel, context?: MonitoringContext): Promise<void>;
};

export type ParsedDsn = {
  endpoint: string;
  publicKey: string;
};

export function parseSentryDsn(dsn: string): ParsedDsn | null {
  const match = /^(https):\/\/([0-9a-f]{16,64})@([a-z0-9.-]+)(?::\d+)?\/(\d+)$/i.exec(dsn.trim());
  if (!match) return null;
  const [, , publicKey, host, projectId] = match;
  return {
    endpoint: `https://${host}/api/${projectId}/envelope/`,
    publicKey,
  };
}

export function createMonitoringReporter(input: {
  dsn?: string | null;
  environment?: string;
  release?: string | null;
  transport?: MonitoringTransport;
  fetchImpl?: typeof fetch;
}): MonitoringReporter {
  const environment = input.environment ?? "development";
  const release = input.release ?? null;
  const parsed = input.dsn ? parseSentryDsn(input.dsn) : null;
  if (!parsed) {
    return { enabled: false, captureError: async () => {}, captureMessage: async () => {} };
  }
  const transport: MonitoringTransport =
    input.transport ?? createSentryHttpTransport(parsed, input.fetchImpl);
  return {
    enabled: true,
    async captureError(error, context) {
      const normalized = normalizeError(error);
      await safeSend(transport, {
        type: "exception",
        level: "error",
        message: `${normalized.name}: ${normalized.message}`,
        exception: normalized,
        context,
        environment,
        release,
        timestamp: new Date().toISOString(),
      });
    },
    async captureMessage(message, level = "info", context) {
      await safeSend(transport, {
        type: "message",
        level,
        message: message.slice(0, 500),
        context,
        environment,
        release,
        timestamp: new Date().toISOString(),
      });
    },
  };
}

function normalizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "Error", message: typeof error === "string" ? error : "Unknown error" };
}

function createSentryHttpTransport(
  parsed: ParsedDsn,
  fetchImpl: typeof fetch = runtimeFetch,
): MonitoringTransport {
  return async (envelope) => {
    const header = JSON.stringify({
      event_id: crypto.randomUUID().replaceAll("-", ""),
      dsn: parsed.endpoint.replace(/\/api\/.+$/, ""),
    });
    const body = `${header}\n${JSON.stringify({ type: envelope.type })}\n${JSON.stringify(envelope)}`;
    await fetchImpl(parsed.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}`,
      },
      body,
    });
  };
}

async function safeSend(transport: MonitoringTransport, envelope: SentryEnvelope): Promise<void> {
  try {
    await transport(envelope);
  } catch {
    // Monitoring must never throw into the request path.
  }
}

export function createRequestScope(context: MonitoringContext): MonitoringContext {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  );
}
