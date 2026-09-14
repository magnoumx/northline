export const SENSITIVE_TOPICS = [
  "US_ELECTIONS",
  "GOVERNMENT_LEADERSHIP",
  "WAR_OR_MILITARY_ACTION",
  "TERRORISM",
  "CRIME_OR_CRIMINAL_ACCUSATIONS",
  "LAWSUITS_OR_ALLEGATIONS",
  "DEATHS",
  "MISSING_PERSONS",
  "MEDICAL_CLAIMS",
  "PUBLIC_HEALTH",
  "INVESTMENTS_OR_PERSONAL_FINANCE",
  "NATURAL_DISASTERS",
  "ACTIVE_EMERGENCIES",
  "MINORS",
  "SEXUAL_MISCONDUCT",
  "IDENTITY_RELATED_CLAIMS",
  "LEAKED_PRIVATE_INFORMATION",
  "GRAPHIC_OR_TRAUMATIC_EVENTS",
  "REPUTATIONAL_HARM",
] as const;

export type SensitiveTopic = (typeof SENSITIVE_TOPICS)[number];

export const AUTO_PUBLISH_CONTENT_CLASSES = [
  "PRODUCT_ANNOUNCEMENT",
  "ENTERTAINMENT_RELEASE",
  "GAMING_UPDATE",
  "VERIFIED_SPORTS_RESULT",
  "TECHNOLOGY_LAUNCH",
  "OFFICIAL_COMPANY_ANNOUNCEMENT",
  "PRIMARY_BACKED_SCIENCE_ANNOUNCEMENT",
  "NON_SENSITIVE_INTERNET_TREND",
] as const;

export type AutoPublishContentClass =
  (typeof AUTO_PUBLISH_CONTENT_CLASSES)[number];

export interface SensitiveContentInput {
  readonly topics: readonly SensitiveTopic[];
  /**
   * Auto-publication starts with an allowlist. An omitted class is reviewable,
   * even when no sensitive topic was detected.
   */
  readonly autoPublishContentClass?: AutoPublishContentClass;
}

export type SensitiveReviewDecision =
  | "AUTO_PUBLISH_ELIGIBLE"
  | "HUMAN_REVIEW_REQUIRED";

export interface SensitiveContentClassification {
  readonly decision: SensitiveReviewDecision;
  readonly requiresHumanReview: boolean;
  readonly matchedTopics: readonly SensitiveTopic[];
  readonly reasons: readonly string[];
}

const TOPIC_LABELS: Readonly<Record<SensitiveTopic, string>> = {
  US_ELECTIONS: "US federal or state elections",
  GOVERNMENT_LEADERSHIP: "government leadership or presidential coverage",
  WAR_OR_MILITARY_ACTION: "war or military action",
  TERRORISM: "terrorism",
  CRIME_OR_CRIMINAL_ACCUSATIONS: "crime or criminal accusations",
  LAWSUITS_OR_ALLEGATIONS: "lawsuits or allegations",
  DEATHS: "deaths",
  MISSING_PERSONS: "missing persons",
  MEDICAL_CLAIMS: "medical claims",
  PUBLIC_HEALTH: "public health",
  INVESTMENTS_OR_PERSONAL_FINANCE: "investments or personal finance",
  NATURAL_DISASTERS: "natural disasters",
  ACTIVE_EMERGENCIES: "active emergencies",
  MINORS: "minors",
  SEXUAL_MISCONDUCT: "sexual misconduct",
  IDENTITY_RELATED_CLAIMS: "identity-related claims",
  LEAKED_PRIVATE_INFORMATION: "leaked private information",
  GRAPHIC_OR_TRAUMATIC_EVENTS: "graphic or traumatic events",
  REPUTATIONAL_HARM: "claims likely to damage a person's reputation",
};

export function classifySensitiveContent(
  input: SensitiveContentInput,
): SensitiveContentClassification {
  const matchedTopics = [...new Set(input.topics)].sort();
  if (matchedTopics.length > 0) {
    return {
      decision: "HUMAN_REVIEW_REQUIRED",
      requiresHumanReview: true,
      matchedTopics,
      reasons: matchedTopics.map(
        (topic) => `Human approval is mandatory for ${TOPIC_LABELS[topic]}.`,
      ),
    };
  }

  if (!input.autoPublishContentClass) {
    return {
      decision: "HUMAN_REVIEW_REQUIRED",
      requiresHumanReview: true,
      matchedTopics,
      reasons: [
        "The content is outside the initial low-risk auto-publication allowlist.",
      ],
    };
  }

  return {
    decision: "AUTO_PUBLISH_ELIGIBLE",
    requiresHumanReview: false,
    matchedTopics,
    reasons: [
      `${input.autoPublishContentClass} is on the initial low-risk allowlist and no sensitive topic was detected.`,
    ],
  };
}
