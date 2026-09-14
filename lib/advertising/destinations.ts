import { isPublicIpAddress } from "../security/ip";
import { isReservedHostname } from "../security/ssrf";
import { validateExternalHttpUrl } from "../security/url";

export type AdvertiserDestination =
  | { valid: true; url: URL }
  | { valid: false; reason: "INVALID_URL" | "RESERVED_HOST" | "NOT_APPROVED" };

export function validateAdvertiserDestination(
  value: string,
  approvedHosts: readonly string[] = [],
): AdvertiserDestination {
  const parsed = validateExternalHttpUrl(value, {
    requireHttps: true,
    allowFragments: false,
    allowedPorts: [443],
  });
  if (!parsed.valid) return { valid: false, reason: "INVALID_URL" };
  const hostname = parsed.url.hostname.toLowerCase();
  if (isReservedHostname(hostname)) {
    return { valid: false, reason: "RESERVED_HOST" };
  }
  if (/^[\d.]+$/u.test(hostname) && !isPublicIpAddress(hostname)) {
    return { valid: false, reason: "RESERVED_HOST" };
  }
  if (
    approvedHosts.length > 0 &&
    !approvedHosts.some(
      (host) =>
        hostname === host.toLowerCase() ||
        hostname.endsWith(`.${host.toLowerCase()}`),
    )
  ) {
    return { valid: false, reason: "NOT_APPROVED" };
  }
  parsed.url.username = "";
  parsed.url.password = "";
  parsed.url.hash = "";
  return { valid: true, url: parsed.url };
}

export function parseApprovedDestinationHosts(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/u.test(host) && !isReservedHostname(host));
}

