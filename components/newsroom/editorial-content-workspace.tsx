"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, FilePenLine, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusPill } from "./primitives";

type EditorialArticle = {
  id: string;
  slug: string;
  category: string;
  format: string;
  state: string;
  sensitive: boolean;
  currentVersionId: string | null;
  headline: string | null;
  updatedAt: string;
};

export function EditorialContentWorkspace({
  mode,
}: {
  mode: "live" | "homepage";
}) {
  const [articles, setArticles] = useState<EditorialArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/newsroom/articles?limit=100", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        articles?: EditorialArticle[];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "The article register is unavailable.");
      setArticles(payload.articles ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The article register is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const visible = useMemo(() => {
    if (mode === "live") {
      return articles.filter(
        (article) =>
          article.format === "LIVE_BLOG" ||
          ["DEVELOPING", "UPDATED", "PUBLISHED"].includes(article.state),
      );
    }
    return articles.filter((article) =>
      ["PUBLISHED", "DEVELOPING", "UPDATED", "CORRECTED"].includes(article.state),
    );
  }, [articles, mode]);

  if (loading) {
    return <div className="operational-loading"><RefreshCw className="spin" aria-hidden="true" /> Loading article register…</div>;
  }
  if (error) {
    return <p className="operational-empty">{error}</p>;
  }

  return (
    <div className="editorial-content-workspace">
      <div className="operational-workspace__toolbar">
        <p>
          {mode === "live"
            ? "Database-backed live and developing coverage."
            : "Published articles currently eligible for reader-facing homepage modules."}
        </p>
        <button className="button-secondary" type="button" onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" /> Refresh
        </button>
      </div>
      {visible.length ? (
        <div className="editorial-content-list">
          {visible.map((article) => (
            <article key={article.id}>
              <div>
                <span>{article.category} · {article.format}</span>
                <h3>{article.headline ?? article.slug}</h3>
                <small>Updated {new Date(article.updatedAt).toLocaleString("en-US")}</small>
              </div>
              <StatusPill tone={article.state === "PUBLISHED" ? "success" : "info"}>
                {article.state}
              </StatusPill>
              <div>
                <Link className="button-secondary" href="/newsroom/editor">
                  <FilePenLine aria-hidden="true" /> Editor
                </Link>
                <Link className="button-primary" href={`/story/${article.slug}`} target="_blank">
                  View <ExternalLink aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="research-empty-state compact">
          <FilePenLine aria-hidden="true" />
          <h3>{mode === "live" ? "No live coverage is active" : "No published story is eligible yet"}</h3>
          <p>Create, review, approve, and publish an article through the protected workflow.</p>
          <Link className="button-primary" href="/newsroom/editor">
            Open Article Editor <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
