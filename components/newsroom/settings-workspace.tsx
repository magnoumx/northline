"use client";

import { CheckCircle2, CircleAlert, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { IntegrationSummary, SettingsCategory } from "@/lib/settings/registry";

type PublicSetting = {
  key: string;
  label: string;
  description: string;
  valueType: string;
  defaultValue?: unknown;
  ownerOnly: boolean;
  requiresRedeploy: boolean;
  isSecretReference: boolean;
};

type StoredSetting = PublicSetting & {
  value?: unknown;
  configured: boolean;
  version: number;
  updatedAt: number | null;
};

export function SettingsWorkspace({
  category,
  definitions,
  integrations,
}: {
  category: SettingsCategory;
  definitions: readonly PublicSetting[];
  integrations: readonly IntegrationSummary[];
}) {
  const [settings, setSettings] = useState<StoredSetting[]>(() =>
    definitions.map((definition) => ({
      ...definition,
      value: definition.defaultValue,
      configured: false,
      version: 0,
      updatedAt: null,
    })),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() => initialDrafts(definitions));
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("Loading stored settings…");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/newsroom/settings/${category}`, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Stored settings are unavailable in this environment.");
        return (await response.json()) as { settings: StoredSetting[] };
      })
      .then((payload) => {
        if (!active) return;
        setSettings(payload.settings);
        setDrafts(initialDrafts(payload.settings));
        setMessage("Changes are versioned and audited. Secrets stay outside the Newsroom.");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Stored settings are unavailable.");
      });
    return () => {
      active = false;
    };
  }, [category]);

  const editableSettings = useMemo(
    () => settings.filter((setting) => !setting.isSecretReference),
    [settings],
  );

  async function save(setting: StoredSetting) {
    const value = parseDraft(setting, drafts[setting.key] ?? "");
    if (value instanceof Error) {
      setMessage(value.message);
      return;
    }
    if (reason.trim().length < 12) {
      setMessage("Add a change reason with at least 12 characters before saving.");
      return;
    }
    setSavingKey(setting.key);
    try {
      const csrfResponse = await fetch("/api/newsroom/csrf", { credentials: "same-origin" });
      const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string; error?: { message?: string } };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) {
        throw new Error(csrfPayload.error?.message ?? "Settings writes are disabled in this environment.");
      }
      const response = await fetch(`/api/newsroom/settings/${category}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfPayload.csrfToken,
        },
        body: JSON.stringify({
          action: "update",
          key: setting.key,
          value,
          expectedVersion: setting.version,
          reason: reason.trim(),
        }),
      });
      const payload = (await response.json()) as {
        setting?: { version: number; value: unknown; requiresRedeploy: boolean };
        error?: { message?: string };
      };
      if (!response.ok || !payload.setting) {
        throw new Error(payload.error?.message ?? "The setting could not be saved.");
      }
      setSettings((current) =>
        current.map((item) =>
          item.key === setting.key
            ? { ...item, value: payload.setting?.value, version: payload.setting?.version ?? item.version, configured: true, updatedAt: Date.now() }
            : item,
        ),
      );
      setReason("");
      setMessage(
        payload.setting.requiresRedeploy
          ? "Saved. Redeploy the Worker before this change can take effect."
          : "Saved with a new version and audit record.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The setting could not be saved.");
    } finally {
      setSavingKey(null);
    }
  }

  if (category === "integrations") {
    return <IntegrationPanel integrations={integrations} message={message} />;
  }

  return (
    <section className="settings-workspace" aria-labelledby="settings-workspace-title">
      <div className="settings-workspace__intro">
        <div>
          <p>Versioned runtime settings</p>
          <h2 id="settings-workspace-title">Review before changing production behavior.</h2>
        </div>
        <ShieldCheck aria-hidden="true" />
      </div>
      <label className="settings-workspace__reason">
        <span>Change reason</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="Explain the editorial or operational reason for this change"
        />
      </label>
      <div className="settings-workspace__list">
        {editableSettings.map((setting) => (
          <article key={setting.key}>
            <div>
              <p>{setting.label}</p>
              <span>{setting.description}</span>
              <small>
                {setting.ownerOnly ? "Owner approval required" : "Settings-manager access"}
                {setting.requiresRedeploy ? " · Redeploy required" : " · Takes effect at runtime"}
              </small>
            </div>
            <textarea
              aria-label={setting.label}
              value={drafts[setting.key] ?? ""}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [setting.key]: event.target.value }))
              }
              rows={setting.valueType === "json" || setting.valueType === "string_list" ? 4 : 1}
            />
            <button type="button" onClick={() => void save(setting)} disabled={savingKey === setting.key}>
              {savingKey === setting.key ? <RefreshCw className="spin" aria-hidden="true" /> : null}
              Save version {setting.version + 1}
            </button>
          </article>
        ))}
      </div>
      <p className="settings-workspace__message" role="status">{message}</p>
    </section>
  );
}

function IntegrationPanel({
  integrations,
  message,
}: {
  integrations: readonly IntegrationSummary[];
  message: string;
}) {
  const [notice, setNotice] = useState("");
  return (
    <section className="integration-workspace" aria-labelledby="integration-workspace-title">
      <div className="settings-workspace__intro">
        <div>
          <p>Deployment credentials</p>
          <h2 id="integration-workspace-title">Connection state without secret exposure.</h2>
        </div>
        <ShieldCheck aria-hidden="true" />
      </div>
      <p className="integration-workspace__note">
        {message} Configure credentials with Cloudflare Workers Secrets or Secrets Store; this page never returns a credential value.
      </p>
      <div className="integration-workspace__list">
        {integrations.map((integration) => (
          <article key={integration.integration}>
            <div>
              <h3>{integration.integration}</h3>
              <span className={`integration-state integration-state--${integration.state.toLowerCase()}`}>
                {integration.state === "Configured" ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
                {integration.state}
              </span>
              <small>
                Last tested: {formatDate(integration.lastTestedAt)} · Last success: {formatDate(integration.lastSuccessAt)}
              </small>
              {integration.lastErrorCategory ? <small>Last error: {integration.lastErrorCategory}</small> : null}
            </div>
            <div className="integration-workspace__actions">
              <button
                type="button"
                onClick={() => setNotice(`Run npm run providers:check to test ${integration.integration} from the deployment environment.`)}
              >
                Test connection
              </button>
              <button
                type="button"
                onClick={() => setNotice("Open docs/SETUP.md in the source repository for the setup sequence.")}
              >
                Setup instructions <ExternalLink aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setNotice(`Rotate ${integration.integration} in Cloudflare, then run npm run providers:check.`)}
              >
                Rotate credential
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="settings-workspace__message" role="status">{notice}</p>
    </section>
  );
}

function initialDrafts(definitions: readonly (PublicSetting | StoredSetting)[]) {
  return Object.fromEntries(
    definitions.map((definition) => [
      definition.key,
      serializeValue("value" in definition ? definition.value : definition.defaultValue),
    ]),
  );
}

function serializeValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? "", null, 2);
}

function parseDraft(setting: StoredSetting, value: string): unknown | Error {
  if (setting.valueType === "string") return value.trim();
  if (setting.valueType === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : new Error("Enter a valid number.");
  }
  if (setting.valueType === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    return new Error("Enter true or false.");
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return new Error("Enter valid JSON for this setting.");
  }
}

function formatDate(value: number | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}
