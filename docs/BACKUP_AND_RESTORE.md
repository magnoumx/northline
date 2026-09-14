# Backup and Restore

**Status:** Target production runbook; reference frontend has no complete
production data plane to back up
**Last reviewed:** 2026-07-24

## 1. Objectives

Recommended starting objectives, subject to business and provider validation:

| Data class | RPO | RTO | Notes |
| --- | ---: | ---: | --- |
| Published/editorial workflow database | 15 minutes | 4 hours | Point-in-time recovery preferred |
| Identity membership, consent, correction/audit | 15 minutes | 4 hours | High integrity and restricted access |
| Original media and permitted source snapshots | 24 hours | 8 hours | Versioning/replication according to rights |
| Configuration/policy/prompt metadata | 1 hour | 4 hours | Git plus database/config export |
| Search, cache, feeds, analytics projections | Rebuild | 8–24 hours | Not authoritative |

These are not achieved until provider configuration, monitoring, and a timed
restore drill prove them.

## 2. Backup scope

Back up:

- PostgreSQL system of record, including migration history and outbox/job state;
- private media and legally permitted source objects plus versioning metadata;
- non-secret versioned configuration, feature/policy/prompt definitions;
- encryption/key metadata needed to identify the correct key versions;
- deployment artifact/commit and schema version;
- operational documentation and incident/audit evidence under retention policy.

Do not treat cache or search as authoritative. Rebuild them from restored
published records. Secrets should be recoverable through the approved secret
manager and escrow/rotation process, not copied into a general backup archive.

## 3. Backup controls

- Encrypt in transit and at rest with keys separated from backup storage.
- Use a dedicated least-privilege backup identity.
- Keep backups in a separate account/project and failure domain where practical.
- Enable immutability/object lock for an approved period where supported.
- Monitor success, age, size anomaly, encryption, retention, and restore
  readability.
- Protect backup catalogs and logs from application administrators.
- Apply contractual/licensing deletion to source/media backups.
- Record backup ID, range/time, schema, key version, checksum/manifest, and
  expiration.
- Never include plaintext credentials, session tokens, signed URLs, or
  unnecessary reader/source PII in operator output.

## 4. Schedule

A production design should include:

- continuous or frequent PostgreSQL WAL/PITR;
- daily logical/snapshot backup;
- weekly or provider-appropriate full verification;
- object versioning plus cross-region/account inventory or replication where
  approved;
- daily configuration/policy inventory;
- monthly sample restore;
- quarterly full isolated restore exercise;
- pre-migration backup/restore validation for high-risk changes.

Choose exact provider features and retention only after legal, cost, and
capacity review.

## 5. Restore authority

| Role | Responsibility |
| --- | --- |
| Incident Commander | Authorizes recovery point and production cutover |
| Database owner | Restores DB and validates schema/integrity |
| Storage owner | Restores objects and access policies |
| Security/privacy owner | Assesses compromise, credentials, evidence, and notification |
| Editorial owner | Validates published state, corrections, embargoes, schedules |
| Operations lead | Rebuilds projections, controls queues, verifies service |
| Scribe | Records times, IDs, decisions, checks, and data-loss window |

Production restore is a high-impact action. Use two-person verification for
target environment and recovery point.

## 6. Pre-restore decision

1. Declare an incident and freeze unsafe writes/publication/distribution.
2. Determine whether the issue is deletion, corruption, compromise, provider
   outage, or regional loss.
3. Preserve forensic evidence before overwriting affected systems.
4. Identify last known good time and estimate data loss to each candidate point.
5. Confirm backup manifest, encryption key access, schema/application
   compatibility, and object snapshot.
6. Select an isolated restore target; never test by overwriting production.
7. Communicate expected RPO/RTO and editorial consequences.

If compromise is suspected, rotate credentials and remove persistence before
production cutover.

## 7. Isolated database restore

Provider-specific commands must be tested and stored in the restricted
operations system; do not guess them during an incident.

General sequence:

1. Create a new isolated database/project with no public access.
2. Restore to the selected point.
3. Verify backup checksums/catalog and database engine/version.
4. Run integrity checks, migration/schema checks, and row-count/time-range
   comparisons.
5. Verify users/roles without enabling stale sessions.
6. Inspect latest published versions, corrections, retractions, schedules,
   audit continuity, outbox, and job leases.
7. Quarantine events after the chosen recovery point for reconciliation.
8. Point a staging application artifact compatible with the restored schema.
9. Run authorization and read-only workflow smoke tests.

Do not execute due schedules or deliver outbox messages in the isolated
environment.

## 8. Object restore

1. Restore or mount the versioned object snapshot privately.
2. Compare the database's expected object checksum/key/license state to the
   object inventory.
3. Quarantine unexpected, unscanned, expired, or legally restricted assets.
4. Verify representative originals and approved derivatives decode correctly.
5. Restore public delivery only for approved derivatives.
6. Recreate missing derivatives from verified originals where rights permit.

Never make an entire restore bucket public.

## 9. Reconciliation and cutover

Before cutover:

- choose the authoritative boundary timestamp;
- inventory post-boundary published articles, corrections, consent changes,
  unsubscribes, role changes, media licenses, and external deliveries;
- prioritize safety-critical consent/unsubscribe, role revocation, correction,
  retraction, and legal-hold reconciliation;
- invalidate old sessions and rotate affected secrets;
- rebuild search, feeds, sitemaps, and caches;
- reset queue leases and dedupe against external provider receipts;
- disable scheduled mail/notifications/ads until reconciled.

Cut over gradually, verify public reads and newsroom denial paths, then resume
jobs by queue family. Publication and distribution resume last.

## 10. Verification checklist

- [ ] Database schema/release compatibility is correct.
- [ ] Required row counts/time ranges and constraints are plausible.
- [ ] Published pointers reference immutable valid versions.
- [ ] Correction/retraction/update histories are intact.
- [ ] Audit chain and authorization assignments are reviewed.
- [ ] Objects match checksums, rights, and public/private state.
- [ ] Consent withdrawals and unsubscribes are no older than allowed loss.
- [ ] Search/cache/feed/sitemap projections rebuilt from restored truth.
- [ ] Queue/outbox replay produces no duplicate publish/send effect.
- [ ] Representative public and newsroom flows pass.
- [ ] Monitoring, backup schedules, and alerting resume.
- [ ] Actual RPO/RTO and unrecovered data are documented.

## 11. D1/reference deployments

If a reference deployment later uses D1/R2, create a provider-specific export,
retention, access, and restore procedure and exercise it. A binding in
`.openai/hosting.json` is not a backup. Do not store irreplaceable production
newsroom data there until the backup and consistency model is approved.

## 12. Restore drill record

```text
Exercise/incident ID:
Date and participants:
Source environment and synthetic dataset:
Backup IDs/timestamps/key versions:
Chosen recovery point:
Restore target:
Start / usable / complete times:
Measured RPO / RTO:
Integrity and application tests:
Projection/queue reconciliation:
Failures and manual steps:
Security/privacy observations:
Follow-up owners and dates:
Approver:
```

## 13. Failure handling

A failed or unreadable backup is a production incident. Do not delete older
known-good backups merely because a new backup exists. Investigate abrupt size,
duration, encryption, or row-count changes and restore-test after backup-system
changes.
