"use client";

import { ExternalLink, Maximize2, Minimize2, Shrink } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { EditorialEmbedProvider } from "@/lib/media/editorial-embeds";

export function EditorialMediaEmbed({
  embedUrl,
  sourceUrl,
  provider,
  title,
  aspect = "landscape",
}: {
  embedUrl: string;
  sourceUrl?: string;
  provider: EditorialEmbedProvider;
  title: string;
  aspect?: "landscape" | "portrait" | "social";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    function syncFullscreenState() {
      setFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  async function toggleFullscreen() {
    const element = containerRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await element.requestFullscreen();
  }

  return (
    <section
      className={`editorial-embed editorial-embed--${aspect}${
        expanded ? " editorial-embed--expanded" : ""
      }`}
      aria-labelledby={titleId}
    >
      <div className="editorial-embed__toolbar">
        <div>
          <p>Verified source media</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="editorial-embed__actions">
          <span>{provider}</span>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Use compact player" : "Expand player"}
          >
            {expanded ? <Shrink aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            {expanded ? "Compact" : "Expand"}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label="Open source media fullscreen"
          >
            {fullscreen ? (
              <Minimize2 aria-hidden="true" />
            ) : (
              <Maximize2 aria-hidden="true" />
            )}
            Fullscreen
          </button>
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Source
            </a>
          ) : null}
        </div>
      </div>
      <div className="editorial-embed__frame" ref={containerRef}>
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      </div>
      <p className="editorial-embed__note">
        Embedded from the original platform. Availability and moderation remain
        controlled by the source publisher.
      </p>
    </section>
  );
}
