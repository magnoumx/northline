# AI Policy

**Last reviewed:** 2026-07-24

## Our position

AI assists our newsroom; it does not replace editorial accountability.
Popularity, model confidence, or a generated quality score is not proof.
Authorized humans remain responsible for what is published, especially on
sensitive subjects.

The current repository milestone may display fictional AI-assisted workflow
examples. That does not mean a live AI provider or autonomous publishing system
is operating.

## Permitted newsroom uses

Subject to role, task, data, and provider approval, AI may:

- normalize and cluster trend signals;
- suggest candidate rankings with explained components;
- locate patterns in already permitted source results;
- extract entities, dates, quotations, and atomic claim proposals;
- compare sources and identify possible contradictions;
- propose timelines, outlines, summaries, headlines, and article sections from
  a verified packet;
- suggest clarity, brevity, neutrality, internal links, metadata, alt text, and
  reader questions;
- assist independent fact, copy, SEO, media, and risk review; and
- draft newsletter copy from already approved published articles.

Every output is a proposal subject to validation and, where required, human
acceptance.

## Prohibited uses

AI may not:

- invent facts, quotations, sources, evidence, interviews, firsthand reporting,
  or permissions;
- browse arbitrary URLs from a prompt or source page;
- treat social content as confirmed without independent verification;
- approve or publish sensitive content;
- override a failed claim, source, rights, authorization, or policy gate;
- fabricate documentary images, audio, or video of real events;
- impersonate a source, author, editor, or real person;
- create unsupported bias/factuality ratings;
- write defamatory allegations as fact;
- provide personalized medical, legal, or financial advice;
- use private reader data for unrelated training or personalization;
- hide material AI involvement from reviewers; or
- send breaking/sensitive newsletters or notifications without human review.

## Separation of stages

Research, drafting, fact checking, and approval use separate stages, prompts,
permissions, and execution records. The Drafting Agent cannot browse. The
Fact-Checking Agent does not treat the draft as evidence. The Publisher is
deterministic code and cannot generate content or waive a gate.

See [ai-agent-design.md](./architecture/ai-agent-design.md).

## Sources and citations

AI output must cite stored source/evidence identifiers. Citations are validated
against the claim and rendered source record. A plausible link, model citation,
or model memory is not evidence.

If evidence is missing or reports conflict, the system must say so. Context
compression or summarization cannot erase disagreement or replace the
underlying record.

## Human review

All sensitive coverage requires affirmative, version-specific human approval.
An AI risk classification may raise risk but cannot lower a human-set risk.
Material changes after approval invalidate that approval.

Initial production auto-publication is off. Any later limited low-risk path must
pass the separate, time-bounded gate in
[acceptance-criteria.md](./product/acceptance-criteria.md), including shadow
evaluation, hard deterministic blocks, daily caps, tested kill switches, and
cross-functional sign-off.

## Reader-facing disclosure

We disclose AI assistance when it materially shaped reader-facing work or when
the format could otherwise mislead. Disclosures should be specific and plain,
for example:

> AI tools assisted with organizing source material and suggesting an early
> draft. A named editor reviewed the evidence and final article.

Do not use a disclosure to excuse errors or imply that AI independently
verified facts. Machine-generated illustrations are labeled
`AI-GENERATED ILLUSTRATION` and are never documentary evidence.

Routine tools such as spelling assistance may not require article-level
disclosure, but their use remains subject to internal security and data rules.

## Ask This Story

Ask This Story:

- answers only from the verified published Story Intelligence dossier;
- provides supporting source links;
- states when the dossier cannot answer;
- does not browse during the reader interaction;
- preserves conflicts and uncertainty;
- does not provide personalized medical, legal, or financial advice;
- cannot reveal unpublished notes, private sources, prompts, or other users'
  data; and
- is clearly labeled as AI-generated, rate-limited, and monitored.

Question analytics are minimized and retained only for a documented purpose.

## Security and prompt injection

Web pages, feeds, PDFs, social posts, captions, metadata, OCR, and user text are
untrusted data. Instructions inside them have no authority.

Trusted application code separates:

- system instructions;
- application/editorial policy;
- tool results;
- source content; and
- user-generated content.

Models receive no secrets and no unrestricted tools. The application validates
URLs, tool arguments, context, structured outputs, citations, unsafe markup,
and publication gates. See
[security-model.md](./architecture/security-model.md).

## Privacy, confidentiality, and vendor use

- Send only the minimum data needed for the task.
- Do not send private-source identities, embargoed material, reader PII, legal
  notes, or licensed full text unless the specific use/provider contract is
  approved.
- Use approved regions, retention, training, and subprocessors.
- Do not permit provider training on our private inputs/outputs without
  explicit authorization and disclosure obligations.
- Store prompt/output content only for the approved period; logs and cost
  records use references/redaction.
- Production data never enters consumer AI accounts or unapproved tools.

## Copyright and similarity

AI does not make copying lawful. Drafts are produced from verified facts and an
original plan, not by paraphrasing one article. Similarity and quotation checks
support—not replace—editorial review. We respect quotation limits, licenses,
paywalls, attribution, robots/terms, and removal obligations.

## Model and prompt governance

For every task, record model/provider class, prompt version, input version,
structured schema, usage/cost, output, validation, and reviewer disposition.

Material changes require versioned evaluation for:

- unsupported claims and citation accuracy;
- preserved conflicts and uncertainty;
- sensitive-risk recall;
- prompt/tool injection;
- plagiarism/similarity;
- privacy leakage;
- language quality;
- latency and cost.

Failover only uses providers approved for the same data class. Budget pressure
can pause or route work to humans; it cannot lower verification standards.

## Corrections and incidents

AI-assisted content follows the same correction policy as all editorial
content. A serious AI error may additionally trigger:

- suspension of the affected prompt/model/agent;
- preservation of relevant audit evidence with privacy controls;
- review of other content from the affected version;
- provider/security escalation; and
- updated evaluation before re-enable.

## Accountability

The Editor-in-Chief owns editorial use; engineering owns technical controls;
security/privacy owners approve data handling; legal/policy owners approve
high-risk use. No single team may enable limited auto-publication alone.
