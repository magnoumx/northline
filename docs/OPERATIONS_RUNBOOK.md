# Newsroom Operations Runbook

**Status:** Target operating procedure; service checks apply only after the
named service exists
**Last reviewed:** 2026-07-24

## 1. Operating principle

Protect accuracy and reader access before volume, automation, personalization,
or revenue. A low-news day can produce no story. The reference frontend uses
fictional data and requires no live-newsroom on-call claim.

## 2. Shift start

### Platform

- Confirm current release, schema, environment, and active incident banner.
- Check public homepage, Latest, representative article, Story Intelligence,
  search, policy/corrections, 404/410.
- Check newsroom identity, membership, and a known denial path.
- Review error rate, latency, Core Web Vitals, database/cache/search/storage,
  queue age, DLQ, backup freshness, audit/logging health.
- Review active kill switches and expiring secrets/certificates/licenses.

### Editorial pipeline

- Review homepage mode and breaking-banner expiry.
- Review high-priority signals, candidates, duplicates, and U.S. relevance.
- Review source/connector freshness and circuit states.
- Review research, source-insufficient, draft, revision, human-review,
  scheduled, developing, correction, and retraction queues.
- Confirm staffing for sensitive stories, live coverage, and scheduled sends.
- Review AI/API/media cost and quota anomalies.

Record checks and owners; do not mark nonexistent integrations healthy.

## 3. Continuous editorial desk

### Trend Desk

1. Inspect provenance and time/geography, not only the total score.
2. Merge duplicates and connect signals to existing Story Clusters.
3. Reject manipulation/noise, weak U.S. relevance, stale/duplicate coverage, no
   source path, or no original-value opportunity.
4. Raise sensitivity/risk when uncertain; AI cannot lower it.
5. Assign research only when an editorially useful angle is plausible.

### Research Desk

- Prefer primary evidence and independent confirmation.
- Track missing information and conflicts explicitly.
- Verify source permission/retention before snapshots.
- Treat social material as a lead.
- Escalate confidential, leaked, private, hacked, malicious, or high-risk
  material.

### Draft and review

- Confirm at least two recorded original-value elements.
- Keep AI proposals diff-based and evidence-bound.
- Complete independent fact, media, SEO, risk, and editorial reviews.
- Reapprove after material edits.
- Verify headline/thumbnail/alerts/newsletter copy, not just body.
- Never use a score to override a hard block.

## 4. Publication checks

Before publish/schedule:

- exact version/hash approved;
- actor has server-side permission;
- central claims have allowable support states;
- source independence/primary availability reviewed;
- sensitive routing and required human/legal review complete;
- at least two original-value elements;
- media rights/attribution/expiry and AI/archive labels valid;
- headline variants accurate;
- canonical, dates, schema, internal links, index controls valid;
- update/correction/disclosure notes present;
- ad/sponsor separation safe;
- embargo/schedule/timezone/daily cap correct;
- rollback/correction path and assigned monitor exist.

The deterministic Publisher rechecks these. A manual checklist does not replace
server enforcement.

## 5. After publication

Within the monitoring window:

- open rendered HTML and canonical URL;
- verify headline/body/media/source/correction/disclosure and mobile layout;
- verify cache, search, feed, sitemap, and Story Intelligence projection;
- confirm notifications/newsletters only when intentionally approved;
- watch source updates, contradictions, affected-party responses, reader
  reports, and rights issues;
- record meaningful update proposals without artificial freshness.

High-risk and developing stories have a named editor and review cadence.

## 6. Corrections desk

1. Acknowledge and preserve the report/version.
2. Triage active harm.
3. Freeze distribution where needed.
4. Recheck evidence and affected surfaces.
5. Publish a new immutable corrected version and visible note.
6. Reconcile caches/search/feeds/sitemaps/social/mail/Story Intelligence.
7. Inspect dependent claims/articles.

Follow [CORRECTIONS_POLICY.md](./CORRECTIONS_POLICY.md). Escalate severe issues
under [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md).

## 7. Connector operations

For each connector monitor:

- last success/failure and data freshness;
- request success/latency/rate-limit headroom;
- permitted-use/attribution/cache contract;
- cursor/checkpoint and duplicate rate;
- circuit state and health explanation;
- credential/license expiry;
- schema/parser changes and unusual volume/content.

On degradation, open the connector circuit, continue other providers, mark
stale data honestly, and do not bypass restrictions with scraping.

## 8. Queue and job operations

Watch queue depth, oldest age, throughput, retry rate, job duration, cost, and
DLQ owner. Prioritize:

1. corrections/retractions and consent/unsubscribe;
2. publication and critical distribution;
3. active-emergency/developing monitoring;
4. normal ingestion/research;
5. bulk maintenance/backfills.

Before replay:

- classify failure;
- fix dependency/code/policy;
- dry-run scope/count;
- confirm idempotency and external receipts;
- rate-limit and monitor;
- never bulk-replay publish/send blindly.

## 9. AI operations

- Review provider/model health, latency, usage, cost, schema failure, unsupported
  claim, citation, risk override, and editor-rejection trends.
- Pause a prompt/model/agent on serious factual, privacy, rights, injection, or
  cost anomaly.
- Provider failover only uses an approved equivalent data class.
- Model/prompt changes run evaluation and shadow mode.
- Budget limits pause/defer work; they do not lower verification.
- Auto-publication remains off unless its approval is current and all monitors
  are green.

## 10. Media operations

- Triage quarantined/malware/decoder failures.
- Review rights and pending expiry.
- Confirm public delivery uses approved derivatives.
- Investigate broken credits, stale archive context, manipulative crops,
  inaccessible captions/alt, or takedown claims.
- Disable an asset globally when safety/rights require it and update every usage.

## 11. Newsletter and notification operations

- Verify consent/suppression immediately before send.
- Preview links, subjects, summaries, disclosures, sponsorship, audience, UTM,
  and timezone.
- Sensitive/breaking sends require human approval.
- Monitor bounce/complaint/unsubscribe/provider rejection and duplicate delivery.
- Pause on suppression failure, incorrect audience, or material editorial error.

## 12. Advertising operations

- Review approved creative version, destination, labels, dates, targeting,
  frequency, consent, and sensitive-page exclusions.
- Monitor malware/redirect change, invalid traffic, layout/accessibility,
  performance, and revenue anomalies.
- Disable affected vendor/campaign/creative/slot immediately on safety/privacy
  failure.
- Never request or generate ad clicks.

## 13. Daily close and handoff

Record:

```text
Open incidents and severity
Homepage mode/banner and expiry
Developing/live stories and next review
Sensitive drafts/reviews and accountable editor
Scheduled publications/sends
Corrections, legal/privacy, and rights issues
Connector/circuit status and stale signals
Queue backlog/DLQ and replays
AI/provider/cost anomalies
Backup/monitoring alerts
Active kill switches/config changes
Named owners and next deadlines
```

Do not hand off through private personal accounts or unlogged messages.

## 14. Recurring schedule

| Cadence | Work |
| --- | --- |
| Each staffed shift | Full shift-start/handoff, queues, developing/sensitive coverage |
| Daily | Connector/source freshness, rights expiry, cost/quota, correction reports, backup result |
| Weekly | Rejected/duplicate trends, claim coverage, review overrides, DLQ, performance, accessibility spot check |
| Monthly | Source tier/license review sample, permission review, restore sample, ad/consent audit, AI evaluation drift |
| Quarterly | Full restore drill, incident tabletop, role/access certification, supplier and retention review |
| Before major event | Capacity, staffing, official data, homepage mode, correction and kill-switch rehearsal |

## 15. Kill switches

Maintain scoped, server-side, audited switches for:

- all publication and auto-publication;
- each connector;
- each AI provider/model/prompt/agent;
- Ask This Story;
- media upload/processing/embeds;
- newsletters and notifications;
- ads by vendor/campaign/slot;
- personalization/analytics; and
- scheduled jobs.

Record who changed a switch, reason, time, incident, expected impact, and
re-enable authority.

## 16. Escalation triggers

Page incident response for:

- unauthorized or materially false publication;
- exposed reader/private-source data or secret;
- sensitive approval bypass;
- malware/XSS/SSRF/prompt-tool execution;
- false death/wrong-person/dangerous emergency claim;
- uncontrolled email/notification/ad behavior;
- corrupt/lost publication history;
- failed audit or backup protections; or
- public outage without a safe cached read path.

## 17. Reference environment

For the current frontend/reference milestone, operator checks are limited to
build, route rendering, fictional demo labeling, responsive/accessibility
behavior, no-secret inspection, and Sites deployment health. Dashboards and
workflow queues shown with fixtures are demonstrations, not operational
telemetry.
