"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, LockKeyhole } from "lucide-react";

type Gate = string;
type ControlState = {
  indexingDecision: {
    enabled: boolean;
    environment: string;
    checklistHash: string;
    reason: string;
    occurredAt: string;
  } | null;
  environmentGate: {
    appEnvironment: string;
    demoContentMode: string;
    environmentFlag: string;
    siteOrigin: string;
  };
  launchGates: Gate[];
  csrfToken: string;
};

export function IndexingLaunchControl() {
  const [control, setControl] = useState<ControlState | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState(
    "Loading the owner-controlled indexing state…",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/newsroom/settings/indexing", {
      credentials: "same-origin",
      signal: abort.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as ControlState & {
          error?: { message?: string };
        };
        if (!response.ok) {
          throw new Error(
            body.error?.message ?? "Indexing control is unavailable.",
          );
        }
        setControl(body);
        setChecked(
          Object.fromEntries(body.launchGates.map((gate) => [gate, false])),
        );
        setMessage(
          body.indexingDecision?.enabled
            ? "Indexing has an enabled owner decision."
            : "Indexing has no enabled owner decision.",
        );
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Indexing control is unavailable.",
          );
        }
      });
    return () => abort.abort();
  }, []);

  const allChecked = useMemo(
    () =>
      Boolean(control) &&
      control!.launchGates.every((gate) => checked[gate] === true),
    [checked, control],
  );

  async function submit(enabled: boolean) {
    if (!control || busy) return;
    setBusy(true);
    setMessage("Recording the owner decision…");
    try {
      const response = await fetch("/api/newsroom/settings/indexing", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": control.csrfToken,
        },
        body: JSON.stringify({
          enabled,
          reason,
          checklist: checked,
        }),
      });
      const body = (await response.json()) as {
        indexingDecision?: ControlState["indexingDecision"];
        error?: { message?: string };
      };
      if (!response.ok || !body.indexingDecision) {
        throw new Error(
          body.error?.message ?? "The owner decision was not recorded.",
        );
      }
      setControl({ ...control, indexingDecision: body.indexingDecision });
      setMessage(
        enabled
          ? "The owner decision was recorded. Robots and sitemaps activate only while every environment gate also remains open."
          : "Indexing was disabled and the rollback decision was recorded.",
      );
      setReason("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The owner decision was not recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="indexing-control" aria-labelledby="indexing-title">
      <div className="indexing-control__heading">
        <LockKeyhole aria-hidden="true" />
        <div>
          <p>OWNER-ONLY LAUNCH ACTION</p>
          <h2 id="indexing-title">Search indexing gate</h2>
          <span>{message}</span>
        </div>
      </div>

      {control ? (
        <>
          <dl className="indexing-control__environment">
            <div>
              <dt>Application</dt>
              <dd>{control.environmentGate.appEnvironment}</dd>
            </div>
            <div>
              <dt>Demo mode</dt>
              <dd>{control.environmentGate.demoContentMode}</dd>
            </div>
            <div>
              <dt>Environment flag</dt>
              <dd>{control.environmentGate.environmentFlag}</dd>
            </div>
            <div>
              <dt>Canonical origin</dt>
              <dd>{control.environmentGate.siteOrigin}</dd>
            </div>
          </dl>

          <fieldset>
            <legend>Attest every launch prerequisite</legend>
            {control.launchGates.map((gate) => (
              <label key={gate}>
                <input
                  checked={checked[gate] ?? false}
                  onChange={(event) =>
                    setChecked((current) => ({
                      ...current,
                      [gate]: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>{humanize(gate)}</span>
              </label>
            ))}
          </fieldset>

          <label className="indexing-control__reason">
            Decision reason
            <textarea
              maxLength={500}
              minLength={20}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reference the approved launch review or rollback incident."
              required
              value={reason}
            />
          </label>

          <div className="indexing-control__actions">
            <button
              disabled={!allChecked || reason.trim().length < 20 || busy}
              onClick={() => submit(true)}
              type="button"
            >
              <CheckCircle2 aria-hidden="true" />
              Enable indexing
            </button>
            <button
              className="danger"
              disabled={reason.trim().length < 20 || busy}
              onClick={() => submit(false)}
              type="button"
            >
              <AlertTriangle aria-hidden="true" />
              Disable indexing
            </button>
          </div>
          <p className="indexing-control__warning">
            This D1 decision is necessary but not sufficient. The server still
            requires production mode, a final HTTPS origin, demo content off,
            and <code>ENABLE_SEARCH_INDEXING=true</code>.
          </p>
        </>
      ) : (
        <p className="indexing-control__warning">{message}</p>
      )}
    </section>
  );
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}
