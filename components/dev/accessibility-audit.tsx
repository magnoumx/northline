"use client";

import type { Result } from "axe-core";
import { useCallback, useEffect, useRef, useState } from "react";

type AuditResult = {
  passes: number;
  incomplete: Result[];
  violations: Result[];
};

type FrameAxe = {
  run(
    context: Document,
    options: {
      runOnly: { type: "tag"; values: string[] };
    },
  ): Promise<{
    passes: Result[];
    incomplete: Result[];
    violations: Result[];
  }>;
};

export function AccessibilityAudit({
  capture = false,
  height,
  target,
  theme,
  width,
}: {
  capture?: boolean;
  height: number;
  target: string;
  theme: "light" | "dark";
  width: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [documentHtml, setDocumentHtml] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");

  const runAudit = useCallback(async () => {
    const targetFrame = frame.current;
    const targetDocument = targetFrame?.contentDocument;
    if (!targetFrame || !targetDocument) {
      setError("The same-origin audit frame could not be inspected.");
      return;
    }

    try {
      targetDocument.documentElement.dataset.theme = theme;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      let frameAxe = (
        targetFrame.contentWindow as (Window & { axe?: FrameAxe }) | null
      )?.axe;
      if (!frameAxe) {
        await loadFrameAxe(targetDocument);
        frameAxe = (
          targetFrame.contentWindow as (Window & { axe?: FrameAxe }) | null
        )?.axe;
      }
      if (!frameAxe) throw new Error("The Axe engine could not be initialized.");
      const audit = await frameAxe.run(targetDocument, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      });
      setResult({
        passes: audit.passes.length,
        incomplete: audit.incomplete,
        violations: audit.violations,
      });
      setError("");
    } catch (auditError) {
      setError(
        auditError instanceof Error
          ? auditError.message
          : "The accessibility audit failed.",
      );
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    void fetch(target, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "x-northline-audit": "responsive-accessibility" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Target returned HTTP ${response.status}.`);
        }
        const html = await response.text();
        return html.replace(
          /<head([^>]*)>/i,
          `<head$1><base href="${window.location.origin}/"><script src="/node_modules/axe-core/axe.min.js"></script>`,
        );
      })
      .then((html) => {
        if (!active) return;
        setDocumentHtml(html);
        setResult(null);
        setError("");
      })
      .catch((fetchError) => {
        if (!active) return;
        setDocumentHtml("");
        setResult(null);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "The target route could not be loaded.",
        );
      });
    return () => {
      active = false;
    };
  }, [target]);

  useEffect(() => {
    if (!documentHtml) return;
    const targetFrame = frame.current;
    if (!targetFrame) return;
    const handleLoad = () => void runAudit();
    targetFrame.addEventListener("load", handleLoad);
    if (targetFrame.contentDocument?.readyState === "complete") handleLoad();
    return () => targetFrame.removeEventListener("load", handleLoad);
  }, [documentHtml, height, runAudit, target, width]);

  return (
    <main
      className={`audit-shell${capture ? " audit-shell--capture" : ""}`}
    >
      <header className="audit-shell__header">
        <div>
          <p>DEVELOPMENT-ONLY ACCESSIBILITY HARNESS</p>
          <h1>Axe audit and responsive render</h1>
        </div>
        <dl>
          <div>
            <dt>Route</dt>
            <dd>{target}</dd>
          </div>
          <div>
            <dt>Viewport</dt>
            <dd>
              {width} × {height}
            </dd>
          </div>
          <div>
            <dt>Theme</dt>
            <dd>{theme}</dd>
          </div>
        </dl>
      </header>

      <section className="audit-shell__results" aria-live="polite">
        <button onClick={runAudit} type="button">
          Run Axe audit
        </button>
        {error ? <p role="alert">{error}</p> : null}
        {!result && !error ? <p>Waiting for the target route…</p> : null}
        {result ? (
          <>
            <p>
              <strong>{result.violations.length}</strong> violations ·{" "}
              <strong>{result.incomplete.length}</strong> needs review ·{" "}
              <strong>{result.passes}</strong> rules passed
            </p>
            <pre id="axe-results">
              {JSON.stringify(result, null, 2)}
            </pre>
          </>
        ) : null}
      </section>

      <div className="audit-shell__canvas">
        {documentHtml ? (
          <iframe
            className={`audit-frame audit-frame--w${width} audit-frame--h${height}`}
            ref={frame}
            srcDoc={documentHtml}
            title={`Accessibility audit target: ${target}`}
          />
        ) : null}
      </div>
    </main>
  );
}

async function loadFrameAxe(targetDocument: Document): Promise<void> {
  const existing = targetDocument.querySelector<HTMLScriptElement>(
    "script[data-northline-axe]",
  );
  if (existing?.dataset.loaded === "true") return;

  await new Promise<void>((resolve, reject) => {
    const script = existing ?? targetDocument.createElement("script");
    const handleLoad = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    const handleError = () =>
      reject(new Error("The Axe engine could not be loaded."));
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.dataset.northlineAxe = "true";
      script.src = "/node_modules/axe-core/axe.min.js";
      targetDocument.head.appendChild(script);
    }
  });
}
