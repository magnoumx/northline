"use client";

import {
  Bell,
  Bookmark,
  Check,
  Contrast,
  FastForward,
  Headphones,
  History,
  ListMusic,
  Monitor,
  Moon,
  MoveHorizontal,
  Pause,
  Play,
  Plus,
  Rewind,
  RotateCcw,
  Settings2,
  Share2,
  Sun,
  Type,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  toArticleAudioMetadata,
  type ArticleAudioMetadata,
  type ArticleAudioState,
} from "@/lib/reader/article-audio";
import {
  DEFAULT_READING_PREFERENCES,
  LEGACY_READER_PREFERENCES_KEY,
  normalizeReadingPreferences,
  READER_PREFERENCES_EVENT,
  READER_PREFERENCES_KEY,
  resolveReaderTheme,
  stepTextSize,
  textSizeLabel,
  type ReaderTextSize,
  type ReaderTheme,
  type ReaderWidth,
  type ReadingPreferences,
} from "@/lib/reader/preferences";

type FollowKind = "topic" | "person" | "company" | "team";
type AudioMode = "quick" | "full";

type SavedStory = {
  slug: string;
  headline: string;
};

type FollowRecord = {
  kind: FollowKind;
  label: string;
};

type HistoryRecord = SavedStory & {
  viewedAt: string;
};

type ReaderStore = ReadingPreferences & {
  saved: SavedStory[];
  follows: FollowRecord[];
  history: HistoryRecord[];
  hiddenTopics: string[];
  hiddenSources: string[];
};

export const ARTICLE_AUDIO_OPEN_EVENT = "northline:article-audio:open";

export type {
  ArticleAudioChapter,
  ArticleAudioMetadata,
  ArticleAudioTiming,
  ArticleAudioTrack,
} from "@/lib/reader/article-audio";

const CHANGE_EVENT = "reader-preferences:change";
const EMPTY_STORE: ReaderStore = {
  saved: [],
  follows: [],
  history: [],
  hiddenTopics: [],
  hiddenSources: [],
  ...DEFAULT_READING_PREFERENCES,
};

function readStore(): ReaderStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  const current = readStoredRecord(READER_PREFERENCES_KEY);
  const legacy = readStoredRecord(LEGACY_READER_PREFERENCES_KEY);
  const source = Object.keys(current).length ? current : legacy;
  const reading = normalizeReadingPreferences(source);

  return {
    saved: Array.isArray(source.saved) ? source.saved : [],
    follows: Array.isArray(source.follows) ? source.follows : [],
    history: Array.isArray(source.history) ? source.history : [],
    hiddenTopics: Array.isArray(source.hiddenTopics)
      ? source.hiddenTopics
      : [],
    hiddenSources: Array.isArray(source.hiddenSources)
      ? source.hiddenSources
      : [],
    ...reading,
  };
}

function readStoredRecord(key: string): Partial<ReaderStore> {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(key) ?? "{}",
    ) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Partial<ReaderStore>)
      : {};
  } catch {
    return {};
  }
}

function applyStore(store: ReaderStore) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.readerSize = store.textSize;
  root.dataset.readerWidth = store.readingWidth;
  root.dataset.readerMotion = store.reduceMotion ? "reduce" : "system";
  root.dataset.readerContrast = store.highContrast ? "high" : "system";
  root.dataset.theme = resolveReaderTheme(store.theme, systemDark);
  root.dataset.readerReady = "true";

  if (store.theme === "system") {
    window.localStorage.removeItem("northline-theme");
  } else {
    window.localStorage.setItem("northline-theme", store.theme);
  }
}

function writeStore(update: (current: ReaderStore) => ReaderStore): ReaderStore {
  const next = update(readStore());
  window.localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(next));
  applyStore(next);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  window.dispatchEvent(
    new CustomEvent(READER_PREFERENCES_EVENT, {
      detail: {
        theme: next.theme,
        resolvedTheme: document.documentElement.dataset.theme,
      },
    }),
  );
  return next;
}

function useReaderStore() {
  const [store, setStore] = useState<ReaderStore>(EMPTY_STORE);

  useEffect(() => {
    const sync = () => {
      const next = readStore();
      applyStore(next);
      setStore(next);
    };
    const timer = window.setTimeout(sync, 0);
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      const next = readStore();
      if (next.theme === "system") {
        applyStore(next);
        setStore(next);
      }
    };

    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener(READER_PREFERENCES_EVENT, sync);
    window.addEventListener("storage", sync);
    colorScheme.addEventListener("change", syncSystemTheme);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener(READER_PREFERENCES_EVENT, sync);
      window.removeEventListener("storage", sync);
      colorScheme.removeEventListener("change", syncSystemTheme);
    };
  }, []);

  const update = useCallback(
    (mutation: (current: ReaderStore) => ReaderStore) => {
      setStore(writeStore(mutation));
    },
    [],
  );

  return { store, update };
}

function includesFollow(
  store: ReaderStore,
  kind: FollowKind,
  label: string,
): boolean {
  return store.follows.some(
    (record) => record.kind === kind && record.label === label,
  );
}

export function ReaderActions({
  slug,
  articleId,
  headline,
  listenText = headline,
  audio,
}: {
  slug: string;
  articleId?: string;
  headline: string;
  listenText?: string;
  audio?: ArticleAudioMetadata;
}) {
  const { store, update } = useReaderStore();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [resolvedAudio, setResolvedAudio] = useState(audio);
  const [message, setMessage] = useState("");
  const saved = store.saved.some((story) => story.slug === slug);
  const playerId = `article-audio-${slug}`;

  useEffect(() => {
    if (audio) {
      const timer = window.setTimeout(() => setResolvedAudio(audio), 0);
      return () => window.clearTimeout(timer);
    }
    if (!articleId) return;
    const controller = new AbortController();
    void fetch(`/api/articles/${encodeURIComponent(articleId)}/audio`, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return undefined;
        return toArticleAudioMetadata(await response.json());
      })
      .then((metadata) => {
        if (metadata) setResolvedAudio(metadata);
      })
      .catch(() => {
        // The player keeps its explicit unavailable state and degraded fallback.
      });
    return () => controller.abort();
  }, [articleId, audio]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writeStore((current) => ({
        ...current,
        history: [
          { slug, headline, viewedAt: new Date().toISOString() },
          ...current.history.filter((entry) => entry.slug !== slug),
        ].slice(0, 20),
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [headline, slug]);

  useEffect(() => {
    const openRequestedPlayer = (event: Event) => {
      const requestedSlug = (event as CustomEvent<{ slug?: string }>).detail
        ?.slug;
      if (requestedSlug === slug) {
        setPlayerOpen(true);
      }
    };
    window.addEventListener(ARTICLE_AUDIO_OPEN_EVENT, openRequestedPlayer);
    return () =>
      window.removeEventListener(ARTICLE_AUDIO_OPEN_EVENT, openRequestedPlayer);
  }, [slug]);

  function toggleSaved() {
    update((current) => ({
      ...current,
      saved: saved
        ? current.saved.filter((story) => story.slug !== slug)
        : [{ slug, headline }, ...current.saved].slice(0, 50),
    }));
    setMessage(saved ? "Removed from saved stories." : "Saved on this device.");
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: headline, url: window.location.href });
        setMessage("Share sheet opened.");
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Link copied.");
    } catch {
      setMessage("Sharing was cancelled.");
    }
  }

  return (
    <div className="reader-actions-wrap">
      <div className="reader-actions" aria-label="Story actions" role="group">
        <button type="button" onClick={toggleSaved} aria-pressed={saved}>
          {saved ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setPlayerOpen(true)}
          aria-expanded={playerOpen}
          aria-controls={playerId}
        >
          <Headphones aria-hidden="true" />
          Listen
        </button>
        <button type="button" onClick={share}>
          <Share2 aria-hidden="true" />
          Share
        </button>
        <ReadingSettings
          store={store}
          update={update}
          announce={setMessage}
          trigger="Aa"
        />
      </div>

      <p
        className="reader-action-status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </p>

      {playerOpen ? (
        <ArticleAudioPlayer
          id={playerId}
          slug={slug}
          headline={headline}
          fallbackText={listenText}
          metadata={resolvedAudio}
          onClose={() => setPlayerOpen(false)}
          announce={setMessage}
        />
      ) : null}
    </div>
  );
}

function TextSizeStepper({
  size,
  onChange,
  compact = false,
}: {
  size: ReaderTextSize;
  onChange: (size: ReaderTextSize) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`text-size-stepper${compact ? " text-size-stepper--compact" : ""}`}
      role="group"
      aria-label="Article text size"
    >
      <button
        type="button"
        aria-label="Decrease article text size"
        disabled={size === "compact"}
        onClick={() => onChange(stepTextSize(size, -1))}
      >
        A<span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        aria-label="Use comfortable 19 pixel article text"
        aria-pressed={size === "comfortable"}
        onClick={() => onChange("comfortable")}
      >
        A
      </button>
      <button
        type="button"
        aria-label="Increase article text size"
        disabled={size === "extra-large"}
        onClick={() => onChange(stepTextSize(size, 1))}
      >
        A<span aria-hidden="true">+</span>
      </button>
      {compact ? (
        <span className="sr-only" aria-live="polite">
          {textSizeLabel(size)}
        </span>
      ) : (
        <output>{textSizeLabel(size)}</output>
      )}
    </div>
  );
}

function ReadingSettings({
  store,
  update,
  announce,
  trigger = "Reading settings",
}: {
  store: ReaderStore;
  update: (mutation: (current: ReaderStore) => ReaderStore) => void;
  announce: (message: string) => void;
  trigger?: string;
}) {
  function setTextSize(size: ReaderTextSize) {
    update((current) => ({ ...current, textSize: size }));
    announce(
      `Article text set to ${formatTextSizeName(size)} (${textSizeLabel(size).split(", ")[1]}).`,
    );
  }

  function setReadingWidth(readingWidth: ReaderWidth) {
    update((current) => ({ ...current, readingWidth }));
    announce(`${capitalize(readingWidth)} reading width selected.`);
  }

  function setTheme(theme: ReaderTheme) {
    update((current) => ({ ...current, theme }));
    announce(`${capitalize(theme)} color theme selected.`);
  }

  function resetReadingSettings() {
    update((current) => ({
      ...current,
      ...DEFAULT_READING_PREFERENCES,
    }));
    announce("Reading settings reset to comfortable defaults.");
  }

  return (
    <details className="reading-settings">
      <summary>
        <Settings2 aria-hidden="true" />
        {trigger}
      </summary>
      <div className="reading-settings__panel">
        <fieldset>
          <legend>
            <Type aria-hidden="true" />
            Text size
          </legend>
          <TextSizeStepper size={store.textSize} onChange={setTextSize} />
        </fieldset>

        <fieldset>
          <legend>
            <MoveHorizontal aria-hidden="true" />
            Reading width
          </legend>
          <div className="reading-choice-group">
            {(["narrow", "balanced", "wide"] as const).map((width) => (
              <button
                key={width}
                type="button"
                aria-pressed={store.readingWidth === width}
                onClick={() => setReadingWidth(width)}
              >
                {capitalize(width)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>
            {store.theme === "dark" ? (
              <Moon aria-hidden="true" />
            ) : store.theme === "light" ? (
              <Sun aria-hidden="true" />
            ) : (
              <Monitor aria-hidden="true" />
            )}
            Theme
          </legend>
          <div className="reading-choice-group">
            {(["system", "light", "dark"] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                aria-pressed={store.theme === theme}
                onClick={() => setTheme(theme)}
              >
                {capitalize(theme)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <Contrast aria-hidden="true" />
            Visual comfort
          </legend>
          <div className="reading-toggle-group">
            <button
              type="button"
              aria-pressed={store.reduceMotion}
              onClick={() => {
                update((current) => ({
                  ...current,
                  reduceMotion: !current.reduceMotion,
                }));
                announce(
                  store.reduceMotion
                    ? "Reduced motion turned off."
                    : "Reduced motion turned on.",
                );
              }}
            >
              Reduce motion
            </button>
            <button
              type="button"
              aria-pressed={store.highContrast}
              onClick={() => {
                update((current) => ({
                  ...current,
                  highContrast: !current.highContrast,
                }));
                announce(
                  store.highContrast
                    ? "High contrast turned off."
                    : "High contrast turned on.",
                );
              }}
            >
              High contrast
            </button>
          </div>
        </fieldset>

        <button
          className="reading-settings__reset"
          type="button"
          onClick={resetReadingSettings}
        >
          <RotateCcw aria-hidden="true" />
          Reset reading settings
        </button>
      </div>
    </details>
  );
}

function ArticleAudioPlayer({
  id,
  slug,
  headline,
  fallbackText,
  metadata,
  onClose,
  announce,
}: {
  id: string;
  slug: string;
  headline: string;
  fallbackText: string;
  metadata?: ArticleAudioMetadata;
  onClose: () => void;
  announce: (message: string) => void;
}) {
  const initialMode: AudioMode =
    metadata?.quick?.state === "READY" && Boolean(metadata.quick.src)
      ? "quick"
      : metadata?.full?.state === "READY" && Boolean(metadata.full.src)
        ? "full"
        : metadata?.quick
          ? "quick"
          : "full";
  const [mode, setMode] = useState<AudioMode>(initialMode);
  const [playing, setPlaying] = useState(false);
  const [fallbackPlaying, setFallbackPlaying] = useState(false);
  const [fallbackSupported, setFallbackSupported] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [lastAudibleVolume, setLastAudibleVolume] = useState(1);
  const [status, setStatus] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const track = metadata?.[mode];
  const duration = track?.durationSeconds ?? 0;
  const selectedState = track?.state ?? metadata?.state;
  const productionReady = selectedState === "READY" && Boolean(track?.src);
  const introEnd =
    track?.skipIntroductionSeconds ??
    (track?.chapters[0]?.title.toLowerCase().includes("intro")
      ? track.chapters[1]?.startSeconds
      : undefined);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setFallbackSupported("speechSynthesis" in window),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;
    audioElement.pause();
    setPlaying(false);
    const resumeAt = readAudioResume(slug, mode);
    setCurrentTime(resumeAt);
    audioElement.load();
  }, [mode, slug, track?.src]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !track?.src) return;
    const mediaSession = navigator.mediaSession;
    mediaSession.metadata = new MediaMetadata({
      title: headline,
      artist: "Northline AI narration",
      album: mode === "quick" ? "Quick Brief" : "Full article",
    });
    const seek = (offset: number) => {
      const audioElement = audioRef.current;
      if (!audioElement) return;
      audioElement.currentTime = clamp(
        audioElement.currentTime + offset,
        0,
        audioElement.duration || duration,
      );
    };
    mediaSession.setActionHandler("play", () => {
      void audioRef.current?.play();
    });
    mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    mediaSession.setActionHandler("seekbackward", () => seek(-15));
    mediaSession.setActionHandler("seekforward", () => seek(15));
    mediaSession.setActionHandler("seekto", (details) => {
      if (audioRef.current && details.seekTime !== undefined) {
        audioRef.current.currentTime = details.seekTime;
      }
    });
    return () => {
      mediaSession.setActionHandler("play", null);
      mediaSession.setActionHandler("pause", null);
      mediaSession.setActionHandler("seekbackward", null);
      mediaSession.setActionHandler("seekforward", null);
      mediaSession.setActionHandler("seekto", null);
    };
  }, [duration, headline, mode, track?.src]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (
        fallbackPlaying &&
        "speechSynthesis" in window &&
        window.speechSynthesis.speaking
      ) {
        window.speechSynthesis.cancel();
      }
    },
    [fallbackPlaying],
  );

  function selectMode(nextMode: AudioMode) {
    if (!metadata?.[nextMode]) return;
    if (
      fallbackPlaying &&
      "speechSynthesis" in window &&
      window.speechSynthesis.speaking
    ) {
      window.speechSynthesis.cancel();
      setFallbackPlaying(false);
    }
    setMode(nextMode);
    setStatus(
      nextMode === "quick"
        ? "Quick Brief selected."
        : "Full article selected.",
    );
  }

  async function toggleProductionAudio() {
    if (!productionReady) {
      toggleBrowserFallback();
      return;
    }
    const audioElement = audioRef.current;
    if (!audioElement) {
      setStatus("Article audio is unavailable on this browser.");
      return;
    }
    if (audioElement.paused) {
      try {
        if (
          fallbackPlaying &&
          "speechSynthesis" in window &&
          window.speechSynthesis.speaking
        ) {
          window.speechSynthesis.cancel();
          setFallbackPlaying(false);
        }
        await audioElement.play();
        setStatus("Article audio playing.");
      } catch {
        setStatus("Playback could not start. Check your browser permissions.");
      }
    } else {
      audioElement.pause();
      setStatus("Article audio paused.");
    }
  }

  function seek(seconds: number) {
    const audioElement = audioRef.current;
    if (!audioElement || !productionReady) return;
    audioElement.currentTime = clamp(
      audioElement.currentTime + seconds,
      0,
      audioElement.duration || duration,
    );
  }

  function seekTo(seconds: number) {
    const audioElement = audioRef.current;
    if (!audioElement || !productionReady) return;
    audioElement.currentTime = clamp(
      seconds,
      0,
      audioElement.duration || duration,
    );
  }

  function setPlayerVolume(nextVolume: number) {
    const clampedVolume = clamp(nextVolume, 0, 1);
    setVolume(clampedVolume);
    if (clampedVolume > 0) setLastAudibleVolume(clampedVolume);
    if (audioRef.current) audioRef.current.volume = clampedVolume;
    setStatus(
      clampedVolume === 0
        ? "Article audio muted."
        : `Article audio volume ${Math.round(clampedVolume * 100)} percent.`,
    );
  }

  function toggleMute() {
    setPlayerVolume(volume === 0 ? lastAudibleVolume : 0);
  }

  function handlePlayerKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (
      target.matches("input, select, textarea") ||
      (target.matches("button, summary") && event.key === " ")
    ) {
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      void toggleProductionAudio();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seek(-15);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seek(15);
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      toggleMute();
    }
  }

  function toggleBrowserFallback() {
    if (
      !fallbackSupported ||
      metadata?.degradedBrowserFallbackAvailable === false
    ) {
      setStatus("The degraded browser voice is unavailable on this device.");
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setFallbackPlaying(false);
      setStatus("Browser voice stopped.");
      return;
    }
    audioRef.current?.pause();
    const utterance = new SpeechSynthesisUtterance(fallbackText);
    utterance.rate = clamp(speed, 0.75, 2);
    utterance.volume = volume;
    utterance.onend = () => {
      setFallbackPlaying(false);
      setStatus("Browser voice finished.");
    };
    utterance.onerror = () => {
      setFallbackPlaying(false);
      setStatus("The degraded browser voice could not play this article.");
    };
    window.speechSynthesis.speak(utterance);
    setFallbackPlaying(true);
    setStatus("Degraded browser voice playing.");
  }

  const activeChapter = [...(track?.chapters ?? [])]
    .reverse()
    .find((chapter) => chapter.startSeconds <= currentTime);
  const activeTiming = track?.timings?.find(
    (timing) =>
      timing.startSeconds <= currentTime && timing.endSeconds > currentTime,
  );

  return (
    <aside
      id={id}
      className="article-audio-player article-audio-player--sticky"
      aria-label="Article audio player"
      onKeyDown={handlePlayerKeyDown}
    >
      <div className="article-audio-player__topline">
        <div>
          <p>LISTEN TO THIS STORY</p>
          <strong>{headline}</strong>
        </div>
        <button
          className="article-audio-player__close"
          type="button"
          aria-label="Close article audio player"
          onClick={() => {
            announce("Article audio player closed.");
            onClose();
          }}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="audio-mode-switch" role="radiogroup" aria-label="Audio depth">
        {(["quick", "full"] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="radio"
            aria-checked={mode === candidate}
            disabled={!metadata?.[candidate]}
            onClick={() => selectMode(candidate)}
          >
            {candidate === "quick" ? "Quick Brief" : "Full article"}
          </button>
        ))}
      </div>

      <audio
        ref={audioRef}
        src={track?.src}
        preload="metadata"
        controlsList="nodownload"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setStatus("Article audio finished.");
        }}
        onLoadedMetadata={(event) => {
          const resumeAt = clamp(
            readAudioResume(slug, mode),
            0,
            event.currentTarget.duration || duration,
          );
          event.currentTarget.currentTime = resumeAt;
          event.currentTarget.playbackRate = speed;
          event.currentTarget.volume = volume;
          setCurrentTime(resumeAt);
        }}
        onError={() =>
          setStatus(
            "Natural audio could not be loaded. Retry later or open the degraded fallback.",
          )
        }
        onTimeUpdate={(event) => {
          const nextTime = event.currentTarget.currentTime;
          setCurrentTime(nextTime);
          writeAudioResume(slug, mode, nextTime);
        }}
      />

      <div className="article-audio-player__transport">
        <button
          type="button"
          aria-label="Go back 15 seconds"
          aria-keyshortcuts="ArrowLeft"
          disabled={!productionReady}
          onClick={() => seek(-15)}
        >
          <Rewind aria-hidden="true" />
          <span>15</span>
        </button>
        <button
          className="article-audio-player__play"
          type="button"
          aria-label={playing || fallbackPlaying ? "Pause article audio" : "Play article audio"}
          aria-keyshortcuts="Space"
          aria-pressed={playing || fallbackPlaying}
          disabled={!productionReady && !fallbackSupported}
          onClick={() => void toggleProductionAudio()}
        >
          {playing || fallbackPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>
        <button
          type="button"
          aria-label="Go forward 15 seconds"
          aria-keyshortcuts="ArrowRight"
          disabled={!productionReady}
          onClick={() => seek(15)}
        >
          <FastForward aria-hidden="true" />
          <span>15</span>
        </button>
        <label className="audio-speed">
          <span>Speed</span>
          <select
            value={speed}
            onChange={(event) => {
              const nextSpeed = Number(event.target.value);
              setSpeed(nextSpeed);
              if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
              setStatus(`${nextSpeed} times playback speed selected.`);
            }}
          >
            {[0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <div className="audio-volume">
          <button
            type="button"
            aria-label={volume === 0 ? "Unmute article audio" : "Mute article audio"}
            aria-keyshortcuts="M"
            aria-pressed={volume === 0}
            disabled={!productionReady && !fallbackSupported}
            onClick={toggleMute}
          >
            {volume === 0 ? (
              <VolumeX aria-hidden="true" />
            ) : (
              <Volume2 aria-hidden="true" />
            )}
          </button>
          <label>
            <span className="sr-only">Article audio volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              disabled={!productionReady && !fallbackSupported}
              onChange={(event) => setPlayerVolume(Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="article-audio-player__timeline">
        <span aria-hidden="true">{formatTime(currentTime)}</span>
        <label>
          <span className="sr-only">Article audio position</span>
          <input
            type="range"
            min="0"
            max={Math.max(duration, 1)}
            step="1"
            value={Math.min(currentTime, Math.max(duration, 1))}
            disabled={!productionReady}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            onChange={(event) => seekTo(Number(event.target.value))}
          />
        </label>
        <span aria-hidden="true">{formatTime(duration)}</span>
      </div>

      {introEnd !== undefined && introEnd > 0 ? (
        <button
          className="audio-skip-intro"
          type="button"
          disabled={!productionReady || currentTime >= introEnd}
          onClick={() => {
            seekTo(introEnd);
            setStatus("Introduction skipped.");
          }}
        >
          Skip introduction
        </button>
      ) : null}

      {activeTiming ? (
        <p className="audio-active-transcript" aria-live="off">
          <span>Now reading</span>
          <mark>{activeTiming.text}</mark>
        </p>
      ) : null}

      {track?.chapters.length ? (
        <details className="audio-chapters">
          <summary>
            <ListMusic aria-hidden="true" />
            Chapters
            {activeChapter ? <span>{activeChapter.title}</span> : null}
          </summary>
          <ol>
            {track.chapters.map((chapter) => (
              <li key={chapter.id}>
                <button
                  type="button"
                  aria-current={
                    activeChapter?.id === chapter.id ? "true" : undefined
                  }
                  onClick={() => seekTo(chapter.startSeconds)}
                >
                  <span>{chapter.title}</span>
                  <time>{formatTime(chapter.startSeconds)}</time>
                </button>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className="article-audio-player__availability" role="note">
        <Volume2 aria-hidden="true" />
        <div>
          <strong>{audioStateLabel(selectedState, productionReady)}</strong>
          <p>
            {metadata?.disclosure ??
              "AI narration is generated from an immutable published version and is not the reporter’s voice."}
            {metadata?.voiceLabel ? ` Voice: ${metadata.voiceLabel}.` : ""}
            {metadata?.publishedVersion
              ? ` Published version: ${metadata.publishedVersion}.`
              : ""}
          </p>
        </div>
      </div>

      <details className="audio-browser-fallback">
        <summary>Playback help and degraded fallback</summary>
        <p>
          Browser speech is device-generated, may sound less natural, and does
          not include chapters, sentence timing, or saved position.
        </p>
        <button
          type="button"
          aria-pressed={fallbackPlaying}
          disabled={
            !fallbackSupported ||
            metadata?.degradedBrowserFallbackAvailable === false
          }
          onClick={toggleBrowserFallback}
        >
          {fallbackPlaying ? (
            <Pause aria-hidden="true" />
          ) : (
            <Volume2 aria-hidden="true" />
          )}
          {fallbackPlaying
            ? "Stop browser voice"
            : "Use browser voice (degraded)"}
        </button>
      </details>

      <p className="article-audio-player__status" aria-live="polite">
        {status}
      </p>
    </aside>
  );
}

export function LocalFollowButton({
  kind,
  label,
}: {
  kind: FollowKind;
  label: string;
}) {
  const { store, update } = useReaderStore();
  const followed = includesFollow(store, kind, label);

  function toggle() {
    update((current) => ({
      ...current,
      follows: followed
        ? current.follows.filter(
            (record) => !(record.kind === kind && record.label === label),
          )
        : [{ kind, label }, ...current.follows],
    }));
  }

  return (
    <button
      className="follow-button"
      type="button"
      onClick={toggle}
      aria-pressed={followed}
    >
      {followed ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
      {followed ? "Following" : `Follow ${kind}`}
      <span className="sr-only"> {label}</span>
    </button>
  );
}

export function ReaderPreferencePanel({
  view,
}: {
  view: "saved" | "following" | "account";
}) {
  const { store, update } = useReaderStore();
  const [message, setMessage] = useState("");
  const recent = store.history.slice(0, 6);
  const hasPersonalization =
    store.saved.length > 0 ||
    store.follows.length > 0 ||
    store.history.length > 0 ||
    store.hiddenTopics.length > 0 ||
    store.hiddenSources.length > 0;

  const heading = useMemo(
    () =>
      view === "saved"
        ? "Saved on this device"
        : view === "following"
          ? "Your local watchlist"
          : "Reader controls",
    [view],
  );

  function resetPersonalization() {
    update((current) => ({
      ...current,
      saved: [],
      follows: [],
      history: [],
      hiddenTopics: [],
      hiddenSources: [],
    }));
    setMessage("Local personalization reset. Reading settings were kept.");
  }

  return (
    <section className="reader-preference-panel" aria-labelledby="reader-pref-title">
      <div className="reader-preference-panel__header">
        <div>
          <p>ANONYMOUS LOCAL PREFERENCE</p>
          <h2 id="reader-pref-title">{heading}</h2>
        </div>
        {hasPersonalization ? (
          <button
            type="button"
            className="text-button"
            onClick={resetPersonalization}
          >
            <RotateCcw aria-hidden="true" /> Reset personalization
          </button>
        ) : null}
      </div>

      <p className="reader-action-status" aria-live="polite">
        {message}
      </p>

      {view === "saved" ? (
        store.saved.length ? (
          <ul className="reader-record-list">
            {store.saved.map((story) => (
              <li key={story.slug}>
                <Bookmark aria-hidden="true" />
                <Link href={`/story/${story.slug}`}>{story.headline}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <PreferenceEmpty
            title="No saved stories yet"
            body="Use Save on a story to keep it here in this browser."
          />
        )
      ) : null}

      {view === "following" ? (
        store.follows.length ? (
          <ul className="reader-record-list">
            {store.follows.map((record) => (
              <li key={`${record.kind}-${record.label}`}>
                <Bell aria-hidden="true" />
                <span>
                  <strong>{record.label}</strong>
                  <small>{record.kind}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <PreferenceEmpty
            title="Your watchlist is empty"
            body="Follow a topic, person, company, or team to build a local briefing."
          />
        )
      ) : null}

      {view === "account" ? (
        <>
          <ReadingSettings
            store={store}
            update={update}
            announce={setMessage}
          />
          <div className="reader-account-grid">
            <div>
              <h3>
                <History aria-hidden="true" /> Recently viewed
              </h3>
              {recent.length ? (
                <ul>
                  {recent.map((story) => (
                    <li key={story.slug}>
                      <Link href={`/story/${story.slug}`}>{story.headline}</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Your reading history will appear here.</p>
              )}
            </div>
            <div className="preference-boundary">
              <h3>What shapes this page</h3>
              <dl>
                <div>
                  <dt>Anonymous local</dt>
                  <dd>
                    Saves, follows, history, hidden items, reading preferences,
                    and audio resume points.
                  </dd>
                </div>
                <div>
                  <dt>Editorial</dt>
                  <dd>Major public-interest stories and editor picks.</dd>
                </div>
                <div>
                  <dt>Personalized</dt>
                  <dd>Your local choices, clearly labeled when used.</dd>
                </div>
              </dl>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function PreferenceEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="preference-empty">
      <Bookmark aria-hidden="true" />
      <h3>{title}</h3>
      <p>{body}</p>
      <Link href="/latest">Browse latest stories</Link>
    </div>
  );
}

export function AudioBriefPlayer({
  text = "Today’s briefing is available as a short audio preview.",
  src,
}: {
  text?: string;
  src?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [fallbackPlaying, setFallbackPlaying] = useState(false);
  const [fallbackSupported, setFallbackSupported] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setFallbackSupported("speechSynthesis" in window),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  async function toggleAudio() {
    if (!src || !audioRef.current) return;
    if (audioRef.current.paused) await audioRef.current.play();
    else audioRef.current.pause();
  }

  function toggleFallback() {
    if (!fallbackSupported) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setFallbackPlaying(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.onend = () => setFallbackPlaying(false);
    utterance.onerror = () => setFallbackPlaying(false);
    window.speechSynthesis.speak(utterance);
    setFallbackPlaying(true);
  }

  return (
    <div className="audio-brief">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        aria-label={playing ? "Pause daily audio brief" : "Play daily audio brief"}
        aria-pressed={playing}
        disabled={!src}
        onClick={() => void toggleAudio()}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <div>
        <p>THE SHORT BRIEF</p>
        <strong>{src ? "Three stories. Clear context." : "Natural audio is being prepared"}</strong>
        <button
          className="audio-brief__fallback"
          type="button"
          aria-pressed={fallbackPlaying}
          disabled={!fallbackSupported}
          onClick={toggleFallback}
        >
          {fallbackPlaying ? "Stop" : "Browser voice (degraded)"}
        </button>
      </div>
    </div>
  );
}

function readAudioResume(slug: string, mode: AudioMode): number {
  try {
    const value = Number(
      window.localStorage.getItem(`northline-audio-resume:v1:${slug}:${mode}`),
    );
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeAudioResume(slug: string, mode: AudioMode, seconds: number) {
  try {
    window.localStorage.setItem(
      `northline-audio-resume:v1:${slug}:${mode}`,
      String(Math.floor(seconds)),
    );
  } catch {
    // Playback remains functional when storage is unavailable.
  }
}

function audioStateLabel(
  state: ArticleAudioState | undefined,
  productionReady: boolean,
): string {
  if (productionReady) return "Natural AI narration ready";
  switch (state) {
    case "QUEUED":
      return "Narration queued";
    case "GENERATING":
      return "Narration being generated";
    case "PROCESSING":
      return "Narration being processed";
    case "FAILED":
      return "Narration generation failed";
    case "STALE":
      return "Narration refresh required";
    case "REJECTED":
      return "Narration was not approved";
    case "READY":
      return "Narration asset unavailable";
    case "NOT_REQUESTED":
    default:
      return "Natural narration not requested";
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function capitalize<T extends string>(value: T): Capitalize<T> {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}` as Capitalize<T>;
}

function formatTextSizeName(size: ReaderTextSize): string {
  return size === "extra-large" ? "Extra Large" : capitalize(size);
}
