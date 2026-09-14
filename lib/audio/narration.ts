import { sha256Base64Url } from "../security/crypto";
import type {
  ArticleAudioVariant,
  ImmutablePublishedArticleVersion,
  NarrationChapter,
  NarrationChunk,
  NarrationDocument,
} from "./types";

const EXCLUDED_BLOCK_TYPES = new Set([
  "ADVERTISEMENT",
  "AD",
  "AD_LABEL",
  "CAPTION",
  "CREDIT",
  "EMBED",
  "HIDDEN_METADATA",
  "IMAGE",
  "NAVIGATION",
  "PROMO",
  "RELATED",
  "SOCIAL_EMBED",
  "VIDEO",
]);

const COMMON_INITIALISMS: Readonly<Record<string, string>> = {
  AI: "A I",
  CEO: "C E O",
  CFO: "C F O",
  CPI: "C P I",
  DNA: "D N A",
  FBI: "F B I",
  GDP: "G D P",
  IRS: "I R S",
  NATO: "NATO",
  NASA: "NASA",
  SEC: "S E C",
  UK: "U K",
  UN: "U N",
  US: "U S",
};

export const DEFAULT_NARRATION_INSTRUCTION =
  "Read as a skilled American digital news presenter. Sound warm, calm, " +
  "credible and conversational. Avoid exaggerated radio-announcer delivery. " +
  "Use natural pauses around headings and quotations. Pronounce names " +
  "carefully. Do not sound cheerful during tragedy or serious events. Adjust " +
  "tone to the article category without becoming theatrical.";

export async function buildNarrationDocument(
  article: ImmutablePublishedArticleVersion,
  variant: ArticleAudioVariant,
  narrationPolicyVersion: string,
): Promise<NarrationDocument> {
  assertImmutablePublishedVersion(article);
  const chapters =
    variant === "QUICK_BRIEF"
      ? quickBriefChapters(article)
      : fullArticleChapters(article);
  if (chapters.length === 0) {
    throw new TypeError("The published article contains no narratable text.");
  }
  let cursor = 0;
  const positioned: NarrationChapter[] = [];
  for (const chapter of chapters) {
    const text = normalizeNarrationText(chapter.text);
    if (!text) continue;
    const characterStart = cursor;
    cursor += text.length;
    positioned.push({
      id: `chapter-${positioned.length + 1}`,
      title: normalizeNarrationText(chapter.title),
      text,
      characterStart,
      characterEnd: cursor,
    });
    cursor += 2;
  }
  const text = positioned.map((chapter) => chapter.text).join("\n\n");
  const inputHash = await sha256Base64Url(
    [
      "northline-article-audio",
      narrationPolicyVersion,
      article.articleId,
      article.articleVersionId,
      String(article.versionNumber),
      article.publishedAt.toISOString(),
      variant,
      text,
    ].join("\u0000"),
  );
  return {
    articleId: article.articleId,
    articleVersionId: article.articleVersionId,
    variant,
    title: normalizeNarrationText(article.headline),
    text,
    characterCount: text.length,
    inputHash,
    chapters: positioned,
  };
}

export async function chunkNarrationDocument(
  document: NarrationDocument,
  maximumCharacters: number,
): Promise<NarrationChunk[]> {
  if (
    !Number.isInteger(maximumCharacters) ||
    maximumCharacters < 250 ||
    maximumCharacters > 20_000
  ) {
    throw new RangeError("The narration chunk limit is outside safe bounds.");
  }
  const chunks: NarrationChunk[] = [];
  for (let chapterIndex = 0; chapterIndex < document.chapters.length; chapterIndex += 1) {
    const chapter = document.chapters[chapterIndex];
    const pieces = splitBoundedText(chapter.text, maximumCharacters);
    for (const text of pieces) {
      const ordinal = chunks.length;
      chunks.push({
        id: `chunk-${ordinal + 1}`,
        ordinal,
        chapterIndex,
        text,
        characterCount: text.length,
        textHash: await sha256Base64Url(
          `${document.inputHash}\u0000${ordinal}\u0000${text}`,
        ),
      });
    }
  }
  return chunks;
}

export function normalizeNarrationText(value: string): string {
  let normalized = decodeBasicEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/\b(?:https?|www)\s*:\s*\/\//giu, " ")
    .replace(/[•●▪◦]/gu, ". ")
    .replace(/[|]/gu, ", ")
    .replace(/&/gu, " and ")
    .replace(/\b([A-Z])\.\s*(?=[A-Z]\.)/gu, "$1 ")
    .replace(/\bU\.?\s*S\.?\b/gu, "U S")
    .replace(/\bU\.?\s*K\.?\b/gu, "U K");

  normalized = normalized.replace(
    /\$(\d[\d,.]*)\s+(million|billion|trillion)\b/giu,
    "$1 $2 dollars",
  );
  normalized = normalized.replace(
    /\$(\d[\d,]*)(?:\.(\d{2}))?\b/giu,
    (_match, dollars: string, cents: string | undefined) => {
      const dollarWords = `${dollars} dollar${dollars === "1" ? "" : "s"}`;
      if (!cents || cents === "00") return dollarWords;
      return `${dollarWords} and ${cents} cents`;
    },
  );
  normalized = normalized.replace(
    /\b(\d{4})-(\d{2})-(\d{2})\b/gu,
    (match, year: string, month: string, day: string) => {
      const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) return match;
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed);
    },
  );
  for (const [initialism, spoken] of Object.entries(COMMON_INITIALISMS)) {
    normalized = normalized.replace(
      new RegExp(`\\b${initialism}\\b`, "gu"),
      spoken,
    );
  }
  return normalized
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, " ")
    .replace(/[ \t]+/gu, " ")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .replace(/([.!?])(?=[A-Z])/gu, "$1 ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function assertImmutablePublishedVersion(
  article: ImmutablePublishedArticleVersion,
): void {
  if (
    !article.articleId ||
    !article.articleVersionId ||
    !Number.isInteger(article.versionNumber) ||
    article.versionNumber < 1 ||
    !(article.publishedAt instanceof Date) ||
    Number.isNaN(article.publishedAt.getTime())
  ) {
    throw new TypeError(
      "Audio input must be an immutable published article version.",
    );
  }
}

function fullArticleChapters(
  article: ImmutablePublishedArticleVersion,
): Array<{ title: string; text: string }> {
  const chapters: Array<{ title: string; text: string }> = [
    {
      title: "Introduction",
      text: [article.headline, article.subheadline]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(". "),
    },
  ];
  const body = safeJson(article.bodyJson);
  const bodyRecord =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const blocks = Array.isArray(body)
    ? body
    : bodyRecord && Array.isArray(bodyRecord.blocks)
      ? bodyRecord.blocks
      : [];
  let untitled = 0;
  for (const block of blocks) {
    const extracted = extractNarratableBlock(block);
    if (!extracted) continue;
    chapters.push({
      title: extracted.heading || `Story section ${++untitled}`,
      text: extracted.heading
        ? `${extracted.heading}. ${extracted.text}`
        : extracted.text,
    });
  }
  return chapters;
}

function quickBriefChapters(
  article: ImmutablePublishedArticleVersion,
): Array<{ title: string; text: string }> {
  const takeaways = safeStringArray(article.keyTakeawaysJson);
  const summary = [article.headline, article.subheadline]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(". ");
  return [
    { title: "Quick Brief", text: summary },
    ...(takeaways.length
      ? [
          {
            title: "Key takeaways",
            text: `Key takeaways. ${takeaways.join(". ")}`,
          },
        ]
      : []),
  ];
}

function extractNarratableBlock(
  value: unknown,
): { heading: string; text: string } | null {
  if (typeof value === "string") {
    const text = normalizeNarrationText(value);
    return text ? { heading: "", text } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const block = value as Record<string, unknown>;
  if (block.spoken === false || block.hidden === true) return null;
  const type = typeof block.type === "string" ? block.type.toUpperCase() : "";
  if (EXCLUDED_BLOCK_TYPES.has(type)) return null;
  const heading =
    stringValue(block.heading) ||
    (type === "HEADING" ? stringValue(block.text) : "");
  const paragraphs = [
    ...stringList(block.paragraphs),
    ...stringList(block.items),
  ];
  if (type !== "HEADING") {
    const direct = stringValue(block.text) || stringValue(block.body);
    if (direct) paragraphs.unshift(direct);
  }
  const text = normalizeNarrationText(paragraphs.join(". "));
  return text ? { heading: normalizeNarrationText(heading), text } : null;
}

function splitBoundedText(text: string, maximum: number): string[] {
  if (text.length <= maximum) return [text];
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/gu) ?? [text];
  const result: string[] = [];
  let current = "";
  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if (sentence.length > maximum) {
      if (current) {
        result.push(current);
        current = "";
      }
      result.push(...splitAtWords(sentence, maximum));
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maximum) {
      result.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) result.push(current);
  return result;
}

function splitAtWords(text: string, maximum: number): string[] {
  const result: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/u)) {
    if (word.length > maximum) {
      if (current) result.push(current);
      for (let offset = 0; offset < word.length; offset += maximum) {
        result.push(word.slice(offset, offset + maximum));
      }
      current = "";
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maximum) {
      result.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) result.push(current);
  return result;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

function safeStringArray(value: string): string[] {
  const parsed = safeJson(value);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">");
}
