import type { MetadataRoute } from "next";
import { isSearchIndexingEnabled } from "@/lib/site/indexing";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!(await isSearchIndexingEnabled())) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  // The sitemaps protocol requires absolute URLs in robots.txt; a relative path
  // is ignored by crawlers.
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://usnorthline.com"
  ).replace(/\/+$/u, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/newsroom/", "/api/"],
      },
    ],
    sitemap: [
      `${origin}/sitemap.xml`,
      `${origin}/news-sitemap.xml`,
      `${origin}/sitemaps/images.xml`,
      `${origin}/sitemaps/video.xml`,
    ],
  };
}
