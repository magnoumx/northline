"use client";

import { CheckCircle2, CircleOff, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusPill } from "./primitives";

type Flag = {
  key: string;
  enabled: boolean;
  group: string;
  note: string;
  launchGate?: string;
};

export function FeatureFlagWorkspace() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/newsroom/feature-flags", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        flags?: Flag[];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Feature flags are unavailable.");
      setFlags(payload.flags ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Feature flags are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const groups = useMemo(() => {
    const result = new Map<string, Flag[]>();
    for (const flag of flags) result.set(flag.group, [...(result.get(flag.group) ?? []), flag]);
    return [...result.entries()];
  }, [flags]);

  if (loading) return <div className="operational-loading"><RefreshCw className="spin" aria-hidden="true" /> Loading runtime flags…</div>;
  if (error) return <p className="operational-empty">{error}</p>;

  return (
    <div className="feature-flag-workspace">
      <div className="operational-workspace__toolbar">
        <p>Effective Worker runtime values. Secret values are never exposed.</p>
        <button className="button-secondary" type="button" onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" /> Refresh
        </button>
      </div>
      {groups.map(([group, entries]) => (
        <section key={group}>
          <h2>{group}</h2>
          <div>
            {entries.map((flag) => (
              <article key={flag.key}>
                <div>
                  {flag.enabled ? <CheckCircle2 aria-hidden="true" /> : <CircleOff aria-hidden="true" />}
                  <span><strong>{flag.key}</strong><small>{flag.note}</small></span>
                </div>
                <StatusPill tone={flag.enabled ? "success" : flag.launchGate ? "warning" : "neutral"}>
                  {flag.enabled ? "Enabled" : "Disabled"}
                </StatusPill>
                {flag.launchGate ? <p><ShieldAlert aria-hidden="true" /> Gate: {flag.launchGate}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
