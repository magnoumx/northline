import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal, dependency-free environment loader for Northline's Node scripts.
 * Wrangler/vinext already load .dev.vars at runtime, but plain `node scripts/*`
 * commands do not. Existing process variables always win.
 */
export function loadEnvironmentFiles(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const appEnv = process.env.APP_ENV?.trim() || process.env.NODE_ENV?.trim() || "development";
  const candidates = options.files ?? [
    ".env",
    `.env.${appEnv}`,
    ".env.local",
    `.env.${appEnv}.local`,
    ".dev.vars",
  ];
  const protectedKeys = new Set(Object.keys(process.env));
  const loaded = [];

  for (const relativePath of candidates) {
    const path = resolve(cwd, relativePath);
    if (!existsSync(path)) continue;
    const parsed = parseEnv(readFileSync(path, "utf8"));
    let applied = 0;
    for (const [key, value] of Object.entries(parsed)) {
      if (protectedKeys.has(key)) continue;
      process.env[key] = value;
      applied += 1;
    }
    loaded.push({ path: relativePath, applied });
  }
  return loaded;
}

export function parseEnv(source) {
  const values = {};
  for (const rawLine of source.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/u.test(key)) continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = findInlineComment(value);
      if (commentIndex >= 0) value = value.slice(0, commentIndex).trimEnd();
    }
    values[key] = value
      .replace(/\\n/gu, "\n")
      .replace(/\\r/gu, "\r")
      .replace(/\\t/gu, "\t");
  }
  return values;
}

function findInlineComment(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "#" && index > 0 && /\s/u.test(value[index - 1])) {
      return index;
    }
  }
  return -1;
}

loadEnvironmentFiles();
