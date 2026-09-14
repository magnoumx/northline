import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isPolicyPrimaryDomain,
  resolveSourceAuthority,
} from "../../lib/editorial/source-authority";

describe("policy decides what is first-party", () => {
  it("accepts government and official records", () => {
    for (const domain of ["bls.gov", "who.int", "army.mil", "sec.gov"]) {
      expect(isPolicyPrimaryDomain(domain), domain).toBe(true);
    }
  });

  it("accepts a first-party record that is not a government one", () => {
    // A film, a signing or a launch has no .gov record. Government-only policy
    // made primaryCount structurally zero on the beats this site covers.
    for (const domain of [
      "mlb.com",
      "nfl.com",
      "marvel.com",
      "sonypictures.com",
      "apple.com",
      "prnewswire.com",
    ]) {
      expect(isPolicyPrimaryDomain(domain), domain).toBe(true);
    }
  });

  it("rejects trade press however it describes itself", () => {
    for (const domain of [
      "collider.com",
      "deadline.com",
      "pagesix.com",
      "forbes.com",
      "primetimer.com",
      "eonline.com",
    ]) {
      expect(isPolicyPrimaryDomain(domain), domain).toBe(false);
    }
  });
});

describe("policy corrects an under-claim, not only an over-claim", () => {
  it("recognises a first-party record the model called context", () => {
    // A flood story cited forecast.weather.gov as CONTEXT and was then held
    // back for having no primary source. What a source is does not depend on
    // how the model chose to describe it.
    const resolved = resolveSourceAuthority(
      {
        url: "https://forecast.weather.gov/product.php?issuedby=LWX",
        domain: "forecast.weather.gov",
        sourceKind: "CONTEXT",
        sourceType: "government",
      },
      [],
    );
    expect(resolved?.sourceKind).toBe("PRIMARY");
    expect(resolved?.primaryConfirmedByPolicy).toBe(true);
  });

  it("promotes an under-claimed official league or studio record", () => {
    for (const domain of ["mlb.com", "marvel.com"]) {
      const resolved = resolveSourceAuthority(
        {
          url: `https://${domain}/news/item`,
          domain,
          sourceKind: "INDEPENDENT",
          sourceType: "official",
        },
        [],
      );
      expect(resolved?.sourceKind, domain).toBe("PRIMARY");
    }
  });

  it("refuses to promote a source that misdeclared its own domain", () => {
    // Being on a trusted host by accident is not the same as being that host.
    const resolved = resolveSourceAuthority(
      {
        url: "https://bls.gov/news",
        domain: "cnn.com",
        sourceKind: "CONTEXT",
        sourceType: "government",
      },
      [],
    );
    expect(resolved?.sourceKind).not.toBe("PRIMARY");
    expect(resolved?.downgradeReason).toContain("does not match");
  });

  it("leaves an ordinary source exactly where it was", () => {
    const resolved = resolveSourceAuthority(
      {
        url: "https://apnews.com/article/x",
        domain: "apnews.com",
        sourceKind: "INDEPENDENT",
        sourceType: "wire",
      },
      [],
    );
    expect(resolved?.sourceKind).toBe("INDEPENDENT");
  });
});

describe("a model cannot promote its own link to primary evidence", () => {
  it("downgrades a self-declared primary that policy does not back", () => {
    const resolved = resolveSourceAuthority(
      {
        url: "https://collider.com/some-scoop",
        domain: "collider.com",
        sourceKind: "PRIMARY",
        sourceType: "trade",
      },
      [],
    );
    expect(resolved?.sourceKind).toBe("INDEPENDENT");
    expect(resolved?.primaryConfirmedByPolicy).toBe(false);
  });

  it("is defeated when the registry itself says the domain is primary", () => {
    // This is the loophole: resolveSourceAuthority trusts a registry row, so
    // whoever writes that row decides what primary evidence means.
    const resolved = resolveSourceAuthority(
      {
        url: "https://collider.com/some-scoop",
        domain: "collider.com",
        sourceKind: "PRIMARY",
        sourceType: "trade",
      },
      [
        {
          domain: "collider.com",
          sourceType: "trade",
          credibilityTier: 2,
          isPrimary: true,
        },
      ],
    );
    expect(resolved?.sourceKind).toBe("PRIMARY");
  });

  it("never lets the pipeline write that registry row from a model claim", () => {
    // Closing the loophole above at its only source: the registry writer.
    const newsroom = readFileSync(
      fileURLToPath(new URL("../../lib/editorial/autonomous-newsroom.ts", import.meta.url)),
      "utf8",
    ).replace(/\s+/gu, " ");

    const writer = newsroom.slice(
      newsroom.indexOf("async function persistSources"),
      newsroom.indexOf("function selectSources"),
    );
    expect(writer).toContain("isPolicyPrimaryDomain(domain)");
    expect(writer).toContain("policyPrimary ? 1 : 0");
    // The old form took the model's word for it.
    expect(writer).not.toContain('source.sourceKind === "PRIMARY" ? 1 : 0');
  });
});
