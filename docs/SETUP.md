# Local Setup

This repository currently supports a production-shaped frontend/reference
implementation. Local setup does not start a live trend-ingestion service, AI
pipeline, queue, email service, ad server, or production newsroom database.

## Prerequisites

- Node.js `>=22.13.0`
- npm compatible with the checked-in lockfile
- Git
- A current browser

Optional future/backend work may also require PostgreSQL, a Redis-compatible
service, S3/R2 storage, and provider sandbox credentials. Do not add those
services merely to run the reference frontend.

## Install and run

From the repository root:

```bash
npm ci
npm run dev
```

The development command uses vinext and the Cloudflare Vite plugin. Use the URL
printed by the process.

Run validation:

```bash
npm run lint
npx tsc --noEmit
npm test
```

`npm test` includes a production build in the current package scripts. For a
build without the test runner:

```bash
npm run build
```

## Windows note

If a package script containing POSIX-style inline environment assignment fails
under the selected npm shell, it is a cross-platform script defect that must be
fixed before release. For temporary local diagnosis, set the value in
PowerShell before invoking the underlying command:

```powershell
$env:WRANGLER_LOG_PATH = ".wrangler/wrangler.log"
npx vinext dev
```

The corresponding temporary build/test sequence is:

```powershell
$env:WRANGLER_LOG_PATH = ".wrangler/wrangler.log"
npx vinext build
node --test tests/rendered-html.test.mjs
```

This only mirrors the baseline `npm test` script. Use the project's complete
test command after it is updated to include additional suites. Prefer
cross-platform package scripts for team and CI use rather than relying on
individual shell configuration.

## Configuration

`.openai/hosting.json` declares optional Sites resource binding names. A value
of `null` means the binding is not configured. Do not invent resource IDs or
assume persistence from a binding name.

The repository must include the required, non-secret `.env.example`, grouped by
application, database, authentication, Redis/queue, object storage, AI, trend
and news providers, YouTube, search, email/newsletter, analytics/advertising,
consent, monitoring/security, cron, and feature flags. If it is missing, treat
setup and the production milestone as incomplete; do not infer variable names
or values.

Create a local ignored file and fill only the values needed for the feature
under development:

```bash
cp .env.example .env.local
```

On PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Rules:

- Keep `.env.example` versioned with an explicit `.gitignore` exception.
- Never commit `.env.local`, API keys, connection strings, signed URLs, or
  provider tokens.
- Use fictional fixtures in local and preview environments.
- Keep production and sandbox provider credentials separate.
- Treat any browser-exposed variable as public.
- Production startup must fail clearly when a required production variable or
  binding is missing; the reference frontend may not require those variables.

## Data

The repository now has a D1-compatible Drizzle schema and seven ordered
migrations for the V3 candidate. Cloudflare D1 is the current release target;
see [DATABASE.md](./DATABASE.md). This local
schema does not prove that remote migrations, backups, restore, capacity, or
production content have been verified.

- use an isolated D1 store for development and preview;
- never run demo seeds against a production target;
- do not call fixture content persistent or production-ready;
- do not put real reader, source, or editorial data into fixtures; and
- back up and reconcile the exact remote target before any approved migration.

After intentional Drizzle schema changes, migration generation is:

```bash
npm run db:generate
```

Generation is not application or production of a migration. Review the output
and follow the environment-specific migration procedure.

## Optional Sites identity

The template includes helpers for Sites/Sign in with ChatGPT identity headers.
Identity alone does not establish newsroom membership or role. Protected
production routes must map the verified subject to server-side membership and
permissions. Public reading should remain anonymous-compatible.

## Demo-content rules

- Mark all demo content clearly.
- Use fictional organizations, teams, products, and events.
- Do not invent current breaking news.
- Do not fabricate scandals, crimes, health events, or allegations involving
  real people.
- Use safe placeholder, licensed, or original media.
- Demonstrate uncertainty, corrections, developing stories, and source
  provenance honestly.

## Common problems

| Symptom | Check |
| --- | --- |
| Unsupported engine | Confirm `node --version` is at least 22.13.0 |
| Lockfile mismatch | Use `npm ci`; do not delete the lockfile casually |
| Worker/binding error | Inspect `.openai/hosting.json`; optional D1/R2 may be null |
| Missing identity header locally | Expected unless running behind the Sites identity layer |
| Stale generated output | Stop the dev server, remove only known generated build output, then rebuild |
| Production feature shows demo data | Keep the feature labeled as demo/contracted; do not supply real data as a shortcut |

## Before opening a change

1. Read the relevant product and architecture documents.
2. Identify whether the capability is demonstrated, contracted, or
   production-ready.
3. Keep fixtures fictional and deterministic.
4. Add tests for behavior and negative/security cases.
5. Run lint, type checking, tests, and build.
6. Review the diff for secrets, unlicensed content, unsupported claims, and
   unrelated changes.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for release procedure.
