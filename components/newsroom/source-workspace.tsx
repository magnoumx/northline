"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { EmptyWorkspaceState, StatusPill } from "./primitives";

type SourceRecord = {
  id: string;
  name: string;
  domain: string;
  publisher: string;
  sourceType: string;
  country: string;
  credibilityTier: number;
  isPrimary: number | boolean;
  licensingStatus: string;
  citationRequirements?: string | null;
  reliabilityNotes?: string | null;
  lastReviewedAt?: number | null;
};

const emptyForm = {
  name: "",
  domain: "",
  publisher: "",
  sourceType: "NEWSROOM",
  country: "US",
  credibilityTier: "3",
  isPrimary: false,
  licensingStatus: "review_required",
  citationRequirements: "",
  reliabilityNotes: "",
};

export function SourceWorkspace() {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading verified source records…");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/newsroom/sources", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        sources?: SourceRecord[];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Source records are unavailable.");
      setSources(payload.sources ?? []);
      setMessage(`${payload.sources?.length ?? 0} verified source records loaded.`);
    } catch (error) {
      setSources([]);
      setMessage(error instanceof Error ? error.message : "Source records are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const ready = useMemo(
    () =>
      form.name.trim().length >= 2 &&
      form.domain.trim().length >= 3 &&
      form.publisher.trim().length >= 2,
    [form],
  );

  async function createSource() {
    if (!ready || saving) return;
    setSaving(true);
    try {
      const csrfResponse = await fetch("/api/newsroom/csrf", { credentials: "same-origin" });
      const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string; error?: { message?: string } };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) {
        throw new Error(csrfPayload.error?.message ?? "Source write security is unavailable.");
      }
      const response = await fetch("/api/newsroom/sources", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfPayload.csrfToken,
        },
        body: JSON.stringify({
          ...form,
          credibilityTier: Number(form.credibilityTier),
          citationRequirements: form.citationRequirements.trim() || undefined,
          reliabilityNotes: form.reliabilityNotes.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { source?: SourceRecord; error?: { message?: string } };
      if (!response.ok || !payload.source) {
        throw new Error(payload.error?.message ?? "The source could not be saved.");
      }
      setForm(emptyForm);
      setMessage(`${payload.source.name} was added and audited.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The source could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="source-workspace">
      <section className="source-form" aria-labelledby="source-create-title">
        <div className="source-form__heading">
          <div>
            <p>PROTECTED SOURCE REGISTRY</p>
            <h2 id="source-create-title">Add a source</h2>
          </div>
          <ShieldCheck aria-hidden="true" />
        </div>
        <div className="source-form__grid">
          <label>
            Source name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Domain
            <input placeholder="example.gov" value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} />
          </label>
          <label>
            Publisher
            <input value={form.publisher} onChange={(event) => setForm({ ...form, publisher: event.target.value })} />
          </label>
          <label>
            Source type
            <select value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value })}>
              {[
                "GOVERNMENT",
                "PRIMARY_DOCUMENT",
                "COMPANY",
                "NEWSROOM",
                "WIRE",
                "RESEARCH",
                "EXPERT",
                "DATASET",
                "OTHER",
              ].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label>
            Country
            <input maxLength={2} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value.toUpperCase() })} />
          </label>
          <label>
            Credibility tier
            <select value={form.credibilityTier} onChange={(event) => setForm({ ...form, credibilityTier: event.target.value })}>
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Tier {value}</option>)}
            </select>
          </label>
          <label>
            Rights status
            <select value={form.licensingStatus} onChange={(event) => setForm({ ...form, licensingStatus: event.target.value })}>
              <option value="approved">Approved</option>
              <option value="review_required">Review required</option>
              <option value="link_only">Link only</option>
              <option value="restricted">Restricted</option>
            </select>
          </label>
          <label className="source-form__check">
            <input type="checkbox" checked={form.isPrimary} onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })} />
            Primary-source organization
          </label>
          <label className="source-form__wide">
            Citation requirements
            <textarea value={form.citationRequirements} onChange={(event) => setForm({ ...form, citationRequirements: event.target.value })} />
          </label>
          <label className="source-form__wide">
            Reliability and scope notes
            <textarea value={form.reliabilityNotes} onChange={(event) => setForm({ ...form, reliabilityNotes: event.target.value })} />
          </label>
        </div>
        <button className="button-primary" type="button" disabled={!ready || saving} onClick={() => void createSource()}>
          <Plus aria-hidden="true" /> {saving ? "Saving…" : "Add verified source"}
        </button>
      </section>

      <section className="source-register" aria-labelledby="source-register-title">
        <div className="source-register__heading">
          <div>
            <p>SOURCE DIRECTORY</p>
            <h2 id="source-register-title">Approved and review-pending records</h2>
          </div>
          <button className="button-secondary" type="button" onClick={() => void refresh()}>
            <RefreshCw aria-hidden="true" /> Refresh
          </button>
        </div>
        {loading ? (
          <p className="operational-loading">Loading…</p>
        ) : sources.length ? (
          <div className="source-register__list">
            {sources.map((source) => (
              <article key={source.id}>
                <BookOpenCheck aria-hidden="true" />
                <div>
                  <strong>{source.name}</strong>
                  <a href={`https://${source.domain}`} target="_blank" rel="noreferrer">{source.domain}</a>
                  <p>{source.reliabilityNotes || "No reliability note has been recorded."}</p>
                </div>
                <div>
                  <StatusPill tone={source.licensingStatus === "approved" ? "success" : "warning"}>
                    {source.licensingStatus.replaceAll("_", " ")}
                  </StatusPill>
                  <small>Tier {source.credibilityTier} · {source.sourceType.replaceAll("_", " ")}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyWorkspaceState
            icon={BookOpenCheck}
            title="No source records yet"
            description="Add primary documents, official agencies, verified newsrooms, research institutions, and other approved sources before creating a publishable article."
          />
        )}
      </section>
      <p className="sr-only" aria-live="polite">{message}</p>
    </div>
  );
}
