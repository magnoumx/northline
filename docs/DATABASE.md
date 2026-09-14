# Database Guide

> V3 supersession note (2026-07-24): the current deployment candidate uses
> Cloudflare D1 as its database target. PostgreSQL below records an earlier
> long-term architecture option, not the active release contract.

## Status

The repository includes a reproducible Drizzle schema and seven D1 migrations,
including the V3 content, AI, authentication, and operations foundations. D1 is
the selected system of record for the current Cloudflare deployment candidate.
That selection does not prove remote migration, capacity, backup, restore, or
operational readiness. A future PostgreSQL migration would require an explicit
architecture decision and a new, reconciled migration history.

## Responsibilities

The system of record owns:

- identity membership and role assignments;
- taxonomy, entities, sources, and connector configuration;
- trends, Story Clusters, dossiers, claims, and evidence;
- articles, immutable versions, reviews, schedules, updates, and corrections;
- media metadata, licensing, and usage decisions;
- reader preferences/consent;
- newsletter and commercial control records;
- job/outbox state, provider/model usage, settings, and audit.

The checked-in D1 migrations enforce core history guarantees: an article's
current version must belong to that article, public states require a timestamped
frozen version, published versions cannot be updated or deleted, and
state-transition/audit rows are append-only. Upgrade migrations backfill valid
legacy publication timestamps and abort if an existing row cannot satisfy those
invariants.

Binary media and permitted large source snapshots belong in private object
storage. Search indexes, caches, feeds, and analytics are rebuildable
projections.

See [data-model.md](./architecture/data-model.md) for the entity catalog and
relationships.

## Local development

For the reference frontend, prefer deterministic fictional fixtures. Do not add
a database merely to make demo content look live.

After an intentional Drizzle schema change:

```bash
npm run db:generate
```

This generates a migration; it does not review, apply, verify, or back up a
database. The current package does not promise a universal migration-apply
command. Add an environment-specific, noninteractive migration runner before
backend rollout and document it here.

## Schema standards

- Use opaque IDs and UTC timestamps.
- Use foreign keys, unique constraints, check constraints, and transactions.
- Avoid database-wide soft delete as a substitute for lifecycle design.
- Store bounded provider metadata in JSON only where relational columns are not
  the better query/integrity choice.
- Use explicit enum constraints/migrations.
- Keep published versions, approvals, source snapshots, and audit append-only.
- Link reviews to version hash and policy version.
- Use narrow projections; avoid `SELECT *` in application paths.
- Store secret references, never secret values, in connector/provider rows.

## Migration procedure

1. Write the domain and backward-compatibility plan.
2. Generate and inspect the migration.
3. Test it from the previous production schema against production-shaped data.
4. Measure locks, runtime, index build, and storage growth.
5. Use expand/migrate/contract.
6. Verify a recent restorable backup before high-risk operations.
7. Apply with a dedicated migration role and advisory lock.
8. Verify schema version and readiness.
9. Run backfills as restartable, rate-limited jobs.
10. Ship destructive contraction only after readers/writers no longer use the
    old shape and rollback window closes.

Do not edit an already-applied migration. Add a new corrective migration.

## Publication transaction

Publication should:

1. lock or version-check the article;
2. reload the approved immutable version;
3. re-evaluate permission and every hard gate;
4. insert the publication/current pointer;
5. insert audit and outbox events; and
6. commit atomically.

Search, feeds, caches, mail, and notifications consume the outbox
asynchronously and idempotently.

## Concurrency

- Editor writes include expected revision/content hash.
- A conflict returns the current version and requires merge/review.
- Approval stores the exact reviewed hash.
- Any material edit invalidates approval.
- Due publication locks per article and uses a semantic idempotency key.
- Backfills and reconcilers use bounded batches and stable cursors.

## Roles

Use separate credentials/roles for:

- application read/write;
- public read projection where practical;
- migrations;
- backup/restore;
- analytics replica/export;
- incident break-glass.

No browser connects directly to the database. Application roles cannot disable
audit integrity or rewrite published history.

## Index and query review

Review indexes for Latest, workflow queues, Story Clusters, trends, claims,
reviews, schedules, jobs, connectors, reader relations, redirects, and public
full-text search. Use partial/covering indexes and cursor pagination where
appropriate.

Before launch:

- capture representative query plans;
- set slow-query thresholds;
- load test breaking-news and newsroom concurrency;
- establish connection budgets/pooling;
- alert on saturation, replication/backup failures, and disk growth.

## Seed data

Seed only fictional, clearly labeled content outside production. Seeds should
cover:

- multiple categories and formats;
- a developing Story Cluster and timeline;
- verified and conflicting claims;
- source tiers and a primary record;
- approved and rejected media;
- a correction/version history;
- sensitive human-review routing; and
- failed/retriable jobs.

Never seed real credentials or fabricated allegations about real people.

## Backup and recovery

Backups must cover the database, object storage, configuration/policy versions,
and enough queue/outbox state to reconcile. Search and cache are rebuilt rather
than treated as authoritative backups. Follow
[BACKUP_AND_RESTORE.md](./BACKUP_AND_RESTORE.md).

## Production readiness

Do not call the database production-ready until:

- migrations are reproducible and reviewed;
- constraints enforce core invariants;
- RBAC and tenant isolation tests pass;
- publication/correction/retraction integration tests pass;
- backup monitoring and a timed restore drill pass;
- query/capacity tests meet budgets;
- PII retention/deletion and audit integrity are verified; and
- unresolved risks are documented with owners.
