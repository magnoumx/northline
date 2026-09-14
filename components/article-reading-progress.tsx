"use client";

import { useEffect, useState } from "react";
import { calculateReadingProgressBps } from "@/lib/reader/retention";

export function ArticleReadingProgress({
  articleElementId,
  slug,
}: {
  articleElementId: string;
  slug: string;
}) {
  const [progressBps, setProgressBps] = useState(0);

  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const article = document.getElementById(articleElementId);
        if (!article) {
          setProgressBps(0);
          return;
        }
        const articleTop = window.scrollY + article.getBoundingClientRect().top;
        setProgressBps(
          calculateReadingProgressBps({
            scrollY: window.scrollY,
            articleTop,
            articleHeight: article.offsetHeight,
            viewportHeight: window.innerHeight,
          }),
        );
      });
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [articleElementId, slug]);

  const percent = Math.round(progressBps / 100);
  return (
    <div className="article-reading-progress" aria-label="Article reading progress">
      <progress max={10_000} value={progressBps} aria-valuetext={`${percent} percent read`} />
      <span className="sr-only">{percent} percent of article read</span>
    </div>
  );
}
