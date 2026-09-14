export type ParsedIpAddress =
  | { version: 4; canonical: string; bytes: readonly number[] }
  | { version: 6; canonical: string; words: readonly number[] };

export function parseIpAddress(value: string): ParsedIpAddress | null {
  const input = value.trim();
  if (!input || input.includes("%")) return null;
  const unwrapped =
    input.startsWith("[") && input.endsWith("]") ? input.slice(1, -1) : input;
  if (unwrapped.includes(":")) return parseIpv6(unwrapped);
  return parseIpv4(unwrapped);
}

export function canonicalizeIpAddress(value: string): string | null {
  return parseIpAddress(value)?.canonical ?? null;
}

export function isPublicIpAddress(value: string): boolean {
  const parsed = parseIpAddress(value);
  if (!parsed) return false;
  return parsed.version === 4
    ? isPublicIpv4(parsed.bytes)
    : isPublicIpv6(parsed.words);
}

function parseIpv4(
  value: string,
): Extract<ParsedIpAddress, { version: 4 }> | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return null;
  const bytes = value.split(".").map(Number);
  if (bytes.some((byte) => byte < 0 || byte > 255)) return null;
  return {
    version: 4,
    canonical: bytes.join("."),
    bytes,
  };
}

function parseIpv6(
  value: string,
): Extract<ParsedIpAddress, { version: 6 }> | null {
  if (!/^[0-9A-Fa-f:.]+$/.test(value)) return null;
  if ((value.match(/::/g) ?? []).length > 1) return null;

  let normalized = value;
  const ipv4Tail = /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value)?.[1];
  if (ipv4Tail) {
    const parsedTail = parseIpv4(ipv4Tail);
    if (!parsedTail) return null;
    const [a, b, c, d] = parsedTail.bytes;
    normalized = `${value.slice(0, -ipv4Tail.length)}${((a << 8) | b).toString(
      16,
    )}:${((c << 8) | d).toString(16)}`;
  }

  const [leftRaw, rightRaw] = normalized.split("::");
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = rightRaw ? rightRaw.split(":") : [];
  if (
    [...left, ...right].some(
      (word) => !/^[0-9A-Fa-f]{1,4}$/.test(word),
    )
  ) {
    return null;
  }

  const omitted = 8 - left.length - right.length;
  if (
    (normalized.includes("::") && omitted < 1) ||
    (!normalized.includes("::") && omitted !== 0)
  ) {
    return null;
  }

  const words = [
    ...left.map((word) => Number.parseInt(word, 16)),
    ...Array.from({ length: omitted }, () => 0),
    ...right.map((word) => Number.parseInt(word, 16)),
  ];
  if (words.length !== 8) return null;
  return {
    version: 6,
    canonical: compressIpv6(words),
    words,
  };
}

function compressIpv6(words: readonly number[]): string {
  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;
  for (let index = 0; index <= words.length; index += 1) {
    if (index < words.length && words[index] === 0) {
      if (currentStart < 0) currentStart = index;
      continue;
    }
    if (currentStart >= 0) {
      const length = index - currentStart;
      if (length > bestLength && length >= 2) {
        bestStart = currentStart;
        bestLength = length;
      }
      currentStart = -1;
    }
  }

  if (bestStart < 0) return words.map((word) => word.toString(16)).join(":");
  const left = words
    .slice(0, bestStart)
    .map((word) => word.toString(16))
    .join(":");
  const right = words
    .slice(bestStart + bestLength)
    .map((word) => word.toString(16))
    .join(":");
  return `${left}::${right}`;
}

function isPublicIpv4(bytes: readonly number[]): boolean {
  const [a, b, c] = bytes;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(words: readonly number[]): boolean {
  if (words.every((word) => word === 0)) return false;
  if (
    words.slice(0, 7).every((word) => word === 0) &&
    words[7] === 1
  ) {
    return false;
  }

  const ipv4Mapped =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (ipv4Mapped) {
    return isPublicIpv4([
      words[6] >> 8,
      words[6] & 0xff,
      words[7] >> 8,
      words[7] & 0xff,
    ]);
  }

  // Reject deprecated IPv4-compatible forms instead of leaving their routing
  // interpretation to the HTTP client or operating system.
  if (words.slice(0, 6).every((word) => word === 0)) return false;

  const first = words[0];
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  if ((first & 0xffc0) === 0xfec0) return false;
  if ((first & 0xff00) === 0xff00) return false;

  // Public fetch destinations are limited to currently assigned global
  // unicast space. This conservatively excludes translation, discard-only,
  // and other special-use prefixes outside 2000::/3.
  if ((first & 0xe000) !== 0x2000) return false;

  // IETF protocol assignments, documentation, benchmarking/transition space,
  // and the documentation block at the top of 2000::/3 are not fetch targets.
  if (first === 0x2001 && words[1] <= 0x01ff) return false;
  if (first === 0x2001 && words[1] === 0x0db8) return false;
  if (first === 0x2002) return false;
  if (first === 0x3fff && (words[1] & 0xf000) === 0) return false;
  return true;
}
