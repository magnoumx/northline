import { getD1Binding } from "@/db";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";
const MAX_BYTES = 10 * 1024 * 1024;
const permittedRights = new Set([
  "PUBLIC_DOMAIN",
  "LICENSED",
  "EDITORIAL",
  "PRESS",
  "WIKIMEDIA_COMPATIBLE",
  "SOCIAL_EMBED",
  "UNVERIFIED",
]);

type MediaEnv = { MEDIA_QUARANTINE?: R2Bucket };

export async function GET(): Promise<Response> {
  const access = await authorizeEditorialRequest(["media.approve", "audit.view"]);
  if (!access.allowed) return access.response;
  try {
    const db = await getD1Binding();
    const result = await db
      .prepare(
        `SELECT id, storage_key AS storageKey, workflow_state AS workflowState,
          mime_type AS mimeType, byte_size AS byteSize, width, height,
          checksum_sha256 AS checksumSha256, creator, copyright_owner AS copyrightOwner,
          original_url AS originalUrl, license, license_url AS licenseUrl,
          usage_permission AS usagePermission, attribution,
          verification_state AS verificationState, created_at AS createdAt,
          updated_at AS updatedAt
         FROM media_assets ORDER BY created_at DESC LIMIT 250`,
      )
      .all();
    return Response.json({ media: result.results }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return apiErrorResponse("UNAVAILABLE", { status: 503, message: "Media storage is temporarily unavailable." });
  }
}

export async function POST(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["media.approve"]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user, {
    allowedMediaTypes: ["multipart/form-data"],
  });
  if (!protection.allowed) return protection.response;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES + 100_000) {
    return apiErrorResponse("PAYLOAD_TOO_LARGE", { status: 413, message: "Media uploads are limited to 10 MB." });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiErrorResponse("BAD_REQUEST", { status: 400, message: "Send a valid multipart media upload." });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_BYTES) {
    return apiErrorResponse(file instanceof File ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST", {
      status: file instanceof File ? 413 : 400,
      message: "Choose a JPG, PNG, WebP, or AVIF file no larger than 10 MB.",
    });
  }
  const metadata = readMetadata(form);
  if (!metadata.valid) {
    return apiErrorResponse("BAD_REQUEST", { status: 400, message: metadata.message });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected || detected.mime !== file.type.toLowerCase()) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "The file signature does not match an approved image format.",
    });
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const checksum = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = `media_${crypto.randomUUID().replaceAll("-", "")}`;
  const extension = detected.extension;
  const date = new Date();
  const storageKey = `quarantine/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${id}.${extension}`;

  try {
    const { env } = (await import("cloudflare:workers")) as { env: MediaEnv };
    if (!env.MEDIA_QUARANTINE) {
      return apiErrorResponse("UNAVAILABLE", { status: 503, message: "The quarantine R2 binding is unavailable." });
    }
    const db = await getD1Binding();
    const duplicate = await db
      .prepare("SELECT id FROM media_assets WHERE checksum_sha256=?1 LIMIT 1")
      .bind(checksum)
      .first<{ id: string }>();
    if (duplicate) {
      return apiErrorResponse("CONFLICT", { status: 409, message: "This exact media file already exists." });
    }
    await env.MEDIA_QUARANTINE.put(storageKey, bytes, {
      httpMetadata: { contentType: detected.mime },
      customMetadata: { mediaId: id, uploadedBy: access.user.userId },
    });
    const now = Date.now();
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO media_assets (
               id, storage_key, public_url, workflow_state, mime_type, byte_size,
               width, height, frame_count, checksum_sha256, creator,
               copyright_owner, original_url, license, license_url,
               usage_permission, attribution, downloaded_at, expires_at,
               verification_state, malware_scan_reference, metadata_stripped_at,
               created_at, updated_at
             ) VALUES (?1, ?2, NULL, 'QUARANTINED', ?3, ?4, ?5, ?6, 1, ?7,
               ?8, ?9, ?10, ?11, ?12, ?13, ?14, NULL, NULL,
               'UNVERIFIED', NULL, NULL, ?15, ?15)`,
          )
          .bind(
            id,
            storageKey,
            detected.mime,
            file.size,
            detected.width,
            detected.height,
            checksum,
            metadata.creator,
            metadata.copyrightOwner,
            metadata.originalUrl,
            metadata.license,
            metadata.licenseUrl,
            metadata.usagePermission,
            metadata.attribution,
            now,
          ),
        db
          .prepare(
            `INSERT INTO audit_logs (
               id, actor_id, action, target_type, target_id, decision,
               reason, metadata_json, occurred_at
             ) VALUES (?1, ?2, 'MEDIA_UPLOADED', 'MEDIA', ?3, 'ALLOWED',
               'Media stored in quarantine pending malware and rights review.', ?4, ?5)`,
          )
          .bind(
            crypto.randomUUID(),
            access.user.userId,
            id,
            JSON.stringify({ storageKey, mime: detected.mime, byteSize: file.size }),
            now,
          ),
      ]);
    } catch (error) {
      await env.MEDIA_QUARANTINE.delete(storageKey);
      throw error;
    }
    return Response.json(
      { media: { id, storageKey, workflowState: "QUARANTINED", mimeType: detected.mime, byteSize: file.size } },
      { status: 201 },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", { status: 503, message: "The media upload could not be stored." });
  }
}

function readMetadata(form: FormData):
  | { valid: true; creator: string; copyrightOwner: string; originalUrl: string | null; license: string; licenseUrl: string | null; usagePermission: string; attribution: string }
  | { valid: false; message: string } {
  const creator = String(form.get("creator") ?? "").trim();
  const copyrightOwner = String(form.get("copyrightOwner") ?? "").trim();
  const originalUrl = nullableUrl(form.get("originalUrl"));
  const license = String(form.get("license") ?? "").trim();
  const licenseUrl = nullableUrl(form.get("licenseUrl"));
  const usagePermission = String(form.get("usagePermission") ?? "UNVERIFIED").trim();
  const attribution = String(form.get("attribution") ?? "").trim();
  if (creator.length < 2 || copyrightOwner.length < 2 || license.length < 2 || attribution.length < 2) {
    return { valid: false, message: "Creator, copyright owner, license, and attribution are required." };
  }
  if (!permittedRights.has(usagePermission)) {
    return { valid: false, message: "Choose a supported usage-permission category." };
  }
  if (originalUrl === false || licenseUrl === false) {
    return { valid: false, message: "Rights URLs must be valid HTTPS addresses." };
  }
  return { valid: true, creator, copyrightOwner, originalUrl, license, licenseUrl, usagePermission, attribution };
}

function nullableUrl(value: FormDataEntryValue | null): string | null | false {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : false;
  } catch {
    return false;
  }
}

function detectImage(bytes: Uint8Array): { mime: string; extension: string; width: number | null; height: number | null } | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: "image/png", extension: "png", width: readU32(bytes, 16), height: readU32(bytes, 20) };
  }
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const dimensions = jpegDimensions(bytes);
    return { mime: "image/jpeg", extension: "jpg", ...dimensions };
  }
  if (bytes.length >= 30 && text(bytes, 0, 4) === "RIFF" && text(bytes, 8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp", ...webpDimensions(bytes) };
  }
  if (bytes.length >= 16 && text(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(text(bytes, 8, 12))) {
    return { mime: "image/avif", extension: "avif", width: null, height: null };
  }
  return null;
}
function readU32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}
function text(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}
function jpegDimensions(bytes: Uint8Array): { width: number | null; height: number | null } {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
    }
    if (length < 2) break;
    offset += length + 2;
  }
  return { width: null, height: null };
}
function webpDimensions(bytes: Uint8Array): { width: number | null; height: number | null } {
  const chunk = text(bytes, 12, 16);
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }
  return { width: null, height: null };
}
