import { describe, expect, it } from "vitest";
import {
  validateSafeFetchTarget,
  validateSafeRedirect,
  type DnsResolver,
} from "../../lib/security/ssrf";
import {
  safeRelativeRedirectPath,
  validateExternalHttpUrl,
} from "../../lib/security/url";

describe("redirect and destination URL safety", () => {
  it("allows only same-origin relative redirect shapes", () => {
    expect(safeRelativeRedirectPath("/newsroom?tab=review")).toBe(
      "/newsroom?tab=review",
    );
    for (const value of [
      "https://attacker.example",
      "//attacker.example",
      "/\\attacker.example",
      "\\\\attacker.example",
      "javascript:alert(1)",
    ]) {
      expect(safeRelativeRedirectPath(value)).toBe("/");
    }
  });

  it("rejects dangerous schemes, credentials, ports, and fragments", () => {
    expect(validateExternalHttpUrl("https://example.com/path").valid).toBe(
      true,
    );
    for (const value of [
      "http://example.com",
      "https://user:pass@example.com",
      "https://example.com:8443",
      "https://example.com/path#secret",
      "javascript:alert(1)",
    ]) {
      expect(validateExternalHttpUrl(value).valid).toBe(false);
    }
  });
});

describe("SSRF validation", () => {
  const publicResolver: DnsResolver = {
    async resolve() {
      return ["93.184.216.34"];
    },
  };

  it("rejects loopback, alternate numeric loopback, and metadata targets", async () => {
    for (const value of [
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://[::ffff:127.0.0.1]/",
      "https://[64:ff9b::7f00:1]/",
      "https://[2002:7f00:1::]/",
      "https://[fec0::1]/",
      "https://2130706433/",
      "https://169.254.169.254/latest/meta-data/",
      "https://localhost/",
    ]) {
      expect(
        (await validateSafeFetchTarget(value, { resolver: publicResolver }))
          .safe,
      ).toBe(false);
    }
  });

  it("rejects any DNS answer set containing a private address", async () => {
    const rebindingResolver: DnsResolver = {
      async resolve() {
        return ["93.184.216.34", "10.0.0.8"];
      },
    };
    expect(
      await validateSafeFetchTarget("https://news.example.net/feed", {
        resolver: rebindingResolver,
      }),
    ).toEqual({ safe: false, reason: "non_public_address" });
  });

  it("returns public addresses for connection pinning and revalidates redirects", async () => {
    const safe = await validateSafeFetchTarget(
      "https://feeds.example.net/news",
      {
        resolver: publicResolver,
        allowedHosts: ["*.example.net"],
      },
    );
    expect(safe).toMatchObject({
      safe: true,
      pinnedAddresses: ["93.184.216.34"],
    });
    if (!safe.safe) throw new Error("Expected a safe target.");

    const redirected = await validateSafeRedirect(
      "https://169.254.169.254/latest",
      safe,
      {
        resolver: publicResolver,
      },
    );
    expect(redirected).toEqual({
      safe: false,
      reason: "non_public_address",
    });
  });
});
