import { z } from "zod";
import { AiRuntimeError } from "./errors";

const MAX_STRUCTURED_RESPONSE_CHARACTERS = 1_000_000;

export function parseStructuredOutput<TSchema extends z.ZodType>(
  text: string,
  schema: TSchema,
): z.output<TSchema> {
  if (!text || text.length > MAX_STRUCTURED_RESPONSE_CHARACTERS) {
    throw new AiRuntimeError(
      "AI_STRUCTURED_OUTPUT_INVALID",
      "The provider returned an empty or oversized structured response.",
    );
  }

  let parsedCandidate = false;
  let firstIssues: readonly { path: string; code: string }[] = [];
  for (const candidate of structuredDocumentCandidates(text)) {
    let value: unknown;
    try {
      value = JSON.parse(candidate);
      parsedCandidate = true;
    } catch {
      continue;
    }
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    if (firstIssues.length === 0) {
      // Only the failing field paths and rule names are recorded. No model
      // output is logged, so a contract mismatch is diagnosable without
      // exposing draft content.
      firstIssues = result.error.issues.slice(0, 8).map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
      }));
    }
  }

  if (firstIssues.length > 0) {
    console.warn("ai_structured_output_mismatch", { issues: firstIssues });
  }

  throw new AiRuntimeError(
    "AI_STRUCTURED_OUTPUT_INVALID",
    parsedCandidate
      ? "The provider response did not match the required output contract."
      : "The provider did not return a JSON document.",
  );
}

export function toProviderJsonSchema(schema: z.ZodType): unknown | undefined {
  try {
    return z.toJSONSchema(schema);
  } catch {
    return undefined;
  }
}

function structuredDocumentCandidates(text: string): readonly string[] {
  const normalized = text.replace(/^\uFEFF/u, "").trim();
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (candidate: string | undefined) => {
    const trimmed = candidate?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  for (const match of normalized.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu)) {
    add(match[1]);
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const opener = normalized[index];
    if (opener !== "{" && opener !== "[") continue;
    const balanced = readBalancedJson(normalized, index);
    if (!balanced) continue;
    add(balanced.document);
    index = balanced.end;
  }

  return candidates;
}

function readBalancedJson(
  text: string,
  start: number,
): { document: string; end: number } | undefined {
  const opener = text[start];
  const closer = opener === "{" ? "}" : opener === "[" ? "]" : undefined;
  if (!closer) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === opener) depth += 1;
    if (character === closer) depth -= 1;

    if (depth === 0) {
      return { document: text.slice(start, index + 1), end: index };
    }
  }

  return undefined;
}
