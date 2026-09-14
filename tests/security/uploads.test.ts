import { describe, expect, it } from "vitest";
import {
  detectImageMime,
  validateImageUpload,
} from "../../lib/security/uploads";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function animatedPng(
  width: number,
  height: number,
  frames: number,
): Uint8Array {
  const bytes = new Uint8Array(53);
  bytes.set(png(width, height));
  const view = new DataView(bytes.buffer);
  view.setUint32(33, 8);
  bytes.set([0x61, 0x63, 0x54, 0x4c], 37);
  view.setUint32(41, frames);
  return bytes;
}

function animatedWebp(): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  bytes.set(new TextEncoder().encode("VP8X"), 12);
  bytes[20] = 0x02;
  return bytes;
}

describe("image upload policy", () => {
  it("checks magic bytes, MIME, dimensions, and generates an opaque quarantine key", () => {
    const result = validateImageUpload({
      bytes: png(1_200, 800),
      declaredMime: "image/png",
      filename: "../../campaign-hero.png",
    });
    expect(result).toMatchObject({
      accepted: true,
      detectedMime: "image/png",
      metadata: { width: 1_200, height: 800, frames: 1 },
      quarantineRequired: true,
      malwareScanRequired: true,
      derivativeRequired: true,
    });
    if (result.accepted) {
      expect(result.storageKey).toMatch(
        /^quarantine\/[0-9a-f-]{36}\.png$/,
      );
      expect(result.storageKey).not.toContain("campaign-hero");
    }
  });

  it("rejects SVG, MIME confusion, extension confusion, and image bombs", () => {
    const svg = new TextEncoder().encode(
      '<svg onload="alert(1)" xmlns="http://www.w3.org/2000/svg"></svg>',
    );
    expect(detectImageMime(svg)).toBeNull();
    expect(
      validateImageUpload({
        bytes: svg,
        declaredMime: "image/svg+xml",
        filename: "creative.svg",
      }),
    ).toEqual({ accepted: false, reason: "unsupported_type" });
    expect(
      validateImageUpload({
        bytes: png(100, 100),
        declaredMime: "image/jpeg",
        filename: "creative.jpg",
      }),
    ).toEqual({ accepted: false, reason: "mime_mismatch" });
    expect(
      validateImageUpload({
        bytes: png(100, 100),
        declaredMime: "image/png",
        filename: "creative.jpg",
      }),
    ).toEqual({ accepted: false, reason: "extension_mismatch" });
    expect(
      validateImageUpload({
        bytes: png(6_000, 6_000),
        declaredMime: "image/png",
        filename: "huge.png",
      }),
    ).toEqual({ accepted: false, reason: "too_many_pixels" });
    expect(
      validateImageUpload({
        bytes: animatedPng(1_200, 800, 121),
        declaredMime: "image/png",
        filename: "animated.png",
      }),
    ).toEqual({ accepted: false, reason: "too_many_frames" });
    expect(
      validateImageUpload({
        bytes: animatedWebp(),
        declaredMime: "image/webp",
        filename: "animated.webp",
      }),
    ).toEqual({
      accepted: false,
      reason: "decoder_metadata_required",
    });
  });
});
