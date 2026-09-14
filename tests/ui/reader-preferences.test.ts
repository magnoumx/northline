import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_READING_PREFERENCES,
  normalizeReadingPreferences,
  resolveReaderTheme,
  stepTextSize,
  textSizeLabel,
} from "../../lib/reader/preferences";
import { toArticleAudioMetadata } from "../../lib/reader/article-audio";

const utilitiesCss = readFileSync("styles/utilities.css", "utf8");
const readerCss = readFileSync("styles/reader.css", "utf8");
const readerActions = readFileSync("components/reader-actions.tsx", "utf8");
const bootstrap = readFileSync("public/reader-preferences.js", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");

describe("V4 reader preferences", () => {
  it("uses explicit comfortable defaults and safely normalizes stored data", () => {
    expect(DEFAULT_READING_PREFERENCES).toEqual({
      textSize: "comfortable",
      readingWidth: "balanced",
      theme: "system",
      reduceMotion: false,
      highContrast: false,
    });
    expect(normalizeReadingPreferences(null)).toEqual(
      DEFAULT_READING_PREFERENCES,
    );
    expect(
      normalizeReadingPreferences({
        textSize: "extra-large",
        readingWidth: "wide",
        theme: "dark",
        reduceMotion: true,
        highContrast: true,
      }),
    ).toEqual({
      textSize: "extra-large",
      readingWidth: "wide",
      theme: "dark",
      reduceMotion: true,
      highContrast: true,
    });
  });

  it("migrates V2 sizes and clamps A-minus/A-plus stepping", () => {
    expect(normalizeReadingPreferences({ textSize: "default" }).textSize).toBe(
      "comfortable",
    );
    expect(normalizeReadingPreferences({ textSize: "larger" }).textSize).toBe(
      "large",
    );
    expect(stepTextSize("compact", -1)).toBe("compact");
    expect(stepTextSize("compact", 1)).toBe("comfortable");
    expect(stepTextSize("comfortable", 1)).toBe("large");
    expect(stepTextSize("large", 1)).toBe("extra-large");
    expect(stepTextSize("extra-large", 1)).toBe("extra-large");
  });

  it("exposes exact reader-facing size labels", () => {
    expect(textSizeLabel("compact")).toBe("Compact, 17 pixels");
    expect(textSizeLabel("comfortable")).toBe("Comfortable, 20 pixels");
    expect(textSizeLabel("large")).toBe("Large, 22 pixels");
    expect(textSizeLabel("extra-large")).toBe("Extra large, 25 pixels");
  });

  it("resolves system preference to dark by default and respects explicit choices", () => {
    // "system" is the value used both when a reader never chose a theme and
    // when they explicitly picked "System" - Northline's dark identity wins
    // either way. Explicit "light"/"dark" choices are always honored as-is.
    expect(resolveReaderTheme("system", true)).toBe("dark");
    expect(resolveReaderTheme("system", false)).toBe("dark");
    expect(resolveReaderTheme("light", true)).toBe("light");
    expect(resolveReaderTheme("dark", false)).toBe("dark");
  });

  it.each([
    ["compact", "17px"],
    ["comfortable", "20px"],
    ["large", "22px"],
    ["extra-large", "25px"],
  ])("binds %s to an exact %s article size", (size, pixels) => {
    expect(utilitiesCss).toMatch(
      new RegExp(
        `html\\[data-reader-size="${size}"\\][\\s\\S]*?--reader-font-size:\\s*${pixels}`,
      ),
    );
  });

  it("bootstraps preferences before interactive hydration to avoid a size flash", () => {
    expect(rootLayout).toContain('strategy="beforeInteractive"');
    expect(rootLayout).toContain('src="/reader-preferences.js"');
    expect(bootstrap).toContain('root.dataset.readerSize = textSize');
    expect(bootstrap).toContain('root.dataset.readerWidth = readingWidth');
    expect(bootstrap).toContain('root.dataset.readerReady = "true"');
    expect(bootstrap).toContain('theme === "system" ? "dark" : theme');
  });

  it("provides width, contrast, reduced-motion, reset, and live announcements", () => {
    expect(readerActions).toContain("Reading width");
    expect(readerActions).toContain("High contrast");
    expect(readerActions).toContain("Reduce motion");
    expect(readerActions).toContain("Reset reading settings");
    expect(readerActions).toContain('aria-live="polite"');
    expect(utilitiesCss).toContain('html[data-reader-width="narrow"]');
    expect(utilitiesCss).toContain('html[data-reader-width="wide"]');
    expect(utilitiesCss).toContain('html[data-reader-contrast="high"]');
    expect(utilitiesCss).toContain('html[data-reader-motion="reduce"]');
  });
});

describe("V4 article audio player contract", () => {
  it("keeps browser speech behind an explicitly degraded fallback", () => {
    expect(readerActions).not.toContain("function toggleSpeech");
    expect(readerActions).toContain("Use browser voice (degraded)");
    expect(readerActions).toContain(
      "Browser speech is device-generated, may sound less natural",
    );
    expect(readerActions).toContain(
      'selectedState === "READY" && Boolean(track?.src)',
    );
  });

  it("maps the provider-neutral public read model into safe player metadata", () => {
    const metadata = toArticleAudioMetadata({
      audio: {
        articleVersionId: "version_12345678",
        tracks: {
          QUICK_BRIEF: {
            state: "READY",
            variant: "QUICK_BRIEF",
            durationMs: 90_000,
            streamUrl: "/api/article-audio/audio_12345678/stream",
            chapters: [
              { id: "intro", title: "Introduction", startMs: 0, endMs: 5_000 },
              { id: "facts", title: "Key facts", startMs: 5_000, endMs: 90_000 },
            ],
            timings: [
              { text: "Confirmed facts.", startMs: 5_000, endMs: 8_000 },
            ],
            disclosure: "AI-generated narration",
            degradedBrowserFallbackAvailable: true,
          },
          FULL_ARTICLE: {
            state: "QUEUED",
            variant: "FULL_ARTICLE",
            durationMs: null,
            streamUrl: null,
            chapters: [],
            timings: [],
            disclosure: "AI-generated narration",
            degradedBrowserFallbackAvailable: true,
          },
        },
      },
    });

    expect(metadata?.quick).toMatchObject({
      state: "READY",
      src: "/api/article-audio/audio_12345678/stream",
      durationSeconds: 90,
      skipIntroductionSeconds: 5,
    });
    expect(metadata?.quick?.timings?.[0]).toMatchObject({
      text: "Confirmed facts.",
      startSeconds: 5,
      endSeconds: 8,
    });
    expect(metadata?.full?.state).toBe("QUEUED");
    expect(metadata?.publishedVersion).toBe("version_12345678");
  });

  it("drops arbitrary media URLs and malformed public responses", () => {
    expect(
      toArticleAudioMetadata({
        tracks: {
          QUICK_BRIEF: {
            state: "READY",
            durationMs: 1_000,
            streamUrl: "javascript:alert(1)",
            chapters: [],
            timings: [],
          },
        },
      })?.quick?.src,
    ).toBeUndefined();
    expect(toArticleAudioMetadata({ audio: { tracks: "invalid" } })).toBeUndefined();
  });

  it("includes the complete keyboard-operable transport contract", () => {
    expect(readerActions).toContain('aria-label="Go back 15 seconds"');
    expect(readerActions).toContain('aria-label="Go forward 15 seconds"');
    expect(readerActions).toContain("Quick Brief");
    expect(readerActions).toContain("Full article");
    expect(readerActions).toContain("Chapters");
    expect(readerActions).toContain("Skip introduction");
    expect(readerActions).toContain("Article audio volume");
    expect(readerActions).toContain("[0.75, 1, 1.25, 1.5, 1.75, 2]");
    expect(readerActions).toContain("MediaMetadata");
    expect(readerActions).toContain("northline-audio-resume:v1");
    expect(readerActions).toContain('aria-keyshortcuts="Space"');
  });

  it("uses touch-sized, reflow-safe sticky controls", () => {
    expect(readerCss).toContain("min-height: var(--button-height)");
    expect(readerCss).toContain("max-height: calc(100dvh - 1rem)");
    expect(readerCss).toContain("overflow-x: hidden");
    expect(readerCss).toContain("@media (max-width: 39.999rem)");
    expect(readerCss).toContain("grid-column: 1 / -1");
  });
});
