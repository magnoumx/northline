export const MEDIA_STATES = [
  "UPLOADED",
  "QUARANTINED",
  "VALIDATING",
  "SCANNING",
  "RIGHTS_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;

export type MediaState = (typeof MEDIA_STATES)[number];

export type MediaPermission =
  | "PUBLIC_DOMAIN"
  | "LICENSED"
  | "EDITORIAL"
  | "PRESS"
  | "WIKIMEDIA_COMPATIBLE"
  | "SOCIAL_EMBED"
  | "UNVERIFIED";

export type MediaRights = {
  owner: string;
  creator: string;
  license: string;
  licenseUrl: string | null;
  attribution: string;
  originalUrl: string | null;
  permission: MediaPermission;
  expiresAt: string | null;
};

export type MediaRecord = {
  id: string;
  checksum: string;
  storageKey: string;
  mime: string;
  state: MediaState;
  rights: MediaRights;
  altText: string;
  caption: string | null;
  dimensions: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
};

export type MediaEvent =
  | { type: "QUARANTINE" }
  | { type: "BEGIN_VALIDATION" }
  | { type: "MALWARE_CLEAN" }
  | { type: "MALWARE_DETECTED" }
  | { type: "RIGHTS_REQUIRED" }
  | { type: "RIGHTS_PRECLEARED" }
  | { type: "RIGHTS_CONFIRMED" }
  | { type: "RIGHTS_DENIED" }
  | { type: "EXPIRE" };

const TRANSITIONS: Record<MediaState, Partial<Record<MediaEvent["type"], MediaState>>> = {
  UPLOADED: { QUARANTINE: "QUARANTINED", EXPIRE: "EXPIRED" },
  QUARANTINED: { BEGIN_VALIDATION: "VALIDATING", EXPIRE: "EXPIRED" },
  VALIDATING: { MALWARE_CLEAN: "SCANNING", MALWARE_DETECTED: "REJECTED", EXPIRE: "EXPIRED" },
  SCANNING: {
    RIGHTS_REQUIRED: "RIGHTS_REVIEW",
    RIGHTS_PRECLEARED: "APPROVED",
    EXPIRE: "EXPIRED",
  },
  RIGHTS_REVIEW: {
    RIGHTS_CONFIRMED: "APPROVED",
    RIGHTS_DENIED: "REJECTED",
    EXPIRE: "EXPIRED",
  },
  APPROVED: { EXPIRE: "EXPIRED" },
  REJECTED: {},
  EXPIRED: {},
};

export class MediaStateError extends Error {
  constructor(
    readonly code: "INVALID_TRANSITION" | "SVG_BLOCKED" | "DUPLICATE" | "RIGHTS_UNVERIFIED",
    message: string,
  ) {
    super(message);
    this.name = "MediaStateError";
  }
}

export function assertSvgBlocked(input: { mime: string; filename: string }): void {
  const isSvg =
    input.mime.trim().toLowerCase() === "image/svg+xml" ||
    /\.svgz?$/i.test(input.filename);
  if (isSvg) {
    throw new MediaStateError(
      "SVG_BLOCKED",
      "SVG uploads are blocked until sanitized through an approved sanitizer.",
    );
  }
}

export function isDuplicateChecksum(
  checksum: string,
  existingChecksums: readonly string[],
): boolean {
  return existingChecksums.includes(checksum);
}

export function rightsVerified(rights: MediaRights): boolean {
  return rights.permission !== "UNVERIFIED";
}

export function applyMediaEvent(
  record: MediaRecord,
  event: MediaEvent,
  now: Date,
): MediaRecord {
  const next = TRANSITIONS[record.state]?.[event.type];
  if (!next) {
    throw new MediaStateError(
      "INVALID_TRANSITION",
      `Cannot apply ${event.type} to a media object in ${record.state}.`,
    );
  }
  if (next === "APPROVED" && !rightsVerified(record.rights)) {
    throw new MediaStateError(
      "RIGHTS_UNVERIFIED",
      "Media cannot be approved with UNVERIFIED rights.",
    );
  }
  if (
    event.type === "EXPIRE" &&
    record.rights.expiresAt &&
    new Date(record.rights.expiresAt).getTime() > now.getTime()
  ) {
    return record;
  }
  return { ...record, state: next, updatedAt: now.toISOString() };
}

export function createMediaRecord(input: {
  id: string;
  checksum: string;
  storageKey: string;
  mime: string;
  filename: string;
  rights: MediaRights;
  altText: string;
  caption: string | null;
  dimensions: { width: number; height: number };
  now?: Date;
}): MediaRecord {
  assertSvgBlocked(input);
  const now = (input.now ?? new Date()).toISOString();
  return {
    id: input.id,
    checksum: input.checksum,
    storageKey: input.storageKey,
    mime: input.mime,
    state: "QUARANTINED",
    rights: input.rights,
    altText: input.altText,
    caption: input.caption,
    dimensions: input.dimensions,
    createdAt: now,
    updatedAt: now,
  };
}
