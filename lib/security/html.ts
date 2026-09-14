const MAX_RICH_TEXT_BYTES = 100_000;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const TOKEN_PATTERN = /<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>/g;
const SAFE_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h2",
  "h3",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
]);

export class UnsafeRichTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeRichTextError";
  }
}

/**
 * Escape-first restricted HTML sanitizer. No source tag or attribute is copied
 * through directly: safe elements are reconstructed from a small allowlist.
 */
export function sanitizeRestrictedHtml(input: string): string {
  if (new TextEncoder().encode(input).byteLength > MAX_RICH_TEXT_BYTES) {
    throw new UnsafeRichTextError("Rich text exceeds the maximum size.");
  }

  let output = "";
  let offset = 0;
  const stack: string[] = [];
  for (const match of input.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    output += escapeHtml(input.slice(offset, index));
    output += sanitizeTag(match[0], stack);
    offset = index + match[0].length;
  }
  output += escapeHtml(input.slice(offset));
  while (stack.length > 0) output += `</${stack.pop()}>`;
  return output;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeTag(token: string, stack: string[]): string {
  if (token.startsWith("<!") || token.startsWith("<!--")) return "";
  const closing = /^<\s*\//.test(token);
  const nameMatch = /^<\s*\/?\s*([A-Za-z0-9]+)/.exec(token);
  if (!nameMatch) return escapeHtml(token);
  let name = nameMatch[1].toLowerCase();
  if (name === "b") name = "strong";
  if (name === "i") name = "em";
  if (!SAFE_TAGS.has(name)) return "";

  if (closing) {
    if (stack.at(-1) !== name) return "";
    stack.pop();
    return `</${name}>`;
  }
  if (name === "br") return "<br>";
  if (/\/\s*>$/.test(token) && name !== "br") return "";

  let serialized = `<${name}`;
  if (name === "a") {
    const attributes = parseAttributes(token.slice(nameMatch[0].length, -1));
    const href = attributes.get("href");
    const safeHref = href ? sanitizeLinkHref(href) : null;
    if (!safeHref) return "";
    serialized += ` href="${escapeHtml(safeHref)}"`;
    const title = attributes.get("title")?.trim();
    if (title && title.length <= 200 && !CONTROL_CHARACTERS.test(title)) {
      serialized += ` title="${escapeHtml(title)}"`;
    }
    if (/^https?:/i.test(safeHref)) {
      serialized += ' rel="nofollow noopener noreferrer"';
    }
  }
  stack.push(name);
  return `${serialized}>`;
}

function parseAttributes(value: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern =
    /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of value.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (attributes.has(name)) continue;
    attributes.set(name, decodeHtmlEntities(match[2] ?? match[3] ?? match[4]));
  }
  return attributes;
}

function sanitizeLinkHref(value: string): string | null {
  const decoded = decodeHtmlEntities(value).trim().replaceAll("\\", "/");
  if (
    !decoded ||
    decoded.length > 2_048 ||
    CONTROL_CHARACTERS.test(decoded) ||
    decoded.startsWith("//")
  ) {
    return null;
  }
  if (decoded.startsWith("#")) {
    return /^#[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(decoded) ? decoded : null;
  }
  if (decoded.startsWith("/")) {
    try {
      const base = "https://content.invalid";
      const url = new URL(decoded, base);
      return url.origin === base
        ? `${url.pathname}${url.search}${url.hash}`
        : null;
    } catch {
      return null;
    }
  }
  if (/^mailto:/i.test(decoded)) {
    const address = decoded.slice("mailto:".length);
    return /^[^\s@?]+@[^\s@?]+\.[^\s@?]+$/.test(address)
      ? `mailto:${address}`
      : null;
  }
  try {
    const url = new URL(decoded);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|colon|tab|newline|amp|quot|apos|lt|gt);?/gi,
    (entity, body: string) => {
      const normalized = body.toLowerCase();
      if (normalized.startsWith("#x")) {
        return safeCodePoint(Number.parseInt(normalized.slice(2), 16));
      }
      if (normalized.startsWith("#")) {
        return safeCodePoint(Number.parseInt(normalized.slice(1), 10));
      }
      return (
        {
          colon: ":",
          tab: "\t",
          newline: "\n",
          amp: "&",
          quot: '"',
          apos: "'",
          lt: "<",
          gt: ">",
        }[normalized] ?? entity
      );
    },
  );
}

function safeCodePoint(value: number): string {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 0x10ffff ||
    (value >= 0xd800 && value <= 0xdfff)
  ) {
    return "\uFFFD";
  }
  return String.fromCodePoint(value);
}
