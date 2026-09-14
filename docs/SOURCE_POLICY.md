# Source and Evidence Policy

**Last reviewed:** 2026-07-24

## Purpose

Sources are evidence and context, not raw material for article rewriting. We
record provenance, evaluate independence, and link meaningful claims to support.
Trend strength or repetition across copied stories is not confirmation.

## Source tiers

| Tier | Typical examples | Use |
| --- | --- | --- |
| 1 | Court/regulatory records, official data, filings, direct official statements, direct interviews, original documents | Preferred primary evidence; still interpret carefully |
| 2 | Established professional newsrooms and qualified specialist publications | Strong reporting and independent confirmation |
| 3 | Credible local outlets and reputable trade publications | Valuable local/specialist evidence; assess access and track record |
| 4 | Unverified blogs, aggregators, reposts, anonymous/social accounts | Discovery only unless independently verified |

Tier is a workflow aid, not a guarantee. A primary source can be self-interested
or wrong; an official statement proves that the speaker made the statement, not
necessarily that every claim in it is true.

## Source record

Each source records:

- name, domain, publisher, type, country, and ownership;
- primary-source status and credibility tier;
- citation and attribution requirements;
- licensing, permitted use, caching, and retention;
- relevant reliability notes and corrections history;
- licensed third-party rating provenance where applicable; and
- reviewer and last-reviewed date.

Credential values live in the secret manager, not source records.

## Evidence standard

For important claims:

1. seek the most direct obtainable primary evidence;
2. seek independent credible confirmation when reasonably available;
3. trace reporting to the earliest credible source rather than citing a chain
   of rewrites;
4. inspect dates, jurisdiction, methodology, sample, definitions, and
   limitations;
5. record support and contradiction at claim level; and
6. state what remains unknown.

Two outlets repeating one wire report, press release, or social post count as
one underlying source.

## Primary documents and data

Link directly where lawful and safe. Identify issuer, date, version, scope, and
relevant limitations. For datasets and studies, inspect methodology and
distinguish correlation, causation, preliminary results, preprints, and peer
review.

Do not infer a court ruling from a party's press release when the order is
available. Do not treat a company announcement as independent product
validation.

## Social and user-generated content

A viral post is a lead, not proof. Before using it:

- verify account and original provenance;
- locate the earliest/original material;
- confirm time and location;
- check manipulation, editing, old/recycled context, and impersonation;
- seek direct or independent confirmation;
- assess privacy, safety, and permission; and
- embed rather than rehost when platform terms and editorial value allow.

Engagement counts can be manipulated and must be described with a time/source
and appropriate uncertainty.

## Anonymous and confidential sources

Use only when information is important, the source has direct access, public
identification presents a substantial reason for protection, and the
information cannot reasonably be obtained on the record. An authorized editor
must know identity, assess motive, corroborate, approve wording, and protect
access. Explain anonymity to readers as specifically as safety permits.

AI systems and general newsroom search must not receive confidential-source
identity unless explicitly approved and technically isolated.

## Leaks and private information

Possession does not establish permission or public interest. Escalate leaked,
hacked, personal, medical, sexual, financial, location, identity, or
authentication data to editorial and legal/security review. Minimize,
authenticate, redact, and avoid links that facilitate harm.

Never solicit or retain credentials, malware, intimate imagery, or unnecessary
personal data.

## Quotations and attribution

- Verify quotation text/audio and material context.
- Attribute close to the quotation or claim.
- Use the minimum copyrighted excerpt needed for the editorial purpose.
- Do not stitch fragments into a misleading meaning.
- Distinguish translated/paraphrased text from a direct quote.
- Link to the original when permitted and useful.
- Do not reproduce paywalled or licensed articles as a substitute for access.

## Source comparisons

Source Comparison may show differences in verified focus, terminology,
included facts, timing, or acknowledged uncertainty. It must not:

- infer political intent from wording alone;
- declare a side correct based on an automated ideology label;
- treat volume as truth;
- imply independent confirmation where outlets share one source; or
- display licensed ratings without current rights and attribution.

## Connector approval

Before enabling a connector, document:

- provider and connector type;
- credential owner and environment;
- contractual/permitted use;
- attribution;
- rate limits and caching/retention;
- markets and categories;
- robots/terms/API policy as applicable;
- data classification and subprocessors;
- failure/circuit behavior;
- security review; and
- renewal/review owner.

Prohibited scraping, paywall circumvention, credential sharing, and restriction
evasion are not permitted.

## Snapshots

Create immutable source snapshots only where lawful. Store checksum, retrieval
time, canonical URL, source/publisher, content type, published/modified time,
parser version, and permission/retention decision. If full storage is not
permitted, retain only allowed metadata, locator, checksum, and excerpt.

Snapshots are restricted research records and are not automatically public.

## Conflicts and stale evidence

When credible evidence conflicts:

- preserve both records;
- identify exactly what differs;
- check time, definitions, versions, and source independence;
- avoid forced resolution;
- label the claim `CONFLICTING_REPORTS` where appropriate;
- seek primary/updated evidence; and
- update the published explanation when facts resolve.

Evidence can become `OUTDATED` without having been false at publication.

## Corrections and source review

If a source retracts or materially corrects information, alert every dependent
central claim and published article. Editors reassess promptly under
[CORRECTIONS_POLICY.md](./CORRECTIONS_POLICY.md). Repeated material reliability
issues trigger source-tier/review changes with documented reasons.

## Public transparency

Before launch, the site must name its publisher and offer a monitored channel
for source or factual concerns. We explain meaningful limitations without
exposing confidential sources, licensed content, or security controls.
