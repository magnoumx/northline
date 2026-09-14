/**
 * One source of truth for how the autonomous newsroom runs.
 *
 * Fifty-six settings were read directly from the environment at their point of
 * use, each with its own inline default. The same limit could therefore be
 * documented as one number, defaulted as another, and displayed as a third,
 * and nothing would disagree loudly enough to notice. Two of them had already
 * drifted this way: the daily story limit and the audio article limit.
 *
 * Every operational limit is declared here once, with its bounds, its default
 * and a sentence saying what it governs. The dashboard, the documentation and
 * the executors all read the same resolved object.
 */

export type RuntimeSetting = {
  /** Environment variable that overrides the default. */
  key: string;
  /** What this setting governs, in one sentence, for the operator. */
  describes: string;
  default: number;
  minimum: number;
  maximum: number;
};

export type RuntimeFlag = {
  key: string;
  describes: string;
  default: boolean;
};

/**
 * Volume and spend. These are the settings an operator actually reaches for,
 * so they are grouped by the decision they support rather than by subsystem.
 */
export const RUNTIME_SETTINGS = {
  storiesPerDay: {
    key: "AUTONOMOUS_DRAFT_DAILY_LIMIT",
    describes: "New stories the newsroom starts on an ordinary day.",
    default: 5,
    minimum: 1,
    maximum: 25,
  },
  breakingReserve: {
    key: "AUTONOMOUS_BREAKING_RESERVE",
    describes:
      "Slots inside the daily limit that only major stories may take, so a quiet morning cannot spend the whole day.",
    default: 2,
    minimum: 0,
    maximum: 10,
  },
  breakingOverflow: {
    key: "AUTONOMOUS_BREAKING_OVERFLOW",
    describes:
      "Extra slots a major story may claim after the daily limit is used.",
    default: 3,
    minimum: 0,
    maximum: 15,
  },
  breakingScore: {
    key: "AUTONOMOUS_BREAKING_SCORE",
    describes: "Priority score at or above which a story counts as major.",
    default: 88,
    minimum: 0,
    maximum: 200,
  },
  dailyCostCeilingUsd: {
    key: "AUTONOMOUS_DAILY_COST_LIMIT_USD",
    describes:
      "Hard ceiling on paid AI spend per day. Cost stops the newsroom before any counter does.",
    default: 10,
    minimum: 1,
    maximum: 200,
  },
  estimatedStoryCostUsd: {
    key: "AUTONOMOUS_ESTIMATED_STORY_COST_USD",
    describes:
      "Planning estimate per story, used to refuse work the remaining budget cannot pay for.",
    default: 0.6,
    minimum: 0.05,
    maximum: 10,
  },
  publicationsPerDay: {
    key: "AUTO_PUBLISH_DAILY_LIMIT",
    describes: "Approved articles released automatically per day.",
    default: 8,
    minimum: 1,
    maximum: 25,
  },
  minimumIndependentSources: {
    key: "AUTONOMOUS_MIN_INDEPENDENT_SOURCES",
    describes:
      "Independent newsrooms required before an article may publish without a human.",
    default: 3,
    minimum: 2,
    maximum: 6,
  },
  narrationArticlesPerDay: {
    key: "ARTICLE_AUDIO_DAILY_ARTICLE_LIMIT",
    describes: "Articles given AI narration per day.",
    default: 8,
    minimum: 1,
    maximum: 100,
  },
  narrationDailyBudgetUsd: {
    key: "TTS_DAILY_BUDGET_USD",
    describes: "Ceiling on narration spend per day.",
    default: 2,
    minimum: 0.1,
    maximum: 50,
  },
} as const satisfies Record<string, RuntimeSetting>;

export const RUNTIME_FLAGS = {
  processAllActiveSignals: {
    key: "AUTONOMOUS_PROCESS_ALL_ACTIVE_SIGNALS",
    describes:
      "Consider every active trend rather than only those above the score threshold.",
    default: false,
  },
  aiIllustrationFallback: {
    key: "FEATURE_AI_ILLUSTRATION",
    describes:
      "Allow a clearly disclosed abstract illustration when no licensed photograph or verified video exists.",
    default: false,
  },
  archiveMediaBackfill: {
    key: "FEATURE_ARCHIVE_MEDIA_BACKFILL",
    describes:
      "Let the newsroom add licensed imagery to already-published articles through a presentation-only revision.",
    default: false,
  },
} as const satisfies Record<string, RuntimeFlag>;

export type RuntimeSettingName = keyof typeof RUNTIME_SETTINGS;
export type RuntimeFlagName = keyof typeof RUNTIME_FLAGS;

export type ResolvedRuntimeConfig = {
  settings: Record<RuntimeSettingName, number>;
  flags: Record<RuntimeFlagName, boolean>;
};

function clampToBounds(setting: RuntimeSetting, raw: string | undefined): number {
  const trimmed = (raw ?? "").trim();
  // `Number("")` is 0, not NaN. Without this an unset or whitespace-only
  // secret would clamp to the minimum rather than fall back to the default -
  // which is how a stray newline once set the newsroom's limits to their floor.
  if (trimmed === "") return setting.default;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return setting.default;
  // A value outside its bounds is an operator error, not an instruction. It is
  // clamped rather than obeyed, and never silently becomes zero.
  return Math.min(setting.maximum, Math.max(setting.minimum, parsed));
}

export function resolveRuntimeConfig(
  environment: Record<string, string | undefined>,
): ResolvedRuntimeConfig {
  const settings = {} as Record<RuntimeSettingName, number>;
  for (const [name, setting] of Object.entries(RUNTIME_SETTINGS)) {
    settings[name as RuntimeSettingName] = clampToBounds(
      setting,
      environment[setting.key],
    );
  }

  const flags = {} as Record<RuntimeFlagName, boolean>;
  for (const [name, flag] of Object.entries(RUNTIME_FLAGS)) {
    const raw = environment[flag.key]?.trim();
    flags[name as RuntimeFlagName] =
      raw === undefined || raw === "" ? flag.default : raw === "true";
  }

  return { settings, flags };
}

/**
 * The operator-facing description of the configuration, so the dashboard and
 * the documentation are generated from the same declaration the code obeys.
 */
export function describeRuntimeConfig(
  environment: Record<string, string | undefined>,
): {
  key: string;
  describes: string;
  value: string;
  isDefault: boolean;
}[] {
  const resolved = resolveRuntimeConfig(environment);
  const rows: {
    key: string;
    describes: string;
    value: string;
    isDefault: boolean;
  }[] = [];

  for (const [name, setting] of Object.entries(RUNTIME_SETTINGS)) {
    const value = resolved.settings[name as RuntimeSettingName];
    rows.push({
      key: setting.key,
      describes: setting.describes,
      value: String(value),
      isDefault: value === setting.default,
    });
  }
  for (const [name, flag] of Object.entries(RUNTIME_FLAGS)) {
    const value = resolved.flags[name as RuntimeFlagName];
    rows.push({
      key: flag.key,
      describes: flag.describes,
      value: value ? "on" : "off",
      isDefault: value === flag.default,
    });
  }
  return rows;
}
