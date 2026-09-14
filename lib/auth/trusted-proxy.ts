import type { AuthConfiguration, AuthEnvironment } from "./config";
import { canonicalizeIpAddress } from "../security/ip";
import {
  hmacSha256Base64Url,
  randomBase64Url,
  verifyHmacSha256Base64Url,
} from "../security/crypto";

export const TRUSTED_IDENTITY_HEADERS = {
  email: "oai-authenticated-user-email",
  fullName: "oai-authenticated-user-full-name",
  fullNameEncoding: "oai-authenticated-user-full-name-encoding",
} as const;

export const INTERNAL_PROXY_HEADERS = {
  attestation: "x-northline-proxy-attestation",
  clientAddress: "x-northline-client-address",
} as const;

const ATTESTATION_VERSION = "npa1";
const ATTESTATION_MAX_AGE_SECONDS = 60;
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export type TrustedProxyIdentity = {
  email: string;
  fullName: string | null;
};

export function stripProxyControlledHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  for (const name of [
    ...Object.values(TRUSTED_IDENTITY_HEADERS),
    ...Object.values(INTERNAL_PROXY_HEADERS),
  ]) {
    headers.delete(name);
  }
  return headers;
}

export function isTrustedSitesRuntimeRequest(
  request: Request,
  configuration: AuthConfiguration,
  environment: AuthEnvironment,
): boolean {
  if (
    !configuration.trustedProxy.enabled ||
    configuration.trustedProxy.platform !== "sites"
  ) {
    return false;
  }
  const cloudflareContext = Reflect.get(request, "cf");
  if (!cloudflareContext || typeof cloudflareContext !== "object") return false;

  const requestHost = new URL(request.url).host.toLowerCase();
  const configuredHost = configuredSiteHost(environment.NEXT_PUBLIC_SITE_URL);
  if (configuredHost) return requestHost === configuredHost;
  return requestHost.endsWith(".chatgpt.site");
}

export function readValidatedProxyIdentity(
  headers: Headers,
): TrustedProxyIdentity | null {
  const email = headers
    .get(TRUSTED_IDENTITY_HEADERS.email)
    ?.trim()
    .toLowerCase();
  if (!email || !isEmail(email)) return null;

  const encodedFullName = headers
    .get(TRUSTED_IDENTITY_HEADERS.fullName)
    ?.trim();
  let fullName: string | null = null;
  if (
    encodedFullName &&
    headers.get(TRUSTED_IDENTITY_HEADERS.fullNameEncoding) ===
      PERCENT_ENCODED_UTF8
  ) {
    try {
      const decoded = decodeURIComponent(encodedFullName).trim();
      if (
        decoded.length >= 1 &&
        decoded.length <= 160 &&
        !CONTROL_CHARACTERS.test(decoded)
      ) {
        fullName = decoded;
      }
    } catch {
      return null;
    }
  }

  return { email, fullName };
}

export function readValidatedClientAddress(headers: Headers): string | null {
  const value = headers.get(INTERNAL_PROXY_HEADERS.clientAddress);
  return value ? canonicalizeIpAddress(value) : null;
}

export async function addProxyAttestation(
  headers: Headers,
  {
    secret,
    now = new Date(),
  }: {
    secret: string;
    now?: Date;
  },
): Promise<void> {
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const nonce = randomBase64Url(16);
  const unsigned = attestationPayload(headers, issuedAt, nonce);
  const signature = await hmacSha256Base64Url(secret, unsigned);
  headers.set(
    INTERNAL_PROXY_HEADERS.attestation,
    `${ATTESTATION_VERSION}.${issuedAt}.${nonce}.${signature}`,
  );
}

export async function verifyProxyAttestation(
  headers: Headers,
  {
    secret,
    now = new Date(),
  }: {
    secret: string;
    now?: Date;
  },
): Promise<boolean> {
  const token = headers.get(INTERNAL_PROXY_HEADERS.attestation);
  if (!token) return false;
  const parts = token.split(".");
  if (
    parts.length !== 4 ||
    parts[0] !== ATTESTATION_VERSION ||
    !/^\d{10,12}$/.test(parts[1]) ||
    !/^[A-Za-z0-9_-]{22}$/.test(parts[2])
  ) {
    return false;
  }
  const issuedAt = Number(parts[1]);
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt > nowSeconds + 5 ||
    nowSeconds - issuedAt > ATTESTATION_MAX_AGE_SECONDS
  ) {
    return false;
  }
  return verifyHmacSha256Base64Url(
    secret,
    attestationPayload(headers, issuedAt, parts[2]),
    parts[3],
  );
}

export function copyTrustedSitesIdentity(
  source: Headers,
  destination: Headers,
): void {
  const identity = readValidatedProxyIdentity(source);
  if (!identity) return;
  destination.set(TRUSTED_IDENTITY_HEADERS.email, identity.email);
  const encodedName = source.get(TRUSTED_IDENTITY_HEADERS.fullName);
  if (identity.fullName && encodedName) {
    destination.set(TRUSTED_IDENTITY_HEADERS.fullName, encodedName);
    destination.set(
      TRUSTED_IDENTITY_HEADERS.fullNameEncoding,
      PERCENT_ENCODED_UTF8,
    );
  }
}

function attestationPayload(
  headers: Headers,
  issuedAt: number,
  nonce: string,
): string {
  return JSON.stringify({
    version: 1,
    issuedAt,
    nonce,
    email: headers.get(TRUSTED_IDENTITY_HEADERS.email)?.trim() ?? "",
    fullName: headers.get(TRUSTED_IDENTITY_HEADERS.fullName)?.trim() ?? "",
    fullNameEncoding:
      headers.get(TRUSTED_IDENTITY_HEADERS.fullNameEncoding)?.trim() ?? "",
    clientAddress:
      headers.get(INTERNAL_PROXY_HEADERS.clientAddress)?.trim() ?? "",
  });
}

function configuredSiteHost(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

function isEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    !CONTROL_CHARACTERS.test(value)
  );
}
