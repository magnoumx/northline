/**
 * Refuses imagery that is licensed but unpublishable.
 *
 * Wikimedia Commons is a medical and forensic archive as well as a news
 * archive. A search for a health subject returns intraoperative photographs,
 * autopsy images and clinical close-ups, all correctly licensed - and one of
 * them reached a live article page, because licence was the only test applied.
 *
 * A licence answers "may we republish this". It does not answer "should a
 * reader meet this without warning above a news story". This is the second
 * question.
 *
 * The check reads the file title and description, which is what Commons
 * reliably provides. It is deliberately cautious: rejecting a usable picture
 * costs a placeholder, publishing a surgical photograph costs a reader.
 */

export type ImageSafetyVerdict = {
  publishable: boolean;
  /** Present when refused, for the diagnostic record. */
  reason: string | null;
};

/**
 * Terms that describe the inside of a body, a death, or explicit content.
 * Matched as whole words so "operating theatre" does not catch "cooperation".
 */
const UNPUBLISHABLE_TERMS = [
  // Clinical and surgical
  "surgery", "surgical", "intraoperative", "laparoscopic", "laparoscopy",
  "hysterectomy", "incision", "sutured", "suturing", "dissection",
  "cadaver", "autopsy", "postmortem", "necropsy", "biopsy", "resection",
  "amputation", "amputated", "prolapse", "lesion", "ulcer", "abscess",
  "tumour", "tumor", "carcinoma", "gangrene", "wound", "haemorrhage",
  "hemorrhage", "endoscopy", "colonoscopy", "catheter", "specimen",
  "histology", "histopathology", "dissected", "viscera", "uterus",
  "genitalia", "genital", "anatomical specimen",
  // Death and violence
  "corpse", "dead body", "mutilated", "execution", "lynching", "massacre",
  "atrocity", "casualty", "wounded soldier", "injury",
  // Explicit
  "nude", "nudity", "naked", "topless", "erotic", "pornographic", "sexual",
  "breast", "nipple",
];

/**
 * Subjects where a Commons match is very likely to be a clinical illustration
 * rather than a news photograph. A story in one of these areas needs a picture
 * chosen by a person, not by a keyword search.
 */
const CLINICAL_SUBJECT_TERMS = [
  "anatomy", "anatomical", "pathology", "pathological", "diagram of the",
  "medical illustration", "clinical", "disease", "syndrome", "infection",
];

function containsWord(haystack: string, term: string): boolean {
  if (term.includes(" ")) return haystack.includes(term);
  return new RegExp(`(?:^|[^a-z])${term}(?:[^a-z]|$)`, "u").test(haystack);
}

export function inspectEditorialImage(input: {
  title: string;
  description: string;
  /** The story's category, so health coverage can be held to a higher bar. */
  category?: string;
}): ImageSafetyVerdict {
  const haystack = `${input.title} ${input.description}`
    .toLowerCase()
    .replaceAll(/[_\-/]+/gu, " ");

  for (const term of UNPUBLISHABLE_TERMS) {
    if (containsWord(haystack, term)) {
      return {
        publishable: false,
        reason: `depicts ${term}`,
      };
    }
  }

  // Health and science stories attract clinical imagery that is not explicit
  // but is still wrong above a news article, so those two categories reject a
  // picture whose own description says it is a clinical illustration.
  const category = (input.category ?? "").toUpperCase();
  if (category === "HEALTH" || category === "SCIENCE") {
    for (const term of CLINICAL_SUBJECT_TERMS) {
      if (containsWord(haystack, term)) {
        return {
          publishable: false,
          reason: `clinical imagery for a ${category.toLowerCase()} story`,
        };
      }
    }
  }

  return { publishable: true, reason: null };
}
