import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  withSecurityHeaders,
} from "../../lib/security/headers";
import { sanitizeRestrictedHtml } from "../../lib/security/html";

describe("Content Security Policy", () => {
  it("uses a nonce and never permits inline scripts or script attributes", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "nonce_123456789",
      reportUri: "/api/security/csp-report",
    });
    const scriptDirective = policy
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("script-src "));
    expect(scriptDirective).toContain("'nonce-nonce_123456789'");
    expect(scriptDirective).toContain("'strict-dynamic'");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("style-src-attr 'none'");
    expect(policy).not.toContain("style-src-attr 'unsafe-inline'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain(
      "frame-src 'self' https://www.youtube.com",
    );
    expect(policy).toContain("report-uri /api/security/csp-report");
  });

  it("allows the minimum AdSense origins only when monetization is enabled", () => {
    const off = buildContentSecurityPolicy({ nonce: "nonce_123456789" });
    expect(off).not.toContain("googlesyndication.com");
    const on = buildContentSecurityPolicy({
      nonce: "nonce_123456789",
      adsense: true,
    });
    expect(on).toContain("pagead2.googlesyndication.com");
    expect(on).toContain("googleads.g.doubleclick.net");
  });

  it("supports an explicit report-only rollout header", () => {
    const response = withSecurityHeaders(new Response("ok"), {
      nonce: "nonce_123456789",
      reportOnly: true,
    });
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(
      response.headers.get("content-security-policy-report-only"),
    ).toContain("'nonce-nonce_123456789'");
  });

});

describe("restricted rich-text sanitization", () => {
  it("reconstructs safe markup and removes executable markup and attributes", () => {
    const sanitized = sanitizeRestrictedHtml(
      '<p onclick="steal()">Hello <strong>reader</strong>' +
        '<img src=x onerror=steal()>' +
        '<a href="javascript&#x3a;alert(1)" style="color:red">bad</a>' +
        '<a href="https://example.com/story" onmouseover="steal()">source</a>' +
        "<script>alert(1)</script></p>",
    );
    expect(sanitized).toContain("<p>Hello <strong>reader</strong>");
    expect(sanitized).toContain(
      '<a href="https://example.com/story" rel="nofollow noopener noreferrer">source</a>',
    );
    expect(sanitized).not.toMatch(
      /<script|<img|onclick|onerror|onmouseover|javascript:/i,
    );
  });

  it("blocks dangerous URL schemes and protocol-relative links", () => {
    for (const href of [
      "data:text/html,boom",
      "//attacker.example/path",
      "file:///etc/passwd",
      "java&#x73;cript:alert(1)",
    ]) {
      const sanitized = sanitizeRestrictedHtml(
        `<a href="${href}">unsafe</a>`,
      );
      expect(sanitized).not.toContain("<a ");
    }
  });
});
