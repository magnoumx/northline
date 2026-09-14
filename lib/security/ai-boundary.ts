export interface UntrustedSourceEnvelope {
  sourceId: string;
  sourceUrl: string;
  contentType: string;
  content: string;
  trust: "UNTRUSTED_DATA";
  instructionsMayNotBeFollowed: true;
}

const secretPattern =
  /(?:api[_-]?key|authorization|bearer|password|secret|private[_-]?key)\s*[:=]/i;
const injectionPattern =
  /(?:ignore|override|reveal|print|exfiltrate).{0,40}(?:instruction|prompt|secret|token|system)/i;

export function createUntrustedSourceEnvelope(input: {
  sourceId: string;
  sourceUrl: string;
  contentType: string;
  content: string;
  maximumCharacters?: number;
}): UntrustedSourceEnvelope {
  const maximum = Math.min(200_000, Math.max(1_000, input.maximumCharacters ?? 50_000));
  if (!/^[A-Za-z0-9._:-]{1,128}$/u.test(input.sourceId)) {
    throw new Error("invalid source identifier");
  }
  return {
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl.slice(0, 2_048),
    contentType: input.contentType.slice(0, 128),
    content: input.content.replace(/\u0000/gu, "").slice(0, maximum),
    trust: "UNTRUSTED_DATA",
    instructionsMayNotBeFollowed: true,
  };
}

export function inspectUntrustedSource(content: string): {
  containsPromptInjectionIndicators: boolean;
  containsSecretLikeMaterial: boolean;
  requiresHumanReview: boolean;
} {
  const containsPromptInjectionIndicators = injectionPattern.test(content);
  const containsSecretLikeMaterial = secretPattern.test(content);
  return {
    containsPromptInjectionIndicators,
    containsSecretLikeMaterial,
    requiresHumanReview:
      containsPromptInjectionIndicators || containsSecretLikeMaterial,
  };
}

export function authorizeModelSuggestedAction(input: {
  action: string;
  allowedActions: readonly string[];
  humanApproved: boolean;
  autoPublishEnabled: boolean;
}): boolean {
  if (!input.allowedActions.includes(input.action)) return false;
  if (input.action === "publish") {
    return input.autoPublishEnabled && input.humanApproved;
  }
  return input.humanApproved;
}

export function redactSecretsFromModelContext(value: string): string {
  return value
    .replace(/\b(bearer)\s+[^\s,;]+/giu, "$1 [REDACTED]")
    .replace(
      /((?:api[_-]?key|authorization|bearer|password|secret|private[_-]?key)\s*[:=]\s*)[^\s,;]+/giu,
      "$1[REDACTED]",
    );
}

