# Acceptance Criteria

**Status:** Verification contract; unchecked criteria are not claims
**Last updated:** 2026-07-24

## 1. How to use this document

Acceptance requires reproducible evidence, not a visual impression. For each
criterion, record:

- build or commit identifier;
- environment;
- exact command or manual procedure;
- result and artifact link;
- date and reviewer;
- known exceptions and owner.

The initial repository milestone is a production-shaped frontend/reference
implementation. Criteria in the “production” gate remain open until real
services and operational evidence exist.

## 2. Milestone 1: cohesive frontend/reference experience

### Public product

- [ ] **FE-001:** Given a desktop or mobile reader, when the homepage loads,
  then it presents a clear lead hierarchy, Top Stories, uninterrupted Latest,
  trending context, section packages, newsletter conversion, a labeled sponsor
  example, and trust navigation without duplicate clutter.
- [ ] **FE-002:** Given the Latest feed, when items are inspected, then they are
  reverse chronological and no pinned item interrupts the sequence.
- [ ] **FE-003:** Given a trend item, when opened, then the reader can distinguish
  the trigger, confirmed context, time/geography, uncertainty, and connected
  coverage.
- [ ] **FE-004:** Given a Story Intelligence page, then summary, latest
  development, key facts, significance, trend context, entities, timeline,
  evidence, conflicts/open questions, next steps, updates, corrections, and
  related coverage have usable states.
- [ ] **FE-005:** Given a standard article, then headline, byline, dates,
  verification, key takeaways, media credit, body, citations, sources,
  disclosures, history, corrections, follow/save, newsletter, and safe ad
  placements are represented.
- [ ] **FE-006:** Given a live blog, then every entry shows time, desk/author,
  source, and verification state.
- [ ] **FE-007:** Topic, search, newsletter, policy, 404, 410, 500, maintenance,
  and offline experiences have purposeful content rather than generic blanks;
  missing and intentionally removed resources also return HTTP 404 and 410
  respectively.
- [ ] **FE-008:** Demo stories are visibly fictional/demo and do not fabricate
  scandals or current breaking news involving real people.

### Newsroom product

- [ ] **NW-001:** The dashboard shows candidate, research, draft, review,
  scheduled, published/developing, correction, failure, connector, and cost
  states using coherent demo data.
- [ ] **NW-002:** The Trend Desk can demonstrate inspect, merge, reject,
  prioritize, assign, research, and connect-to-cluster interactions.
- [ ] **NW-003:** The Research Desk represents sources, primary documents,
  claims, conflicts, timeline, entities, missing information, snapshots, and
  notes.
- [ ] **NW-004:** The editor supports the required editorial block types or
  clearly identifies contracted controls, and AI actions show a reviewable diff.
- [ ] **NW-005:** The review workspace separates facts, sources, risk, media,
  SEO, accessibility, ads, structured data, preview, and history.
- [ ] **NW-006:** Sensitive-story demo paths visibly require human review and
  cannot enter an approved/published state through the reference controls.
- [ ] **NW-007:** Score displays expose components and explanations rather than
  an unexplained number.

### Experience quality

- [ ] **UX-001:** All milestone routes render at 320px, 768px, 1280px, and
  1536px without clipped primary content or horizontal page scroll.
- [ ] **UX-002:** Keyboard users can reach navigation, search, feeds, dialogs,
  tabs, forms, and editor controls with visible focus.
- [ ] **UX-003:** Automated accessibility checks have no critical violations,
  and manual checks cover landmarks, headings, names, focus, zoom, contrast,
  reduced motion, status text, and live updates.
- [ ] **UX-004:** Loading, empty, error, disabled, success, and validation states
  are present for interactive workflows.
- [ ] **UX-005:** Media and ad examples reserve dimensions to avoid layout
  shift; article text remains readable with ads unavailable or blocked.
- [ ] **UX-006:** No interface represents demo metrics, feeds, AI results, ad
  revenue, or connector health as live production data.

### Engineering quality

- [ ] **ENG-001:** Dependency installation, lint, type checking, tests, and
  production build pass using documented commands.
- [ ] **ENG-002:** Public pages render meaningful HTML without requiring client
  JavaScript for article content.
- [ ] **ENG-003:** Route-level errors do not expose stack traces, secrets, or
  unpublished content.
- [ ] **ENG-004:** No secret or real credential exists in source, fixtures,
  generated output, or browser bundles.
- [ ] **ENG-005:** The docs match the implemented routes and label future
  services as contracts.

## 3. Core backend gate

- [ ] **BE-001:** Production identity maps to server-side membership and roles;
  authorization tests cover direct API/action access, not only hidden controls.
- [ ] **BE-002:** The normalized production schema, migrations, constraints,
  indexes, and seed strategy are reviewed and reproducible.
- [ ] **BE-003:** Published versions and source snapshots are immutable to
  application roles; corrections create new versions.
- [ ] **BE-004:** Every editorial state transition is transactionally validated
  and audited.
- [ ] **BE-005:** Central claims have queryable supporting and contradicting
  evidence with valid verification states.
- [ ] **BE-006:** Search cannot return unpublished, cross-tenant, private source,
  or restricted legal/media data.
- [ ] **BE-007:** Media upload, scanning, metadata extraction, licensing, expiry,
  and usage approval work end to end.
- [ ] **BE-008:** Correction, retraction, redirect, cache invalidation, feed, and
  sitemap effects are integration-tested.

## 4. Ingestion and AI-assistance gate

- [ ] **AI-001:** Each enabled connector has documented permission, attribution,
  limits, caching, market/category scope, timeout, health, and circuit breaker.
- [ ] **AI-002:** Egress blocks private/link-local/reserved targets, DNS
  rebinding, unsafe redirects, oversized responses, and disallowed content
  types.
- [ ] **AI-003:** Jobs are idempotent, retry with bounded backoff, enter a
  dead-letter queue, and can be safely replayed.
- [ ] **AI-004:** Research, drafting, fact checking, and approval use distinct
  stages and credentials.
- [ ] **AI-005:** Drafting cannot browse; the Publisher cannot generate content
  or override a deterministic block.
- [ ] **AI-006:** Prompt/tool injection suites demonstrate that retrieved text
  cannot change policy, invoke tools, obtain secrets, or publish.
- [ ] **AI-007:** Model/prompt versions, usage, latency, cost, inputs by
  reference, outputs, and reviewer decisions are observable with required
  redaction.
- [ ] **AI-008:** Quality and risk evaluations meet approved test-set thresholds
  in shadow mode, including disagreement and manipulated-signal cases.
- [ ] **AI-009:** Ask This Story uses only the verified dossier, provides source
  links, declines missing support, and enforces abuse/rate limits.

## 5. Distribution, retention, and revenue gate

- [ ] **DST-001:** Canonicals, robots, index controls, publication/modified
  dates, Open Graph, sitemaps, feeds, and supported structured-data types pass
  validation against representative pages.
- [ ] **DST-002:** Newsletter consent, double opt-in where configured,
  suppression, unsubscribe, preference center, segmentation, preview, and
  idempotent send are integration-tested.
- [ ] **DST-003:** Reader follows/saves/history respect reset, export, deletion,
  retention, and non-personalized public-interest coverage.
- [ ] **REV-001:** Every ad and sponsored format is visibly labeled, consent
  aware, dimensionally reserved, and absent from prohibited/low-value states.
- [ ] **REV-002:** Commercial roles cannot modify editorial ranking, claims, or
  publication state.
- [ ] **REV-003:** Impression/click handling rejects obvious replay and never
  creates incentives or automation for invalid clicks.

## 6. Production launch gate

- [ ] **LCH-001:** Staging and production are separate; production secrets,
  data, providers, buckets, queues, databases, and domains are not reused by
  local/demo environments.
- [ ] **LCH-002:** Database and object-storage backups are encrypted, monitored,
  and restored in a timed exercise meeting approved RPO/RTO.
- [ ] **LCH-003:** Rollback is rehearsed for application, configuration, and
  backward-compatible database changes.
- [ ] **LCH-004:** Health, logs, traces, errors, queue lag, connector failures,
  publication failures, cost, and security events have actionable alerts and
  owners.
- [ ] **LCH-005:** Incident, corrections, security, backup, and editorial
  runbooks are exercised by the people on the escalation roster.
- [ ] **LCH-006:** Privacy, terms, ownership/funding, editorial, AI, corrections,
  source, media, advertising, and sponsored-content disclosures are reviewed
  for the actual operating entity and vendors.
- [ ] **LCH-007:** Accessibility, performance, security, SEO, editorial, and
  media-rights audits have no unresolved launch-blocking findings.
- [ ] **LCH-008:** Public editorial pages meet measured p75 targets of LCP
  <2.5s, CLS <0.1, and INP <200ms where sufficient field data exists; lab
  budgets cover prelaunch.
- [ ] **LCH-009:** On-call coverage and human editorial coverage are sufficient
  for enabled formats and schedules.
- [ ] **LCH-010:** Auto-publish remains disabled at launch unless the separate
  gate in section 7 passes.

## 7. Limited auto-publication gate

All items are required:

- [ ] At least 30 days of representative shadow-mode results have been
  reviewed; the review window may be lengthened for low sample volume.
- [ ] The enabled categories/formats are an explicit low-risk allowlist.
- [ ] Sensitive classification is deny-by-default and cannot be lowered by AI.
- [ ] False/unsupported central claims, missing sources, unresolved conflicts,
  rights failures, and policy failures deterministically block.
- [ ] Quality threshold is at least 94 and component explanations are stored.
- [ ] Daily automation cap is at most 3 and total daily cap at most 10.
- [ ] A staffed kill switch, rollback, correction workflow, and alert are tested.
- [ ] Editor-in-Chief, engineering, security, and legal/policy owners sign the
  exact policy/model/prompt version.
- [ ] A dated expiration forces reapproval; material model, prompt, source,
  policy, or provider changes disable or requalify the pathway.

Passing the score threshold alone is insufficient.

## 8. Final product evidence table

Do not answer “yes” without linking evidence.

| Question | Required evidence |
| --- | --- |
| Can it detect important U.S. trends? | Live permitted connector test, market filtering, latency, and sampled editorial relevance |
| Can it reject weak or duplicate trends? | Unit/integration cases plus editor audit sample |
| Can claims be traced to evidence? | Published-version query/report and claim coverage test |
| Are sensitive stories blocked? | Server-side authorization/policy tests and E2E bypass attempts |
| Can editors modify/approve AI drafts? | Diff-acceptance E2E and immutable approval hash |
| Are media rights recorded? | Schema constraints, upload/review test, expiry behavior |
| Are corrections preserved? | Version history and public correction E2E |
| Are pages fast and indexable? | Rendered HTML, Lighthouse/lab, field telemetry, crawler validation |
| Is mobile excellent? | Device matrix, accessibility, and usability results |
| Are ads safe? | Placement audit, consent tests, policy review |
| Are permissions server-enforced? | RBAC integration suite including IDOR and stale sessions |
| Are workflows tested? | CI report mapped to workflow states |
| Can failed jobs recover? | Retry, dedupe, DLQ, and replay exercise |
| Can it be restored? | Dated restore drill with measured RPO/RTO |
| Can another team operate it? | Fresh-environment setup and on-call tabletop |
| Does every story add value? | Published-content audit showing two recorded value elements |

## 9. Definition of done for each feature

- [ ] Requirements and acceptance criteria are linked.
- [ ] Desktop and mobile UI are complete.
- [ ] Loading, empty, error, and permission-denied states exist.
- [ ] Server-side authorization and input validation exist where applicable.
- [ ] Audit logging exists for material actions.
- [ ] Unit, integration, relevant E2E, and security tests pass.
- [ ] Accessibility, performance, privacy, editorial, media, and security impact
  are reviewed in proportion to risk.
- [ ] Documentation and operational ownership are updated.
- [ ] Production build passes and no secrets are exposed.
- [ ] No placeholder behavior is represented as a live capability.
