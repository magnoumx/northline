# Deployment

This procedure distinguishes deployment of the reference site from production
readiness of the newsroom platform.

## 1. Reference site on Sites

Because this repository contains `.openai/hosting.json`, use the Sites control
plane for site creation, saved versions, runtime environment values, access
policy, and deployment.

### Preflight

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
git status --short
```

Also verify:

- demo content is clearly fictional;
- no secret exists in source or build output;
- `.openai/hosting.json` has been read exactly as stored;
- routes and policy links work;
- reference features do not claim live providers or autonomous publication;
- the commit to deploy is the reviewed source state.

### Site and source rules

1. If `.openai/hosting.json` already contains a `project_id`, reuse it exactly.
2. If it has no `project_id`, create the site once through Sites and persist the
   returned ID unchanged.
3. Obtain a short-lived source repository credential through Sites and use it
   only for the required push. Never print or store the token.
4. Push the exact source state.
5. Build/archive from that same state when an archive is required.
6. Save a site version using the exact pushed commit SHA.
7. Deploy only the saved version.

Every returned deployment URL is a production URL. If the site is verified
owner-only, use the private deployment path. If it is shared, public, or access
cannot be verified, obtain explicit user approval before the open deployment
path.

### Environment values

Store runtime values through Sites, not in `.openai/hosting.json`. Mark secrets
as secrets. Changing environment values creates a new environment revision and
requires deployment of a saved version to take effect.

The reference frontend should normally need no live news, AI, email, ad, or
reader-data secrets.

### Newsletter delivery

Preview and development environments can leave `EMAIL_PROVIDER` empty. In that
mode the signup response is explicitly labeled as a demo and includes a local
confirmation link; no email is claimed or sent.

Before setting `APP_ENV=production`, configure:

- an HTTPS `NEXT_PUBLIC_SITE_URL`;
- `RATE_LIMIT_SECRET` with at least 32 random characters;
- `EMAIL_PROVIDER=resend`;
- secret `EMAIL_API_KEY`; and
- a verified `EMAIL_FROM_ADDRESS`.

Production fails closed when any of those delivery controls are absent. Signup
attempts are limited in D1 by keyed hashes of the client address and normalized
email; raw client addresses are not stored. Apply the newsletter migration
before enabling the form, and schedule removal of expired rate-limit rows if
traffic no longer reaches the signup endpoint regularly.

### Container status

No Dockerfile or development Compose stack is part of the baseline reference
repository. Sites/vinext is the implemented deployment path. If later
production APIs/workers require containers, add the reviewed artifacts and
security/capacity tests described in
[architecture/deployment.md](./architecture/deployment.md) before advertising
Docker support.

### Post-deploy smoke test

- Home and representative public routes return 200.
- Article text is present in rendered HTML.
- Mobile navigation and keyboard focus work.
- Story Intelligence, article, Latest, Trending, newsletter, and policy
  experiences render.
- A missing route returns HTTP 404 and an intentionally removed fixture returns
  HTTP 410; friendly copy with HTTP 200 fails the check.
- Demo labels and media credits are visible.
- No browser/network error reveals a secret or internal stack.
- Security headers and CSP are reviewed for the deployed integration set.
- The deployed screenshot and source commit match the approved release.

## 2. Production newsroom prerequisites

A reference deployment must not be promoted conceptually to a live newsroom
until these are connected and accepted:

- production identity, MFA where supported, membership, and server-side RBAC;
- normalized system-of-record database and reviewed migrations;
- durable queue, cache, object storage, search, and restricted egress;
- approved source/trend, AI, email, analytics, consent, and advertising vendor
  contracts;
- immutable publication, corrections, media rights, and audit behavior;
- monitoring, alerts, on-call ownership, backup/restore, and rollback;
- security, accessibility, performance, editorial, SEO, and legal/media
  evidence;
- public operating-entity, ownership/funding, contact, privacy, terms, and
  policy details.

See [acceptance-criteria.md](./product/acceptance-criteria.md) and
[LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

## 3. Environment promotion

| Stage | Gate |
| --- | --- |
| Preview | Build/test, fictional data, authenticated review |
| Staging | Production-shaped dependencies, migrations, full workflow and security tests |
| Production canary | Approved artifact, backups, rollback, on-call, risky features off |
| Production general | Post-deploy health and error budget acceptable |
| Feature enablement | Separate flag/policy approval and observability |

Never reuse production data or credentials in preview. Staging source/provider
accounts must be licensed for their use.

## 4. Release record

Record:

```text
Release ID and commit
Saved Sites version and deployment ID
Environment revision
Database migration version
Feature/policy/prompt/model versions
Approvers
Preflight evidence
Deploy start/end
Smoke-test evidence
Known risks
Rollback artifact
```

## 5. Migrations

1. Review migration SQL and expected locks/data volume.
2. Verify a recent restorable backup for high-risk changes.
3. Use expand/migrate/contract.
4. Apply with the migration role and lock.
5. Verify schema/readiness before traffic increase.
6. Run backfills as observable idempotent jobs.
7. Delay destructive contraction until the compatibility window closes.

Do not treat D1/SQLite and PostgreSQL migration output as interchangeable.

## 6. Rollback

### Application or configuration

1. Stop the rollout or disable the affected feature/provider.
2. Route to the prior schema-compatible saved version.
3. Verify article reads, newsroom authorization, queues, and publication.
4. Reconcile distribution effects from the incident window.

### Content

Never erase an incorrect story by deploying old code. Use the correction or
retraction workflow, preserving the published record.

### Database

Prefer a forward repair. Restore only under the Incident Commander's decision
after measuring data loss and downstream consistency impact. Follow
[BACKUP_AND_RESTORE.md](./BACKUP_AND_RESTORE.md).

## 7. Production health check

Public liveness should reveal little. Protected operator health should show:

- release and compatible schema;
- database, cache, queue, storage, and search;
- oldest job and dead-letter age;
- connector freshness/circuit state;
- AI/email/notification availability and budget state;
- publication/distribution lag;
- audit/logging health; and
- active kill switches.

## 8. Deployment ownership

- Engineering release owner controls the artifact and rollout.
- Database owner controls migrations.
- Security owner controls secrets and critical security gates.
- Editorial owner controls editorial policy/mode and content operations.
- The user/site owner controls Sites access and open-world deployment approval.
- Limited auto-publication requires a separate cross-functional approval; it is
  not enabled by deploying the site.

Detailed topology is in
[architecture/deployment.md](./architecture/deployment.md).
