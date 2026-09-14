# Editorial benchmark

**Research date:** 2026-07-24
**Purpose:** Convert the strongest practices observed across human-led and AI-assisted news products into an accountable editorial system for Story Intelligence.

## Benchmark sources

| Organization/product | Current first-party standard or product behavior | Practice worth carrying forward | Important boundary |
|---|---|---|---|
| [Reuters](https://reutersagency.com/about/standards-values/) | Accuracy takes priority over speed; named sources are preferred; information is cross-checked; quotes are protected; corrections are transparent. Reuters says AI-derived facts, sources, and claims require independent verification and humans remain accountable. | Verification, attribution, datelines, independent confirmation, human ownership of AI-assisted output. | Reuters is an original reporting organization. Its standards do not grant permission to ingest or republish its content. |
| [AP](https://www.ap.org/about/news-values-and-principles/telling-the-story/) | Disputed facts are attributed; anonymous material faces stringent tests; third-party material is vetted and attributed to its original source; corrections remain visible; visual authenticity is protected. A [July 2026 AI update](https://www.ap.org/the-definitive-source/announcements/ap-updates-newsroom-standards-for-artificial-intelligence/) permits defined assistance but requires human review/editing and rejects generative news photography. | Visible updates, source scrutiny, original-language writing, visual provenance, explicit AI limits. | AI can assist a task; it cannot replace reporting, judgment, verification, or accountability. |
| [BBC](https://downloads.bbc.co.uk/guidelines/editorialguidelines/pdfs/bbc-editorial-guidelines-whole-document.pdf) | Due accuracy and due impartiality; user/social material must be verified; fact, allegation, rumor, and opinion are distinguished; significant errors are corrected. | Proportionate impartiality, careful language of uncertainty, verification of social media, public-interest framing. | “Due” impartiality is not equal time for claims with unequal evidence. |
| [Axios](https://www.axios.com/2021/01/15/axios-bill-of-rights) | Smart Brevity structure, clinical/critical tone, transparent business commitments, and visible relevance cues. Current stories use labeled blocks such as Driving the news, The other side, and What they’re saying. | Fast orientation, semantic labels, explicit “why it matters,” concise paragraphs. | Compression must not erase material caveats, chronology, or evidentiary asymmetry. |
| [The Verge](https://www.theverge.com/ethics-statement) | Published separation of editorial and advertising, source rules, affiliate disclosures, independent reviews, and correction/update notes explaining material changes. | Clear content labels, disclosure of commercial relationships, specific correction notes, distinct formats. | Voice is compatible with accuracy, but analysis/opinion/commerce must not masquerade as straight news. |
| [Particle](https://particle.news/blog/3-ways-particle-detects-and-avoids-hallucinations-in-news-summaries) | Describes model evaluation, multi-step verification/regeneration, audit logs, human review, source-linked bullets, and user reporting. | Treat generated summaries as testable artifacts; log and evaluate failure modes; make sources visible. | Vendor performance claims are not independent proof. The platform needs its own measured evaluations and incident record. |
| [Ground News](https://ground.news/rating-system) | Shows coverage distribution and outlet bias/factuality/ownership, with third-party publication-level ratings and unrated-source handling. | Method transparency, coverage comparison, ownership context, reader correction/reporting affordance. | Publication-level ratings must not be presented as a truth score for an individual article or claim. |
| [Boring Report](https://www.boringreport.org/) | Intentionally lowers sensational language and links to sources. | Calm wording and non-alarmist presentation. | “Boring,” “neutral,” or “unbiased” wording is not a verification method. |

## Editorial promise

Recommended public promise:

> We help you understand what happened, what is supported, what remains uncertain, how coverage differs, and what changed. Every material correction is visible, and a human newsroom remains accountable for what we publish.

Do not promise:

- perfect neutrality;
- elimination of bias;
- complete coverage;
- real-time accuracy without qualification;
- that a high source count equals truth;
- that AI has independently “verified” reality.

## Content types and mandatory labels

| Type | Definition | Required treatment |
|---|---|---|
| **Reported news** | Facts gathered or verified by the newsroom through original reporting. | Named byline; sourcing; dateline when relevant; direct evidence; editor; update/correction history. |
| **Synthesis** | A concise account assembled from multiple identified sources. | “Synthesis” or equivalent label; source set; no implication of firsthand reporting; original wording; claim-level support. |
| **Live coverage** | Time-ordered updates during an ongoing event. | Entry timestamps; bylines; verification state per entry; clear distinction between event time and post time; corrected entries remain legible. |
| **Explainer** | Background that answers enduring questions. | Last reviewed date; linked current story; scope; sources; stale-fact review trigger. |
| **Analysis** | Evidence-based interpretation by a qualified writer/editor. | “Analysis” label at headline level; author expertise; factual basis; material counterevidence. |
| **Opinion** | A writer’s argued viewpoint. | “Opinion” label before click and on page; author affiliation/conflicts; factual corrections still apply. |
| **Review** | Independent evaluation of a product/service/work. | Review methodology; test conditions; affiliate/commercial disclosure; no advertiser approval. |
| **Fact check / verification** | Assessment of a discrete checkable claim or media artifact. | Exact claim; speaker/source; evidence; rating language defined; methodology; date/context; correction route. |
| **Sponsored content** | Content created or funded for an advertiser. | “Advertisement,” “Paid Advertisement,” or equally unambiguous label before click and on page; separate workflow; no newsroom byline or visual mimicry. |
| **AI-assisted output** | Material in which a model shaped reader-visible language, analysis, audio, or visuals. | Disclosure proportionate to the role; human owner; source support; model audit internally. Synthetic visuals require an adjacent label. |

## Story state and evidence language

### Fact states

- **Confirmed:** supported by a primary source or sufficiently corroborated reliable reporting and approved for publication.
- **Attributed claim:** a named source says it; the newsroom has not independently established it.
- **Unverified:** relevant information exists but support is insufficient.
- **Disputed:** credible sources materially conflict.
- **Withdrawn:** previously published claim is no longer supported; preserve the correction trail.
- **Forecast/estimate:** forward-looking or modeled; assumptions and source are visible.

### Language rules

Use:

- “Police said …”
- “The filing states …”
- “Two independent reports, neither confirmed by the agency, say …”
- “The available evidence does not establish …”
- “This is an inference from …”
- “The forecast assumes …”

Avoid:

- “It is believed …” without identifying by whom;
- “Reports say …” without source names;
- “Confirmed” when one interested party is the only source;
- “The internet is saying …”;
- “AI verified …”;
- “Both sides” when the evidence is materially unequal;
- “Unbiased” as a content label.

## Source hierarchy

Source class is a workflow aid, not an automatic credibility score.

1. **Primary evidence**
   - statutes, regulations, court records, filings, official datasets, audited reports, transcripts/recordings, direct observations, authenticated original documents.
2. **Original reporting**
   - identifiable newsroom/reporter with direct sourcing and a correction policy.
3. **Specialist evidence**
   - peer-reviewed research, recognized technical bodies, domain experts with disclosed credentials/conflicts.
4. **Secondary reporting and analysis**
   - useful corroboration/context; trace important claims to the original source where possible.
5. **Interested-party statements**
   - official, corporate, campaign, advocacy, attorney, or spokesperson claims; always attributed and independently checked.
6. **User/social material**
   - discovery leads until identity, time, location, authenticity, consent/rights, and context are verified.

### Minimum support

- Routine low-risk fact: one reliable direct source may suffice if the source is authoritative for that fact.
- Material contested claim: seek independent corroboration or keep it explicitly attributed/unverified.
- Serious allegation about an identifiable person: named human editor, right-of-reply effort where appropriate, documentary support, and legal review under newsroom policy.
- Breaking death, casualty, election, market, health, or emergency claim: use the applicable specialist protocol; do not let speed override confirmation.

Source-count graphics must deduplicate wire republications and circular citations. Ten pages repeating one report are still one evidentiary origin.

## Story dossier workflow

### 1. Intake

- record URL/source/author/publisher/published and retrieved times;
- classify source and content type;
- capture rights/usage restrictions;
- preserve the original headline and material metadata;
- flag conflicts, corrections, and known syndication.

### 2. Cluster

- match event, entities, location, time, and causal frame;
- prevent merges of recurring events, namesakes, separate legal counts, or analysis about a related subject;
- assign a human-review threshold for uncertain merges;
- retain provenance when a cluster is split or merged.

### 3. Extract claims

- atomize only material factual propositions;
- preserve attribution, negation, quantities, units, dates, modality, and quotation boundaries;
- link each claim to exact supporting locations;
- mark unsupported, contradictory, or derivative sourcing.

### 4. Verify

- prioritize primary evidence;
- trace secondary claims back to the first known report;
- confirm names, titles, dates, geography, numbers, and chronology;
- independently authenticate social media;
- check whether a source article was corrected or updated;
- seek response from a criticized party when fairness requires it.

### 5. Synthesize

- write from the claim/evidence record, not by paraphrasing a single article;
- include only supported facts;
- keep unresolved material in known/unknown/disputed;
- preserve uncertainty and attribution;
- ensure the summary does not substitute for a source’s distinctive full article.

### 6. Review

- run automated citation-entailment, entity, number/unit, quote, date, and contradiction checks;
- assign human review by risk tier;
- preview headline, social card, push alert, audio, and translation—not only the body;
- log the reviewer and material decisions.

### 7. Publish and monitor

- set first-published and materially-updated times;
- watch source updates/corrections and primary-event checkpoints;
- notify followers only on meaningful deltas;
- preserve every material change and correction.

## AI use policy

### Permitted with safeguards

- transcription and translation with review;
- entity/date/quote extraction;
- document summarization for internal research;
- clustering and duplicate detection;
- headline or brief drafts;
- alternate reading level and audio script from approved story state;
- source comparison;
- evidence-constrained reader questions;
- structured data and SEO-field drafting;
- grammar/style checks.

### Prohibited or presumptively prohibited

- inventing or reconstructing quotes;
- fabricating missing visual/audio evidence;
- photorealistic synthetic depictions of real news events;
- autonomous publication of high-risk breaking claims;
- identifying anonymous people from partial clues;
- inferring sensitive traits without a strong public-interest basis;
- using a model’s confidence as proof;
- writing around a paywall to reproduce the protected substance of an article;
- generating “local reporting” without reporting or attributable local sources.

### Reader disclosure

Disclose when AI had a material reader-visible role. Example:

> This brief was generated from the listed sources and reviewed by [desk/editor]. The newsroom is responsible for the published result.

Do not use disclosure as a substitute for verification. Minor grammar/spellcheck need not receive a prominent story label; internally record material model use according to policy.

## Headlines, briefs, and alerts

### Headline test

A headline must:

- state the established development, not the most dramatic allegation;
- identify the actor and action;
- preserve essential qualifiers;
- avoid unsupported causality;
- match the story’s current state;
- remain accurate when separated from the page;
- avoid questions that imply an unsupported answer;
- avoid imperatives, outrage cues, and curiosity gaps.

### Five-part brief

1. What happened
2. Latest confirmed
3. Why it matters
4. What is unknown or disputed
5. What happens next

Not every story needs all five, but absent sections should not be filled with speculation.

### Push alert

- Send only a new, material, verified development.
- Put the change in the first line.
- Attribute claims.
- Do not use “BREAKING” as a habitual attention device.
- Correct a materially wrong alert with another alert when the harm/importance warrants it.
- Let the user select urgency, topics, location, and quiet hours.

## Quotations

- Reproduce exact words; do not improve grammar unless policy permits a clearly indicated edit.
- Check quote against recording/transcript/notes.
- Do not splice separate remarks into one quote.
- Include enough context to avoid changing meaning.
- Translate accurately and state when the newsroom made the translation.
- Use the minimum excerpt needed; a link and attribution do not grant a right to reproduce extensive text.
- AI may locate a quote but a human must verify the quoted words and speaker before publication.

## Coverage comparison

Compare what can be supported:

- headlines and leads;
- facts included or omitted;
- people/institutions quoted;
- primary documents used;
- article type;
- ownership and syndication;
- publication/update timing;
- geographic perspective;
- clearly labeled analysis of framing.

Do not:

- score truth from left/center/right position;
- treat every difference as bias;
- compare an opinion column directly with a breaking report without labeling type;
- count identical wire copies as independent reporting;
- imply an unrated publisher is unreliable;
- hide the method or source of third-party ratings.

## Visual and audio integrity

- Preserve original meaning and context.
- Record creator, source, license, restrictions, caption, time, location, and alterations.
- Crop, tone, and edit only within the adopted visual-authenticity standard.
- Label file/handout/pool/composite/illustration/simulation/AI-generated material next to the asset.
- Never add/remove people or objects in documentary imagery.
- Verify social imagery through source, metadata where available, geolocation/chronology, reverse search, and corroboration.
- Captions state what is visible, when/where, and what is not independently verified.
- Synthetic voice must not impersonate a real journalist/source and must be disclosed.

## Corrections, updates, and removals

### Update

A new fact, clarification, link, or routine development that does not repair a material error.

Display:

- material update time;
- one-line change note when the reader would otherwise misunderstand what changed;
- prior story state in the internal log.

### Correction

A published statement, headline, visual, caption, alert, translation, or generated answer was materially wrong or misleading.

Display:

- “Correction” label;
- what was wrong;
- the corrected fact;
- when it changed;
- affected surfaces, including social/alert/audio where practical.

Do not silently overwrite a material error or use “updated” to conceal a correction.

### Removal

Remove only for a documented legal, safety, privacy, rights, or severe accuracy reason. Preserve an internal record and, where appropriate, a public note. Search deindexing, cache purge, syndication partner notice, and model knowledge-store cleanup must be part of the response plan.

## Sensitive coverage

Maintain specific checklists and senior review for:

- elections/voting logistics;
- conflict, terrorism, hostage events, and graphic casualties;
- crime allegations and private persons;
- suicide/self-harm;
- health and medicine;
- disasters/weather/emergency instructions;
- minors and sexual violence;
- markets-moving and personal-finance claims;
- leaked, hacked, private, or personal data.

These protocols should cover terminology, sourcing thresholds, privacy, contact/right of reply, visual warnings, helplines where verified and appropriate, advertising suppression, and escalation.

## Governance

Named owners:

- editor in chief — public standards and final editorial accountability;
- standards editor — corrections, sourcing, labels, high-risk protocols;
- AI/editorial systems lead — models, evaluation, incident response, disclosure;
- visuals editor — authenticity, captions, rights, sensitive imagery;
- audience editor — alerts, newsletters, recommendations, feedback;
- legal/privacy counsel — advice and escalation, not routine editorial delegation.

Publish:

- ownership and funding;
- masthead and author pages;
- editorial standards;
- AI use policy;
- corrections policy and correction log;
- conflicts/affiliate/sponsor rules;
- contact and report-an-error channel;
- source and coverage-comparison methodology.

## Release checklist

A story cannot ship until the responsible reviewer can answer “yes”:

- Is every material factual sentence supported by the linked evidence?
- Does each source actually support the nearby claim?
- Are primary source, original reporting, analysis, opinion, and interested-party statements distinguished?
- Are names, numbers, units, dates, locations, and chronology checked?
- Are allegations and uncertainty attributed in headline, brief, alert, and social card?
- Are wire copies/circular citations deduplicated?
- Did a human review the risk-appropriate surfaces?
- Is AI assistance disclosed when material?
- Are image/audio rights, authenticity, caption, and accessibility complete?
- Is “why it matters” evidence-based rather than speculative?
- Are known/unknown/disputed states honest?
- Is the update/correction history accurate?
- Can the criticized party’s relevant response be found?
- Does the story add original value rather than merely substitute for a source article?
