import { describe, expect, it } from "vitest";
import {
  domainFromUrl,
  resolveSourceAuthority,
} from "../../lib/editorial/source-authority";

const registry = [
  {
    domain: "reuters.com",
    sourceType: "NEWSROOM",
    credibilityTier: 1,
    isPrimary: false,
  },
  {
    domain: "congress.gov",
    sourceType: "GOVERNMENT",
    credibilityTier: 1,
    isPrimary: true,
  },
];

describe("source authority resolution", () => {
  it("rejects a fabricated domain that borrows a trusted publisher", () => {
    // The reported attack: a model-controlled `domain` field claiming to be a
    // government record while the link points somewhere else entirely.
    const resolved = resolveSourceAuthority(
      {
        url: "https://attacker.example/fabricated-report",
        domain: "congress.gov",
        sourceKind: "PRIMARY",
        sourceType: "GOVERNMENT",
      },
      registry,
    );

    expect(resolved).not.toBeNull();
    expect(resolved?.domain).toBe("attacker.example");
    expect(resolved?.sourceKind).not.toBe("PRIMARY");
    expect(resolved?.primaryConfirmedByPolicy).toBe(false);
    expect(resolved?.downgradeReason).toContain("does not match");
  });

  it("refuses to let a model promote an ordinary page to primary evidence", () => {
    const resolved = resolveSourceAuthority(
      {
        url: "https://blog.example.com/opinion",
        domain: "blog.example.com",
        sourceKind: "PRIMARY",
        sourceType: "PRIMARY_DOCUMENT",
      },
      registry,
    );

    expect(resolved?.sourceKind).toBe("INDEPENDENT");
    expect(resolved?.primaryConfirmedByPolicy).toBe(false);
  });

  it("confirms primary status when policy or the registry agrees", () => {
    for (const url of [
      "https://www.congress.gov/bill/119th-congress/senate-bill/1",
      "https://www.nasa.gov/press-release/example",
    ]) {
      const resolved = resolveSourceAuthority(
        {
          url,
          domain: new URL(url).hostname.replace(/^www\./u, ""),
          sourceKind: "PRIMARY",
          sourceType: "GOVERNMENT",
        },
        registry,
      );

      expect(resolved?.sourceKind, url).toBe("PRIMARY");
      expect(resolved?.primaryConfirmedByPolicy, url).toBe(true);
    }
  });

  it("takes credibility and type from the registry rather than the model", () => {
    const resolved = resolveSourceAuthority(
      {
        url: "https://www.reuters.com/world/example",
        domain: "reuters.com",
        sourceKind: "INDEPENDENT",
        sourceType: "SOCIAL_POST",
      },
      registry,
    );

    expect(resolved?.sourceType).toBe("NEWSROOM");
    expect(resolved?.credibilityTier).toBe(1);
  });

  it("discards sources whose URL cannot be trusted", () => {
    for (const url of [
      "http://insecure.example.com/page",
      "https://user:pass@example.com/page",
      "not-a-url",
    ]) {
      expect(domainFromUrl(url), url).toBeNull();
    }
  });

  it("recognises a first-party domain named in the story as primary", () => {
    // The bug that made every article unpublishable: netflix.com is the
    // first-party record for a Netflix show but is not on the curated
    // allowlist, so it was downgraded to INDEPENDENT and the story read as
    // having no primary source.
    const resolved = resolveSourceAuthority(
      {
        url: "https://www.netflix.com/tudum/articles/the-gentlemen-renewed",
        domain: "netflix.com",
        sourceKind: "PRIMARY",
        sourceType: "PRIMARY_DOCUMENT",
      },
      registry,
      "Netflix Orders The Gentlemen Season 2 With Theo James",
    );
    expect(resolved?.sourceKind).toBe("PRIMARY");
    expect(resolved?.primaryConfirmedByPolicy).toBe(true);
  });

  it("recognises a subject's own long-tail domain as primary", () => {
    const resolved = resolveSourceAuthority(
      {
        url: "https://www.draper.vc/news/draper-associates-fund-viii",
        domain: "draper.vc",
        sourceKind: "PRIMARY",
        sourceType: "PRIMARY_DOCUMENT",
      },
      registry,
      "Tim Draper Secures $150 Million Fund VIII to Back AI Founders",
    );
    expect(resolved?.sourceKind).toBe("PRIMARY");
  });

  it("never promotes independent press even when the outlet is named", () => {
    const resolved = resolveSourceAuthority(
      {
        url: "https://variety.com/2026/tv/news/story",
        domain: "variety.com",
        sourceKind: "PRIMARY",
        sourceType: "NEWSROOM",
      },
      registry,
      "Variety Launches New Streaming Vertical",
    );
    expect(resolved?.sourceKind).not.toBe("PRIMARY");
  });

  it("does not subject-promote when the domain brand is not in the story", () => {
    const resolved = resolveSourceAuthority(
      {
        url: "https://randomblog.example/post",
        domain: "randomblog.example",
        sourceKind: "PRIMARY",
        sourceType: "PRIMARY_DOCUMENT",
      },
      registry,
      "Netflix Orders The Gentlemen Season 2",
    );
    expect(resolved?.sourceKind).not.toBe("PRIMARY");
  });

  it("does not subject-promote a spoofed domain even if the brand matches", () => {
    const resolved = resolveSourceAuthority(
      {
        url: "https://attacker.example/fake",
        domain: "netflix.com",
        sourceKind: "PRIMARY",
        sourceType: "PRIMARY_DOCUMENT",
      },
      registry,
      "Netflix Orders The Gentlemen Season 2",
    );
    expect(resolved?.sourceKind).not.toBe("PRIMARY");
  });


  it("promotes a first-party domain even when the model under-labelled it", () => {
    // The model tags a subject's own site as INDEPENDENT more often than not;
    // policy must recognise it as primary regardless of the model's label, or
    // the story reads as having no primary source.
    const resolved = resolveSourceAuthority(
      {
        url: "https://www.netflix.com/tudum/articles/the-gentlemen-renewed",
        domain: "netflix.com",
        sourceKind: "INDEPENDENT",
        sourceType: "NEWSROOM",
      },
      registry,
      "Netflix Orders The Gentlemen Season 2 With Theo James",
    );
    expect(resolved?.sourceKind).toBe("PRIMARY");
  });

});
