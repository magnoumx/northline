import { isPublicIpAddress, parseIpAddress } from "./ip";
import { validateExternalHttpUrl } from "./url";

export interface DnsResolver {
  resolve(hostname: string): Promise<readonly string[]>;
}

export type SafeFetchTarget =
  | {
      safe: true;
      url: URL;
      hostname: string;
      pinnedAddresses: readonly string[];
    }
  | {
      safe: false;
      reason:
        | "invalid_url"
        | "host_not_allowed"
        | "reserved_hostname"
        | "dns_failed"
        | "non_public_address";
    };

export async function validateSafeFetchTarget(
  value: string,
  {
    resolver,
    allowedHosts = [],
    requireHttps = true,
    allowedPorts,
  }: {
    resolver: DnsResolver;
    allowedHosts?: readonly string[];
    requireHttps?: boolean;
    allowedPorts?: readonly number[];
  },
): Promise<SafeFetchTarget> {
  const validation = validateExternalHttpUrl(value, {
    requireHttps,
    allowedPorts,
  });
  if (!validation.valid) return { safe: false, reason: "invalid_url" };

  const hostname = unwrapHostname(validation.url.hostname.toLowerCase());
  if (isReservedHostname(hostname)) {
    return { safe: false, reason: "reserved_hostname" };
  }
  if (allowedHosts.length > 0 && !hostMatchesAllowlist(hostname, allowedHosts)) {
    return { safe: false, reason: "host_not_allowed" };
  }

  const literal = parseIpAddress(hostname);
  if (literal) {
    return isPublicIpAddress(literal.canonical)
      ? {
          safe: true,
          url: validation.url,
          hostname,
          pinnedAddresses: [literal.canonical],
        }
      : { safe: false, reason: "non_public_address" };
  }

  let addresses: readonly string[];
  try {
    addresses = await resolver.resolve(hostname);
  } catch {
    return { safe: false, reason: "dns_failed" };
  }
  const normalized = Array.from(
    new Set(
      addresses
        .map((address) => parseIpAddress(address)?.canonical)
        .filter((address): address is string => Boolean(address)),
    ),
  );
  if (normalized.length === 0) return { safe: false, reason: "dns_failed" };
  if (normalized.some((address) => !isPublicIpAddress(address))) {
    return { safe: false, reason: "non_public_address" };
  }
  return {
    safe: true,
    url: validation.url,
    hostname,
    // A fetch implementation must connect only to this set and revalidate
    // every redirect; resolving again without pinning reopens DNS rebinding.
    pinnedAddresses: normalized,
  };
}

export async function validateSafeRedirect(
  location: string,
  previous: SafeFetchTarget & { safe: true },
  options: Parameters<typeof validateSafeFetchTarget>[1],
): Promise<SafeFetchTarget> {
  let redirected: URL;
  try {
    redirected = new URL(location, previous.url);
  } catch {
    return { safe: false, reason: "invalid_url" };
  }
  return validateSafeFetchTarget(redirected.toString(), options);
}

export function hostMatchesAllowlist(
  hostname: string,
  allowedHosts: readonly string[],
): boolean {
  const normalizedHost = hostname.toLowerCase();
  return allowedHosts.some((entry) => {
    const pattern = entry.trim().toLowerCase();
    if (!pattern || pattern.includes("/") || pattern.includes(":")) return false;
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(2);
      return (
        normalizedHost.length > suffix.length &&
        normalizedHost.endsWith(`.${suffix}`)
      );
    }
    return normalizedHost === pattern;
  });
}

export function isReservedHostname(hostname: string): boolean {
  const normalized = unwrapHostname(hostname.toLowerCase()).replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".home") ||
    normalized.endsWith(".lan") ||
    normalized.endsWith(".test") ||
    normalized.endsWith(".invalid") ||
    normalized.endsWith(".example")
  );
}

function unwrapHostname(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}
