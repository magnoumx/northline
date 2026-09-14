import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

const info = read("components/public/info-pages.tsx");
const routes = read("lib/site/public-routes.ts");
const adsTxt = read("app/ads.txt/route.ts");

/**
 * The checks a reviewer actually performs, held as tests rather than as a
 * checklist someone ticks once. An article count is not readiness.
 */
describe("adsense readiness", () => {
  it("publishes every trust page a reviewer looks for", () => {
    for (const page of [
      "about",
      "ownership",
      "funding",
      "editorial-standards",
      "ai-policy",
      "corrections",
      "contact",
      "privacy",
      "cookies",
      "terms",
      "sponsored-content-policy",
      "security",
    ]) {
      expect(routes, page).toContain(page);
    }
  });

  it("gives a real contact address rather than describing one", () => {
    // The contact page explained how to get in touch and then never said where.
    for (const address of [
      "corrections@usnorthline.com",
      "editorial@usnorthline.com",
      "advertising@usnorthline.com",
      "privacy@usnorthline.com",
      "security@usnorthline.com",
    ]) {
      expect(info, address).toContain(address);
    }
  });

  it("names who publishes the site", () => {
    // "Founder-operated" without a name is not a publisher identity.
    expect(info).toContain("published and operated by Omar Mohamed");
    expect(info).toContain("Editorial responsibility");
  });

  it("states the funding position plainly", () => {
    expect(info).toContain("currently self-funded");
    expect(info).toContain("no undisclosed commercial arrangements");
  });

  it("separates advertising from editorial in writing", () => {
    expect(info).toContain("cannot review coverage before publication");
    expect(info).toContain("cannot have a story removed");
  });

  it("serves ads.txt only once a real publisher id is configured", () => {
    // A placeholder ads.txt is worse than none: it advertises an authorisation
    // that does not exist.
    expect(adsTxt).toContain('process.env.FEATURE_ADSENSE !== "true"');
    expect(adsTxt).toContain("normalizePublisherId(process.env.ADSENSE_CLIENT_ID)");
    expect(adsTxt).toContain("DIRECT, f08c47fec0942fa0");
    expect(adsTxt).toMatch(/\^\(\?:ca-\)\?\(pub-\\d\{10,30\}\)\$/u);
  });

  it("describes the AI workflow without claiming human review", () => {
    // Google's publisher guidance turns on disclosure being accurate.
    expect(info).toContain("We do not claim a human read an article");
    expect(info).not.toContain("reviewed by a human.");
  });
});
