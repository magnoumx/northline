import type {
  FormatRecommendation,
  FormatRecommendationInput,
} from "./types";

const formatGuidance: Record<
  FormatRecommendation["format"],
  Omit<FormatRecommendation, "format" | "rationale">
> = {
  NEWS_FLASH: {
    targetWords: [150, 300],
    noPaddingRule: "Publish only the verified fact, consequence, and next check.",
  },
  QUICK_BRIEF: {
    targetWords: [350, 700],
    noPaddingRule: "Stop once the central update and essential context are clear.",
  },
  STANDARD_STORY: {
    targetWords: [800, 1500],
    noPaddingRule: "Do not add background that does not change understanding.",
  },
  DEEP_EXPLAINER: {
    targetWords: [1800, 3500],
    noPaddingRule: "Every section must answer a distinct reader question.",
  },
  ULTIMATE_GUIDE: {
    targetWords: [3000, 6000],
    noPaddingRule:
      "Use only when verified layers and durable reader utility justify each section.",
  },
  LIVE_COVERAGE: {
    targetWords: null,
    noPaddingRule: "Each update must add a verified development.",
  },
};

export function recommendFormat(
  input: FormatRecommendationInput,
): FormatRecommendation {
  let format: FormatRecommendation["format"] = "STANDARD_STORY";
  let rationale = "A verified multi-source development with enough context for a standard report.";

  if (input.evolving) {
    format = "LIVE_COVERAGE";
    rationale = "The situation is still changing and should be updated in discrete verified entries.";
  } else if (input.publicActionability && input.evidenceCount >= 12) {
    format = "ULTIMATE_GUIDE";
    rationale =
      "A broad, durable evidence set supports an unusually comprehensive service resource.";
  } else if (
    input.evidenceCount >= 8 ||
    (input.analyticalDepth && input.evidenceCount >= 6) ||
    input.eventCount >= 7
  ) {
    format = "DEEP_EXPLAINER";
    rationale =
      "The evidence supports multiple useful layers, clearly separated facts, and deeper context.";
  } else if (input.urgency === "HIGH" && input.evidenceCount <= 2) {
    format = "NEWS_FLASH";
    rationale = "Only a narrow verified development is ready; further context should not be padded.";
  } else if (input.evidenceCount <= 3) {
    format = "QUICK_BRIEF";
    rationale = "The verified scope is useful but too narrow for a longer article.";
  } else {
    format = "STANDARD_STORY";
    rationale =
      "A verified multi-source development with enough context for a standard story.";
  }

  return { format, rationale, ...formatGuidance[format] };
}

export function getFormatCatalog(): readonly FormatRecommendation[] {
  const scenarios: readonly FormatRecommendationInput[] = [
    { urgency: "HIGH", evidenceCount: 1, eventCount: 1, publicActionability: false, analyticalDepth: false, evolving: false },
    { urgency: "MEDIUM", evidenceCount: 3, eventCount: 1, publicActionability: false, analyticalDepth: false, evolving: false },
    { urgency: "MEDIUM", evidenceCount: 5, eventCount: 2, publicActionability: false, analyticalDepth: false, evolving: false },
    { urgency: "LOW", evidenceCount: 9, eventCount: 4, publicActionability: false, analyticalDepth: true, evolving: false },
    { urgency: "LOW", evidenceCount: 14, eventCount: 6, publicActionability: true, analyticalDepth: true, evolving: false },
    { urgency: "HIGH", evidenceCount: 3, eventCount: 2, publicActionability: false, analyticalDepth: false, evolving: true },
  ];
  return scenarios.map(recommendFormat);
}
