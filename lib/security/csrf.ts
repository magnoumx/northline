import {
  hmacSha256Base64Url,
  randomBase64Url,
  verifyHmacSha256Base64Url,
} from "./crypto";

const CSRF_VERSION = "csrf1";
const MINIMUM_SECRET_LENGTH = 32;
const MAXIMUM_TTL_SECONDS = 2 * 60 * 60;

export type CsrfVerification =
  | {
      valid: true;
      nonce: string;
      issuedAt: number;
      expiresAt: number;
    }
  | {
      valid: false;
      reason: "malformed" | "bad_signature" | "expired" | "subject_mismatch";
    };

export async function createCsrfToken({
  secret,
  subject,
  now = new Date(),
  ttlSeconds = 30 * 60,
}: {
  secret: string;
  subject: string;
  now?: Date;
  ttlSeconds?: number;
}): Promise<string> {
  assertSecret(secret);
  assertSubject(subject);
  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < 60 ||
    ttlSeconds > MAXIMUM_TTL_SECONDS
  ) {
    throw new RangeError("CSRF token lifetime is outside the allowed range.");
  }
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const expiresAt = issuedAt + ttlSeconds;
  const nonce = randomBase64Url(18);
  const unsigned = `${CSRF_VERSION}.${issuedAt}.${expiresAt}.${nonce}.${subject}`;
  const signature = await hmacSha256Base64Url(secret, unsigned);
  return `${CSRF_VERSION}.${issuedAt}.${expiresAt}.${nonce}.${signature}`;
}

export async function verifyCsrfToken(
  token: string,
  {
    secret,
    subject,
    now = new Date(),
  }: {
    secret: string;
    subject: string;
    now?: Date;
  },
): Promise<CsrfVerification> {
  if (secret.trim().length < MINIMUM_SECRET_LENGTH || !isSubject(subject)) {
    return { valid: false, reason: "bad_signature" };
  }
  const parts = token.split(".");
  if (
    parts.length !== 5 ||
    parts[0] !== CSRF_VERSION ||
    !/^\d{10,12}$/.test(parts[1]) ||
    !/^\d{10,12}$/.test(parts[2]) ||
    !/^[A-Za-z0-9_-]{24}$/.test(parts[3])
  ) {
    return { valid: false, reason: "malformed" };
  }
  const issuedAt = Number(parts[1]);
  const expiresAt = Number(parts[2]);
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  if (
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > MAXIMUM_TTL_SECONDS ||
    issuedAt > nowSeconds + 5
  ) {
    return { valid: false, reason: "malformed" };
  }
  if (expiresAt <= nowSeconds) return { valid: false, reason: "expired" };
  const unsigned = `${CSRF_VERSION}.${issuedAt}.${expiresAt}.${parts[3]}.${subject}`;
  if (!(await verifyHmacSha256Base64Url(secret, unsigned, parts[4]))) {
    return { valid: false, reason: "bad_signature" };
  }
  return {
    valid: true,
    nonce: parts[3],
    issuedAt,
    expiresAt,
  };
}

function assertSecret(secret: string): void {
  if (secret.trim().length < MINIMUM_SECRET_LENGTH) {
    throw new TypeError(
      `CSRF secret must contain at least ${MINIMUM_SECRET_LENGTH} characters.`,
    );
  }
}

function assertSubject(subject: string): void {
  if (!isSubject(subject)) {
    throw new TypeError("CSRF subject is invalid.");
  }
}

function isSubject(subject: string): boolean {
  return (
    subject.length >= 8 &&
    subject.length <= 256 &&
    !/[\u0000-\u001F\u007F]/.test(subject)
  );
}
