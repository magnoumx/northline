import { sha256Base64Url } from "../security/crypto";

export type ArticleBodySection = {
  heading: string;
  paragraphs: readonly string[];
};

export type FinalBodyIntegrityInput = {
  headline: string;
  subheadline: string;
  sections: readonly ArticleBodySection[];
  /** Exact source URLs that independent review actually examined. */
  approvedSourceUrls: readonly string[];
};

export type FinalBodyIntegrityResult = {
  /** Hash of the exact text that was reviewed, asserted again at publication. */
  bodyHash: string;
  /** Links present in the final text but absent from the reviewed manifest. */
  unapprovedLinks: readonly string[];
  wordCount: number;
};

const LINK_PATTERN = /https?:\/\/[^\s<>"')\]]+/giu;

export function canonicalBodyText(
  input: Pick<FinalBodyIntegrityInput, "headline" | "subheadline" | "sections">,
): string {
  const sections = input.sections
    .map(
      (section) =>
        `${section.heading.trim()}\n${section.paragraphs
          .map((paragraph) => paragraph.trim())
          .join("\n")}`,
    )
    .join("\n\n");
  return `${input.headline.trim()}\n${input.subheadline.trim()}\n\n${sections}`
    .replaceAll(/\r\n/gu, "\n")
    .replaceAll(/[ \t]+/gu, " ")
    .trim();
}

function normalizeLink(value: string): string {
  return value.replace(/[.,;:)\]]+$/u, "").trim().toLowerCase();
}

/**
 * Establishes what was actually reviewed. The pipeline rewrites the draft after
 * independent fact review - redaction, length completion and copy editing all
 * replace the whole body - so publication has to prove that the text being
 * published is the text that was checked, and that no new link appeared in it.
 */
export async function measureFinalBodyIntegrity(
  input: FinalBodyIntegrityInput,
): Promise<FinalBodyIntegrityResult> {
  const text = canonicalBodyText(input);
  const approved = new Set(input.approvedSourceUrls.map(normalizeLink));
  const found = new Set(
    (text.match(LINK_PATTERN) ?? []).map((link) => normalizeLink(link)),
  );

  return {
    bodyHash: await sha256Base64Url(text),
    unapprovedLinks: [...found].filter((link) => !approved.has(link)),
    wordCount: text.split(/\s+/u).filter(Boolean).length,
  };
}

/**
 * Publication guard. A mismatch means the body changed between review and
 * publication, which is exactly the condition that let an unreviewed sentence
 * reach readers.
 */
export function reviewedBodyMatches(
  reviewedHash: string,
  publishedHash: string,
): boolean {
  return (
    reviewedHash.length > 0 &&
    publishedHash.length > 0 &&
    reviewedHash === publishedHash
  );
}
