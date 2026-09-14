import { getPublicContentSnapshot } from "@/lib/content";
import type { Story } from "@/lib/site/types";
import { PageShell } from "./page-shell";
import { HomeStructuredData } from "./structured-data";
import {
  HomeEmptyState,
  HomeLead,
  HomeRiver,
  HomeSection,
  HomeTrending,
  NewsletterInvite,
  RestrainedAdPlacement,
} from "./home/home-zones";

/**
 * One story, one place.
 *
 * The page previously ran six zones - lead, latest, coverage, live, sections,
 * most read - all drawing from the same small pool, so a six-article
 * publication printed the same headlines four times and read as noise. The
 * composition now shows each story exactly once and lets the page end when the
 * news does, which is what a front page does.
 *
 * Zones claim stories in order - lead, latest, then each section - and every
 * later zone excludes what an earlier one already took. A section only
 * renders once it has three stories left of its own; Weather on a day with
 * one story does not get a near-empty shelf just because the template has a
 * slot for it.
 */

const SECTIONS: readonly { category: string; label: string; href: string }[] = [
  { category: "SPORTS", label: "Sports", href: "/topics/sports" },
  { category: "US_NEWS", label: "U.S.", href: "/topics/u-s-news" },
  { category: "ENTERTAINMENT", label: "Entertainment", href: "/topics/entertainment" },
];
const MINIMUM_SECTION_STORIES = 3;
// How many stories a *qualifying* section shows - separate from the minimum
// above on purpose. Raising this alone makes a section denser once it has
// enough of its own stories; it must never also raise the bar for whether a
// quiet section (e.g. Weather with two stories) renders at all.
const SECTION_DISPLAY_COUNT = 5;
const LATEST_ZONE_SIZE = 9;

export async function HomePage() {
  const snapshot = await getPublicContentSnapshot();
  const { featuredStory, stories, trends } = snapshot;

  if (!featuredStory) {
    return (
      <PageShell>
        <HomeStructuredData />
        <HomeEmptyState />
      </PageShell>
    );
  }

  const claimed = new Set([featuredStory.slug]);
  const take = (pool: Story[], count: number): Story[] => {
    const taken: Story[] = [];
    for (const story of pool) {
      if (taken.length >= count) break;
      if (claimed.has(story.slug)) continue;
      taken.push(story);
      claimed.add(story.slug);
    }
    return taken;
  };

  const secondary = take(stories, 2);
  const latest = take(stories, LATEST_ZONE_SIZE);
  const sections = SECTIONS.map((section) => ({
    ...section,
    stories: take(
      stories.filter((story) => story.category === section.category),
      SECTION_DISPLAY_COUNT,
    ),
  })).filter((section) => section.stories.length >= MINIMUM_SECTION_STORIES);

  return (
    <PageShell>
      <HomeStructuredData />
      <HomeLead lead={featuredStory} secondary={secondary} />
      {latest.length > 0 ? <HomeRiver stories={latest} /> : null}
      <RestrainedAdPlacement />
      {sections.map((section) => (
        <HomeSection
          key={section.category}
          label={section.label}
          href={section.href}
          stories={section.stories}
        />
      ))}
      <HomeTrending trends={trends} />
      <NewsletterInvite />
    </PageShell>
  );
}
