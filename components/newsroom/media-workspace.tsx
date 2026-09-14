"use client";

import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { EmptyWorkspaceState, StatusPill } from "./primitives";

type MediaAsset = {
  id: string;
  storageKey: string;
  workflowState: string;
  mimeType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  creator?: string | null;
  copyrightOwner?: string | null;
  license?: string | null;
  usagePermission?: string | null;
  attribution?: string | null;
  verificationState: string;
  createdAt: number;
};

const initialMetadata = {
  creator: "",
  copyrightOwner: "",
  originalUrl: "",
  license: "",
  licenseUrl: "",
  usagePermission: "UNVERIFIED",
  attribution: "",
};

export function MediaWorkspace() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [metadata, setMetadata] = useState(initialMetadata);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading media registry…");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/newsroom/media", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        media?: MediaAsset[];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Media registry is unavailable.");
      setAssets(payload.media ?? []);
      setMessage(`${payload.media?.length ?? 0} media records loaded.`);
    } catch (error) {
      setAssets([]);
      setMessage(error instanceof Error ? error.message : "Media registry is unavailable.");
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

  async function upload() {
    if (!file || saving) return;
    setSaving(true);
    setMessage("Uploading to the quarantine bucket…");
    try {
      const csrfResponse = await fetch("/api/newsroom/csrf", { credentials: "same-origin" });
      const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string; error?: { message?: string } };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) {
        throw new Error(csrfPayload.error?.message ?? "Upload security is unavailable.");
      }
      const form = new FormData();
      form.set("file", file);
      Object.entries(metadata).forEach(([key, value]) => form.set(key, value));
      const response = await fetch("/api/newsroom/media", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfPayload.csrfToken },
        body: form,
      });
      const payload = (await response.json()) as { media?: MediaAsset; error?: { message?: string } };
      if (!response.ok || !payload.media) {
        throw new Error(payload.error?.message ?? "The media upload failed.");
      }
      setFile(null);
      setMetadata(initialMetadata);
      setMessage("Media uploaded to quarantine. It is not public until malware and rights review pass.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The media upload failed.");
    } finally {
      setSaving(false);
    }
  }

  const canUpload = Boolean(
    file &&
      metadata.creator.trim().length >= 2 &&
      metadata.copyrightOwner.trim().length >= 2 &&
      metadata.license.trim().length >= 2 &&
      metadata.attribution.trim().length >= 2,
  );

  return (
    <div className="media-workspace">
      <section className="media-upload-panel" aria-labelledby="media-upload-title">
        <div className="source-form__heading">
          <div>
            <p>R2 QUARANTINE</p>
            <h2 id="media-upload-title">Upload licensed media</h2>
          </div>
          <ShieldCheck aria-hidden="true" />
        </div>
        <p>
          JPG, PNG, WebP, and AVIF only. The server checks file signatures, hashes duplicates,
          stores the object privately, and records rights metadata. SVG is blocked.
        </p>
        <div className="source-form__grid">
          <label className="source-form__wide">
            Media file
            <input
              accept="image/jpeg,image/png,image/webp,image/avif"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>Creator<input value={metadata.creator} onChange={(event) => setMetadata({ ...metadata, creator: event.target.value })} /></label>
          <label>Copyright owner<input value={metadata.copyrightOwner} onChange={(event) => setMetadata({ ...metadata, copyrightOwner: event.target.value })} /></label>
          <label>Original HTTPS URL<input value={metadata.originalUrl} onChange={(event) => setMetadata({ ...metadata, originalUrl: event.target.value })} /></label>
          <label>License<input value={metadata.license} onChange={(event) => setMetadata({ ...metadata, license: event.target.value })} /></label>
          <label>License HTTPS URL<input value={metadata.licenseUrl} onChange={(event) => setMetadata({ ...metadata, licenseUrl: event.target.value })} /></label>
          <label>
            Usage permission
            <select value={metadata.usagePermission} onChange={(event) => setMetadata({ ...metadata, usagePermission: event.target.value })}>
              {[
                "UNVERIFIED",
                "PUBLIC_DOMAIN",
                "LICENSED",
                "EDITORIAL",
                "PRESS",
                "WIKIMEDIA_COMPATIBLE",
                "SOCIAL_EMBED",
              ].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="source-form__wide">Attribution<textarea value={metadata.attribution} onChange={(event) => setMetadata({ ...metadata, attribution: event.target.value })} /></label>
        </div>
        <button className="button-primary" type="button" disabled={!canUpload || saving} onClick={() => void upload()}>
          <Upload aria-hidden="true" /> {saving ? "Uploading…" : "Upload to quarantine"}
        </button>
      </section>

      <section className="source-register" aria-labelledby="media-registry-title">
        <div className="source-register__heading">
          <div><p>MEDIA REGISTRY</p><h2 id="media-registry-title">Rights and verification state</h2></div>
          <button className="button-secondary" type="button" onClick={() => void refresh()}><RefreshCw aria-hidden="true" /> Refresh</button>
        </div>
        {loading ? <p className="operational-loading">Loading…</p> : assets.length ? (
          <div className="source-register__list">
            {assets.map((asset) => (
              <article key={asset.id}>
                <ImageIcon aria-hidden="true" />
                <div>
                  <strong>{asset.attribution || asset.storageKey}</strong>
                  <span>{asset.mimeType} · {formatBytes(asset.byteSize)}{asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}</span>
                  <p>{asset.creator || "Unknown creator"} · {asset.license || "No recorded license"}</p>
                </div>
                <div>
                  <StatusPill tone={asset.workflowState === "APPROVED" ? "success" : asset.workflowState === "REJECTED" ? "danger" : "warning"}>{asset.workflowState}</StatusPill>
                  <small>{asset.verificationState} · {asset.usagePermission ?? "UNVERIFIED"}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyWorkspaceState icon={ImageIcon} title="No media records yet" description="Upload approved or review-pending media with complete rights metadata. Nothing becomes public from this screen automatically." />
        )}
      </section>
      <p className="editor-message" aria-live="polite">{message}</p>
    </div>
  );
}

function formatBytes(value: number) {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}
