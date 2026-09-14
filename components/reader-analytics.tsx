"use client";

import { useEffect, useRef } from "react";
import {
  classifyTrafficSource,
  createAnonymousId,
  isEngagedRead,
  isValidArticleId,
  looksAutomated,
  scrollBucketsCrossed,
  type ReaderEvent,
} from "@/lib/analytics/reader-signal";

const ANONYMOUS_ID_KEY = "northline.anonymous-id";

/**
 * Sends reader signals so that "Most read" can eventually mean something.
 *
 * The events table and its ingest route were already built and were never
 * called once. This is the missing half.
 *
 * Design constraints:
 *  - Nothing is sent for automated traffic, or when the reader has asked not
 *    to be tracked.
 *  - The identifier is random and lives for the session only; the server keeps
 *    an HMAC of it, never the value.
 *  - Dwell time counts only while the tab is actually visible.
 *  - Delivery uses sendBeacon so leaving the page does not cancel the event
 *    and does not delay navigation.
 */
export function ReaderAnalytics({ articleId }: { articleId?: string }) {
  const sentScrollBuckets = useRef(new Set<string>());
  const visibleSeconds = useRef(0);
  const maxScrollPercent = useRef(0);
  const engagedSent = useRef(false);
  const completionSent = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Do Not Track and Global Privacy Control are honoured before anything is
    // measured, not merely before it is sent.
    const navigatorWithSignals = navigator as Navigator & {
      doNotTrack?: string;
      globalPrivacyControl?: boolean;
    };
    if (
      navigatorWithSignals.doNotTrack === "1" ||
      navigatorWithSignals.globalPrivacyControl === true ||
      looksAutomated(navigator.userAgent)
    ) {
      return;
    }

    let anonymousId: string | null = null;
    try {
      anonymousId = sessionStorage.getItem(ANONYMOUS_ID_KEY);
      if (!anonymousId) {
        anonymousId = createAnonymousId();
        sessionStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
      }
    } catch {
      // Storage can be blocked; the visit is still counted, just unlinked.
      anonymousId = null;
    }

    const validArticleId = isValidArticleId(articleId) ? articleId : undefined;

    const send = (event: ReaderEvent) => {
      const payload = JSON.stringify({
        ...event,
        articleId: event.articleId ?? validArticleId,
        ...(anonymousId ? { anonymousId } : {}),
      });
      try {
        const blob = new Blob([payload], { type: "application/json" });
        if (!navigator.sendBeacon("/api/analytics/events", blob)) {
          void fetch("/api/analytics/events", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Measurement must never break reading.
      }
    };

    send({ eventType: "PAGE_VIEW" });
    send({
      eventType: "TRAFFIC_SOURCE",
      properties: {
        sourceType: classifyTrafficSource(
          document.referrer,
          window.location.hostname,
        ),
      },
    });

    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibleSeconds.current += 1;
      if (
        !engagedSent.current &&
        isEngagedRead({
          visibleSeconds: visibleSeconds.current,
          maxScrollPercent: maxScrollPercent.current,
        })
      ) {
        engagedSent.current = true;
        send({ eventType: "ENGAGED_READING" });
      }
    }, 1_000);

    const onScroll = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const percent =
        scrollable > 0
          ? Math.min(100, Math.round((window.scrollY / scrollable) * 100))
          : 100;
      maxScrollPercent.current = Math.max(maxScrollPercent.current, percent);

      for (const bucket of scrollBucketsCrossed(
        maxScrollPercent.current,
        sentScrollBuckets.current,
      )) {
        sentScrollBuckets.current.add(bucket);
        send({ eventType: "SCROLL_DEPTH", properties: { scrollBucket: bucket } });
      }

      // Reaching the end of an article is only a completion if the reader also
      // spent time there; scrolling straight to the foot is not reading.
      if (
        !completionSent.current &&
        validArticleId &&
        maxScrollPercent.current >= 90 &&
        visibleSeconds.current >= 20
      ) {
        completionSent.current = true;
        send({ eventType: "ARTICLE_COMPLETION" });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.clearInterval(tick);
      window.removeEventListener("scroll", onScroll);
    };
  }, [articleId]);

  return null;
}
