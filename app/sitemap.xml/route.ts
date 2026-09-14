import { isSearchIndexingEnabled } from "@/lib/site/indexing";

const routes = [
  "/sitemaps/pages.xml",
  "/news-sitemap.xml",
  "/sitemaps/images.xml",
  "/sitemaps/video.xml",
];

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const advertisedRoutes = (await isSearchIndexingEnabled()) ? routes : [];
  const generatedAt = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${advertisedRoutes
  .map(
    (route) => `  <sitemap>
    <loc>${origin}${route}</loc>
    <lastmod>${generatedAt}</lastmod>
  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>`;
  return xmlResponse(xml);
}

function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
      "x-robots-tag": "noindex",
    },
  });
}
