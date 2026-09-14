# Launch Checklist

**Rule:** Leave an item unchecked until dated, reproducible evidence exists.
“Not implemented,” “not applicable,” and “demo only” are not passes.

## 1. Product and scope

- [ ] The release is labeled accurately as reference, beta, or production.
- [ ] Product requirements and route inventory match the shipped experience.
- [ ] Public website and newsroom form a cohesive end-to-end product, not only a
  homepage.
- [ ] Homepage, Latest, Trending, Story Intelligence, standard article, live
  blog, topic, search, newsletter, trust/policy, and custom system states work.
- [ ] Newsroom dashboard, Trend Desk, Research Desk, editor, and review workspace
  cover loading, empty, error, denial, and success states.
- [ ] Demo content is fictional, visible, safe, and absent from production
  claims/metadata.
- [ ] No interface or documentation describes a mock/contracted connector, AI,
  metric, ad, newsletter, or workflow as live.
- [ ] Hard publication maximum and no-minimum quality policy are configured.

## 2. Editorial readiness

- [ ] Editor-in-Chief and duty/editorial escalation roster are named.
- [ ] Source, claim, risk, media, SEO, quality, correction, retraction, and live
  workflows are trained and exercised.
- [ ] Every published format has a definition and review template.
- [ ] Every story records at least two original-value elements.
- [ ] Sensitive categories always route to affirmative human approval.
- [ ] Author cannot be the sole sensitive final approver.
- [ ] Central unverified/false/improperly conflicting claims block publication.
- [ ] Headlines, thumbnails, alerts, social, and newsletter copy are reviewed
  with the body.
- [ ] Correction contact/queue is monitored and severe-error escalation tested.
- [ ] No publication quota encourages weak stories.

## 3. Public trust and legal identity

- [ ] Operating publisher legal name, address/jurisdiction as required, contact,
  ownership, and funding are real and visible.
- [ ] Authors have accountable profiles and relevant disclosures.
- [ ] Editorial, AI, sources, corrections, media rights, sponsored content,
  privacy, cookies, terms, and advertising policies reflect actual operations.
- [ ] Copyright/takedown, privacy, accessibility, security, and editorial
  contacts are monitored.
- [ ] Terms and vendor contracts allow every enabled source, feed, snapshot,
  model, media, email, analytics, consent, and ad use.
- [ ] Counsel/policy review covers defamation, privacy, minors, elections, health,
  finance, crime, emergencies, copyright, and operating regions.

## 4. Identity and authorization

- [ ] Production identity provider and newsroom membership mapping work.
- [ ] MFA is required for privileged roles where supported.
- [ ] Session fixation, rotation, revocation, expiry, logout, and recovery pass.
- [ ] Server-side role/object/section/tenant/field authorization passes direct
  API/action and IDOR tests.
- [ ] Stale role/session and material-post-approval edit are denied.
- [ ] Service principals use short-lived least privilege.
- [ ] Sensitive approval, retraction, role, secret, export, and break-glass
  actions are audited.
- [ ] Deprovisioning and quarterly access certification are owned.

## 5. Data and editorial integrity

- [ ] Production database choice is final and architecture reviewed.
- [ ] Schema/migrations/constraints/indexes are reproducible and tested.
- [ ] Published versions, approvals, source snapshots, and audit are immutable to
  application roles.
- [ ] Claims link to supporting/contradicting evidence and valid states.
- [ ] Publication commits version, audit, and outbox atomically.
- [ ] Corrections/retractions preserve history and update every public
  representation.
- [ ] Search, cache, feeds, sitemaps, and analytics exclude drafts/private data
  and can rebuild.
- [ ] Retention, export, deletion, legal hold, and consent behavior are tested.
- [ ] No production data is present in local/preview fixtures.

## 6. Connectors and sources

- [ ] Each enabled connector has current permission, attribution, caching,
  retention, rate, market/category, credential, and owner records.
- [ ] No prohibited scraping, paywall circumvention, or restriction evasion.
- [ ] Egress blocks private/reserved addresses, DNS rebinding, unsafe redirects,
  excessive size/time, and wrong content type.
- [ ] Connector timeouts, retries, jitter, circuits, freshness, and independent
  degradation pass.
- [ ] Source tier/ownership/reliability records have reviewers and dates.
- [ ] Social/viral input remains discovery-only until verified.
- [ ] Source correction/retraction propagates to dependent-claim review.

## 7. AI readiness

- [ ] AI provider data processing, retention, training, region, and subprocessor
  terms are approved for each data class.
- [ ] Research, drafting, fact checking, specialist review, and approval are
  isolated.
- [ ] Drafting cannot browse and Publisher cannot generate or waive gates.
- [ ] Prompt/source/tool/user trust boundaries pass adversarial tests.
- [ ] Structured outputs, citations, unsupported claims, privacy leakage, and
  unsafe markup fail closed.
- [ ] Model/prompt versions, usage, cost, latency, and reviewer disposition are
  observable.
- [ ] Ask This Story is dossier-only, cited, rate-limited, and declines missing
  support/advice.
- [ ] AI and generated-illustration disclosures are accurate.
- [ ] Model/provider/agent kill switches are tested.
- [ ] Auto-publication is off unless every separate criterion below passes.

## 8. Limited auto-publication

- [ ] At least 30 days of representative shadow operation is reviewed.
- [ ] Enabled formats/categories are a narrow documented low-risk allowlist.
- [ ] Sensitive status is deny-by-default and cannot be lowered by AI.
- [ ] Quality score is at least 94 and every component explanation is stored.
- [ ] All source/claim/rights/originality/policy gates are deterministic.
- [ ] Daily auto cap is at most 3; total daily cap is at most 10.
- [ ] Staffed kill switch, alert, correction, and rollback exercises pass.
- [ ] Editorial, engineering, security, and legal/policy owners sign the exact
  policy/model/prompt version and expiration.

If any item is unchecked, auto-publication remains disabled.

## 9. Media

- [ ] Upload quarantine, magic-byte/type, malware, dimension/pixel/frame,
  decompression, metadata, and derivative controls pass.
- [ ] Only approved derivatives are public.
- [ ] Every usage has source, creator/rightsholder, license/permission,
  territory/channel, attribution, expiry, and reviewer.
- [ ] Archive/file/illustration/AI labels are visible and accurate.
- [ ] Alt, captions, transcripts, controls, crops, and thumbnails pass
  accessibility/context review.
- [ ] Rights expiry/takedown globally finds and disables/replaces usages.
- [ ] No random search images, watermarks removed, unlicensed rehosting, or fake
  documentary AI.

## 10. SEO and distribution

- [ ] Representative article body and metadata render in HTML without client JS.
- [ ] Canonicals, redirects, pagination, noindex, robots, dates, Open Graph, and
  supported JSON-LD validate.
- [ ] Sitemap index, news/image/video sitemaps as applicable, RSS/Atom, and
  section/topic/author feeds reconcile with published state.
- [ ] Search/account/newsroom/preview/thin URLs are excluded from indexation.
- [ ] Retraction, correction, slug merge, redirect, and `410` cases pass.
- [ ] Missing and intentionally removed resources return actual HTTP 404 and
  410 statuses rather than soft-404 pages with HTTP 200.
- [ ] Publisher identity, byline, reviewer, ownership/funding, contact, and trust
  links are present.
- [ ] No guarantee of ranking, News, or Discover appears.
- [ ] Search platform verification uses production-controlled accounts.

## 11. Performance, accessibility, and resilience

- [ ] Public pages meet lab budgets and have field measurement for p75 LCP
  <2.5s, CLS <0.1, INP <200ms when sample size permits.
- [ ] Breaking-news/cache-stampede and uncached read load tests pass.
- [ ] Article reading survives AI, ad, analytics, personalization, and connector
  outage.
- [ ] Responsive checks pass at 320, 768, 1280, and 1536px.
- [ ] Keyboard, focus, headings, landmarks, names, contrast, zoom, reduced
  motion, captions, alt, status, and live updates pass manual review.
- [ ] Automated accessibility checks have no unresolved critical findings.
- [ ] Media/ad dimensions are reserved and third parties fit performance budgets.
- [ ] 404, 410, 500, maintenance, offline, and degraded states are useful.

## 12. Security and privacy

- [ ] Threat model matches the deployed architecture and vendors.
- [ ] IDOR/RBAC, XSS, CSRF, SSRF/DNS rebinding, redirects, uploads/image bombs,
  prompt/tool injection, cron/webhook replay, queues, rate bypass, CSV injection,
  and secret leakage pass.
- [ ] CSP and security headers work with the actual integration inventory.
- [ ] Secrets are managed, separated by environment, least-privilege, scanned,
  redacted, and rotation-tested.
- [ ] Dependency/SAST/license/CI provenance gates pass.
- [ ] Consent, preferences, opt-out/GPC where applicable, account export/delete,
  newsletter proof, retention, and privacy-safe logs pass.
- [ ] Independent penetration test has no unresolved launch-blocking finding.
- [ ] Residual risks have owner, treatment, expiry, and explicit acceptance.

## 13. Jobs and operations

- [ ] Durable queue, idempotency, lease, timeout, bounded retry/backoff, circuit
  breaker, DLQ, and scoped replay pass fault injection.
- [ ] Worker crash before/after DB and external effect does not duplicate
  publication/send.
- [ ] Publication/distribution reconciliation passes.
- [ ] Health, logs, traces, errors, queue lag, connector freshness, model/API
  cost, audit failure, and security alerts reach named owners.
- [ ] On-call and editorial staffed coverage match enabled hours/formats.
- [ ] Operations handoff, correction, incident, deployment, and kill-switch
  exercises pass.
- [ ] Feature flags have owner, purpose, environment, expiry, and audit.

## 14. Backups and disaster recovery

- [ ] Database PITR/snapshots and object/config backups are encrypted and
  monitored.
- [ ] Backup identities/storage are isolated from the application.
- [ ] Search/cache/projections rebuild from the system of record.
- [ ] Monthly sample and quarterly full isolated restore exercises meet approved
  RPO/RTO.
- [ ] Restore reconciles consent/unsubscribe, roles, corrections, schedules,
  queues/outbox, objects/rights, and external sends.
- [ ] Application/config rollback is rehearsed.
- [ ] Database high-risk migration backup and forward-repair plan are approved.

## 15. Newsletter, ads, and revenue

- [ ] Signup consent, confirmation where configured, preferences, suppression,
  unsubscribe, segmentation, preview, idempotent send, and archive pass.
- [ ] Sensitive/breaking newsletters require human send approval.
- [ ] Ads/sponsored/affiliate labels are conspicuous in every viewport/channel.
- [ ] Ads are absent from prohibited/empty/low-value states and do not obscure
  content or induce accidental clicks.
- [ ] Consent and contextual fallback work; sensitive/minor targeting is off.
- [ ] Creative scan, rights, claim, destination/redirect, version reapproval,
  invalid-traffic, and kill-switch controls pass.
- [ ] Advertising Manager cannot change editorial ranking/facts/publication.
- [ ] Demo revenue/impressions/clicks never enter production billing/reporting.

## 16. Deployment

- [ ] Commit, saved Sites version, artifact, environment revision, and schema
  match the approved release record.
- [ ] `.openai/hosting.json` IDs/bindings are reused exactly and contain no
  secrets.
- [ ] Preview/staging cannot be indexed or access production data.
- [ ] Production access policy and domain/TLS are verified.
- [ ] The chosen runtime topology is fully represented: either validated
  Sites/worker compatibility, or reviewed/scanned Docker and local dependency
  manifests for every containerized service.
- [ ] Risky features deploy off and enable separately.
- [ ] Canary/gradual rollout, smoke tests, monitoring, and compatible rollback
  artifact are ready.
- [ ] Every production deployment has the required owner/open-world approval.
- [ ] Post-deploy public, newsroom denial, safe publication/correction, cache,
  search/feed/sitemap, queue, and alert checks pass.

## 17. Go/no-go record

```text
Release/commit:
Saved version/deployment:
Environment/schema/config/policy/prompt versions:
Evidence index:
Open risks:
Feature flags disabled:
Auto-publication status:
Editorial approver:
Engineering approver:
Security/privacy approver:
Legal/policy approver:
Operations/on-call approver:
Decision and UTC time:
Rollback owner/artifact:
```

No single score, build, screenshot, or approver is sufficient for production
launch.
