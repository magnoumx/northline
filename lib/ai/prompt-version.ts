import type { AiPromptDefinition } from "./types";
import { AiRuntimeError } from "./errors";

const SAFE_PROMPT_ID = /^[a-z0-9][a-z0-9._/-]{0,127}$/u;
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;

export async function fingerprintPrompt(
  prompt: AiPromptDefinition,
  schemaName: string,
): Promise<string> {
  if (
    !SAFE_PROMPT_ID.test(prompt.id) ||
    !SAFE_VERSION.test(prompt.version) ||
    !SAFE_PROMPT_ID.test(schemaName)
  ) {
    throw new AiRuntimeError(
      "AI_INPUT_INVALID",
      "Prompt identifiers, versions, and schema names must use safe identifiers.",
    );
  }
  if (!prompt.systemTemplate.trim() || prompt.systemTemplate.length > 100_000) {
    throw new AiRuntimeError(
      "AI_INPUT_INVALID",
      "The system prompt template is empty or exceeds the allowed size.",
    );
  }
  const canonical = JSON.stringify({
    id: prompt.id,
    version: prompt.version,
    schemaName,
    systemTemplate: prompt.systemTemplate.replace(/\r\n?/gu, "\n"),
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
