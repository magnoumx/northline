import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync("styles/public-tokens.css", "utf8");

describe("dark theme tokens (Provenance)", () => {
  it("uses the blue-slate archive ground, not near-black or the old navy tint", () => {
    // Provenance replaced the near-black #0b0b0f dark that read as a generic
    // AI default. The ground is a blue-slate the paper text sits on.
    expect(tokensCss).not.toContain("--pub-bg: #0b0b0f;");
    expect(tokensCss).not.toContain("--pub-bg: #10141c;");
    expect(tokensCss).toContain("--pub-bg: #141a20;");
  });

  it("carries warm paper text rather than stark white", () => {
    expect(tokensCss).toContain("--pub-text: #e9e5dc;");
  });

  it("makes the traced teal the interactive colour, not the old vermilion", () => {
    // The vermilion #e8544a was the other half of the generic default.
    expect(tokensCss).not.toContain("#e8544a");
    expect(tokensCss).toContain("--pub-accent: #5ea8a0;");
  });

  it("keeps a verified colour distinct from the brand accent", () => {
    // One state earns its own colour; it must not collapse into the link teal.
    expect(tokensCss).toMatch(/--pub-verified: #74cba9;/u);
    expect(tokensCss).not.toMatch(/--pub-verified: #5ea8a0;/u);
  });

  it("keeps the dark block and its prefers-color-scheme fallback in sync", () => {
    // This invariant predates Provenance and still matters: an explicit toggle
    // and a dark OS must resolve to identical values, or the two paths drift.
    const explicitDarkBlock =
      tokensCss.split(':root[data-theme="dark"]')[1]?.split("}")[0] ?? "";
    const systemDarkBlock =
      tokensCss.split("@media (prefers-color-scheme: dark)")[1] ?? "";
    for (const line of [
      "--pub-bg: #141a20;",
      "--pub-bg-raised: #1b232b;",
      "--pub-text: #e9e5dc;",
      "--pub-accent: #5ea8a0;",
      "--pub-verified: #74cba9;",
      "--pub-line: #262f38;",
      "--pub-line-strong: #384450;",
    ]) {
      expect(explicitDarkBlock).toContain(line);
      expect(systemDarkBlock).toContain(line);
    }
  });
});
