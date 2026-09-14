export type AdTokenPurpose = "IMPRESSION" | "VIEWABILITY" | "CLICK";

export interface AdTokenPayload {
  v: 1;
  purpose: AdTokenPurpose;
  jti: string;
  iat: number;
  exp: number;
  requestId: string;
  campaignId: string;
  lineItemId: string;
  creativeVersionId: string;
  destination?: string;
}

export type TokenVerification =
  | { valid: true; payload: AdTokenPayload }
  | {
      valid: false;
      reason:
        | "MALFORMED"
        | "INVALID_SIGNATURE"
        | "EXPIRED"
        | "WRONG_PURPOSE"
        | "INVALID_PAYLOAD";
    };

export async function signAdToken(
  payload: Omit<AdTokenPayload, "v">,
  secret: string,
): Promise<string> {
  assertSecret(secret);
  assertPayload({ ...payload, v: 1 });
  const encoded = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify({ ...payload, v: 1 })),
  );
  const signature = await hmac(encoded, secret);
  return `${encoded}.${encodeBase64Url(signature)}`;
}

export async function verifyAdToken(
  token: string,
  secret: string,
  expectedPurpose: AdTokenPurpose,
  nowSeconds = Math.floor(Date.now() / 1_000),
): Promise<TokenVerification> {
  try {
    assertSecret(secret);
    if (token.length > 4_096) return { valid: false, reason: "MALFORMED" };
    const segments = token.split(".");
    if (segments.length !== 2 || !segments[0] || !segments[1]) {
      return { valid: false, reason: "MALFORMED" };
    }
    const expected = await hmac(segments[0], secret);
    const received = decodeBase64Url(segments[1]);
    if (!constantTimeEqual(expected, received)) {
      return { valid: false, reason: "INVALID_SIGNATURE" };
    }
    const parsed = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(segments[0])),
    ) as unknown;
    if (!isAdTokenPayload(parsed)) {
      return { valid: false, reason: "INVALID_PAYLOAD" };
    }
    if (parsed.purpose !== expectedPurpose) {
      return { valid: false, reason: "WRONG_PURPOSE" };
    }
    if (parsed.exp <= nowSeconds || parsed.iat > nowSeconds + 60) {
      return { valid: false, reason: "EXPIRED" };
    }
    return { valid: true, payload: parsed };
  } catch {
    return { valid: false, reason: "MALFORMED" };
  }
}

function assertPayload(payload: AdTokenPayload): void {
  if (!isAdTokenPayload(payload)) throw new Error("invalid ad token payload");
  if (payload.exp <= payload.iat) throw new Error("token expiry must follow issue time");
  if (payload.exp - payload.iat > 60 * 60) {
    throw new Error("ad event tokens cannot live longer than one hour");
  }
}

function isAdTokenPayload(value: unknown): value is AdTokenPayload {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const strings = [
    "jti",
    "requestId",
    "campaignId",
    "lineItemId",
    "creativeVersionId",
  ];
  return (
    item.v === 1 &&
    ["IMPRESSION", "VIEWABILITY", "CLICK"].includes(String(item.purpose)) &&
    strings.every(
      (key) =>
        typeof item[key] === "string" &&
        (item[key] as string).length >= 1 &&
        (item[key] as string).length <= 512,
    ) &&
    Number.isSafeInteger(item.iat) &&
    Number.isSafeInteger(item.exp) &&
    (item.destination === undefined ||
      (typeof item.destination === "string" && item.destination.length <= 2_048))
  );
}

async function hmac(message: string, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    asArrayBuffer(encoder.encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    asArrayBuffer(encoder.encode(message)),
  );
  return new Uint8Array(signature);
}

function assertSecret(secret: string): void {
  if (secret.length < 32) throw new Error("ad token secret must be at least 32 characters");
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("invalid base64url");
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

