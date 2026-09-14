# Advertising and Commercial Policy

**Last reviewed:** 2026-07-24

This policy applies the current first-party ad-platform and regulatory practice
review in
[advertising policy research](./research/07-advertising-policy-research.md).
Actual vendor contracts and operating jurisdictions control implementation.

## Principle

Revenue supports the newsroom but does not purchase editorial conclusions,
verification status, search ranking, corrections, or access to private reader
data. Readers can distinguish commercial material immediately.

The reference frontend may show labeled ad/sponsor placeholders. It does not
imply a live ad network, campaign, revenue, impression, click, or advertiser
portal.

## Launch scope

The launch path may prepare for:

- contextual/display inventory;
- newsletter sponsorship;
- manually approved direct campaigns;
- category or event sponsorship with strict separation; and
- disclosed affiliate links.

Google Ad Manager, takeovers, a self-service advertiser portal, premium
membership, sponsored research, data products, and other revenue models are
future capabilities requiring separate review. Do not activate every channel at
launch.

## Labels

Use conspicuous plain labels:

- `ADVERTISEMENT`
- `SPONSORED`
- `PAID PARTNERSHIP`

Labels appear before the commercial content, remain visible on mobile and in
shared/archived forms, and are not replaced by vague terms such as “partner
content.”

## Editorial independence

- Advertisers and sponsors do not approve independent editorial coverage.
- Commercial value is never treated as evidence or news importance.
- An Advertising Manager cannot publish or alter standard editorial content.
- Editors disclose and manage gifts, review units, travel, affiliate, and
  sponsor conflicts.
- Critical or unfavorable coverage is not removed because a subject advertises.
- Corrections follow evidence, not commercial requests.

## Placement rules

Never:

- disguise ads as navigation, editorial cards, system alerts, or download
  controls;
- place controls to induce accidental clicks;
- put more advertising than useful content;
- block reading with interstitials/popups;
- insert an ad between headline/byline and the factual lead;
- deceptively refresh or stack ads;
- monetize empty, error, thin, copied, retracted-body, or low-value pages;
- cover correction, consent, safety, or accessibility controls;
- cause material layout shift; or
- use autoplay audio.

Slots have named page positions, supported formats, reserved dimensions,
frequency rules, and content-safety exclusions. Articles remain complete and
readable when ads or consent are unavailable.

## Sensitive-content exclusions

Use conservative exclusions for deaths, disasters, active emergencies, crime
victims, minors, sexual misconduct, self-harm, graphic content, war/terrorism,
and other contexts where an ad would be exploitative or unsafe. Editorial
leaders can suppress ads without revenue approval.

Do not behaviorally target minors. Sensitive health, political, financial,
identity, precise-location, and inferred-trait targeting requires legal/privacy
review and is off by default.

## Consent and privacy

- Request storage/measurement/personalization only after the applicable consent
  state.
- Honor opt-out and Global Privacy Control where required by policy/law.
- Provide granular preferences and preserve consent evidence.
- Use contextual/non-personalized fallback where approved.
- Minimize event data; avoid article body, private search/query, exact location,
  identity, or sensitive inference in ad requests.
- Do not sell private reader data by default.
- Inventory every ad-tech subprocessor, cookie/storage key, purpose, retention,
  and data transfer.

Privacy/legal review must tailor requirements to operating regions before
launch.

## Creative and campaign approval

Every campaign records advertiser, legal entity, dates, budget, placement,
targeting, frequency cap, labels, destination, creative versions, rights,
policy review, and approvers.

Creative review covers:

- malware, scripts, file/MIME safety;
- deceptive UI, false claims, prohibited products, shock/graphic imagery;
- trademarks, copyright, likeness, and substantiation;
- landing-page TLS, redirects, domain consistency, privacy, and accessibility;
- political/issue-ad requirements;
- mobile dimensions, motion, audio, and performance; and
- conflict with article context.

All campaigns require manual approval. Material creative, targeting, URL, or
script changes require reapproval.

## Sponsored content

Sponsored articles use:

- a distinct content type and template;
- visible sponsor identity and paid label;
- accountable commercial/editorial byline;
- claim substantiation and rights review;
- no placement in Latest as ordinary editorial;
- no misleading `NewsArticle` representation;
- separate metrics and approval;
- correction/update handling; and
- a public sponsored-content policy.

A sponsor can review its factual brand/product information but cannot remove
required disclosure or impersonate independent reporting.

## Affiliate links

Disclose the relationship before or near the first affiliate link. Editorial
selection and conclusions remain independent. Link records include destination,
network, relationship, disclosure, validity, and redirect rules. Prices and
availability are timestamped and never guaranteed.

## Measurement and invalid traffic

Measure impressions, viewability, clicks, delivery, and revenue using minimal
data and documented definitions. Apply event IDs, server validation, rate/replay
controls, bot filtering, anomaly detection, and vendor reconciliation.

Never create, incentivize, simulate, or ask users/staff to generate ad clicks.
Do not refresh solely to inflate impressions. Demo metrics are labeled and
never sent to billing/reporting.

## Technical safeguards

- Allowlist ad vendors, frames, scripts, and destinations in reviewed CSP.
- Sandbox third-party frames and isolate them from editorial/session data.
- Load ads after essential content and within performance budgets.
- Reserve dimensions and enforce creative size/runtime limits.
- Provide global/vendor/campaign/slot kill switches.
- Verify `ads.txt` and `sellers.json` entries only for actual authorized
  relationships.
- Audit campaign/creative/status changes and commercial exports.

## Incidents

Immediately disable affected vendor/campaign/creative/slot for malware,
misdirection, unlabeled content, privacy leakage, invalid traffic, abusive
targeting, or severe layout/accessibility harm. Preserve redacted evidence,
notify security/privacy/editorial owners, assess affected readers, rotate
credentials where relevant, and do not re-enable before corrective review.

## Readiness gate

Before live ads:

- operating entity, vendor contracts, consent and privacy text are complete;
- roles and editorial separation are server-enforced;
- placements pass mobile, accessibility, performance, and accidental-click
  review;
- creative scan/approval and destination revalidation work;
- event/billing dedupe and invalid-traffic monitoring work;
- kill switches and incident path are tested;
- empty/error/sensitive-page suppression is tested; and
- public labels render in every format and shared/archive context.
