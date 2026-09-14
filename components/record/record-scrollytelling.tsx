"use client";

import { useEffect, useRef } from "react";

/**
 * The scroll behaviour for the verification record.
 *
 * This is the only route on the site that loads GSAP and Lenis. Article and
 * homepage bundles are unaffected: the imports are dynamic and live inside a
 * client component nothing else renders, so a reader who came for a news story
 * never downloads any of it.
 *
 * The animation is one idea repeated - a bar growing to its real proportion as
 * it enters view - rather than a catalogue of effects. The figures are the
 * point; motion only paces how they arrive.
 *
 * The markup is complete before any of this runs. If the libraries fail to load,
 * or the reader has asked for reduced motion, the page is a readable set of
 * figures with nothing missing.
 */
export function RecordScrollytelling({
  children,
}: {
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }, LenisModule] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      if (cancelled || !root.current) return;

      gsap.registerPlugin(ScrollTrigger);

      const Lenis = LenisModule.default;
      const lenis = new Lenis({ duration: 0.9, smoothWheel: true });
      // Lenis owns the scroll position, so ScrollTrigger has to read from it
      // rather than the native scroll event or the two disagree about where
      // the page is.
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      const context = gsap.context(() => {
        // Each bar grows to the width it already holds in the markup, so the
        // animation cannot misreport a figure - it only delays showing it.
        gsap.utils.toArray<HTMLElement>("[data-grow]").forEach((bar) => {
          gsap.from(bar, {
            scaleX: 0,
            transformOrigin: "left center",
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: bar, start: "top 85%" },
          });
        });

        gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((element) => {
          gsap.from(element, {
            y: 24,
            autoAlpha: 0,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: { trigger: element, start: "top 88%" },
          });
        });
      }, root);

      cleanup = () => {
        context.revert();
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div className="record" ref={root}>
      {children}
    </div>
  );
}
