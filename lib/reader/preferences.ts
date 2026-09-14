export const READER_PREFERENCES_KEY = "northline-reader-preferences:v4";
export const LEGACY_READER_PREFERENCES_KEY = "reader-preferences:v2";
export const READER_PREFERENCES_EVENT = "northline-reader-preferences:change";

export const TEXT_SIZE_ORDER = [
  "compact",
  "comfortable",
  "large",
  "extra-large",
] as const;

export type ReaderTextSize = (typeof TEXT_SIZE_ORDER)[number];
export type ReaderWidth = "narrow" | "balanced" | "wide";
export type ReaderTheme = "system" | "light" | "dark";

export type ReadingPreferences = {
  textSize: ReaderTextSize;
  readingWidth: ReaderWidth;
  theme: ReaderTheme;
  reduceMotion: boolean;
  highContrast: boolean;
};

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  textSize: "comfortable",
  readingWidth: "balanced",
  theme: "system",
  reduceMotion: false,
  highContrast: false,
};

export function normalizeReadingPreferences(
  value: unknown,
): ReadingPreferences {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    textSize: normalizeTextSize(record.textSize),
    readingWidth:
      record.readingWidth === "narrow" || record.readingWidth === "wide"
        ? record.readingWidth
        : "balanced",
    theme:
      record.theme === "light" || record.theme === "dark"
        ? record.theme
        : "system",
    reduceMotion: record.reduceMotion === true,
    highContrast: record.highContrast === true,
  };
}

export function stepTextSize(
  current: ReaderTextSize,
  direction: -1 | 1,
): ReaderTextSize {
  const currentIndex = TEXT_SIZE_ORDER.indexOf(current);
  const nextIndex = Math.max(
    0,
    Math.min(TEXT_SIZE_ORDER.length - 1, currentIndex + direction),
  );
  return TEXT_SIZE_ORDER[nextIndex];
}

export function textSizeLabel(size: ReaderTextSize): string {
  switch (size) {
    case "compact":
      return "Compact, 17 pixels";
    case "comfortable":
      return "Comfortable, 20 pixels";
    case "large":
      return "Large, 22 pixels";
    case "extra-large":
      return "Extra large, 25 pixels";
  }
}

export function resolveReaderTheme(
  theme: ReaderTheme,
  systemPrefersDark: boolean,
): "light" | "dark" {
  // Dark is Northline's default identity, not an OS preference a reader has
  // to opt into - "system" (the value for both "never chose" and "explicitly
  // picked System") always resolves dark. `systemPrefersDark` stays in the
  // signature so existing callers don't need to change; it is intentionally
  // unused for this branch.
  if (theme === "system") return "dark";
  return theme;
}

function normalizeTextSize(value: unknown): ReaderTextSize {
  if (
    value === "compact" ||
    value === "comfortable" ||
    value === "large" ||
    value === "extra-large"
  ) {
    return value;
  }

  // Preserve V2 choices while moving every reader onto explicit pixel sizes.
  if (value === "default") return "comfortable";
  if (value === "larger") return "large";
  return DEFAULT_READING_PREFERENCES.textSize;
}
