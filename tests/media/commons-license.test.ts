import { describe, expect, it } from "vitest";
import { isAcceptedCommonsLicense } from "../../lib/media/commons-editorial";

describe("Wikimedia Commons license acceptance", () => {
  it("accepts the licences that permit commercial editorial reuse", () => {
    for (const license of [
      "CC0",
      "CC0 1.0",
      "Public Domain",
      "PDM 1.0",
      "CC BY 2.0",
      "CC BY 4.0",
      "CC BY-SA 3.0",
      "CC BY-SA 4.0",
      "cc by-sa 4.0",
      "CC-BY-4.0",
    ]) {
      expect(isAcceptedCommonsLicense(license), license).toBe(true);
    }
  });

  it("rejects noncommercial and no-derivatives variants", () => {
    // A word-boundary prefix match used to let these through as "CC BY".
    for (const license of [
      "CC BY-NC 4.0",
      "CC BY-NC-SA 4.0",
      "CC BY-ND 4.0",
      "CC BY-NC-ND 3.0",
      "cc by-nc 2.0",
      "CC BY-NonCommercial 4.0",
    ]) {
      expect(isAcceptedCommonsLicense(license), license).toBe(false);
    }
  });

  it("rejects unknown, empty, and unversioned marketing strings", () => {
    for (const license of [
      "",
      "   ",
      "All rights reserved",
      "Fair use",
      "GFDL",
      "CC BY 9.0",
      "Copyrighted free use",
      "Attribution required, commercial use prohibited",
    ]) {
      expect(isAcceptedCommonsLicense(license), license).toBe(false);
    }
  });
});

describe("licence rejection cannot be silently disabled", () => {
  it("rejects noncommercial and no-derivatives forms", () => {
    // The bug this covers: the rejection expression carried a literal
    // backspace where a word boundary was intended, so it never matched and
    // the allowlist was the only remaining guard.
    for (const licence of [
      "CC BY-NC 4.0",
      "CC BY-NC-SA 4.0",
      "CC BY-ND 4.0",
      "CC BY-NC-ND 3.0",
      "Noncommercial use only",
      "CC BY-NoDerivatives 4.0",
    ]) {
      expect(isAcceptedCommonsLicense(licence), licence).toBe(false);
    }
  });

  it("still accepts the commercial-safe forms", () => {
    for (const licence of [
      "CC0 1.0",
      "CC BY 4.0",
      "CC BY-SA 3.0",
      "Public Domain",
    ]) {
      expect(isAcceptedCommonsLicense(licence), licence).toBe(true);
    }
  });
});
