# Copyright and media policy research

**Research date:** 2026-07-24
**Status:** Operational research for a US news product, not legal advice. Copyright, contract, trademark, privacy, publicity, defamation, right-of-access, and platform rules can overlap. Qualified counsel must approve the policy, licenses, and disputed uses.

## Core rule

**A link is not a license. Attribution is not a license. Public availability is not a license.**

The platform may report facts in its own words, quote only when justified, and publish media only under a documented permission, license, public-domain basis, platform embed right, or counsel-approved legal rationale.

The US Copyright Office states that copyright does not protect facts, ideas, systems, or methods, although it may protect their expression ([FAQ](https://www.copyright.gov/help/faq/faq-protect.html)). This supports factual reporting; it does not permit copying another publisher’s selection, wording, photographs, video, graphics, or other protected expression.

## Source use categories

| Source/material | Internal research/ingestion | Reader-facing use | Required control |
|---|---|---|---|
| Public web news article | Fetch only as allowed by law, contract, access controls, and approved crawler policy | Facts restated in original language; short justified quotation; title/source link; licensed text where contracted | Terms/robots/access review; provenance; excerpt limits; no paywall bypass; no source-substituting rewrite |
| Licensed wire/feed | Within the exact contracted fields, uses, products, users, territories, and retention | Only formats/edits/credits allowed by the agreement | License ID, product/territory, edit/AI limits, credit, archive/expiry, audit |
| Primary government document/data | Generally useful for research | Quote/link/reproduce only after checking federal-work status, embedded third-party rights, privacy, seals/marks, data terms, and access restrictions | Issuer/version/date; public-domain or license basis; redaction; source URL |
| Court filing/public record | Useful for reporting; access method/terms still matter | Relevant excerpts/images with context and privacy/legal review | Docket/document identifier; retrieval source; redaction; allegation language; sealed/expunged update process |
| Photo/video/audio from a publisher or agency | Metadata/thumbnail only if licensed or otherwise approved | License or counsel-approved use required | Rights owner, license, territory, duration, edit restrictions, model release/publicity limits, mandatory credit |
| Creative Commons media | Verify original posting, licensor authority, exact license/version, and embedded third-party elements | Only uses permitted by the exact license with full attribution and adaptation/share-alike handling | Screenshot/PDF of rights proof; license URL/version; author/title/source/change notice |
| Public-domain material | Verify status; public domain can be jurisdiction-specific | Publish with source/creator credit as an editorial practice | Basis and jurisdiction; source record; embedded-rights check |
| Social post/user media | Discovery only until identity, authenticity, context, rights, and consent are checked | Native platform embed if permitted, or explicit written license/permission; exceptional fair use only after review | Account/post URL, permission scope, identity, safety/privacy, deletion/takedown plan |
| PR handout/press kit | Verify stated permissions and restrictions | Use only within the grant; label “handout” and preserve required credit | Original terms, owner, embargo, editorial-only limits, expiry |
| Screenshot | Internal reference | Publish only when necessary to report/analyze the interface/content and after rights/privacy/security review | Purpose, scope/crop, source/time, redactions, trademarks, personal data |
| AI-generated media | Record tool/model/input/reference rights | Illustration only under policy; never documentary evidence | Generated label, prompt/provenance, rights/terms, reviewer, no real-event deception |

## Facts, expression, and synthesis

### Allowed editorial objective

Create a new, evidence-backed account of the facts:

- read multiple lawful sources;
- identify facts and primary evidence;
- verify independently where possible;
- write original language and structure;
- add original value such as timeline, comparison, consequence, contradiction, document analysis, or reporting;
- link readers to the sources.

### Disallowed objective

Create a substitute for a source:

- line-by-line paraphrase;
- preserving a source’s distinctive sequence, examples, analysis, or narrative while swapping words;
- reproducing the “heart” of an exclusive or creative work;
- combining extracts so the reader no longer needs the original;
- using AI to “spin,” translate, or summarize around a paywall;
- republishing a wire story, photo, caption, chart, or video because another site displayed it.

Similarity checks should compare generated output against every input, not only exact strings. A low text-similarity score does not itself establish a lawful use.

## Fair use

The Copyright Office’s [fair-use guidance](https://www.copyright.gov/fair-use/more-info.html) explains the case-specific four-factor analysis:

1. purpose and character of the use;
2. nature of the copyrighted work;
3. amount and substantiality used;
4. effect on the actual or potential market.

News reporting is one statutory example of a use that **may** qualify; it is not an automatic exemption. The Office states there is no formula or fixed number of words/percentage that guarantees fair use.

### Internal fair-use review

Record:

- editorial purpose and public interest;
- what new meaning, criticism, verification, or reporting the use adds;
- whether the work is factual/creative and published/unpublished;
- exact quantity and qualitative importance used;
- whether the use substitutes for the original or harms a licensing market;
- why a link, description, licensed alternative, or smaller excerpt is insufficient;
- counsel/standards approver and expiration/re-review trigger.

Do not publish a “safe quote length.” Internal numeric limits can reduce operational risk but are not a legal safe harbor.

## Quotations and excerpts

- Quote because the exact language is newsworthy, evidentiary, or necessary for criticism—not because it is convenient.
- Use the minimum needed for the editorial purpose.
- Preserve meaning and context.
- Attribute speaker/author, publication/document, and date; link to the lawful source.
- Verify against recording, transcript, document, or reporter notes.
- Do not reconstruct, clean up, splice, or translate a quote with AI without human verification and disclosure where material.
- Avoid serial quoting across many Story Intelligence modules that collectively substitutes for the original.
- Store exact support locations internally; expose only rights-approved excerpts to readers.
- Honor license-specific excerpt, embargo, display, and archival rules even when a general fair-use argument might be discussed.

## Wire and publisher content

### AP

AP’s current [terms and conditions](https://www.ap.org/terms-and-conditions/) state that AP text, data, photos, graphics, audio, video, and site elements are protected and that access/download does not transfer rights. AP separately offers [news content licensing](https://www.ap.org/content/).

Operational rule:

- no AP text/photo/video republication without an applicable license or counsel-approved use;
- license metadata must control display, credit, term, territory, archive, and permitted editing;
- never infer rights from an AP story appearing free on AP News or a third-party site.

### Reuters

Reuters’ [Brand Attribution Guidelines](https://reutersagency.com/brand-attribution-guidelines/) require contracted users to preserve applicable notices/credits and prohibit alterations that distort editorial meaning, including AI-assisted distortion; translations must be identified.

Operational rule:

- route every Reuters use through the current agreement and entitlement system;
- preserve Reuters/third-party credits and restrictions;
- record whether summarization, extraction, translation, model processing, archival use, or redistribution is permitted;
- do not represent a platform-created synthesis as Reuters reporting.

### Other publishers

For every source agreement, map:

- licensed content and excluded content;
- products/surfaces;
- territory/audience;
- display vs internal analysis/model use;
- transformations/summaries/translations;
- full text vs excerpt;
- media edits/crops;
- source referrals;
- credit/link/logo rules;
- real-time vs archive/retention;
- sublicensing/API/export;
- ads adjacency;
- AI training/fine-tuning/retrieval;
- termination, purge, correction, and audit obligations.

## Government and public records

17 U.S.C. §105 states that copyright protection is generally unavailable for a work of the United States Government ([current Title 17 text](https://www.copyright.gov/title17/92chap1.html#105)). That rule is narrower than “anything on a government website.”

Before reuse, check:

- whether a federal employee created it within official duties;
- whether a contractor, grantee, state/local government, news agency, or private party owns it;
- whether the document embeds protected photos, maps, software, logos, or data;
- whether a federal agency holds copyright transferred to it;
- whether special statutes, seals, trademarks, database terms, privacy, publicity, export, or security rules apply;
- whether the record has been superseded, sealed, expunged, or corrected.

State and local government works are not automatically public domain under §105. Credit the issuing agency and link to the authoritative version even where copyright does not apply.

## Creative Commons and public domain

[Creative Commons](https://creativecommons.org/share-your-work/cclicenses/) defines six core licenses:

- **CC BY:** commercial reuse/adaptation allowed with attribution.
- **CC BY-SA:** same, but adaptations must use the same license.
- **CC BY-NC / BY-NC-SA:** noncommercial only; do not assume an ad-supported or subscription news product qualifies.
- **CC BY-ND / BY-NC-ND:** redistribution only in unadapted form; cropping, translation, editing, or combination may require analysis/permission.
- **CC0:** a public-domain dedication tool with no copyright conditions.

Rules:

- Verify that the uploader/licensor owns or controls the rights.
- Capture the exact license version and original page at acquisition time.
- Confirm the license covers the specific asset, not merely the containing page.
- Credit title, creator, source, and license with a link; identify modifications.
- Apply ShareAlike to adaptations where required.
- Treat “NC” and “ND” uses as review-required.
- Check privacy, publicity, moral, trademark, and third-party rights separately; a CC license covers only rights the licensor can grant.
- A later deletion does not necessarily revoke an already valid CC license, but rights proof must be preserved.

## Photography

Every published photo needs:

- creator/photographer;
- owner/licensor;
- original source URL or delivery ID;
- license/permission/public-domain basis;
- permitted products, territories, duration, and archive;
- required credit;
- caption;
- capture date/location if known;
- people/subject context;
- edit/crop restrictions;
- sensitive-content flag;
- accessibility text;
- rights proof.

Rules:

- Do not download images from search results, social media, another publisher, or a wire preview.
- Do not remove watermarks or crop out a credit.
- Label handouts, pool images, file photos, composites, illustrations, and simulations.
- Do not use a generic file photo in a way that implies the depicted person committed the reported act.
- For minors, victims, private settings, medical scenes, grief, and graphic imagery, complete privacy/public-interest/harm review in addition to copyright clearance.
- Hotlinking is not a rights-management strategy; use a licensed delivery URL or native authorized embed.

## Video and audio

- Use owned/commissioned footage, a direct license, a licensed feed, or an authorized platform embed.
- Do not download and rehost a platform video merely because embedding is available.
- Use the official player and follow current platform terms, branding, ads, privacy, geographic, and deletion controls.
- Verify music, archive footage, stills, performer, and third-party clips inside a video; a license to the container may not clear every element for every reuse.
- Record timecoded excerpt rights.
- Caption video and provide transcripts; accessibility does not expand copyright permission.
- Do not clone a real person’s voice or create a synthetic quote/performance.
- Preserve audio edit context; do not splice words into a new meaning.

## Social media and user-submitted material

Instagram says public accounts can allow posts/profiles to be [embedded](https://help.instagram.com/620154495870484), but this does not justify downloading and rehosting the media or resolve every privacy/publicity/context issue.

Workflow:

1. Verify the original account/uploader and contact them where practical.
2. Verify capture time, location, edits, and chain of custody.
3. Ask whether the uploader created the media and whether others hold rights.
4. Obtain written permission/license stating asset, uses, media, territory, duration, editing, credit, payment, and withdrawal expectations.
5. Assess subject privacy, safety, minors, trauma, and retaliation risk.
6. Prefer the platform’s native embed when editorially appropriate and permitted.
7. Prepare for deletion, account privacy change, platform outage, or terms change.
8. Never condition emergency assistance on a rights transfer.

Public interest and newsworthiness do not erase copyright, privacy, or safety obligations.

## Screenshots, documents, maps, and data graphics

### Screenshots

- Capture only what is needed to report or critique.
- Show source, date, and relevant context.
- Redact personal data, credentials, tokens, private messages, minors, and unsafe identifiers.
- Do not use a screenshot to avoid obtaining a photo/video license.
- Review app/site terms and trademark presentation.

### Documents

- Link to the authoritative original where possible.
- For a displayed page image, record the reuse basis.
- Quote selectively with page/section reference.
- Preserve version/hash and retrieval time.
- Do not expose sealed, private, accidentally published, or legally restricted information merely because a crawler found it.

### Maps and data

- License the base map, tiles, geocoding, fonts, icons, and datasets.
- Follow attribution and caching limits.
- Record methodology, update date, geographic precision, and uncertainty.
- Avoid maps that expose private residences, victim locations, protected facilities, or sensitive movement without a strong public-interest case.
- Facts/data may be unprotected, but database selection/arrangement, API contracts, and visual expression can carry rights/restrictions.

## AI-generated and AI-edited media

- Never use photorealistic generation to represent an actual news event, victim, suspect, official act, disaster, or evidentiary scene.
- Synthetic illustration must be adjacent-labeled “AI-generated illustration” and never enter a documentary photo feed.
- Record model/provider, version, date, prompt, reference assets, editor, and provider terms.
- Verify the team had rights to every reference image, likeness, voice, logo, and uploaded source.
- Do not imitate a living artist’s signature style for a news commission without review.
- No face swap, voice clone, lip sync, or object/person addition/removal in documentary material.
- Ordinary technical adjustments to documentary media must stay within the adopted visual-authenticity standard and be logged when material.
- Run identity, trademark, defamation, violence, sexual content, and deceptive-context review.

AP’s [news standards](https://www.ap.org/about/news-values-and-principles/telling-the-story/) and Reuters’ [standards](https://reutersagency.com/about/standards-values/) are useful benchmarks: both emphasize authentic visual journalism, and both reject generative alteration that creates a false news reality.

## Rights ledger

No asset can transition from `research-only` to `publishable` without a complete rights record.

Minimum fields:

```text
asset_id
asset_type
original_url_or_delivery_id
original_creator
rights_owner
source_publisher_or_platform
acquired_at
license_type_and_version
license_or_permission_document
allowed_products_and_uses
territories
start_and_expiry
archive_rights
edit_crop_translate_ai_permissions
mandatory_credit
third_party_rights_notes
people_privacy_publicity_notes
sensitive_content_state
caption
alt_text_or_transcript
ai_generated_or_materially_edited
reviewer
last_rights_review_at
takedown_or_purge_status
```

Technical enforcement:

- publication API rejects missing/expired rights;
- renderer inserts mandatory credit automatically;
- derivatives inherit the parent asset’s restrictions;
- license expiry removes public delivery or routes to replacement review;
- corrections/takedowns purge CDN, image variants, social cards, search caches where possible, newsletters/app caches, and model retrieval stores;
- rights proof is immutable/auditable with limited staff access.

## Crawler, storage, and model-use boundaries

Maintain separate permissions for:

- one-time human research;
- automated crawling;
- metadata storage;
- full-text temporary processing;
- searchable internal archive;
- embeddings/retrieval;
- model evaluation;
- fine-tuning/training;
- reader-facing quotation;
- redisplay/syndication;
- long-term archive.

A license to display an article is not automatically permission to train a model on it. A public `robots.txt` allowance is not automatically a copyright license. A contract may be more restrictive than technical access.

Apply:

- allowlist of approved sources and access methods;
- per-source retention/purge controls;
- encrypted access-controlled research stores;
- no credential sharing/paywall bypass;
- source correction/deletion propagation;
- prompt-injection isolation for ingested content;
- output similarity and excerpt aggregation checks;
- contract review before new model/provider use.

## DMCA and takedown

The Copyright Office explains that eligible service providers seeking §512 safe-harbor protections may need to designate an agent publicly and with the Office, maintain the designation, and follow applicable notice-and-takedown requirements ([§512 resource](https://www.copyright.gov/512/index.html); [agent FAQ](https://www.copyright.gov/dmca-directory/faq.html)). A designation does not by itself guarantee safe harbor, and failure to qualify does not automatically decide liability.

Counsel should design:

- public copyright/DMCA contact;
- Copyright Office agent registration and three-year renewal;
- notice validation and expeditious action;
- uploader notification/counter-notice where applicable;
- repeat-infringer policy where required;
- no interference with technical protection measures;
- preservation of evidence and legal holds;
- appeal/restoration;
- search/CDN/feed/app/social/partner purge;
- transparent status communication without exposing complainants or users improperly.

### Internal response targets

Use risk-based service levels, not a promise that every notice is valid:

1. acknowledge receipt;
2. prevent further automated distribution of the identified asset while triaged where risk warrants;
3. validate exact work, URL/asset, claimant authority, and notice elements;
4. involve counsel for disputes, fair-use assertions, counter-notices, or public-interest concerns;
5. remove/disable or restore according to the approved process;
6. document every affected derivative and surface;
7. update rights/source trust records and prevent recurrence.

## Corrections versus rights actions

- **Factual correction:** fix the editorial claim and display a correction note.
- **Rights replacement:** remove/replace an asset but preserve the story and note the change when readers would otherwise be misled.
- **Privacy/safety redaction:** document why details were removed; do not expose the removed data in the public change log.
- **Full takedown:** reserve for legal/safety circumstances; use the correct HTTP/indexing/CDN/partner response and a public note where appropriate.

A rights complaint must not be mislabeled as an editorial correction, and an editorial error must not be hidden as a rights change.

## Pre-publication checklist

- Are the facts written in original language and supported independently where possible?
- Does any passage preserve another source’s distinctive expression or replace the need to read it?
- Are quotations exact, contextual, minimal, attributed, and justified?
- Do we have rights for every image, clip, audio file, chart, map, font, icon, and document page displayed?
- Is the license valid for this product, territory, audience, advertising context, transformation, and archive period?
- Are mandatory credits adjacent and correct?
- Are third-party elements inside a licensed work separately cleared?
- Are people’s privacy/publicity/safety interests reviewed?
- Is government/public-domain status documented rather than assumed?
- Are CC license version, attribution, adaptation, NC/ND/SA obligations satisfied?
- Does platform embed use the official method and handle deletion/privacy?
- Is synthetic or materially altered media clearly labeled and non-deceptive?
- Is the rights ledger complete and machine-enforced?
- Can the asset and every derivative be removed quickly?
- Has counsel approved any fair-use, leaked/private material, serious allegation, or disputed-rights use that exceeds routine policy?
