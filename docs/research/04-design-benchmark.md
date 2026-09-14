# Design benchmark

**Research date:** 2026-07-24
**Method:** Direct review of current public home/story surfaces where available, supplemented by first-party app/help pages. Observations describe the reviewed surface; recommendations are original design guidance, not instructions to copy a competitor’s trade dress.

## Competitive patterns

| Product | Current design observation | What works | Friction or limitation | Principle to adapt |
|---|---|---|---|---|
| [Particle](https://particle.news/) | Dense feed cards lead into a highly modular cluster with overview, articles, podcasts, quotes, questions, and related stories. | The page makes a story feel like an explorable object rather than one article. | Many modules compete for attention; the AI layer can visually dominate the sources. | Use progressive disclosure and keep evidence/source access adjacent to every synthetic element. |
| [Ground News](https://ground.news/) | Data-rich cards and cluster pages expose coverage distribution, filters, outlet metadata, and comparison charts. | Comparison is visible at decision time, not hidden on an about page. | High information density and tier locks make the trust model harder to parse quickly. | Put the simplest coverage fact first, explain labels inline, and reveal detailed methodology on demand. |
| [Boring Report](https://www.boringreport.org/app) | Very quiet category feed and plain summary page with little chrome. | Low cognitive load and low-arousal presentation. | Sparse pages lack strong evidence, authorship, state, and change cues. | Keep the calm surface, but let trust information be visually quiet rather than absent. |
| [Yahoo News](https://www.yahoo.com/news/) | Portal layout mixes a lead grid, personalized modules, comment signals, publisher cards, newsletter prompts, and frequent ads. | Broad content discovery and familiar account/engagement controls. | Editorial hierarchy competes with ad/recommendation density; publisher provenance is easy to skim past. | Preserve breadth with stronger module boundaries, source labels, and an explicit ad-density budget. |
| [Reuters](https://www.reuters.com/) | Restrained black/orange business-news system, market ticker, strong lead package, linked follow-ons, and long categorical homepage. | Clear authority, compact headline scanning, and disciplined media treatment. | The breadth is utilitarian and dense for casual orientation. | Build a professional editorial spine, then layer optional plain-language context rather than more simultaneous modules. |
| [AP](https://apnews.com/) | Large visual lead, “More Coverage,” event packages, Latest, rich photography/video, and many recurring discovery sections. | Excellent visual provenance and strong developing-story packaging. | The homepage becomes very long; priority can blur below the top package. | Use a finite first-screen briefing and place deeper discovery after a clear completion boundary. |
| [BBC News](https://www.bbc.com/news) | Calm black/white modular grid with clear lead, section labels, standfirsts, More to Explore, Most Watched/Read, and restrained accent color. | Strong hierarchy and cross-format discovery without relying on decorative UI. | Ads and broad global scope can interrupt the reading rhythm; personalization is not prominent. | Use typography, spacing, and editorial grouping as the primary hierarchy tools. |
| [Axios](https://www.axios.com/) | Narrow measure, generous whitespace, short modules, and repeated semantic labels such as “Why it matters.” | Fastest scanning and clearest relevance cue in the set. | Repetition can make different stories feel structurally identical and can compress nuance. | Adopt semantic signposts, but vary depth and expose supporting evidence. |
| [The Verge](https://www.theverge.com/) | Expressive hero mosaic, dark/light modes, Top/Latest/Following, rapid Quick Posts, immersive features, strong illustration and typography. | Distinct identity and excellent differentiation among news, quick posts, reviews, and features. | Visual density can become demanding; commerce/editorial proximity requires careful labeling. | Create distinct templates by editorial job while retaining a calmer general-news shell. |

## Recommended design position

**Recommendation:** “Calm evidence, visible motion.”

- **Calm evidence:** neutral surfaces, generous reading space, unambiguous typography, restrained color, no alarmist animation.
- **Visible motion:** developing stories visibly change through timestamps, deltas, timelines, state chips, and upcoming checkpoints.
- **Editorial confidence:** strong hierarchy and photography where licensed, without imitating any reviewed brand’s palette, typography, logo system, card shape, or signature composition.

## Information architecture

### Global navigation

Primary:

- Home
- Latest
- US
- Politics
- Economy
- Technology
- Climate
- Health
- World
- Local

Utilities:

- Search / Ask
- Daily Brief
- Following
- Saved
- Account and preferences

**Recommendation:** Keep “Latest” semantically distinct from “Home.” Latest is reverse chronological and filterable; Home is an editorially ranked briefing with optional personalization. Never silently pin, backdate, or insert an ad that resembles an item in Latest.

### Homepage hierarchy

1. **Status rail:** only active, high-consequence developing situations; no generic ticker.
2. **Lead package:** one primary story plus up to three genuinely related developments.
3. **Your finite brief:** 8–12 items, completion state, “why shown,” and mute controls.
4. **Latest confirmed:** chronological stream of material story changes, not duplicate articles.
5. **US consequences:** policy, economy, courts, public safety, and location-aware impacts.
6. **Coverage worth comparing:** stories where source emphasis materially diverges.
7. **Deep context:** explainers, timelines, investigations, and visual reporting.
8. **Media:** video, audio, and photo essays labeled by format.
9. **Newsletters/topics:** a restrained follow/briefing module.

**Recommendation:** The first viewport should answer “What matters now?” It should not try to represent every section.

## Desktop layout

Use a flexible 12-column system:

- maximum content shell: approximately 1,280–1,360 px;
- outer gutters: 24–40 px depending on viewport;
- story reading measure: approximately 680–760 px;
- evidence/utility rail: approximately 280–340 px;
- gap between story and rail: 32–48 px;
- line length: roughly 55–75 characters for sustained prose.

These are starting constraints for testing, not immutable tokens.

### Story page composition

| Region | Contents |
|---|---|
| Masthead | Section, story state, factual headline, standfirst, author/editor, publish/update times, save/follow/share |
| Orientation | Latest confirmed, five-point brief, why it matters, known/unknown/disputed |
| Main narrative | Reported/synthesized sections with inline evidence chips and expandable source support |
| Intelligence rail | Story follow, update delta, primary documents, coverage count, next checkpoint, listening control |
| Deep modules | Timeline, people/organizations, coverage comparison, contradictions, media, questions, related explainers |
| Accountability | Material update log, corrections, AI-assistance disclosure, methodology, contact/report issue |

On long pages, the rail may become a compact sticky index, but it must not obscure focused elements, trap keyboard users, or compete with reading.

### Story state vocabulary

Use both icon/shape and text, never color alone:

- **Developing** — verified core event, material facts still changing
- **Confirmed** — key event established by sufficient evidence
- **Disputed** — material claims conflict
- **Explainer** — background/evergreen orientation
- **Resolved** — defined outcome occurred
- **Corrected** — a material published error was fixed

Avoid green/red “truth meters.” They imply a precision the evidence model cannot support.

## Mobile layout

### First screen

Prioritize:

1. state + section;
2. headline;
3. one-line latest-confirmed delta;
4. byline and update time;
5. follow/save;
6. compact “Read the brief” entry.

Do not place a full-width ad, app-install interstitial, or autoplaying video between the headline and essential orientation.

### Navigation

A five-item bottom bar can work for:

- Home
- Latest
- Search/Ask
- Following
- Saved/Account

Section navigation remains in a menu or horizontal list with an accessible non-drag alternative. Do not require swiping to reach a section.

### Progressive disclosure

- Collapse long source lists into “Sources (24),” while keeping primary documents visible.
- Render the first evidence citation inline; expose additional support in a sheet or accordion.
- Provide a sticky “Latest / Brief / Timeline / Sources” index after the user scrolls beyond the masthead.
- Preserve URL fragments and browser back behavior for opened modules.

## Component guidance

### Story cards

Required elements:

- section or topic;
- plain headline;
- one-sentence verified change or standfirst;
- source identity or “synthesized from N sources”;
- published/updated age with absolute time available;
- state chip;
- media credit when an image is used;
- recommendation explanation on personalized surfaces.

Optional:

- read time;
- follow state;
- coverage-comparison cue;
- local consequence.

Avoid:

- generic “AI Summary” sparkle icons as a trust signal;
- comment/engagement counts as the dominant hierarchy;
- images unrelated to the specific event;
- truncated publisher names;
- sponsored cards using the same label position/color as editorial cards.

### Evidence chips

The compact state should show:

- source/issuer;
- primary or reporting designation;
- publication date;
- direct link affordance.

The expanded state should show:

- exact supporting excerpt within rights limits;
- page/paragraph/timestamp when available;
- retrieval time;
- whether another source corroborates it;
- any conflict or correction.

### Coverage comparison

Start with neutral dimensions:

- number of distinct sources;
- publisher ownership;
- geography;
- article type: original report, wire republication, analysis, opinion, transcript;
- facts or voices emphasized;
- sources/documents cited;
- first publication and update time.

Political orientation can be an optional, method-explained attribute where reliable data exists. It should never be the sole organizing axis.

### Ask

- Default the text field to a private interaction.
- State that answers are limited to the current story dossier.
- Attach citations at sentence/claim level.
- Show the answer’s “information current through” time.
- Provide “No supported answer found.”
- Separate suggested questions from questions asked by other users.
- Never make a public question feed the default; public posting requires an explicit choice and moderation.

## Typography and color

### Typography

Use an original pairing:

- editorial serif or humanist face for feature headlines only;
- highly legible sans-serif for navigation, briefs, data, and body;
- tabular numerals for times, market/election figures, and timelines;
- minimum default body size around 17–18 px on desktop and 16–18 px on mobile, validated with user testing;
- body line-height around 1.55–1.7.

Do not use typography to imitate Reuters, BBC, Axios, AP, or The Verge. Type licenses and webfont performance must be recorded.

### Color

Use a mostly neutral canvas and reserve semantic color:

- one brand accent for actions/navigation;
- amber/orange for developing or attention, not danger;
- red only for destructive actions, correction/error, or genuine emergency context;
- blue/teal for evidence/primary-source affordances;
- gray with text labels for unavailable/unverified;
- opinion, analysis, and sponsored content receive distinct labeled treatments.

All status meanings need a text/icon redundant cue.

## Visual media

- Lead with a licensed, specific image only when it adds evidence or understanding.
- Always show creator/source and a useful caption near the asset.
- Preserve crop focal points; never crop away context that changes meaning.
- For composite, file, illustrative, or AI-generated visuals, place the label at the image—not only in metadata.
- Prefer maps, timelines, document excerpts, and data graphics when they explain causality or geography better than a stock image.
- Never use a generated photorealistic image to depict an actual news event.

AP and Reuters demonstrate rigorous credits; The Verge demonstrates strong commissioned art direction; BBC demonstrates useful format mixing. The platform should combine those principles with its own visual language and rights ledger.

## Advertising integration

Design inventory before ad tags:

- reserve exact slot dimensions to prevent layout shifts;
- label “Advertisement” above the creative;
- visually separate native sponsorship from story cards;
- keep the first story orientation uninterrupted;
- place initial inline display only after a meaningful content block;
- keep sticky units small, dismissible where appropriate, and outside controls;
- do not insert ads into source/evidence lists, corrections, or known/unknown blocks;
- suppress or restrict ads on graphic, casualty, self-harm, crime-victim, and emergency-instruction contexts.

The [Coalition for Better Ads](https://www.betterads.org/standards/) identifies pop-ups, autoplay video with sound, countdown prestitials, large sticky ads, and high-density experiences among formats users find least acceptable.

## Accessibility baseline

Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) and include disabled users in usability testing.

- semantic landmark and heading order;
- skip link;
- keyboard access to every control;
- visible, unobscured focus;
- minimum target sizing and adequate spacing;
- screen-reader names that match visible labels;
- captions, transcripts, and audio descriptions where required;
- useful alternative text; empty `alt` for decorative images;
- no information conveyed by color, hover, drag, or animation alone;
- zoom/reflow without loss of content or function;
- pause/stop/hide for moving or auto-updating regions;
- polite live-region announcements only for user-relevant material changes;
- reduced-motion support;
- accessible authentication without memory/puzzle barriers;
- chart tables or text summaries for every data visualization.

## Performance budget

Use field performance at the 75th percentile. Current [Core Web Vitals](https://web.dev/articles/vitals) “good” thresholds are:

- LCP at or below 2.5 seconds;
- INP at or below 200 milliseconds;
- CLS at or below 0.1.

Design implications:

- server-render the essential story state and metadata;
- do not block the brief on personalization or ad auctions;
- lazy-load below-fold embeds and comparison visualizations;
- self-host/subset fonts where licensing permits;
- responsive images with explicit dimensions;
- hydrate only interactive islands;
- reserve space for ads, captions, embeds, and late-arriving story modules;
- provide a low-data mode without autoplay and with reduced imagery.

## Design acceptance checklist

A story template is not ready unless a reviewer can answer:

- What changed, and when?
- What is confirmed, unknown, or disputed?
- Which source supports each generated factual statement?
- Who wrote, generated, reviewed, and last updated this?
- Is the main image specifically relevant, licensed, credited, captioned, and accessible?
- Can a keyboard/screen-reader user reach every source and module?
- Can a user complete the page’s core task before any ad or signup interruption?
- Are editorial, analysis, opinion, AI assistance, affiliate, and advertising visibly distinct?
- Does the page remain readable with JavaScript failure, 200% zoom, reduced motion, and a narrow viewport?
- Does a returning reader see a meaningful delta instead of a generic “updated” label?
