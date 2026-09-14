# Product Requirements

**Status:** Approved product direction; implementation must be verified separately
**Last updated:** 2026-07-24
**Audience:** Product, editorial, design, engineering, security, revenue, and operations

This specification incorporates the dated market, product, design, and
editorial findings in
[product opportunities](../research/03-product-opportunities.md),
[design benchmark](../research/04-design-benchmark.md), and
[editorial benchmark](../research/05-editorial-benchmark.md). Those findings
support a living evidence record, truly chronological Latest feed, calm
hierarchy, visible uncertainty, and human-owned AI workflow.

## 1. Product statement

The platform is a United States-focused digital newsroom and trend-intelligence
product. It helps readers understand what happened, why an event is receiving
attention, what is confirmed, what is disputed, why it matters, and what may
happen next.

The product is quality-driven rather than quota-driven. It is not an automated
article-rewriting service and must not present itself as a fully autonomous
newsroom.

The differentiating object is **Story Intelligence**: one canonical, living
event record that connects verified facts, updates, a timeline, source
coverage, open questions, related articles, and corrections.

## 2. Implementation contract

This repository's first milestone is a **production-shaped frontend and
reference implementation**. It may demonstrate public pages, newsroom
workflows, typed domain objects, realistic fictional data, and deterministic
policy behavior. It does not, by itself, prove that live connectors, durable
jobs, an AI provider, publication automation, advertising, email delivery,
production authentication, or a production database are operating.

Capabilities use these labels:

| Label | Meaning |
| --- | --- |
| Demonstrated | A user can exercise the behavior in the reference UI with demo data. |
| Contracted | The behavior and interfaces are specified but a production service is not connected. |
| Production-ready | The behavior is deployed, monitored, secured, and supported by passing evidence. |

No document, interface label, or launch decision may upgrade a capability to
production-ready without the evidence required in
[acceptance-criteria.md](./acceptance-criteria.md).

## 3. Goals

1. Give readers a fast, accurate account of high-interest events relevant to
   the United States.
2. Add at least two meaningful forms of original reader value to every
   published story.
3. Make source provenance, uncertainty, material updates, and corrections easy
   to inspect.
4. Give editors control over discovery, research, drafting, review, scheduling,
   updates, and retractions.
5. Apply stronger verification and mandatory human approval to sensitive
   subjects.
6. Establish an accessible, indexable, high-performance editorial experience
   across desktop and mobile.
7. Build retention through follows, saved stories, Story Intelligence, and
   newsletters without obscuring major public-interest news.
8. Prepare transparent, reader-safe revenue surfaces without allowing
   commercial pressure to influence editorial conclusions.
9. Keep AI and infrastructure costs observable and bounded.

## 4. Non-goals for the first milestone

- Unattended publishing of live news.
- Claims that trend providers, search indexes, newsletters, payments,
  advertisements, or notifications are live when they are not.
- Automated political bias ratings or unlicensed factuality labels.
- Prohibited scraping, paywall circumvention, or unlicensed media reuse.
- Personalized medical, legal, or financial advice.
- A comment system, advertiser self-service, premium subscription billing, or
  a native mobile application.
- Guaranteed Google News, Search, or Discover placement.

## 5. Audiences and jobs

| Audience | Primary job |
| --- | --- |
| Time-limited reader | Understand the verified essentials in under two minutes. |
| Context-seeking reader | Follow a developing event without reading repetitive articles. |
| Trend-curious reader | Learn why a term is trending and whether the signal is reliable. |
| Returning reader | Follow topics or entities and receive a useful briefing. |
| Writer/reporter | Turn a qualified candidate and source dossier into original coverage. |
| Editor | Prioritize stories, inspect evidence, revise drafts, and control publication. |
| Fact checker | Verify atomic claims independently and record conflicts. |
| Media/SEO/risk specialist | Review a bounded portion of the publication package. |
| Newsroom leader | See queue health, quality, costs, incidents, and audit history. |
| Revenue operator | Manage clearly separated, policy-compliant commercial inventory. |

## 6. Editorial principles

- Accuracy outranks speed; reader value outranks volume.
- A social post is a discovery signal, not proof.
- Uncertainty must be expressed, not smoothed over.
- Published facts must be traceable to evidence.
- The first two paragraphs explain what happened.
- Every article adds at least two original-value elements, such as synthesis,
  timeline, context, a primary document, comparison, data, FAQ, or next steps.
- Missing reliable sources blocks publication.
- High quality scores never override hard risk rules.
- Commercial suitability is never a proxy for newsworthiness or truth.
- Meaningful updates change the modified date; cosmetic edits do not.

## 7. Product requirements

### 7.1 Public experience

| ID | Requirement |
| --- | --- |
| PUB-001 | The homepage combines a curated lead package with an uninterrupted reverse-chronological Latest feed. |
| PUB-002 | Top Stories and Latest use separate ranking rules and do not repeat the same story in the same viewport without a clear editorial reason. |
| PUB-003 | Homepage modes can change editorial hierarchy without a code deployment: normal, breaking, election, major sports, entertainment, product launch, disaster, and low-news day. |
| PUB-004 | Breaking treatment appears only when an authorized editor activates it and includes a timestamp and destination. |
| PUB-005 | Readers can reach Latest, Trending, Live, search, topic, entity, source, author, newsletter, trust, and policy surfaces. |
| PUB-006 | Public pages provide useful loading, empty, error, offline, 404, 410, and maintenance states. |
| PUB-007 | Mobile layouts preserve reading order, source access, controls, and reserved media/ad space. |
| PUB-008 | Status is communicated with text and semantics, never color alone. |

### 7.2 Story formats

| ID | Requirement |
| --- | --- |
| FMT-001 | A News Flash is approximately 80–180 words, timestamped, attributed, verified, and free of speculation. |
| FMT-002 | A Quick Brief covers what happened, key facts, why it matters, and what comes next. |
| FMT-003 | A standard article supports a factual lead, context, quotations, implications, next steps, and sources. |
| FMT-004 | A deep explainer may include timelines, FAQs, documents, comparisons, data, and maps. |
| FMT-005 | Live blog entries have a timestamp, author or desk, source, and verification state. |
| FMT-006 | “Why is this trending?” distinguishes the trigger, geography, related searches, confirmed context, and signal uncertainty. |
| FMT-007 | Visual and source-comparison stories include rights-safe media and do not automate ideological conclusions. |

### 7.3 Story Intelligence and article trust

| ID | Requirement |
| --- | --- |
| STI-001 | Each major event has one canonical Story Cluster and stable Story Intelligence URL. |
| STI-002 | Story Intelligence shows a plain-language summary, latest confirmed development, key facts, significance, trend context, participants, timeline, sources, conflicts, open questions, next steps, updates, and corrections where available. |
| STI-003 | Related articles connect to the canonical cluster rather than creating competing event identities. |
| STI-004 | Ask This Story answers only from the verified stored dossier, cites evidence, declines unsupported questions, and is rate-limited. |
| STI-005 | Reader-facing confidence uses explained evidence states such as confirmed, attributed, disputed, or unknown—not a pseudo-precise model “truth percentage.” |
| ART-001 | Article pages expose category, headline, subheadline, byline, reviewer when applicable, published/modified times, reading time, verification status, media attribution, sources, disclosures, update history, and corrections. |
| ART-002 | Central claims link to claim and evidence records; unsupported, false, or improperly conflicting central claims block publication. |
| ART-003 | Published versions are immutable. Updates and corrections create new versions while preserving history. |
| ART-004 | Headlines are scored separately for accuracy, clarity, specificity, search alignment, sensationalism, risk, and promise/body fit. |
| ART-005 | Reported news, synthesis, live coverage, explainer, analysis, opinion, review, sponsored material, and materially AI-assisted output use distinct labels and workflows whenever those formats are enabled. |

### 7.4 Discovery and selection

| ID | Requirement |
| --- | --- |
| TRD-001 | Each third-party signal provider is isolated behind a connector adapter with usage, attribution, cache, rate-limit, health, and circuit-breaker metadata. |
| TRD-002 | Normalization preserves the original term and records normalized terms, related terms, entities, category, market, timestamps, velocity, novelty, source availability, media availability, and risk. |
| TRD-003 | Candidate scores store every positive and negative component with a plain-language explanation. |
| TRD-004 | Legal, reputation, verification, duplication, copyright, and sensationalism penalties can outweigh demand. |
| TRD-005 | A failed connector degrades independently and cannot stop unrelated providers or the editorial application. |
| TRD-006 | Daily volume has no minimum. The configurable total maximum defaults to 10, and weak category balance never justifies publication. |

### 7.5 Newsroom workflow

| ID | Requirement |
| --- | --- |
| WRK-001 | The workflow follows the logged state machine in [editorial-workflows.md](./editorial-workflows.md). |
| WRK-002 | Research, drafting, fact checking, and approval are separate stages with separate permissions and prompts. |
| WRK-003 | Editors can merge/reject trends, start research, assign owners, set priority/risk, and connect candidates to existing clusters. |
| WRK-004 | The research desk shows sources, primary records, extracted claims, contradictions, timeline, entities, missing information, snapshots, and notes. |
| WRK-005 | AI-assisted editor actions operate on verified context, show a diff, and require explicit acceptance. |
| WRK-006 | Review panels cover facts, sources, risk, media rights, SEO, accessibility, ad safety, structured data, preview, and history. |
| WRK-007 | Every state, permission, review, version, schedule, correction, retraction, and policy override attempt is auditable. |
| WRK-008 | The publisher cannot override deterministic safety gates. |

### 7.6 Sensitive coverage

| ID | Requirement |
| --- | --- |
| RSK-001 | Elections, government leadership, war, terrorism, crime, allegations, lawsuits, deaths, missing persons, health, finance, disasters, emergencies, minors, sexual misconduct, identity claims, leaked private information, graphic events, and likely reputational harm require human approval. |
| RSK-002 | Sensitive status is derived from structured risk assessments and can also be raised manually; it cannot be lowered solely by an AI output. |
| RSK-003 | Initial production auto-publication remains disabled until the launch gate explicitly enables a narrow low-risk allowlist. |
| RSK-004 | A central claim marked `UNVERIFIED`, `FALSE`, or `CONFLICTING_REPORTS` blocks publication unless the story's accurate subject is the existence of the conflict. |

### 7.7 Sources and media

| ID | Requirement |
| --- | --- |
| SRC-001 | Sources record publisher, domain, type, country, ownership, tier, primary status, licensing, citation requirements, reliability notes, and review date. |
| SRC-002 | Third-party political, bias, or factuality data is shown only with a valid license and attribution. |
| SRC-003 | Important claims use multiple independent credible sources when reasonably available, with preference for primary evidence. |
| MED-001 | Every media asset stores origin, rights holder, license, permission, attribution, checksum, dimensions, metadata, expiry, and verification state. |
| MED-002 | AI imagery never masquerades as documentary evidence and is labeled when used. |
| MED-003 | Embeds identify the original publisher and provide editorial context; embed-only ad pages are prohibited. |

### 7.8 Personalization and retention

| ID | Requirement |
| --- | --- |
| PER-001 | Readers may follow topics, people, companies, teams, and authors; block topics/sources; save articles; select categories, summary mode, notification frequency, and default feed; and reset personalization. |
| PER-002 | Public-interest Top Stories remain visible regardless of personalization. |
| PER-003 | Anonymous preferences use minimal local or consented data and can be cleared. |
| PER-004 | Story/entity alerts are triggered by a meaningful verified change, explain what changed, link to evidence, honor cadence/quiet hours, and suppress duplicate noise. |
| NWS-001 | Newsletter signup supports consent evidence, preference management, unsubscribe, segmentation, preview, sponsorship labels, archive, and UTM attribution. |
| NWS-002 | AI may draft a newsletter, but sensitive or breaking sends require human review. |
| NWS-003 | The Daily Brief is finite, has a clear completion boundary, explains recommendations, and favors meaningful deltas over repeated headlines. |

### 7.9 Distribution and revenue

| ID | Requirement |
| --- | --- |
| SEO-001 | Public editorial content is server-rendered with canonical URLs, accurate dates, metadata, structured data, feeds, sitemaps, and indexation controls appropriate to the format. |
| SEO-002 | The system prevents thin keyword variants, duplicate canonicals, and artificial freshness changes. |
| ADS-001 | Advertising is reserved, labeled, separated from navigation/editorial content, consent-aware, and excluded from empty or low-value pages. |
| ADS-002 | Campaigns and sponsored content require manual approval; commercial users cannot publish editorial content. |
| ADS-003 | No feature produces fake clicks, deceptive refreshes, accidental-click layouts, or unlabeled paid material. |

### 7.10 Reliability, security, and privacy

| ID | Requirement |
| --- | --- |
| OPS-001 | Durable jobs are idempotent, bounded by timeouts, retried with backoff, observable, and recoverable through a dead-letter workflow. |
| OPS-002 | Health reporting distinguishes web, database, queue, storage, connector, search, mail, and AI dependencies. |
| SEC-001 | Authentication and server-side authorization protect every mutation; client-side visibility is not a security boundary. |
| SEC-002 | External content is hostile data. Fetching and rendering enforce URL, DNS, redirect, size, type, timeout, sanitization, and isolation controls. |
| SEC-003 | Prompts, source content, tool output, and user content remain separate trust domains. Source text cannot grant permissions or invoke tools. |
| PRV-001 | The platform minimizes personal data, records consent, supports export/deletion, applies retention limits, and does not sell private reader data by default. |

## 8. Quality and publication gates

The quality score is an aid, never an approval authority.

| Component | Weight |
| --- | ---: |
| Factual verification | 25 |
| Source quality and independence | 15 |
| Original reader value | 15 |
| Search-intent satisfaction | 10 |
| Writing quality | 10 |
| Headline accuracy | 5 |
| Context and completeness | 5 |
| Media quality and rights | 5 |
| Technical SEO | 5 |
| Trust and transparency | 5 |

Reference thresholds:

- `AUTO_PUBLISH_MIN_SCORE=94`
- `HUMAN_REVIEW_MIN_SCORE=82`
- `REJECT_BELOW_SCORE=70`
- `MAX_DAILY_AUTO_PUBLISH=3`
- `MAX_TOTAL_DAILY_PUBLISH=10`

Auto-publish additionally requires all deterministic gates, an enabled
low-risk format/category allowlist, complete evidence, a valid media decision,
no sensitive classification, no unresolved central claim, and a healthy
rollback/monitoring path. The launch default is off.

A strong story is not rejected merely because no useful media exists. The
editor records the media decision and uses a text-led treatment. Missing
reliable sources does block publication.

## 9. Outcome measures

Metrics are decision inputs, not editorial quotas.

| Area | Measures | Guardrail |
| --- | --- | --- |
| Trust | Correction rate, substantiated complaints, source-link usage, reader trust survey | Never suppress a correction to protect a metric. |
| Quality | Published stories with two original-value elements, claim coverage, review completion | No daily publication minimum. |
| Audience | Engaged reading, return rate, direct traffic, topic follows | Avoid clickbait and tragedy exploitation. |
| Retention | Newsletter confirmation, open/click trends, saves, follows | Honor consent and unsubscribe immediately. |
| Operations | Queue latency, failure/recovery rate, connector health, cost/story | Cost cannot relax verification. |
| Revenue | Viewability, RPM, direct campaign delivery | Ads do not change editorial decisions. |
| Performance | LCP <2.5s, CLS <0.1, INP <200ms at p75 where measurable | Reserve ad/media space; keep article body server-rendered. |

## 10. Phased delivery

1. **Reference experience:** cohesive public and newsroom frontend, fictional
   demo content, typed contracts, policy documentation, responsive states.
2. **Core newsroom services:** production identity, RBAC, relational data,
   immutable versions, audit, source/media management, search, corrections.
3. **Assisted pipeline:** permitted connectors, durable jobs, provider
   abstraction, claim evidence, independent reviews, human-controlled publish.
4. **Distribution and retention:** feeds, sitemaps, newsletters, following,
   notifications, analytics, consent.
5. **Revenue foundations:** labeled inventory and manually approved campaigns.
6. **Hardening and launch:** security, accessibility, performance, restore,
   editorial, legal/media, and incident-response exercises.
7. **Limited automation:** only after measured shadow operation and explicit
   approval; never for sensitive coverage.

## 11. Dependencies and risks

- Provider contracts and media licenses determine what may be ingested, stored,
  displayed, or cached.
- Editorial staffing is a hard dependency for sensitive coverage and incidents.
- Trend signals can be manipulated; source velocity is not equivalent to truth.
- AI models can hallucinate, omit context, reproduce source language, or follow
  malicious instructions.
- A frontend demo can create false operational confidence unless status is
  visible in documentation and launch gates.
- Search and advertising eligibility depend on external platforms and cannot be
  promised.
- Full personalization, analytics, newsletters, and ads require a reviewed
  consent and privacy implementation.

## 12. Related documents

- [Information architecture](./information-architecture.md)
- [Editorial workflows](./editorial-workflows.md)
- [Permissions matrix](./permissions-matrix.md)
- [Acceptance criteria](./acceptance-criteria.md)
- [System architecture](../architecture/system-architecture.md)
- [Editorial policy](../EDITORIAL_POLICY.md)
- [AI policy](../AI_POLICY.md)
