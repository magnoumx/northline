import { describe, expect, it } from "vitest";
import {
  applyMediaEvent,
  assertSvgBlocked,
  createMediaRecord,
  isDuplicateChecksum,
  MediaStateError,
  rightsVerified,
  type MediaRecord,
  type MediaRights,
} from "../../lib/media/lifecycle";

const rights = (permission: MediaRights["permission"] = "LICENSED"): MediaRights => ({
  owner: "Northline",
  creator: "Staff photographer",
  license: "Editorial license #1",
  licenseUrl: "https://licenses.example/1",
  attribution: "© Northline",
  originalUrl: "https://cdn.example/original.jpg",
  permission,
  expiresAt: null,
});

function record(overrides: Partial<MediaRecord> = {}): MediaRecord {
  return {
    id: "media_1",
    checksum: "abc123",
    storageKey: "quarantine/media_1.jpg",
    mime: "image/jpeg",
    state: "QUARANTINED",
    rights: rights(),
    altText: "A verified editorial photograph.",
    caption: "Scene from the hearing.",
    dimensions: { width: 1200, height: 800 },
    createdAt: "2026-07-24T10:00:00Z",
    updatedAt: "2026-07-24T10:00:00Z",
    ...overrides,
  };
}

describe("media upload lifecycle", () => {
  it("creates a quarantined record and blocks SVG", () => {
    const r = createMediaRecord({
      id: "media_2",
      checksum: "def456",
      storageKey: "quarantine/media_2.png",
      mime: "image/png",
      filename: "photo.png",
      rights: rights("PUBLIC_DOMAIN"),
      altText: "alt",
      caption: null,
      dimensions: { width: 100, height: 100 },
    });
    expect(r.state).toBe("QUARANTINED");

    expect(() =>
      createMediaRecord({
        id: "media_3",
        checksum: "x",
        storageKey: "q",
        mime: "image/svg+xml",
        filename: "logo.svg",
        rights: rights(),
        altText: "alt",
        caption: null,
        dimensions: { width: 1, height: 1 },
      }),
    ).toThrow(MediaStateError);
  });

  it("advances quarantined → scanning when validation passes and malware is clean", () => {
    const validating = applyMediaEvent(record(), { type: "BEGIN_VALIDATION" }, new Date());
    expect(validating.state).toBe("VALIDATING");
    const scanning = applyMediaEvent(validating, { type: "MALWARE_CLEAN" }, new Date());
    expect(scanning.state).toBe("SCANNING");
  });

  it("rejects on malware detection", () => {
    const validating = applyMediaEvent(record(), { type: "BEGIN_VALIDATION" }, new Date());
    const rejected = applyMediaEvent(validating, { type: "MALWARE_DETECTED" }, new Date());
    expect(rejected.state).toBe("REJECTED");
  });

  it("preclears public-domain media straight to approved after scanning", () => {
    const scanning = record({ state: "SCANNING", rights: rights("PUBLIC_DOMAIN") });
    const approved = applyMediaEvent(scanning, { type: "RIGHTS_PRECLEARED" }, new Date());
    expect(approved.state).toBe("APPROVED");
  });

  it("refuses approval with unverified rights", () => {
    const scanning = record({ state: "SCANNING", rights: rights("UNVERIFIED") });
    expect(() =>
      applyMediaEvent(scanning, { type: "RIGHTS_PRECLEARED" }, new Date()),
    ).toThrow(MediaStateError);
  });

  it("routes licensed media through rights review then approval", () => {
    const scanning = record({ state: "SCANNING" });
    const review = applyMediaEvent(scanning, { type: "RIGHTS_REQUIRED" }, new Date());
    expect(review.state).toBe("RIGHTS_REVIEW");
    const approved = applyMediaEvent(review, { type: "RIGHTS_CONFIRMED" }, new Date());
    expect(approved.state).toBe("APPROVED");
  });

  it("rejects invalid transitions", () => {
    expect(() =>
      applyMediaEvent(record({ state: "APPROVED" }), { type: "BEGIN_VALIDATION" }, new Date()),
    ).toThrow(MediaStateError);
  });

  it("expires media when permission has lapsed", () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const expired = record({
      state: "APPROVED",
      rights: { ...rights(), expiresAt: "2026-07-15T00:00:00Z" },
    });
    expect(applyMediaEvent(expired, { type: "EXPIRE" }, now).state).toBe("EXPIRED");
  });

  it("does not expire media before its expiry date", () => {
    const now = new Date("2026-07-24T00:00:00Z");
    const active = record({
      state: "APPROVED",
      rights: { ...rights(), expiresAt: "2026-12-31T00:00:00Z" },
    });
    expect(applyMediaEvent(active, { type: "EXPIRE" }, now).state).toBe("APPROVED");
  });
});

describe("media helpers", () => {
  it("detects duplicate checksums", () => {
    expect(isDuplicateChecksum("abc", ["aaa", "abc"])).toBe(true);
    expect(isDuplicateChecksum("xyz", ["aaa", "abc"])).toBe(false);
  });

  it("treats only verified permissions as rights-verified", () => {
    expect(rightsVerified(rights("PUBLIC_DOMAIN"))).toBe(true);
    expect(rightsVerified(rights("LICENSED"))).toBe(true);
    expect(rightsVerified(rights("UNVERIFIED"))).toBe(false);
  });

  it("blocks svg by extension too", () => {
    expect(() => assertSvgBlocked({ mime: "image/png", filename: "sneaky.svg" })).toThrow();
  });
});
