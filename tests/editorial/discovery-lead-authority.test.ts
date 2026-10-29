import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveDiscoveryLeads } from "../../lib/editorial/source-authority";

const flat = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8").replace(/\s+/gu, " ");

// 2026-10-29: live search reported 3 primary leads for "price of gold", the
// draft cost 76,629 micros, and the gate held it for missing_primary_source -
// every lead the model called PRIMARY was a market-news site.
describe("live-search leads are labelled by the publication gate's rule", () => {
  const registry = [
    { domain: "lbma.org.uk", sourceType: "industry", credibilityTier: 1, isPrimary: true },
  ];

  it("does not count a model-declared PRIMARY that policy rejects", () => {
    const leads = resolveDiscoveryLeads(
      [
        { url: "https://www.kitco.com/news/gold", sourceKind: "PRIMARY" as const },
        { url: "https://www.bullionvault.com/gold-news/x", sourceKind: "PRIMARY" as const },
        { url: "https://www.cnbc.com/2026/10/28/gold.html", sourceKind: "INDEPENDENT" as const },
      ],
      registry,
      "price of gold",
    );
    expect(leads.map((lead) => lead.sourceKind)).toEqual([
      "INDEPENDENT",
      "INDEPENDENT",
      "INDEPENDENT",
    ]);
  });

  it("keeps policy, registry and first-party primaries, whatever the model said", () => {
    const leads = resolveDiscoveryLeads(
      [
        { url: "https://www.federalreserve.gov/newsevents/x.htm", sourceKind: "CONTEXT" as const },
        { url: "https://www.lbma.org.uk/prices", sourceKind: "INDEPENDENT" as const },
        { url: "https://about.netflix.com/en/news/x", sourceKind: "PRIMARY" as const },
      ],
      registry,
      "Netflix Orders The Gentlemen Season 2",
    );
    expect(leads.map((lead) => lead.sourceKind)).toEqual(["PRIMARY", "PRIMARY", "PRIMARY"]);
  });

  it("drops leads with an unusable URL and keeps the other fields", () => {
    const leads = resolveDiscoveryLeads(
      [
        { url: "not a url", sourceKind: "PRIMARY" as const, name: "x" },
        { url: "https://www.sec.gov/news/x", sourceKind: "PRIMARY" as const, name: "SEC" },
      ],
      [],
    );
    expect(leads).toEqual([
      { url: "https://www.sec.gov/news/x", sourceKind: "PRIMARY", name: "SEC" },
    ]);
  });

  it("is what the reportability check and the research handoff use", () => {
    const newsroom = flat("../../lib/editorial/autonomous-newsroom.ts");
    expect(newsroom).toContain(
      "const leads = resolveDiscoveryLeads( discovery.data.sources, registryAuthority, input.headline, );",
    );
    expect(newsroom).toContain("liveSourceLeads = { ...discovery.data, sources: leads };");
    expect(newsroom).not.toContain("const leads = discovery.data.sources;");
  });
});
