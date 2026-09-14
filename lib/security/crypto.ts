const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function randomBase64Url(byteLength = 32): string {
  if (!Number.isSafeInteger(byteLength) || byteLength < 16 || byteLength > 128) {
    throw new RangeError("byteLength must be an integer between 16 and 128.");
  }
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeBase64UrlText(value: string): string {
  return encodeBase64Url(encoder.encode(value));
}

export function decodeBase64UrlText(value: string): string | null {
  const bytes = decodeBase64Url(value);
  if (!bytes) return null;
  try {
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

export async function hmacSha256Bytes(
  secret: string,
  value: string,
): Promise<Uint8Array> {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return new Uint8Array(signature);
}

export async function hmacSha256Base64Url(
  secret: string,
  value: string,
): Promise<string> {
  return encodeBase64Url(await hmacSha256Bytes(secret, value));
}

export async function verifyHmacSha256Base64Url(
  secret: string,
  value: string,
  signature: string,
): Promise<boolean> {
  const signatureBytes = decodeBase64Url(signature);
  if (!signatureBytes || signatureBytes.byteLength !== 32) return false;
  try {
    const key = await importHmacKey(secret, ["verify"]);
    const signatureBuffer = signatureBytes.slice().buffer as ArrayBuffer;
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      encoder.encode(value),
    );
  } catch {
    return false;
  }
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function sha256BytesBase64Url(
  value: Uint8Array,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    value.slice().buffer as ArrayBuffer,
  );
  return encodeBase64Url(new Uint8Array(digest));
}

async function importHmacKey(
  secret: string,
  keyUsages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    keyUsages,
  );
}
