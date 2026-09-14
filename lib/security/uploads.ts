export type SafeImageMime =
  | "image/avif"
  | "image/gif"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export type UploadPolicy = {
  maximumBytes: number;
  maximumWidth: number;
  maximumHeight: number;
  maximumPixels: number;
  maximumFrames: number;
  allowedMimeTypes: readonly SafeImageMime[];
};

export type DecodedImageMetadata = {
  width: number;
  height: number;
  frames: number;
};

export type UploadValidation =
  | {
      accepted: true;
      detectedMime: SafeImageMime;
      metadata: DecodedImageMetadata;
      storageKey: string;
      quarantineRequired: true;
      malwareScanRequired: true;
      derivativeRequired: true;
    }
  | {
      accepted: false;
      reason:
        | "empty"
        | "too_large"
        | "unsupported_type"
        | "mime_mismatch"
        | "extension_mismatch"
        | "invalid_dimensions"
        | "too_many_pixels"
        | "too_many_frames"
        | "decoder_metadata_required";
    };

export const DEFAULT_IMAGE_UPLOAD_POLICY: UploadPolicy = {
  maximumBytes: 5 * 1024 * 1024,
  maximumWidth: 6_000,
  maximumHeight: 6_000,
  maximumPixels: 24_000_000,
  maximumFrames: 120,
  allowedMimeTypes: [
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
};

export function validateImageUpload({
  bytes,
  declaredMime,
  filename,
  decodedMetadata,
  policy = DEFAULT_IMAGE_UPLOAD_POLICY,
}: {
  bytes: Uint8Array;
  declaredMime: string;
  filename: string;
  decodedMetadata?: DecodedImageMetadata;
  policy?: UploadPolicy;
}): UploadValidation {
  if (bytes.byteLength === 0) return { accepted: false, reason: "empty" };
  if (bytes.byteLength > policy.maximumBytes) {
    return { accepted: false, reason: "too_large" };
  }

  const detectedMime = detectImageMime(bytes);
  if (!detectedMime || !policy.allowedMimeTypes.includes(detectedMime)) {
    return { accepted: false, reason: "unsupported_type" };
  }
  const normalizedDeclaredMime = declaredMime
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (normalizedDeclaredMime !== detectedMime) {
    return { accepted: false, reason: "mime_mismatch" };
  }
  const expectedExtension = extensionForMime(detectedMime);
  const suppliedExtension = safeExtension(filename);
  if (suppliedExtension && !extensionsForMime(detectedMime).includes(suppliedExtension)) {
    return { accepted: false, reason: "extension_mismatch" };
  }

  const parsedMetadata = readImageDimensions(bytes, detectedMime);
  if (
    parsedMetadata &&
    decodedMetadata &&
    (parsedMetadata.width !== decodedMetadata.width ||
      parsedMetadata.height !== decodedMetadata.height ||
      parsedMetadata.frames !== decodedMetadata.frames)
  ) {
    return { accepted: false, reason: "invalid_dimensions" };
  }
  const metadata = decodedMetadata ?? parsedMetadata;
  if (!metadata) {
    return { accepted: false, reason: "decoder_metadata_required" };
  }
  if (
    !isPositiveInteger(metadata.width) ||
    !isPositiveInteger(metadata.height) ||
    !isPositiveInteger(metadata.frames) ||
    metadata.width > policy.maximumWidth ||
    metadata.height > policy.maximumHeight
  ) {
    return { accepted: false, reason: "invalid_dimensions" };
  }
  if (metadata.width * metadata.height > policy.maximumPixels) {
    return { accepted: false, reason: "too_many_pixels" };
  }
  if (metadata.frames > policy.maximumFrames) {
    return { accepted: false, reason: "too_many_frames" };
  }

  return {
    accepted: true,
    detectedMime,
    metadata,
    storageKey: `quarantine/${crypto.randomUUID()}.${expectedExtension}`,
    quarantineRequired: true,
    malwareScanRequired: true,
    derivativeRequired: true,
  };
}

export function detectImageMime(bytes: Uint8Array): SafeImageMime | null {
  if (
    startsWith(bytes, [0xff, 0xd8, 0xff]) &&
    bytes.byteLength >= 4
  ) {
    return "image/jpeg";
  }
  if (
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }
  const ascii6 = ascii(bytes, 0, 6);
  if (ascii6 === "GIF87a" || ascii6 === "GIF89a") return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (
    bytes.byteLength >= 16 &&
    ascii(bytes, 4, 4) === "ftyp" &&
    ["avif", "avis"].includes(ascii(bytes, 8, 4))
  ) {
    return "image/avif";
  }
  return null;
}

export function readImageDimensions(
  bytes: Uint8Array,
  mime: SafeImageMime,
): DecodedImageMetadata | null {
  if (mime === "image/png") return readPngDimensions(bytes);
  if (mime === "image/gif" && bytes.byteLength >= 10) {
    return {
      width: bytes[6] | (bytes[7] << 8),
      height: bytes[8] | (bytes[9] << 8),
      frames: countGifFrames(bytes),
    };
  }
  if (mime === "image/jpeg") return readJpegDimensions(bytes);
  if (
    mime === "image/webp" &&
    bytes.byteLength >= 30 &&
    ascii(bytes, 12, 4) === "VP8X"
  ) {
    // Animated WebP frame counts require a real decoder/container parser.
    // Do not guess: require decoder-supplied metadata before acceptance.
    if ((bytes[20] & 0x02) !== 0) return null;
    return {
      width: 1 + readUint24Le(bytes, 24),
      height: 1 + readUint24Le(bytes, 27),
      frames: 1,
    };
  }
  if (
    mime === "image/webp" &&
    bytes.byteLength >= 25 &&
    ascii(bytes, 12, 4) === "VP8L" &&
    bytes[20] === 0x2f
  ) {
    const bits =
      bytes[21] |
      (bytes[22] << 8) |
      (bytes[23] << 16) |
      (bytes[24] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      frames: 1,
    };
  }
  return null;
}

function readPngDimensions(
  bytes: Uint8Array,
): DecodedImageMetadata | null {
  if (
    bytes.byteLength < 33 ||
    readUint32Be(bytes, 8) !== 13 ||
    ascii(bytes, 12, 4) !== "IHDR"
  ) {
    return null;
  }

  const metadata = {
    width: readUint32Be(bytes, 16),
    height: readUint32Be(bytes, 20),
    frames: 1,
  };
  let offset = 8;
  while (offset + 12 <= bytes.byteLength) {
    const length = readUint32Be(bytes, offset);
    if (
      !Number.isSafeInteger(length) ||
      length > bytes.byteLength - offset - 12
    ) {
      return null;
    }
    const type = ascii(bytes, offset + 4, 4);
    if (type === "acTL") {
      if (length !== 8) return null;
      metadata.frames = readUint32Be(bytes, offset + 8);
    }
    offset += length + 12;
  }
  return metadata;
}

function readJpegDimensions(
  bytes: Uint8Array,
): DecodedImageMetadata | null {
  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 2 > bytes.byteLength) return null;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
      return null;
    }
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb,
        0xcd, 0xce, 0xcf,
      ].includes(marker)
    ) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
        frames: 1,
      };
    }
    offset += segmentLength;
  }
  return null;
}

function countGifFrames(bytes: Uint8Array): number {
  let frames = 0;
  for (let index = 10; index < bytes.byteLength; index += 1) {
    if (bytes[index] === 0x2c) frames += 1;
  }
  return Math.max(frames, 1);
}

function readUint32Be(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint24Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return (
    bytes.byteLength >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte)
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset + length > bytes.byteLength) return "";
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function safeExtension(filename: string): string | null {
  const basename = filename.replaceAll("\\", "/").split("/").at(-1) ?? "";
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(basename);
  return match?.[1].toLowerCase() ?? null;
}

function extensionForMime(mime: SafeImageMime): string {
  return extensionsForMime(mime)[0];
}

function extensionsForMime(mime: SafeImageMime): readonly string[] {
  return {
    "image/avif": ["avif"],
    "image/gif": ["gif"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
  }[mime];
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1;
}
