import {
  AuthConfigurationError,
  resolveAuthConfiguration,
  type AuthEnvironment,
} from "../auth/config";
import {
  addProxyAttestation,
  copyTrustedSitesIdentity,
  INTERNAL_PROXY_HEADERS,
  isTrustedSitesRuntimeRequest,
  readValidatedClientAddress,
  stripProxyControlledHeaders,
  verifyProxyAttestation,
} from "../auth/trusted-proxy";
import { canonicalizeIpAddress } from "./ip";

const UNTRUSTED_FORWARDING_HEADERS = [
  "cf-connecting-ip",
  "forwarded",
  "true-client-ip",
  "x-client-ip",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
] as const;

type RuntimeEnvironment = AuthEnvironment & Record<string, unknown>;
type RequestWithCloudflareContext = Request & { cf?: unknown };

/**
 * Sanitizes all externally controllable identity/forwarding headers. In an
 * explicitly configured Sites runtime, it then copies only validated platform
 * identity fields and adds a short-lived internal HMAC attestation.
 */
export async function hardenIncomingRequest(
  request: Request,
  environment: RuntimeEnvironment,
): Promise<Request> {
  const sourceHeaders = request.headers;
  const headers = stripProxyControlledHeaders(sourceHeaders);
  for (const name of UNTRUSTED_FORWARDING_HEADERS) headers.delete(name);

  let configuration;
  try {
    configuration = resolveAuthConfiguration(environment);
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    return cloneRequestWithHeaders(request, headers);
  }

  if (!isTrustedSitesRuntimeRequest(request, configuration, environment)) {
    return cloneRequestWithHeaders(request, headers);
  }
  const proxySecret = configuration.trustedProxy.secret;
  if (!proxySecret) return cloneRequestWithHeaders(request, headers);

  const clientAddress = canonicalizeIpAddress(
    sourceHeaders.get("cf-connecting-ip") ?? "",
  );
  if (clientAddress) {
    headers.set(INTERNAL_PROXY_HEADERS.clientAddress, clientAddress);
  }
  if (configuration.provider === "trusted_proxy") {
    copyTrustedSitesIdentity(sourceHeaders, headers);
  }
  await addProxyAttestation(headers, {
    secret: proxySecret,
  });
  return cloneRequestWithHeaders(request, headers);
}

export async function resolveAttestedClientAddress(
  headers: Headers,
  environment: AuthEnvironment = process.env as AuthEnvironment,
): Promise<string> {
  try {
    const configuration = resolveAuthConfiguration(environment);
    const secret = configuration.trustedProxy.secret;
    if (
      !configuration.trustedProxy.enabled ||
      !secret ||
      !(await verifyProxyAttestation(headers, { secret }))
    ) {
      return "unavailable";
    }
    return readValidatedClientAddress(headers) ?? "unavailable";
  } catch {
    return "unavailable";
  }
}

export function cloneRequestWithHeaders(
  request: Request,
  headers: Headers,
): Request {
  let cloned: Request;
  try {
    cloned = new Request(request, { headers });
  } catch {
    const init: RequestInit & { cf?: unknown } = {
      method: request.method,
      headers,
      body: request.body ?? undefined,
      redirect: request.redirect,
      signal: request.signal,
    };
    if (request.body) {
      Object.assign(init, { duplex: "half" });
    }
    cloned = new Request(request.url, init);
  }

  const cloudflareContext = (request as RequestWithCloudflareContext).cf;
  if (cloudflareContext !== undefined) {
    Object.defineProperty(cloned, "cf", {
      value: cloudflareContext,
      enumerable: true,
      configurable: true,
    });
  }
  return cloned;
}

export function runtimeAuthEnvironment(
  runtime: Record<string, unknown> = {},
): AuthEnvironment {
  const value = (name: keyof AuthEnvironment): string | undefined => {
    const runtimeValue = runtime[name];
    return typeof runtimeValue === "string"
      ? runtimeValue
      : process.env[name];
  };
  return {
    APP_ENV: value("APP_ENV"),
    NODE_ENV: value("NODE_ENV"),
    AUTH_PROVIDER: value("AUTH_PROVIDER"),
    AUTH_SESSION_SECRET: value("AUTH_SESSION_SECRET"),
    AUTH_TRUSTED_PROXY_MODE: value("AUTH_TRUSTED_PROXY_MODE"),
    AUTH_TRUSTED_PROXY_PLATFORM: value("AUTH_TRUSTED_PROXY_PLATFORM"),
    AUTH_TRUSTED_PROXY_SECRET: value("AUTH_TRUSTED_PROXY_SECRET"),
    NEXT_PUBLIC_SITE_URL: value("NEXT_PUBLIC_SITE_URL"),
    CLOUDFLARE_ACCESS_ENABLED: value("CLOUDFLARE_ACCESS_ENABLED"),
    CLOUDFLARE_ACCESS_AUD: value("CLOUDFLARE_ACCESS_AUD"),
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: value("CLOUDFLARE_ACCESS_TEAM_DOMAIN"),
  };
}
