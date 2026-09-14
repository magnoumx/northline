# SEO and News Discoverability

**Last reviewed:** 2026-07-24

This policy applies the current first-party platform and market review in
[SEO policy research](./research/06-seo-policy-research.md). Platform
documentation and eligibility can change; recheck it before launch and after a
material search-platform update.

## Principle

Search optimization is an infrastructure and editorial-quality practice. It
helps readers and crawlers understand accurate original work; it is not keyword
stuffing, artificial freshness, mass page generation, or a guarantee of
placement in Search, Google News, or Discover.

## Rendering and performance

- Server-render the article body and essential metadata.
- Return useful HTML quickly without requiring client JavaScript.
- Cache immutable published versions at the CDN with precise invalidation.
- Minimize client components and third-party scripts.
- Use responsive media, explicit dimensions, optimized fonts, cursor
  pagination, and reserved ad slots.
- Target p75 LCP <2.5s, CLS <0.1, and INP <200ms where field measurement is
  meaningful.

## URL and canonical policy

- Use one stable lowercase canonical per public object.
- Use `/story/[slug]` for the canonical evolving event and format-specific
  routes for coverage.
- Redirect old slugs permanently.
- Merge duplicates into the surviving canonical and preserve relationship
  context.
- Noindex filter, internal-search, preview, account, saved/following, thin
  taxonomy, and non-public newsroom URLs.
- Retractions normally retain the canonical with an accurate notice; authorized
  removals use `410` or redirect based on the decision.
- Do not create pages for small keyword variations.

## Dates

Show accurate visible and machine-readable publication time. Show modified time
only after meaningful new information or correction. Include timezone context.
Cosmetic edits, ad changes, or SEO rewrites do not reset freshness.

LiveBlogPosting dates belong to individual updates and the live object; they do
not justify changing unrelated article dates.

## Metadata

Each article package includes:

```text
Primary reader/search intent
Primary query and related entities
Secondary questions
Recommended format
On-site headline and SEO title
Subheadline and meta description
Stable slug and canonical
Internal links
Structured-data type
Recommended rights-cleared media
News/visual discovery suitability
Freshness/update strategy
Potential follow-up
```

Every headline variant is factual and promise/body aligned. Meta descriptions
summarize rather than tease. Open Graph/social cards use rights-approved media
and accurate text.

## Structured data

Use only types supported by visible page content:

| Surface | Candidate types |
| --- | --- |
| Standard news | `NewsArticle` / `Article`, `BreadcrumbList`, author `Person`, publisher `Organization` |
| Explainer | `Article` or `NewsArticle` as appropriate; visible FAQ only when eligible and useful |
| Live blog | `LiveBlogPosting` with valid coverage/update fields |
| Video-rich page | `VideoObject` when the video is prominent, accessible, and rights-compliant |
| Site | `WebSite`, publisher `Organization`; `SearchAction` only if site search works as described |
| Author | `Person` matching visible profile |

Generate JSON-LD from the published immutable record. Validate URLs, dates,
headline, images, author, publisher, correction/update state, and canonical.
Structured data must not contain claims or media hidden from readers.

## Sitemaps and feeds

Provide:

- sitemap index;
- standard article sitemaps;
- news sitemap containing only eligible recent news;
- image/video sitemaps where rights and page relevance support them;
- RSS and Atom;
- category, topic, and author feeds where they add durable value.

Reconcile from published records. Remove/adjust retracted or removed URLs
according to status without dropping audit history. Sitemaps do not include
search, filters, drafts, previews, account, or newsroom pages.

## Robots and previews

- Publish intentional `robots.txt` rules; do not use it as access control.
- Use `noindex` for non-public/thin states.
- Set `max-image-preview:large` where media rights allow.
- Control snippet/archive/AI crawler directives according to current publisher
  policy and contracts; review them at launch rather than assuming defaults.
- Prevent staging/preview indexation with access controls plus noindex.

## News readiness and trust

Public pages expose:

- clear bylines and author profiles;
- publication/meaningful modified times;
- publisher identity, ownership, funding, and contact;
- editorial standards, AI policy, corrections, media/source and sponsored
  policies;
- inline attribution and source list;
- visible updates/corrections; and
- clear separation of ads and editorial content.

Technical eligibility does not guarantee traffic or inclusion. Do not present
Publisher Center or any manual submission as a guarantee.

## Story Intelligence and duplicate prevention

The Story Cluster is the event canonical. New articles cover a genuinely new
angle/format and link back. The system:

- detects near-duplicate drafts;
- avoids repeated feed cards for the same canonical event;
- consolidates entity/topic aliases;
- uses canonical/redirect relationships;
- rejects thin recap pages; and
- preserves a coherent update timeline.

## Internal linking

Links are editorially relevant and descriptive. Prioritize canonical Story
Intelligence, primary documents, durable explainers, topic/entity pages, and
material related developments. Check redirects, retractions, source validity,
and orphan pages. Do not automate excessive exact-match anchors.

## Visual discovery

Use strong, relevant, non-misleading, rights-cleared landscape imagery, normally
at least 1200px wide where the channel/license permits. Include accurate
caption/alt and allow large previews when approved. Never use unrelated
celebrity imagery, fake documentary AI, or sensational disaster crops.

## Search and measurement

Start with PostgreSQL full-text search for internal search. Add an external
engine only after measured relevance/scale needs.

Monitor:

- index coverage and crawl errors;
- canonical/redirect conflicts;
- structured-data validation;
- sitemap/feed freshness;
- Core Web Vitals and rendered HTML;
- query/page performance by intent;
- Discover/News/Search trends without guaranteed attribution;
- thin/duplicate/orphan pages; and
- manual/security actions.

Search Console/Bing data is advisory and privacy-minimized. Never change facts
or publish weak content to chase a query.

## Release checks

- Representative rendered HTML contains body, canonical, dates, byline,
  metadata, and valid JSON-LD.
- Robots/index controls distinguish public, preview, search, account, and
  newsroom.
- Sitemaps/feeds match published state.
- Redirect, correction, retraction, and `410` behavior is tested.
- Mobile performance and image dimensions meet budgets.
- No placeholder domain, publisher, contact, author, or demo content appears in
  production metadata.
