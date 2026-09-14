import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  resolveAuthConfiguration,
  type AuthEnvironment,
} from "@/lib/auth/config";
import {
  readSessionCookie,
  type SessionStateReader,
  verifySessionToken,
} from "@/lib/auth/session";
import { createD1StandardAuthRepository } from "@/lib/auth/standard-repository";
import { verifyCloudflareAccessRequest } from "@/lib/auth/cloudflare-access";
import {
  readValidatedProxyIdentity,
  verifyProxyAttestation,
} from "@/lib/auth/trusted-proxy";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  provider: "standard" | "trusted_proxy" | "cloudflare_access";
  sessionId: string | null;
};

const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const STANDARD_SIGN_IN_PATH = "/account/sign-in";
const STANDARD_SIGN_OUT_PATH = "/account/sign-out";
const ACCESS_REQUIRED_PATH = "/account/access-required";
const CALLBACK_PATH = "/callback";

/**
 * Compatibility name retained for existing callers. Authentication is now
 * provider-independent: signed standard sessions are the default, and Sites
 * headers are accepted only with explicit configuration plus Worker attestation.
 */
export async function getChatGPTUser({
  environment,
  sessionStateReader,
}: {
  environment?: AuthEnvironment;
  sessionStateReader?: SessionStateReader;
} = {}): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const runtimeEnvironment = environment ?? (await loadRuntimeAuthEnvironment());
  let configuration;
  try {
    configuration = resolveAuthConfiguration(runtimeEnvironment);
  } catch {
    return null;
  }

  if (configuration.provider === "cloudflare_access") {
    const identity = await verifyCloudflareAccessRequest(requestHeaders, {
      environment: {
        CLOUDFLARE_ACCESS_AUD: configuration.cloudflareAccess.audience,
        CLOUDFLARE_ACCESS_TEAM_DOMAIN:
          configuration.cloudflareAccess.teamDomain,
      },
    });
    if (!identity) return null;
    return {
      userId: `access:${identity.subject}`,
      displayName: identity.name ?? identity.email,
      email: identity.email,
      fullName: identity.name,
      provider: "cloudflare_access",
      sessionId: null,
    };
  }

  if (configuration.provider === "trusted_proxy") {
    if (
      !(await verifyProxyAttestation(requestHeaders, {
        secret: configuration.trustedProxy.secret,
      }))
    ) {
      return null;
    }
    const identity = readValidatedProxyIdentity(requestHeaders);
    if (!identity) return null;
    return {
      userId: `proxy:${identity.email}`,
      displayName: identity.fullName ?? identity.email,
      email: identity.email,
      fullName: identity.fullName,
      provider: "trusted_proxy",
      sessionId: null,
    };
  }

  if (!configuration.sessionSecret) return null;
  const token = readSessionCookie(requestHeaders.get("cookie"));
  if (!token) return null;
  let resolvedStateReader = sessionStateReader;
  if (!resolvedStateReader) {
    try {
      resolvedStateReader = createD1StandardAuthRepository(await getDb());
    } catch {
      // Standard sessions are revocable records. If their authoritative D1
      // state cannot be checked, protected callers fail closed.
      return null;
    }
  }
  const verification = await verifySessionToken(token, {
    secret: configuration.sessionSecret,
    stateReader: resolvedStateReader,
  });
  if (!verification.valid) return null;
  return {
    userId: verification.claims.userId,
    displayName: verification.claims.displayName,
    email: verification.claims.email,
    fullName: verification.claims.displayName,
    provider: "standard",
    sessionId: verification.claims.sessionId,
  };
}

async function loadRuntimeAuthEnvironment(): Promise<AuthEnvironment> {
  try {
    const { env } = (await import("cloudflare:workers")) as unknown as {
      env: Record<string, unknown>;
    };
    const runtime: AuthEnvironment = { ...(process.env as AuthEnvironment) };
    for (const key of [
      "APP_ENV",
      "NODE_ENV",
      "AUTH_PROVIDER",
      "AUTH_SESSION_SECRET",
      "AUTH_TRUSTED_PROXY_MODE",
      "AUTH_TRUSTED_PROXY_PLATFORM",
      "AUTH_TRUSTED_PROXY_SECRET",
      "NEXT_PUBLIC_SITE_URL",
      "CLOUDFLARE_ACCESS_ENABLED",
      "CLOUDFLARE_ACCESS_AUD",
      "CLOUDFLARE_ACCESS_TEAM_DOMAIN",
    ] as const) {
      const value = env[key];
      if (typeof value === "string") runtime[key] = value;
    }
    return runtime;
  } catch {
    return process.env as AuthEnvironment;
  }
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeAuthReturnPath(returnTo);
  const provider = currentAuthProvider();
  const path =
    provider === "trusted_proxy"
      ? SIGN_IN_PATH
      : provider === "cloudflare_access"
        ? ACCESS_REQUIRED_PATH
        : STANDARD_SIGN_IN_PATH;
  return `${path}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeAuthReturnPath(returnTo);
  const provider = currentAuthProvider();
  const path =
    provider === "trusted_proxy"
      ? SIGN_OUT_PATH
      : provider === "cloudflare_access"
        ? "/cdn-cgi/access/logout"
        : STANDARD_SIGN_OUT_PATH;
  return `${path}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function safeAuthReturnPath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(normalized, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === STANDARD_SIGN_IN_PATH ||
    pathname === STANDARD_SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH ||
    pathname === ACCESS_REQUIRED_PATH
  );
}

function currentAuthProvider(): "standard" | "trusted_proxy" | "cloudflare_access" {
  try {
    return resolveAuthConfiguration(process.env).provider;
  } catch {
    return "standard";
  }
}
