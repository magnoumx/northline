# Security policy

Northline is a reference implementation, not a claim of complete security.

## Reporting

Do not open a public issue containing an exploit, secret, personal data, or a
vulnerable source URL. Use the private security contact configured by the
operating organization. The example addresses in the demo UI do not receive
mail.

## High-risk areas

- Server-side role and ownership checks
- SSRF and DNS-rebinding controls in source connectors
- HTML, embed, and uploaded-media sanitization
- Prompt and tool injection from retrieved content
- Webhook replay, cron authentication, and job idempotency
- Published-version immutability and audit-log integrity
- Secret redaction and least-privilege provider credentials

## Supported milestone

The checked-in release includes a protected newsroom identity gate, explicit
role mapping, security headers, input validation, D1 prepared-query access
through Drizzle, and deterministic editorial policy gates. Live connectors,
uploads, webhooks, and autonomous publishing are not active and therefore are
not represented as penetration-tested production capabilities.

See [Security testing](docs/SECURITY_TESTING.md), the
[security model](docs/architecture/security-model.md), and
[incident response](docs/INCIDENT_RESPONSE.md).
