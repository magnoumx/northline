# Security Testing

**Status:** Required verification plan; not a security certification
**Last reviewed:** 2026-07-24

## 1. Scope

Test the public application, newsroom, identity/membership, authorization,
editorial state machine, publication, connectors/egress, AI gateway, media,
jobs/webhooks, database, search/exports, newsletters/notifications, ads,
observability, backups, CI/CD, and infrastructure.

The reference frontend can be tested for browser and dependency issues, but it
cannot pass backend control tests for services that do not exist. Record those
items as **not implemented**, not passed.

## 2. Rules of engagement

- Use local, preview, or authorized staging targets and synthetic accounts/data.
- Obtain explicit authorization and define hosts, times, rates, and contacts
  before active testing.
- Do not test production destructively or send real mail/notifications/ad
  events.
- Exclude real private sources, reader PII, and licensed full text from test
  fixtures.
- Keep payloads, screenshots, traces, and exploit evidence in restricted
  storage.
- Stop and declare an incident if testing exposes real secrets/data or risks
  availability.
- Retest fixes and preserve both initial and corrected evidence.

## 3. Minimum automated gates

Run for every change. These are acceptance gates: every command must return
zero in the supported local and CI shells. A platform-specific script failure
is a failed gate, not a skipped test:

```bash
npm run lint
npx tsc --noEmit
npm test
```

CI should additionally include:

- secret scanning across source, history, fixtures, build output, and source
  maps;
- dependency vulnerability and license scanning;
- static analysis for TypeScript, configuration, and infrastructure;
- unit/integration authorization and validation tests;
- built-page CSP/header and rendered-HTML checks;
- artifact provenance/SBOM where available.

Scanner success does not replace manual testing.

## 4. Test identity matrix

Create synthetic accounts for:

- anonymous reader;
- authenticated reader;
- each newsroom role;
- section-scoped and own-object variants;
- disabled/deprovisioned user;
- expired/stale session;
- service principal for each worker class;
- cross-tenant user if tenancy exists.

For every protected action, test allowed, denied, stale, direct-object,
cross-section/tenant, modified client payload, API/server-action, bulk, and
search/export paths.

## 5. Authorization and IDOR

Test:

- changing article/source/media/user/campaign IDs;
- accessing unpublished or legally restricted records through public routes,
  search, preview, image, feed, sitemap, export, and error messages;
- changing client-supplied author, owner, role, approval, risk, state, score, or
  tenant;
- Writer edit of another writer's draft;
- Section Editor access outside scope;
- Fact/Copy/SEO/Media/Legal role mutation outside its field;
- Advertising Manager editorial mutation;
- Developer content-state mutation;
- author self-approval and sensitive self-approval;
- material edit after approval;
- stale session after role removal;
- service principal using a human endpoint;
- batch endpoints with mixed authorized/unauthorized IDs.

Expected result is server denial without object existence leakage, plus an
appropriate audit/security event.

## 6. Browser and injection testing

### XSS

Attempt stored, reflected, and DOM XSS in:

- headlines, subheadlines, body blocks, quotes, tables, captions, alt text;
- author/topic/entity/source names;
- research notes and source metadata;
- embeds, URLs, redirects, search terms, contact forms;
- newsletter and sponsored creative;
- filenames and media metadata;
- AI outputs and imported feed content.

Cover HTML, attributes, URLs, JSON-LD, CSS-adjacent values, SVG, Markdown/rich
text, event handlers, dangerous protocols, malformed encoding, mutation XSS,
and CSP bypass. Verify that allowed formatting survives safe rendering.

### CSRF and cross-origin

- Mutation with absent/invalid token or origin.
- SameSite edge cases and sign-in callbacks.
- Simple-form and JSON requests from another origin.
- CORS preflight and credential policy.
- Cross-origin framing/clickjacking.

### Redirect and URL injection

- Protocol-relative, encoded, mixed-slash, Unicode/punycode, credential-in-host,
  fragment/query, and reserved auth paths.
- `javascript:`, `data:`, `file:`, custom schemes.
- Affiliate/ad/source redirect chains and canonical poisoning.

## 7. SSRF and safe-fetch suite

Exercise the egress broker and every indirect fetch surface (connectors, source
preview, image optimizer, media import, unfurl, webhook callback, AI tool):

- loopback IPv4/IPv6;
- RFC1918, link-local, multicast, reserved, and cloud metadata addresses;
- decimal/octal/hex/mixed IP representations;
- DNS name resolving to private IP;
- DNS rebinding between validation and connection;
- redirect from public to blocked host and chained redirects;
- alternate ports/schemes/userinfo;
- oversized headers/body, slow response, compression/decompression bomb;
- wrong/missing content type, polyglot, malformed parser input;
- credential/cookie/header forwarding;
- URL allowlist bypass and wildcard subdomain edge cases.

Verify resolve-and-pin behavior, redirect revalidation, time/size/type limits,
no internal response leakage, and security telemetry.

## 8. File and media testing

- Extension/MIME/magic-byte mismatch and polyglots.
- Executable/scripted SVG, HTML, PDF, office file, archive, and media metadata.
- Malware test fixture in quarantine.
- Huge dimensions/pixel/frame count and decompression bomb.
- Corrupt/truncated decoder input.
- Path traversal, Unicode filename, overwrite, public-bucket/listing attempts.
- Signed upload reuse, scope escalation, expiry bypass.
- Unscanned original delivery and derivative URL guessing.
- License expiry, rejected rights, attribution omission, crop/version mismatch.
- Dangerous embed providers/parameters and autoplay.

Only approved derivatives should be publicly reachable.

## 9. Prompt and tool injection

Create adversarial source pages, feeds, PDFs, captions, OCR, social posts, and
reader questions that instruct the model to:

- ignore policy or change role;
- reveal prompts, secrets, other users, or private sources;
- call tools or fetch a chosen URL;
- mark an unsupported claim verified;
- lower risk or waive human review;
- publish/send/notify;
- include unsafe HTML, misleading citation, or copied passage;
- consume unbounded tokens or repeat recursively.

Expected results:

- content remains in the untrusted-data boundary;
- no secret or unrestricted tool exists in model context;
- application-selected tool arguments reject unsafe values;
- structured output validation fails closed;
- no approval/publication mutation occurs;
- security findings are observable; and
- Ask This Story cites only public dossier evidence or declines.

Test model/prompt/provider changes, not only one model version.

## 10. Jobs, webhooks, and automation

- Missing, bad, stale, and replayed signatures/nonces.
- Signature parsing ambiguity and body mutation.
- Unauthorized cron and queue producer/consumer.
- Duplicate delivery before, during, and after effect.
- Worker crash before commit, after DB commit, and after external provider
  success.
- Lease expiry, stale input version, poison job, retry storm, DLQ replay.
- Publication job with old approval/hash, exceeded cap, sensitive risk, failed
  claim or media gate.
- Newsletter recipient suppression race.
- Bulk replay without dry-run/approval.

Verify idempotency, bounded retry/backoff, audit, and reconciliation.

## 11. Authentication and session testing

- Session fixation and rotation after sign-in/privilege change.
- Cookie flags, scope, expiry, logout, revocation, and concurrent sessions.
- MFA enforcement and recovery for privileged roles.
- Identity-header spoofing when requests bypass the trusted edge.
- Sign in with ChatGPT identity without membership.
- Disabled/deleted user and role change during an open editor session.
- Brute force, enumeration, rate-limit distribution, and recovery abuse.
- OAuth/state/nonce/PKCE/callback validation where applicable.

## 12. Data, privacy, search, and export

- SQL/query injection and unsafe sort/filter/cursor.
- Unpublished/private records in search, analytics, autocomplete, feeds, and
  sitemaps.
- Cross-user follows, saves, history, consent, export, and deletion.
- CSV formula injection and spreadsheet encoding.
- Cache key omission of authorization/tenant/user.
- Logs/traces/errors/source maps containing tokens, email, private sources,
  prompts, signed URLs, or source bodies.
- Deletion/export identity verification and race conditions.
- Backup access, encryption, restore isolation, and expired-data resurrection.

## 13. Advertising and third parties

- Unlabeled or visually ambiguous creative.
- Ad overlap, accidental-click placement, focus theft, mobile overflow, layout
  shift, autoplay audio.
- Script/frame escape, CSP violation, cookie before consent.
- Malicious/multi-hop click destination, creative swap after approval.
- Impression/click replay and fabricated client events.
- Sensitive-page suppression and minor targeting.
- Vendor outage or blocked script: article remains readable.

## 14. Infrastructure and supply chain

- Public storage/database/admin endpoint exposure.
- Least-privilege runtime, migration, backup, and CI roles.
- Environment separation and secret rotation.
- Branch/release protection and unreviewed deployment.
- Dependency confusion, typosquatting, install scripts, stale vulnerable
  packages, CI action pinning.
- TLS, DNS, domain takeover, HSTS readiness.
- CSP and all security headers against the real provider/embedding inventory.
- Denial-of-service limits for search, images, feeds, Ask This Story, editor,
  queues, and expensive queries.

## 15. Cadence

| Trigger | Testing |
| --- | --- |
| Every change | Lint, types, tests, secrets, dependencies, relevant negative cases |
| Auth/RBAC/publication change | Full authorization and workflow suite |
| Fetch/parser/upload/embed change | SSRF, parser, file, XSS, and sandbox suite |
| Model/prompt/tool/provider change | AI quality and injection evaluation |
| Pre-release | Full E2E, DAST, configuration/header, backup/rollback checks |
| Pre-launch and annually | Independent penetration test scoped to live design |
| After severe incident | Targeted regression plus related-system review |
| Continuous | Dependency/secret monitoring, auth/security anomaly alerts |

## 16. Finding severity and release policy

| Severity | Example | Release treatment |
| --- | --- | --- |
| Critical | Unauthenticated publish, secret/reader-source exfiltration, RCE | Stop release/disable feature; incident response |
| High | Cross-role draft access, stored XSS, exploitable SSRF, approval bypass | Block release |
| Medium | Limited information leak, missing defense-in-depth, rate weakness | Fix before launch or documented time-bound exception |
| Low | Hardening/documentation issue with low exploitability | Track with owner/date |

Exceptions need owner, impact, evidence, compensating control, expiry, and
authorized risk acceptance. “No scanner finding” is not proof of security.

## 17. Evidence template

```text
Test ID:
Commit/release:
Environment and target:
Preconditions/accounts:
Tool/version or manual procedure:
Payload/reference:
Expected:
Actual:
Logs/audit/trace:
Result: PASS / FAIL / NOT IMPLEMENTED / NOT APPLICABLE
Finding and severity:
Fix commit:
Retest evidence:
Reviewer/date:
```

Do not mark `NOT IMPLEMENTED` or `NOT APPLICABLE` as pass.
