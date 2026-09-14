# Product opportunities

**Research date:** 2026-07-24
**Basis:** Live-product review in [01-competitor-matrix.md](./01-competitor-matrix.md) and audience/market evidence in [02-us-news-market-analysis.md](./02-us-news-market-analysis.md).

## Product thesis

**Inference:** The strongest opening is not “AI writes the news.” It is “AI helps an accountable newsroom maintain a living, inspectable story record.”

The proposed platform should make each important event a persistent **Story Intelligence** object rather than a stream of duplicate articles. The object should become more useful as reporting develops: current state, claims, evidence, timeline, people, documents, coverage differences, open questions, corrections, and meaningful-change alerts.

## Priority stack

| Priority | Opportunity | User job | Competitive evidence | Minimum useful release | Principal risk |
|---|---|---|---|---|---|
| P0 | Living canonical story | “Give me one place that stays current.” | Particle and Ground News cluster sources; Reuters/AP/BBC build topic packages, but none reviewed combines a persistent cluster, claim evidence, and explicit change history. | Stable story URL; deduplicated source set; latest-confirmed block; key facts; why it matters; timeline; related stories; updated timestamp. | Wrong merges, stale state, or an update timestamp that changes without a meaningful editorial change. |
| P0 | Claim-level provenance | “Show me what supports each statement.” | Particle emphasizes source links and verification; Ground exposes sources; wire publishers model disciplined attribution. Claim-to-evidence mapping was not consistently visible across products. | Evidence chips on every generated factual bullet; source class; published/retrieved time; direct link; primary/supporting designation; unsupported-state refusal. | Citation laundering: a linked page exists but does not support the claim. |
| P0 | Known / unknown / disputed | “Tell me where certainty ends.” | Ground shows coverage differences; Reuters/AP/BBC standards distinguish fact, rumor, and attribution. Most consumer summaries still read as a single confident voice. | Three explicit states; attributed disputed claims; contradiction queue; confidence based on evidence state, not model probability. | Turning uncertainty into a misleading numeric score or false equivalence. |
| P0 | Human-owned AI workflow | “Who is accountable if this is wrong?” | Reuters and AP explicitly retain human responsibility for AI-assisted output; Particle describes automated checks and human review. | Named author/editor or newsroom desk; AI-assistance disclosure; review status; publish gate by risk tier; audit trail; correction route. | “Human reviewed” becoming a ceremonial checkbox at scale. |
| P0 | Truly chronological Latest | “What was published most recently?” | Major publishers expose Latest, while recommendation feeds often mix freshness and predicted interest. | Separate unpersonalized reverse-chronological feed with immutable publish time, visible update time, filters, and no silent pinning. | Conflating article updates with newly published stories or inserting sponsored units as news. |
| P1 | Evidence-constrained Ask | “Answer my question about this story and show your work.” | Particle is the clearest current consumer example of sourced story questions. | Retrieval only from the story dossier and approved source set; sentence/claim citations; answer timestamp; “not enough evidence”; suggested questions; report control. | Prompt injection, stale answers, defamation, overconfident synthesis, and source rights. |
| P1 | Material-change following | “Alert me only when this materially changes.” | Competitors offer topic alerts and follows, but conventional alerts frequently repeat the same event. | Follow story/entity/location; delta classifier; one-sentence “what changed”; linked evidence; severity and cadence controls; quiet hours. | False deltas and notification fatigue. |
| P1 | Coverage comparison without verdict theater | “How do credible sources differ?” | Ground News excels at comparison but relies heavily on publication-level ratings. | Compare headlines, facts emphasized, sources quoted, missing angles, ownership, geography, and article type; label algorithmic inference. | Reducing complex reporting to partisan buckets or implying equal evidentiary value. |
| P1 | Calm, finite personal briefing | “Help me be informed and then be done.” | Axios and Boring Report are concise; Particle/Yahoo/Ground personalize; Pew reports substantial news fatigue. | 8–12 configurable items; completion state; explain “why this”; topic caps; mute controls; catch-up window; morning/evening choice. | Engagement optimization quietly re-creating an infinite feed. |
| P1 | US consequence and civic-data layer | “What does this change for people where I live?” | General national products are weak on consequence mapping; Medill documents severe local-news gaps. | State/metro context, affected groups, effective dates, agency/jurisdiction, official documents, deadlines, map only when geospatially meaningful. | Thin auto-local pages, wrong jurisdiction, privacy risks, or implying original local reporting. |
| P1 | Primary-source desk | “Take me to the bill, filing, ruling, transcript, data, or recording.” | Particle links primary material; Reuters/AP use disciplined attribution; many articles still bury documents. | Typed document index; issuer; date/version; excerpt with page/section; archive URL where lawful; OCR confidence; change comparison. | Mirrored documents with unclear rights or outdated versions. |
| P2 | Brief-to-depth format ladder | “Let me choose how much time to spend.” | Axios owns brevity; The Verge and BBC handle multiple formats; Particle offers summary styles/audio. | 30-second brief, 2-minute orientation, full evidence/timeline, and optional audio generated from the same approved story state. | Divergent facts between formats or low-quality synthetic audio. |
| P2 | Topic explainer graph | “Explain the background once, then connect new developments.” | BBC InDepth, Reuters/AP packages, and Particle related timelines partially solve this. | Evergreen explainer, entities, definitions, prior decisions/events, linked current stories, last reviewed date. | Stale evergreen content ranking for a changed fact pattern. |
| P2 | One high-signal configurable newsletter | “Send only the useful changes.” | Newsletters are a proven habit across Axios, BBC, Reuters, AP, Yahoo, and The Verge, but Pew finds many go unread. | User-selected topics/locations, finite story deltas, source links, one sponsor maximum, web archive, easy cadence changes. | Portfolio sprawl and repetitive content. |
| P2 | Transparent trend detection | “Why is this topic rising?” | Competitors show Trending but rarely expose why. | Volume/velocity across sources, first-seen time, geographic spread, source diversity, anomaly warnings, and a human-readable method note. | Manipulation by coordinated low-quality sources, bot activity, or treating popularity as importance. |

## The Story Intelligence object

### Reader-facing structure

1. **Headline and state**
   - plain factual headline;
   - `Developing`, `Confirmed`, `Disputed`, `Explainer`, or `Resolved`;
   - first published, last materially updated, and next expected checkpoint.
2. **Latest confirmed**
   - the newest consequential verified fact;
   - evidence link and timestamp;
   - change marker from the reader’s last visit.
3. **The brief**
   - what happened;
   - key facts;
   - why it matters;
   - who is affected;
   - what happens next.
4. **Known, unknown, and disputed**
   - verified facts;
   - material gaps;
   - attributed claims with status;
   - contradictions requiring resolution.
5. **Evidence**
   - primary documents/data;
   - original reporting;
   - supporting analysis;
   - media provenance and rights status.
6. **Timeline and people**
   - event time, reporting time, and update time kept distinct;
   - people/organizations with role in this story, not generic biographies.
7. **Coverage comparison**
   - sources, article types, ownership, geography, headlines, evidence cited, and substantive framing differences.
8. **Questions**
   - editor-curated questions;
   - evidence-constrained reader Ask;
   - “not answered by available evidence” as a valid result.
9. **What to watch**
   - scheduled hearings, votes, filings, reports, deadlines, forecasts, or announced next steps;
   - never presented as guaranteed.
10. **Update and correction history**
    - material diffs with time, reason, editor, and affected claim;
    - correction separate from routine update.

### Internal data contract

Every published claim should minimally store:

```text
claim_id
story_id
claim_text
claim_type              # fact | attributed_claim | analysis | forecast
status                  # supported | disputed | unverified | withdrawn
event_time
first_published_at
last_verified_at
sources[]               # source_id, exact support location, retrieval time
primary_source_present
editor_owner
model_version_if_assisted
material_change_id
```

**Recommendation:** Confidence should be a documented editorial/evidence state. Do not expose a pseudo-precise model probability such as “93% true.”

## Differentiation map

| Borrow the principle from | Adapt | Add to make it distinct and safer |
|---|---|---|
| Particle | Story cluster, sourced questions, follows, quotes, timeline, audio | Claim-level support, editor ownership, public change log, primary-source rank, known/unknown/disputed, private questions by default |
| Ground News | Coverage comparison, ownership, blindspots, headline differences | Article-level evidence analysis, unrated-source visibility, method tooltips, nonpartisan dimensions beyond a single ideology axis |
| Boring Report | Low-arousal wording and minimal feed | Preserve consequence and uncertainty; add sources per claim and accountable byline |
| Yahoo News | Preference onboarding, blocks, history, morning audio, broad source distribution | Less ad density, clear recommendation reasons, publisher quality controls, no account requirement for core public-interest access |
| Reuters/AP/BBC | Reporting standards, datelines, media provenance, update discipline, live formats | A multi-source intelligence layer and structured public audit trail |
| Axios | Scannable semantic blocks and explicit relevance | Expandable evidence, chronology, counterevidence, and nuance |
| The Verge | Strong format differentiation, fast/deep coexistence, explicit ethics/disclosures | A calmer general-news visual language and stricter opinion/analysis/commerce separation |

## Recommendation and personalization design

### Explicit controls first

Collect only the preferences that immediately improve the product:

- topics and subtopics;
- location at user-chosen granularity;
- people, organizations, and story follows;
- publishers to prefer, mute, or block;
- desired depth and formats;
- briefing cadence and quiet hours;
- topics the reader wants less of.

### Every recommendation should answer “why”

Examples:

- “Because you follow the Federal Reserve.”
- “Important update to a story you read.”
- “Affects Istanbul-based US travelers” only if the user explicitly set that context.
- “Widely covered across 42 sources.”
- “Undercovered by sources you usually read.”

Avoid opaque labels such as “For you” without an explanation or control.

### Separate editorial importance from personal relevance

Use two independently visible signals:

- **Newsroom priority:** consequence, urgency, public safety, democratic/civic importance, and verified change.
- **Personal relevance:** explicit follows, location, reading preferences, and format/cadence.

The user can tune relevance, but should still receive a small, clearly labeled essential-news layer. The newsroom, not an engagement model, owns that layer.

## Trend system

“Trending” should be an auditable signal, not a popularity badge.

### Candidate inputs

- unique credible sources publishing on the same cluster;
- change in publication rate relative to that topic’s baseline;
- geographic spread;
- search/referral interest where licensed and privacy-compliant;
- primary-source event (filing, vote, ruling, alert);
- social velocity only after bot/coordinated-behavior filtering;
- editor escalation for public safety or civic importance.

### Reader-facing explanation

Display:

- “Rising because 28 additional outlets reported this in the last two hours.”
- “First detected at 10:14 ET.”
- “Most coverage is regional.”
- “Social activity is high, but independent reporting is limited.”

Never equate trending with true, important, or endorsed.

## Trust moat

The product can turn trust operations into durable product value:

- versioned story state rather than overwritten prose;
- reproducible source dossier;
- licensing/rights metadata for every asset;
- explicit generated-versus-reported labels;
- material-change alerts;
- public corrections;
- model/prompt/evaluation records internally;
- red-team tests for source mismatch, entity collision, quote alteration, chronology, and unsupported certainty;
- human escalation by legal/editorial risk.

Competitors can reproduce a summary. Reproducing a credible longitudinal evidence record is harder.

## High-risk categories

Require named human approval and stricter sourcing for:

- elections and voting logistics;
- war, terrorism, hostage events, and national security;
- crime allegations and identifiable private people;
- health, medicine, self-harm, and public-health emergencies;
- markets-moving and personal-finance claims;
- weather/emergency instructions;
- minors;
- graphic media;
- leaked/private data;
- obituaries and death reports.

For these categories, a single uncorroborated report should normally be shown as an attributed claim, not promoted into the confirmed summary.

## Anti-opportunities

Do not build:

- an automatic full-article rewrite farm;
- thousands of thin query/location pages intended mainly for search;
- a “bias score” that purports to decide truth;
- AI-generated imagery depicting real current events;
- trust features hidden behind the premium tier;
- public AI questions without abuse, privacy, and defamation controls;
- auto-playing video/audio or interruptive breaking-news theatrics;
- anonymous stories with no accountable desk;
- a comment system before identity, moderation, appeals, and incident response are staffed;
- a Trending list sourced mostly from social engagement;
- ad units visually interchangeable with story cards.

## Phased validation

### Phase 1 — prove the story object

- Cover 20–30 high-interest US developing stories manually assisted by tools.
- Test brief comprehension, source-opening behavior, known/unknown usefulness, and timeline accuracy.
- Publish no open-ended Ask until claim-to-source evaluation meets a documented threshold.

### Phase 2 — prove the return loop

- Add follows and material-change alerts.
- Add one finite Daily Brief.
- Measure whether users return for deltas rather than duplicate headlines.

### Phase 3 — prove comparison and local relevance

- Add coverage comparison with methodology explanations.
- Pilot two or three metros/states with licensed sources and civic data.
- Audit false locality and missing-context errors.

### Phase 4 — prove monetization without trust erosion

- Add restrained ad inventory and direct sponsorship controls.
- Test premium convenience/depth, while keeping source provenance and corrections free.
- Compare revenue against page speed, source click-through, trust research, and churn.

## Decision gates

Do not scale ingestion or SEO page count until all are true:

1. Cluster precision and recall are evaluated on difficult related-but-distinct events.
2. Generated claims have direct, supporting evidence—not merely topical links.
3. Material updates and corrections produce an understandable public diff.
4. High-risk stories reliably enter human review.
5. Rights metadata prevents unlicensed media publication.
6. Readers can distinguish reporting, synthesis, analysis, opinion, and advertising.
7. Source publishers receive clear attribution and useful referral paths.
8. The team can explain why every recommendation and trend label appeared.
