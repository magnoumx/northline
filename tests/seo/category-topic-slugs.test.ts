import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  categoryNameForTopicSlug,
  categoryTopic,
  legacyCategoryTopicRedirect,
} from "../../lib/editorial/topic-derivation";

const flat = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8").replace(/\s+/gu, " ");

// 2026-10-30 audit: the sitemap and breadcrumb linked /topics/us-news (0
// counted stories, noindex), the indexable /topics/u-s-news was titled
// "U S News", and the breadcrumb read "Home / US_NEWS / Story".
describe("one name and slug per category", () => {
  it("uses the public category name", () => {
    expect(categoryTopic("US_NEWS")).toEqual({ name: "U.S. News", slug: "u-s-news" });
    expect(categoryTopic("SPORTS")).toEqual({ name: "Sports", slug: "sports" });
    expect(categoryTopic("INTERNET_TRENDS")).toEqual({ name: "Internet", slug: "internet" });
    expect(categoryTopic("SOMETHING_NEW")).toEqual({ name: "Something New", slug: "something-new" });
  });

  it("redirects only the enum slugs that changed", () => {
    expect(legacyCategoryTopicRedirect("us-news")).toBe("u-s-news");
    expect(legacyCategoryTopicRedirect("internet-trends")).toBe("internet");
    expect(legacyCategoryTopicRedirect("sports")).toBeNull();
    expect(legacyCategoryTopicRedirect("u-s-news")).toBeNull();
    expect(legacyCategoryTopicRedirect("ryan-garcia")).toBeNull();
  });

  it("names a category topic page properly", () => {
    expect(categoryNameForTopicSlug("u-s-news")).toBe("U.S. News");
    expect(categoryNameForTopicSlug("ryan-garcia")).toBeNull();
  });

  it("is what the breadcrumb, structured data, sitemap and topic page use", () => {
    const shared = flat("../../components/public/shared.tsx");
    expect(shared).toContain('<Link href={`/topics/${topic.slug}`}>{topic.name}</Link>');
    expect(shared).toContain('<span aria-current="page">{story.headline}</span>');
    const data = flat("../../components/structured-data.tsx");
    expect(data).toContain("articleSection: categoryTopic(story.category).name,");
    expect(data).toContain("item: `${origin}/topics/${categoryTopic(story.category).slug}`,");
    expect(flat("../../app/sitemaps/pages.xml/route.ts")).toContain(
      "const slug = categoryTopic(story.category).slug;",
    );
    const page = flat("../../app/[...slug]/page.tsx");
    expect(page).toContain("if (current) permanentRedirect(`/topics/${current}`);");
    expect(page).toContain("categoryTopic(story.category).slug === slug ||");
  });
});

describe("page-level SEO basics", () => {
  it("gives the front page an h1", () => {
    expect(flat("../../components/home/home-zones.tsx")).toContain(
      '<h1 className="visually-hidden" id="front-title">',
    );
  });

  it("keeps 404 pages out of the index", () => {
    expect(flat("../../app/not-found.tsx")).toContain('<meta name="robots" content="noindex, follow" />');
  });
});
