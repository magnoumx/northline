# SEO and discovery policy research

**Research date:** 2026-07-24
**Status:** Operational research, not a ranking guarantee. Search and AI-discovery systems change; re-check linked first-party documentation before launch and after material platform updates.

## Policy objective

Make original, accountable Story Intelligence easy to crawl, understand, verify, and revisit. Do not create pages or language primarily to manipulate rankings, Top Stories, Discover, or AI citations.

Google’s [Search Essentials](https://developers.google.com/search/docs/essentials) define eligibility requirements, while its [people-first guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) emphasizes useful, reliable content made for readers. Google classifies scaled, low-value, unoriginal page creation as [scaled content abuse](https://developers.google.com/search/docs/essentials/spam-policies#scaled-content), regardless of whether automation or people created it. Its current [generative-AI guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) says AI can aid research/structure, but scaled output without added value may violate spam policy.

**Recommendation:** The SEO unit is a materially useful story, explainer, person/organization profile, or topic hub—not every query variation, source article, claim, city, or AI answer.

## Eligibility is not placement

- Google says publisher content that follows its policies is automatically eligible for consideration in Google News; publishers no longer apply or control News publication pages through a submitted feed. Since March 2025, publication pages have been [automatically generated](https://support.google.com/news/publisher-center/answer/15898024).
- Eligibility, valid structured data, a sitemap, recrawl request, or Publisher Center presence does **not** guarantee indexing, a rich result, Top Stories, Discover, ranking, or traffic.
- Google says [Discover](https://developers.google.com/search/docs/appearance/google-discover) requires no special tag or structured data; indexed, policy-compliant content is automatically eligible, not guaranteed to appear.
- Bing similarly says SEO and AI-grounding practices do not guarantee rankings, traffic, citations, or inclusion in its [Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a).

Do not describe any technical task internally as “getting approved for Google News.”

## Page inventory and index policy

| Page type | Default index state | Canonical rule | Publication threshold |
|---|---|---|---|
| Canonical Story Intelligence | `index,follow` | Self-canonical stable URL | Verified material development, unique brief, accountable author/editor, source/evidence set, visible timestamps |
| Original reported article | `index,follow` | Self-canonical unless explicitly syndicated under a contract requiring another treatment | Original reporting and full editorial metadata |
| Live coverage | `index,follow` | One stable event URL; entries use anchors, not separate thin URLs | Active editorial coverage with timestamps/bylines and meaningful archive value |
| Explainer | `index,follow` | Stable concept URL | Original synthesis, scope, sources, named reviewer, reviewed date |
| Topic hub | Conditional | Self-canonical | Original overview/curation, not merely a tag list; meaningful navigation and current content |
| Person/organization profile | Conditional | Self-canonical | Verified, public-interest context and original structured value; no auto-generated biography filler |
| Location page | Conditional | Self-canonical | Actual location-specific reporting/data/context; no keyword-swapped template |
| Search results | `noindex,follow` by default | No canonical to unrelated destination | Keep out of index unless converted into a deliberate editorial hub |
| Filters/sorts/facets | Usually non-indexable | Canonical to clean parent where genuinely duplicate; otherwise block generation/discovery appropriately | Prevent crawl traps and combinatorial URL growth |
| User question/AI answer | `noindex` by default | Parent story | Index only if editor-curated, stable, original, safe, and independently valuable |
| Saved/personalized/account | `noindex` and authenticated | N/A | Never indexed |
| Preview/staging/experiment | `noindex`, access controlled | N/A | Never publicly indexable |
| Sponsored landing page | Case-by-case | Self-canonical | Must be useful and clearly commercial; never use paid content to impersonate editorial news |

## Canonical story architecture

Use one durable URL for the evolving event:

```text
/us/politics/descriptive-story-slug
```

Recommendations:

- Keep the slug readable but do not change it for every headline update.
- Preserve the URL when the story moves from developing to resolved.
- Represent material updates in the page and public update history, not as near-duplicate new URLs.
- Use separate URLs only when the user intent and editorial object are genuinely distinct: original analysis, explainer, live blog, or a later event.
- Redirect retired duplicate URLs with a server-side permanent redirect.
- Use a consistent self-referencing `rel="canonical"`.
- Link internally to the canonical URL, not tracking/facet variants.
- Do not canonicalize materially different pages to one destination merely to force consolidation.

Google describes canonicalization as selecting a representative URL among duplicates and recommends consistent canonical signals in its [canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## Crawlable first response

The initial HTML response should contain:

- unique title and meta description;
- one visible H1;
- headline, standfirst/brief, byline, publication and modification times;
- essential current story text;
- source links;
- primary image metadata/credit where used;
- navigation and breadcrumbs;
- structured data matching visible content.

Do not require client-side personalization, login, consent to nonessential tracking, or an ad auction before essential public-interest content appears. Google notes that structured-data pages must be accessible and not blocked by robots, `noindex`, or login to be eligible for supported appearances in its [Article documentation](https://developers.google.com/search/docs/appearance/structured-data/article).

## `NewsArticle` structured data

Use JSON-LD on qualifying news/story pages. Google says `Article` markup is not required for Google News eligibility, but can help it understand title, images, dates, and authors.

Recommended visible-and-marked properties:

```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "mainEntityOfPage": "https://example.com/us/politics/story-slug",
  "headline": "Visible factual headline",
  "description": "Visible standfirst",
  "datePublished": "2026-07-24T09:15:00-04:00",
  "dateModified": "2026-07-24T11:42:00-04:00",
  "author": [
    {
      "@type": "Person",
      "name": "Full Name",
      "url": "https://example.com/staff/full-name"
    }
  ],
  "publisher": {
    "@type": "NewsMediaOrganization",
    "name": "Publication Name",
    "url": "https://example.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/assets/publisher-logo.png"
    }
  },
  "image": [
    "https://example.com/media/story-1x1.jpg",
    "https://example.com/media/story-4x3.jpg",
    "https://example.com/media/story-16x9.jpg"
  ],
  "articleSection": "Politics",
  "isAccessibleForFree": true
}
```

Implementation rules:

- Mark up what readers can see; never use structured data to introduce hidden or misleading claims.
- Use `Person` for people and a real author profile URL; include every visible author separately.
- Keep `headline`, dates, author, image, and access state synchronized with the rendered page.
- Use crawlable, relevant, licensed image URLs.
- Add paywall markup if access is subscription/registration restricted.
- Validate templates with the Rich Results Test and inspect deployed URLs.
- Treat structured data as eligibility help, not a ranking switch; Google explicitly says correct markup does not guarantee a rich result in its [general structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

Potential additional types where they accurately match the page:

- `BreadcrumbList`
- `VideoObject`
- `PodcastEpisode`
- `ImageObject`
- `Organization` / `NewsMediaOrganization`
- `Person`

Do not add `FAQPage` merely because the product has an Ask interface; markup must match current Google-supported use and visible editorial content.

## Dates and update integrity

Use three distinct concepts:

- **Event time:** when the event occurred.
- **Date published:** when this page/story first became public.
- **Date modified:** when the page materially changed.

Rules:

- Show dates prominently in the page, with timezone.
- Keep visible and structured dates consistent.
- Do not change `dateModified` for ad refreshes, recommendation changes, read counters, minor style fixes, or automated reprocessing.
- When a material fact changes, update the visible page, `dateModified`, sitemap `lastmod`, and update history together.
- Do not republish an old story with a new date to manufacture freshness.

Follow Google’s [publication-date guidance](https://developers.google.com/search/docs/appearance/publication-dates).

## News sitemap

Maintain a separate news sitemap for operational visibility.

- Include only article URLs published in the prior two days; Google explicitly recommends removing older news metadata/URLs from the news sitemap after that window.
- Update the same sitemap as stories publish; do not create a new sitemap for each update.
- Keep publication name and language consistent.
- Include actual publication time and a concise news title.
- Return a clean `200`, valid XML, canonical production URLs only.
- Submit through Search Console and reference in `robots.txt`.
- Maintain a standard sitemap or sitemap index for older evergreen/news URLs.

Source: Google’s [news sitemap documentation](https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap). A sitemap is a discovery hint, not an indexing guarantee.

## Google News transparency

Google News policies ask for [transparency](https://support.google.com/news/publisher-center/answer/6204050), including:

- clear dates and bylines;
- information about authors, publication, and publisher;
- information about the company/network behind the content;
- contact information.

Publish prominently:

- masthead and full author profiles;
- ownership, funding, and relevant conflicts;
- editorial, AI-use, corrections, sourcing, and advertising policies;
- physical/business and editorial contact details appropriate to the organization;
- report-an-error and rights/takedown routes;
- content-type and sponsored labels.

These are also reader trust requirements, not merely crawler signals.

## Images and Discover

- Use a specific, high-quality lead image relevant to the story.
- Provide at least large landscape and suitable alternate aspect ratios where licensed.
- Put meaningful caption, creator/source credit, and alt text in the HTML.
- Use explicit width/height and responsive delivery.
- Do not use generic logo/text-heavy images as the main story image.
- Add `max-image-preview:large` only when rights allow large previews.
- Keep images crawlable; do not expose a licensed full-resolution original if the license permits only a derivative.

Google’s [Discover guidance](https://developers.google.com/search/docs/appearance/google-discover) recommends non-clickbait titles, non-sensational presentation, useful/unique content, and compelling relevant images. Its [robots meta documentation](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) explains `max-image-preview`.

## Headlines and snippets

Each page should have:

- concise, unique HTML `<title>`;
- one matching but not necessarily identical H1;
- factual standfirst;
- useful meta description;
- descriptive social title/description/image;
- stable publisher site name/favicon.

Do not:

- withhold the key fact to manufacture curiosity;
- exaggerate outrage, fear, death, sexuality, or shock;
- swap names/places into repetitive keyword templates;
- add keyword lists invisible or unnatural to readers;
- put “live” or “breaking” on stale pages;
- create a new page for every related question.

## Internal linking

Build a reader-first graph:

- story → primary documents, prior event, explainer, people, topic, related current story;
- explainer → current developments and last review;
- topic hub → current priority, latest, foundational explainers;
- person/organization → role-specific stories, not every passing mention;
- correction/update log → affected story.

Use descriptive anchor text. Do not place hundreds of boilerplate entity links in every story or generate circular “related” networks without editorial relevance.

## AI-content publication threshold

An AI-assisted page may be indexable only when it has:

1. a defined reader job;
2. verified original value beyond rephrasing sources;
3. accountable authorship/editing;
4. supporting evidence and accessible source links;
5. a material difference from every other indexed page;
6. rights-compliant text/media;
7. a maintenance owner and stale-state trigger;
8. no deceptive automation or false claim of firsthand reporting.

Examples of original value:

- primary-document extraction with page citations;
- verified timeline;
- deduplicated multi-source comparison;
- consequences by jurisdiction;
- explicit contradiction/unknown analysis;
- material update history;
- original reporting or expert analysis.

Simple article rewrites, generic “what is X” pages, automatically expanded location pages, and saved chatbot answers fail this threshold.

## Robots and crawler policy

Maintain an explicit, version-controlled crawler decision table covering:

- search indexing;
- News;
- AI search/answer inclusion;
- model training;
- ad review;
- partner ingestion;
- internal monitoring.

Do not assume one crawler directive controls every purpose. Google states that `Google-Extended` can control certain Gemini training/grounding uses without affecting Search inclusion or ranking in its [crawler documentation](https://developers.google.com/crawling/docs/about-crawling). OpenAI separately documents [OAI-SearchBot for search](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq) and `GPTBot` for potential training controls.

Policy choices should be made with editorial, commercial, rights, and technical owners. Test that CDN/WAF/bot protection does not accidentally block approved crawlers, and never expose private/licensed material merely for discoverability.

## Bing and AI-search discovery

- Verify Bing Webmaster Tools.
- Submit XML sitemaps.
- Use [IndexNow](https://www.bing.com/webmasters/help/indexnow-0z209wby) on publish, material update, deletion, and restoration.
- Keep key facts explicit and high on the page.
- Define entities consistently.
- Preserve stable URLs.
- Keep structured data accurate to visible content.
- Monitor impressions/citations as well as clicks.

Bing’s current guidelines explicitly warn against scraped/lightly rewritten content, large-scale low-quality generation, misleading structured data, prompt-injection manipulation, and excessive crawl waste.

## Performance and page experience

Target current [Core Web Vitals](https://web.dev/articles/vitals) at the 75th percentile:

- LCP ≤ 2.5 seconds;
- INP ≤ 200 milliseconds;
- CLS ≤ 0.1.

Operational requirements:

- cache public story HTML with rapid purge on material update;
- reserve image/ad/embed dimensions;
- defer nonessential scripts and recommendations;
- avoid mandatory app/open-login interstitials;
- make ads visually distinct and non-obstructive;
- support HTTPS, secure forms, and safe browsing;
- monitor mobile and desktop field data separately.

Performance is a user requirement even where no ranking benefit can be promised.

## Launch checklist

### Editorial/transparency

- real masthead, author pages, ownership, contact, corrections, standards, AI policy;
- at least a credible body of original, maintained work;
- no placeholder authors or undifferentiated “Staff” bylines without an accountable desk page;
- visible labels for analysis, opinion, review, synthesis, sponsored, and AI-assisted material.

### Technical

- production domain verified in Google Search Console and Bing Webmaster Tools;
- HTTPS, clean `200/301/404/410` behavior;
- crawlable initial HTML;
- canonical tags and internal links aligned;
- valid `NewsArticle` and breadcrumbs;
- news + standard sitemaps;
- robots/meta/X-Robots rules tested;
- favicon/site name/organization markup;
- image accessibility, licensing, dimensions, and previews;
- feed/facet/search/account/staging index controls;
- IndexNow on material lifecycle events;
- performance and accessibility budgets.

### Monitoring

- index coverage and URL inspection;
- Google Search, News, and Discover performance where available;
- Bing indexing, citations/grounding, and IndexNow status;
- crawl logs by verified bot;
- structured-data errors;
- canonical mismatch;
- stale dates and orphan pages;
- title/snippet mismatch;
- manual/security actions;
- traffic quality, source-referral clicks, corrections, and rights incidents.

## SEO decision rule

If a proposed page would not be worth publishing without search traffic, do not index it. If it is worth publishing, make its value, provenance, authorship, date, and maintenance state obvious to both readers and machines.
