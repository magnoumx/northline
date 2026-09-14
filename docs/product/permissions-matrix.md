# Permissions Matrix

**Status:** Normative authorization model
**Last updated:** 2026-07-24

## 1. Rules

- Authorization is evaluated server-side on every read of restricted data and
  every mutation.
- The client never supplies a trusted role, permission, owner, approval, or
  risk level.
- Permissions are deny-by-default and scoped by organization, desk, object,
  ownership, state, and field.
- Role names are bundles; permission strings are the enforcement unit.
- High-impact actions require recent authentication and an immutable audit
  event.
- Sensitive approval is version-specific. Material edits invalidate it.
- No service account or AI agent receives interactive human role bundles.

## 2. Permission key

| Symbol | Meaning |
| --- | --- |
| `O` | Own/assigned objects only |
| `S` | Objects in assigned section or desk |
| `A` | Any editorial object in the organization |
| `R` | Read only |
| `—` | Not granted |

## 3. Role bundles

| Role | Create/edit | Review/approve | Publish/correct | Manage |
| --- | --- | --- | --- | --- |
| Owner | `A` | `A` | `A` | Organization, billing, users, settings |
| Administrator | `A` | `A` | `A` | Users, roles, settings, integrations |
| Editor-in-Chief | `A` | `A`, including sensitive | `A`, retract | Editorial policy and homepage |
| Managing Editor | `A` | `A`, including sensitive when delegated | `A`, correct | Schedule, assignments, homepage |
| News Editor | `A` | General news; sensitive when delegated | Publish/correct assigned desks | Trends, sources, live coverage |
| Section Editor | `S` | Section; sensitive when delegated | Section publish/correct | Section assignments and curation |
| Writer | `O` | — | — | Own drafts/research notes |
| Fact Checker | Claim/review records | Fact review | — | Claim statuses with evidence |
| Copy Editor | Copy fields in review | Copy review | — | Headline suggestions |
| SEO Editor | SEO fields | SEO review | — | Redirect/internal-link proposals |
| Media Editor | Media fields/usages | Media approval | — | Assets, licenses, expiry |
| Legal Reviewer | Risk/review notes | Legal/sensitive review | — | Legal holds |
| Advertising Manager | Sponsored/commercial objects | Campaign approval | Sponsored activation only | Ads, advertisers, campaigns |
| Analyst | — | — | — | Aggregated analytics read |
| Developer | — | — | — | Operational diagnostics; no content authority |

Owner and Administrator access to editorial actions is an operational
capability, not routine workflow. Production policy should assign Editor-in-Chief
or Managing Editor approval explicitly rather than relying on platform
ownership.

## 4. Granular permission matrix

### Editorial objects

| Permission | Owner/Admin | EIC | Managing | News | Section | Writer | Fact | Copy | SEO | Media | Legal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `article.create` | A | A | A | A | S | O | — | — | — | — | — |
| `article.read.unpublished` | A | A | A | A | S | O | A | A | A | A | A |
| `article.edit.own` | A | A | A | A | S | O | — | — | — | — | — |
| `article.edit.any` | A | A | A | A | S | — | — | — | — | — | — |
| `article.edit.copy` | A | A | A | A | S | O | — | A | — | — | — |
| `article.edit.seo` | A | A | A | A | S | — | — | — | A | — | — |
| `article.approve` | A | A | A | A | S | — | — | — | — | — | — |
| `article.approve.sensitive` | A | A | delegated | delegated | delegated | — | — | — | — | — | R |
| `article.schedule` | A | A | A | A | S | — | — | — | — | — | — |
| `article.publish` | A | A | A | A | S | — | — | — | — | — | — |
| `article.correct` | A | A | A | A | S | — | — | — | — | — | — |
| `article.retract` | A | A | delegated | — | — | — | — | — | — | — | R |
| `homepage.curate` | A | A | A | A | S | — | — | — | — | — | — |
| `live.manage` | A | A | A | A | S | O | — | — | — | — | — |

### Evidence and specialist reviews

| Permission | EIC/Managing | News/Section | Writer | Fact | Copy | SEO | Media | Legal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `trend.manage` | A | A/S | — | — | — | — | — | — |
| `research.create` | A | A/S | O | O | — | — | — | — |
| `claim.create` | A | A/S | O | A | — | — | — | — |
| `claim.verify` | A | A/S | — | A | — | — | — | R |
| `source.manage` | A | A/S | propose | R | — | — | R | R |
| `review.fact.complete` | A | A/S | — | A | — | — | — | — |
| `review.copy.complete` | A | A/S | — | — | A | — | — | — |
| `review.seo.complete` | A | A/S | — | — | — | A | — | — |
| `review.media.complete` | A | A/S | — | — | — | — | A | — |
| `review.legal.complete` | delegated | delegated | — | — | — | — | — | A |
| `media.upload` | A | A/S | O | — | — | — | A | — |
| `media.approve` | A | A/S | — | — | — | — | A | — |
| `risk.raise` | A | A/S | O | A | A | A | A | A |
| `risk.lower` | A | A/S | — | — | — | — | — | A with reason |

Any authenticated newsroom user may raise risk. Lowering risk requires an
authorized editor or Legal Reviewer, evidence, and an audit reason. AI can only
recommend raising risk.

### Platform, commercial, and operations

| Permission | Owner | Admin | EIC | Managing | Ad Manager | Analyst | Developer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `user.manage` | A | A | — | — | — | — | — |
| `role.manage` | A | A | — | — | — | — | — |
| `settings.manage` | A | A | editorial subset | editorial subset | commercial subset | — | technical subset |
| `connector.manage` | A | A | R | R | — | — | A |
| `job.retry` | A | A | publication jobs | publication jobs | commercial jobs | — | non-editorial or approved |
| `audit.view` | A | A | A | A | commercial scope | aggregated | security/ops scope |
| `audit.export` | A | A | delegated | — | — | — | delegated |
| `analytics.view` | A | A | A | A | commercial | aggregated | operational |
| `ad.manage` | A | A | policy read | policy read | A | R | diagnostics |
| `sponsored.approve` | A | A | editorial policy | delegated | commercial approval | — | — |
| `feature_flag.manage` | A | A | — | — | — | — | A |
| `secret.manage` | A | A | — | — | — | — | delegated |

The Advertising Manager cannot approve editorial truth claims or publish
standard editorial articles. Editorial leaders cannot silently convert
sponsored material into editorial content.

## 5. Service and AI principals

| Principal | Allowed | Explicitly denied |
| --- | --- | --- |
| Trend Scout | Read connector signals; propose clusters/scores | Draft, approve, publish |
| Research Agent | Read approved source fetch results; write dossier proposal | Unrestricted URL fetch, publish |
| Claim Analyst | Read dossier; propose claims/evidence links | Change source snapshots, approve |
| Editorial Planner | Read verified dossier; propose format/outline | Add facts, publish |
| Drafting Agent | Read approved packet; write draft proposal | Browse, approve, publish |
| Fact Checker Agent | Read draft and evidence independently; propose findings | Rewrite evidence, approve |
| Copy/SEO/Media/Risk agents | Propose bounded specialist changes/findings | Final approval, policy override |
| Publisher service | Evaluate deterministic gates; publish approved hash | Generate content, waive gates |
| Connector worker | Fetch allowlisted endpoint through egress broker | Read user data, mutate articles |
| Distribution worker | Read published version; update a named channel idempotently | Edit article body |

Agents use short-lived, task-scoped credentials. A prompt is never a permission
grant.

## 6. Separation-of-duty rules

1. The author cannot be the sole final approver of sensitive coverage.
2. The Drafting Agent cannot act as the Fact-Checking Agent for the same
   version/execution context.
3. Media usage cannot publish without a rights decision.
4. A Legal Reviewer can hold or clear legal review but cannot publish unless
   separately assigned an editorial role.
5. A Developer can inspect jobs and logs but cannot change article state.
6. An Advertising Manager can activate approved inventory but cannot change
   editorial ranking or conclusions.
7. Role or permission changes cannot approve an already-open action; the action
   reloads authorization.
8. Emergency override requires two people where feasible, never bypasses
   central-claim or rights blocks, and receives retrospective review.

## 7. Object and field constraints

- Ownership is derived from the database, not request parameters.
- Section-scoped access checks the object's canonical section.
- Published body fields are immutable; edits create a new version.
- Review completion stores the reviewed content hash.
- Schedule changes after approval revalidate embargo and permission.
- Source snapshots and audit records are append-only for application users.
- PII, legal notes, unpublished sources, and private media have distinct read
  permissions and must not leak through search, exports, or analytics.
- Bulk actions have lower limits and stronger confirmation than single-object
  actions.

## 8. Authentication and session requirements

- Production newsroom access requires a verified identity and membership.
- Optional Sign in with ChatGPT/workspace identity establishes identity only;
  it does not grant a newsroom role without server-side membership mapping.
- MFA is required for privileged roles when the identity provider supports it.
- Sessions rotate after sign-in, privilege change, and sensitive actions.
- Reauthentication is required for role changes, secret access, retractions,
  and mass publication/scheduling.
- Deprovisioning revokes sessions and service tokens promptly.

## 9. Audit requirements

Audit events include actor and effective roles, tenant, object, action, decision,
before/after references, reason, policy version, IP/device metadata where
lawful, request/job ID, and UTC timestamp. Secrets, full prompt inputs, source
paywall content, and unnecessary reader PII are redacted.

Alert on:

- repeated denials or object enumeration;
- privilege changes;
- sensitive approvals;
- retractions and legal holds;
- bulk exports;
- secret access;
- publisher gate failures;
- disabled security controls; and
- audit pipeline failures.

## 10. Verification

Authorization tests must cover direct object references, cross-section access,
role tampering, stale sessions, approval invalidation, API and server action
paths, bulk operations, search/export leakage, and service-principal scope. See
[SECURITY_TESTING.md](../SECURITY_TESTING.md).
