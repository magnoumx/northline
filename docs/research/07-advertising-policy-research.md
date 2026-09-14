# Advertising policy research

**Research date:** 2026-07-24
**Status:** Product and operations policy research, not legal advice. Advertising, privacy, election, health, financial, and child-directed-content rules vary by jurisdiction and change frequently. Counsel and each contracted platform’s current terms must approve implementation.

## Objective

Advertising may fund broad public access, but it must never:

- be mistaken for journalism;
- change editorial selection, headline, conclusion, rating, or correction;
- obscure essential story context or evidence;
- create accidental clicks;
- expose users to tracking before required choices;
- materially degrade accessibility, safety, or page performance;
- place a brand beside content the newsroom has classified as unsafe.

## External policy baseline

| Source | Current relevant requirement | Operational implication |
|---|---|---|
| [FTC Native Advertising Guide](https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses) | An ad must not mislead consumers about its commercial nature. When disclosure is needed, it must be clear and prominent; FTC guidance favors plain labels such as “Ad,” “Advertisement,” or “Paid Advertisement” close to/before the native headline. | Label before click and on landing page. Do not rely on color, logo, “Promoted,” “Partner,” or a footer disclosure alone. Review the unit’s net impression. |
| [Google Publisher Policies overview](https://support.google.com/publisherpolicies/answer/10400453) | Google-served ads are subject to content, behavioral, privacy, and standards requirements; violations can limit or terminate monetization. | Maintain a policy owner, pre-publish category controls, and an ad-serving kill switch. |
| [AdSense program policies](https://support.google.com/publisherpolicies/answer/48182) | Publishers may not click their own ads or artificially inflate impressions/clicks. | Filter staff/QA traffic, train employees, monitor invalid traffic, and never use copy/UI that invites ad clicks. |
| [More ads than publisher content](https://support.google.com/publisherpolicies/answer/11169917) | Google does not allow served ads on screens with more advertising/paid material than publisher content. | Adopt a materially stricter internal density cap and include house ads, native ads, and sponsor promos in the count. |
| [Ads interfering with interaction](https://support.google.com/publisherpolicies/answer/11035030) and [obscuring content](https://support.google.com/publisherpolicies/answer/11127388) | Ads must not overlay/obscure content or sit where interactions create accidental clicks. | Keep ads out of navigation, source chips, play controls, accordions, Ask, next/previous, and sticky UI. |
| [Coalition for Better Ads](https://www.betterads.org/standards/) | Identifies formats below consumer acceptability thresholds, including pop-ups, autoplay video with sound, countdown prestitials, large sticky ads, flashing ads, and high-density experiences. | Ban the least-preferred formats, including when a vendor technically offers them. |
| [IAB Tech Lab ads.txt](https://iabtechlab.com/ads-txt-about/) | Publishers can publicly declare authorized sellers to reduce counterfeit inventory. | Publish and continuously validate `ads.txt`; remove stale seller accounts. |
| [IAB sellers.json/SupplyChain](https://iabtechlab.com/sellers-json/) | Buyers can inspect direct sellers/intermediaries and supply-chain nodes. | Require partners to represent the publisher correctly and pass valid supply-chain objects; minimize unnecessary intermediaries. |
| [Google CMP requirements](https://support.google.com/adsense/answer/13554020) | Google publisher products require a Google-certified CMP integrated with IAB TCF for personalized ads in the EEA, UK, and Switzerland. | Use an approved CMP where applicable, audit regional triggering and consent strings, and retain non-personalized/contextual fallbacks. |
| [California privacy rights](https://privacy.ca.gov/california-privacy-rights/rights-under-the-california-consumer-privacy-act/) | Covered California consumers may have a right to opt out of sale/sharing for cross-context behavioral advertising and other rights. | Counsel must determine applicability; implement a visible privacy-choice route and applicable opt-out preference handling rather than hiding it in account settings. |

## Separation of newsroom and revenue

### Newsroom controls

The newsroom alone decides:

- what to cover and how prominently;
- story framing, headlines, sources, conclusions, ratings, and corrections;
- whether a page is too sensitive for advertising;
- adjacency categories that would create harm or apparent influence;
- whether a sponsor conflicts with an investigation or review.

### Revenue controls

The commercial team may decide:

- inventory, pricing, sales channel, campaign pacing, and aggregate reporting;
- sponsor suitability under published rules;
- creative requirements and technical delivery;
- package benefits that do not direct coverage.

### Required firewall

- No advertiser pre-approval or post-publication veto of editorial work.
- No payment conditioned on a favorable story, source inclusion, omission, or correction.
- No transfer of private newsroom plans to an advertiser beyond ordinary publicly available editorial calendars.
- Sponsored content uses a separate production path, contract, template, and approver.
- Editorial staff do not write anonymous sponsor copy under their news bylines.
- Material commercial conflicts are disclosed.

## Allowed commercial formats

### 1. Standard display

- Reserved, labeled slots outside essential controls and evidence.
- Static, HTML5, or video only within approved weight/motion/audio limits.
- No autoplay sound.
- No deceptive system/browser UI.

### 2. Newsletter and audio sponsorship

- One concise sponsor block at a predictable boundary.
- “Sponsored by” or “Advertisement” stated in text and audio.
- Sponsor has no control over editorial item selection or wording.
- Tracking links and pixels follow consent/privacy rules.

### 3. Clearly separated sponsored content

- Commercial label before the headline in every card, search result, social preview, newsletter, and landing page.
- Distinct URL/template visual treatment.
- Advertiser identity visible.
- Claims substantiated and reviewed for deceptive practices.
- Not eligible for “Top News,” Latest, editorial recommendation, or story-source evidence.
- Search/link attributes set according to current search-engine paid-link guidance.

### 4. Affiliate commerce

- Only in labeled reviews/guides with an editorial reason to exist.
- Disclosure before the first affiliate link and near purchase actions.
- Commission does not affect score, inclusion, or conclusion.
- Price/availability timestamps and retailer identity visible.
- No affiliate links inside straight-news evidence lists.

### 5. Direct underwriting

- A sponsor may support a topic, event, public-service tool, or newsletter.
- Language must communicate financial support, not editorial endorsement or ownership.
- Avoid underwriting where the sponsor is a central subject of ongoing accountability coverage unless standards/legal review determines the separation is unmistakable.

## Prohibited formats and practices

- pop-ups or prestitials that block story access;
- countdown interstitials;
- autoplaying audio;
- flashing or rapidly animated creative;
- full-screen scrollovers;
- large sticky ads;
- sticky pop-out video;
- ads that expand on hover;
- fake close buttons, fake notifications, download buttons, or system messages;
- creatives that imitate a news alert, source chip, correction, poll, or Ask answer;
- ads placed immediately beside navigation or interactive evidence controls;
- forced app-install prompts before public web content;
- ads inserted inside a quotation, correction, known/unknown list, source list, or emergency instruction;
- “related story” units that are actually ads without an adjacent unambiguous label;
- staff clicks, incentivized clicks, paid-to-click traffic, click exchange, or hidden/stacked ads;
- auto-refresh by default;
- selling a user’s inferred political affiliation, health status, financial distress, victim status, or other sensitive news-reading inference.

## Internal density and placement policy

The following are recommended internal limits, intentionally stricter than merely staying below an external enforcement threshold.

### Homepage/feed

- No ad before the lead package is understood.
- First display slot after at least four editorial items or one complete lead module.
- At least five editorial cards between subsequent feed ads on mobile; test a stricter cadence at launch.
- Never more than one commercial unit in the initial viewport.
- Sponsored cards receive a different container treatment and an “Advertisement” label before the headline.
- Latest remains chronologically pure; ads may occupy separate fixed slots but must not receive story timestamps or numbering.

### Story

- No ad between headline/byline and the complete orientation block.
- No ad in Latest confirmed, known/unknown/disputed, primary documents, evidence, correction, or update-history modules.
- First inline unit after a complete narrative section, not mid-sentence or between a claim and its citation.
- Maintain enough editorial content between slots that only one display unit is normally visible at a time.
- Right-rail inventory must not become sticky if it obscures reading/focus or competes with the Story Intelligence rail.
- End-of-story recommendations separate paid and editorial groups.

### Mobile

- No large sticky/anchor unit at launch.
- No ad that occupies most of the viewport.
- No video interstitial on open, scroll, return, or app foreground.
- Reserve dimensions to prevent content movement.
- Keep tap targets and scroll affordances clear of the slot.

### Density measurement

Count:

- programmatic display;
- direct display;
- native/sponsored cards;
- house ads;
- affiliate commerce promos;
- sticky media ads;
- sponsor takeovers.

Measure both page-level ad height and viewport experience. An internal target should remain well under the Coalition’s unacceptable-density boundaries; product leadership should approve a numeric cap only after testing content templates and vendor behavior.

## Refresh and video

- Default: no automatic ad refresh.
- If refresh is later proposed, require viewability, user presence, minimum interval, exchange disclosure, reporting accuracy, and written platform/contract approval.
- Never refresh a unit while offscreen merely to generate impressions.
- Editorial video does not automatically authorize a video ad.
- Any pre-roll must be skippable after a short period, muted until user action, caption-accessible, and proportionate to content length.
- No mid-roll in short-form news video; the Coalition lists mid-roll in short-form video among least-preferred experiences.

## Sensitive-content suitability

The editorial CMS should set `ads_allowed`, `ads_limited`, or `ads_suppressed`, with reason and reviewer.

Default suppress or senior-review advertising on:

- active casualty scenes, graphic injury, executions, sexual violence;
- suicide/self-harm;
- content primarily about a minor victim;
- emergency instructions where interruption could cause harm;
- hostage/kidnapping pages;
- obituaries immediately after death;
- stories containing leaked intimate/private material;
- hate/extremist propaganda displayed for reporting;
- serious allegations where adjacency could create reputational harm;
- corrections/takedown notices.

Contextual classification must review the actual page; blunt keyword blocks can suppress legitimate public-interest journalism or create unsafe adjacency.

## Political, health, finance, and regulated ads

- Maintain jurisdiction- and platform-specific acceptance rules, identity verification, disclaimers, recordkeeping, and blackout dates where applicable.
- Axios’s current [advertising guidelines](https://static.axios.com/advertise/advertise-guidelines.pdf), for example, apply special political-ad rules and reject editorial confusion and misleading/unsubstantiated claims; use such policies as a benchmark, not as legal authority for this platform.
- Do not accept issue/candidate ads until counsel, operations, and public ad-library requirements are ready.
- Require substantiation and legal review for health, investment, credit, insurance, gambling, alcohol, supplements, and other regulated/sensitive claims.
- Do not target these campaigns from inferred news-reading vulnerability.
- Newsroom fact checks/corrections of an advertiser remain independent.

## Privacy and consent

### Minimum data policy

- Contextual ads are the default launch mode.
- Collect no more data than needed for delivery, fraud prevention, aggregate measurement, and user-approved personalization.
- Do not send story title/full URL to partners when it exposes sensitive interests and a coarser content category will work.
- Maintain a current vendor register: purpose, data fields, regions, retention, subprocessors, transfer mechanism, security contact, and deletion route.
- Contractually prohibit partners from repurposing publisher data or building sensitive profiles.
- Keep consent separate from account signup and editorial access where legally/product feasible.

### Choice experience

- Equal visual prominence for accept/reject where applicable.
- Granular purposes and vendor information.
- No preselected nonessential consent.
- Easy withdrawal as consent.
- A persistent “Privacy choices” link.
- Do not set nonessential ad/analytics storage before the required choice.
- Honor applicable legal opt-outs and universal preference signals as advised by counsel.
- Preserve proof of consent/choice without creating a new cross-site identifier.

Google notes that its CMP certification is focused on its own criteria and does not establish full legal compliance. The publisher remains responsible.

### Children and teens

Do not infer that a general news audience eliminates child users. Before behavioral advertising or age estimation:

- conduct a child/teen privacy and product-safety review;
- apply applicable age-treatment signals;
- disable personalized advertising where required;
- avoid manipulative engagement and sensitive profiling;
- obtain specialized counsel.

## Supply-chain controls

- Publish `https://domain.example/ads.txt`.
- Verify every seller ID, relationship type (`DIRECT`/`RESELLER`), certification authority ID, and owner domain.
- Remove inactive partners promptly.
- Confirm SSP/exchange `sellers.json` identity and SupplyChain object consistency.
- Prefer direct paths and document every reseller’s purpose.
- Monitor unauthorized domain/app inventory and spoofing.
- Use `app-ads.txt` for apps when applicable.
- Require malware scanning, SSL, privacy-string support, creative audit data, and incident contact in contracts.

## Invalid traffic and fraud

- Exclude office, QA, preview, synthetic-monitor, and automated-test traffic from monetized requests.
- Never ask staff, contractors, readers, or partners to click ads.
- Rate-limit and challenge suspicious traffic without blocking approved search/news crawlers.
- Monitor abnormal CTR, viewability, geographic/device spikes, referrer anomalies, bot signatures, and repeated sessions.
- Freeze affected inventory and notify platform partners during an investigation.
- Preserve logs with access/retention controls.
- Do not buy low-quality arbitrage traffic whose economics depend on ad impressions.

## Creative review

Automated scanning plus human review for high-risk campaigns:

- advertiser identity and landing-domain match;
- claim substantiation;
- malware/redirect behavior;
- deceptive UI or fake news presentation;
- prohibited products/content;
- political/regulated category;
- accessibility: flashing, contrast, captions, motion, focus;
- weight/latency and third-party calls;
- privacy/consent behavior;
- story adjacency exclusions;
- final rendered mobile and desktop appearance.

Allow readers to report an ad and capture campaign/creative ID without requiring them to reproduce sensitive personal data.

## Performance budget

- Reserve slot geometry to protect CLS.
- Load ads after essential editorial HTML.
- Set third-party script and network-call budgets.
- Lazy-load below-fold inventory.
- Time out failed auctions and collapse only with no layout shift.
- No ad vendor may block headline/brief rendering.
- Monitor [Core Web Vitals](https://web.dev/articles/vitals) by template, device, consent state, and ad partner.
- Automatically pause a partner or format that causes persistent performance/accessibility regressions.

## Commercial measurement

Track revenue alongside reader harm:

- revenue and net revenue per session;
- viewable impressions, fill, and latency;
- invalid-traffic rate;
- consent and privacy-choice completion;
- page speed/CLS/INP by ad state;
- bounce and return rate;
- source/evidence clicks;
- subscription conversion;
- ad report/complaint rate;
- accessibility incidents;
- brand-safety blocks;
- correction/trust research.

Do not optimize CTR in isolation. A high ad CTR may indicate deceptive placement.

## Incident response

For malware, deceptive creative, unsafe adjacency, privacy leakage, invalid traffic, or undisclosed sponsored content:

1. disable the creative/campaign/vendor or all ads through the kill switch;
2. preserve identifiers, logs, screenshots, consent state, and affected URLs;
3. notify security/privacy/editorial/legal owners and the platform partner;
4. protect affected users and rotate compromised tags/keys;
5. correct labels or public disclosures where readers were misled;
6. document root cause and prevention;
7. reinstate only after validation.

## Launch gate

Advertising must remain off until:

- editorial/commercial firewall and sponsor labels are approved;
- first-party privacy notice and choice mechanism are live;
- applicable CMP and regional fallbacks are tested;
- `ads.txt` and supply-chain records validate;
- sensitive-content controls work at page and slot level;
- staff/QA/bot traffic is excluded;
- creative scanning and report-an-ad workflow exist;
- slots pass mobile, keyboard, screen-reader, zoom, reduced-motion, and performance testing;
- a one-action global ad kill switch is operational;
- contracts allocate data, security, rights, fraud, and incident responsibilities.
