import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { publisherLogo } from "../../lib/site/publisher-logo";

const origin = "https://usnorthline.com";

describe("publisher logo in structured data", () => {
  it("falls back to a real image when no logo is configured", () => {
    // `new URL("", origin)` does not throw - it resolves to the origin - so an
    // unset APP_LOGO silently declared the homepage as the publisher's logo,
    // an ImageObject whose url served HTML.
    for (const unset of ["", "   ", undefined]) {
      const logo = publisherLogo(unset, origin);
      expect(logo.url, String(unset)).toBe(`${origin}/brand/square-logo.png`);
      expect(logo.url).not.toBe(`${origin}/`);
    }
  });

  it("declares dimensions, which an ImageObject is expected to carry", () => {
    const logo = publisherLogo("", origin);
    expect(logo.width).toBe(1000);
    expect(logo.height).toBe(1000);
  });

  it("honours a configured logo and makes it absolute", () => {
    expect(publisherLogo("/brand/custom.png", origin).url).toBe(
      `${origin}/brand/custom.png`,
    );
    expect(publisherLogo("https://cdn.example.com/l.png", origin).url).toBe(
      "https://cdn.example.com/l.png",
    );
  });

  it("never returns the origin itself, whatever it is handed", () => {
    for (const value of ["", "/", "   ", "not a url", "://broken"]) {
      expect(publisherLogo(value, origin).url, value).not.toBe(`${origin}/`);
    }
  });

  it("ships the asset it points at", () => {
    const png = readFileSync(
      fileURLToPath(new URL("../../public/brand/square-logo.png", import.meta.url)),
    );
    // PNG magic number, so a truncated or placeholder file fails here.
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // Dimensions live big-endian at byte 16 of the IHDR chunk.
    expect(png.readUInt32BE(16)).toBe(1000);
    expect(png.readUInt32BE(20)).toBe(1000);
  });
});
