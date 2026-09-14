import {
  ArrowRight,
  Check,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrandConfig } from "@/lib/brand/config";
import { getPublicContentSnapshot } from "@/lib/content";
import type { Story } from "@/lib/site/types";
import { UnifiedNewsletterForm } from "../newsletter-form";
import { PageShell } from "../page-shell";
import {
  LocalFollowButton,
  ReaderPreferencePanel,
} from "../reader-actions";
import { SectionHeading, StoryCard } from "../story-ui";
import { PageIntro, toPublicSlug } from "./shared";

/**
 * A schedule here is a promise to a reader. It is only stated once a worker
 * exists that keeps it; until then the honest answer is that sign-ups are open
 * and the first issue has not been sent. Advertising "weekdays at 7 a.m." with
 * nothing scheduled to send it is the same class of claim as a reviewer who
 * never read the article.
 */
const newsletterProducts = [
  {
    id: "daily-brief",
    name: "The Daily Brief",
    schedule: "Not yet sending · sign up to be first",
    description: "Five consequential stories, distilled with context.",
  },
  {
    id: "breaking-updates",
    name: "Breaking Updates",
    schedule: "Only when it matters",
    description: "Verified major developments without alert fatigue.",
  },
  {
    id: "weekend-deep-reads",
    name: "Weekend Deep Reads",
    schedule: "Saturday · 9 a.m. ET",
    description: "The week’s strongest explainers and visual stories.",
  },
] as const;

export async function NewsletterPage() {
  const brand = getBrandConfig();
  const { mode, stories } = await getPublicContentSnapshot();
  return (
    <PageShell>
      <section className="newsletter-hero">
        <div className="shell newsletter-hero__inner">
          <div>
            <p className="story-eyebrow">{brand.name.toUpperCase()} NEWSLETTERS</p>
            <h1>The day, made legible.</h1>
            <p>
              Useful briefings with source links left in. Choose the rhythm that
              fits your day.
            </p>
          </div>
          <aside>
            <span>
              {stories[0]?.publishedAtIso
                ? new Intl.DateTimeFormat("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    timeZone: "America/New_York",
                  }).format(new Date(stories[0].publishedAtIso))
                : "Next issue in preparation"}
            </span>
            <h2>The Daily Brief</h2>
            <p>Three stories deserve your attention today.</p>
            <ol>
              {stories.slice(0, 3).map((story, index) => (
                <li key={story.slug}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {story.headline}
                </li>
              ))}
            </ol>
            {mode === "DEMO_FIXTURES" ? (
              <small>Preview only — fictional stories are never sent.</small>
            ) : null}
          </aside>
        </div>
      </section>
      <section className="shell newsletter-picker section-space">
        <SectionHeading title="Choose your briefings" />
        <UnifiedNewsletterForm products={newsletterProducts} />
        <div className="newsletter-trust">
          <div>
            <Check aria-hidden="true" />
            Double opt-in
          </div>
          <div>
            <Check aria-hidden="true" />
            One-click unsubscribe
          </div>
          <div>
            <Check aria-hidden="true" />
            Sponsorships labeled
          </div>
          <Link href="/account">
            Open reader preferences <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

type PolicyPageContent = {
  eyebrow: string;
  title: string;
  description: string;
  sections: Array<{ title: string; body: string[] }>;
};

const policyContent: Record<string, PolicyPageContent> = {
  about: {
    eyebrow: "ABOUT",
    title: "A newsroom built for understanding",
    description:
      "Northline is building a calmer, source-forward American news publication focused on evidence, context, and transparent updates.",
    sections: [
      {
        title: "Our purpose",
        body: [
          "Readers should be able to understand what happened, why it matters, what is confirmed, and what comes next without opening ten tabs.",
          "The operating goal is a few strong stories, not a publishing quota.",
        ],
      },
      {
        title: "Launch boundary",
        body: [
          "Development and staging environments may contain clearly labeled fixtures. Production publishes only reviewed database content with verified authorship, sourcing, and media rights.",
        ],
      },
    ],
  },
  "editorial-standards": {
    eyebrow: "TRUST",
    title: "Editorial standards",
    description:
      "The sourcing, verification, headline, correction, and approval rules behind the product.",
    sections: [
      {
        title: "Evidence before speed",
        body: [
          "A viral post is a lead, not proof. Central claims must trace to credible evidence, with primary records preferred when available.",
          "Sensitive coverage always requires human approval.",
        ],
      },
      {
        title: "Original reader value",
        body: [
          "Every story must add useful synthesis, context, comparison, primary documents, or a clear account of what remains uncertain.",
        ],
      },
      {
        title: "Headlines",
        body: [
          "Headlines must match the evidence and reject false urgency, unsupported superlatives, and tragedy exploitation.",
        ],
      },
    ],
  },
  "ai-policy": {
    eyebrow: "TRUST",
    title: "How Northline reports",
    description:
      "Northline uses software to find stories, gather sources and prepare drafts. This page describes how that works, where a person decides, and what we will not claim.",
    sections: [
      {
        title: "What the workflow actually does",
        body: [
          "Signals are collected from public trend and news-discovery feeds. A model with live web search then gathers candidate sources and returns exact URLs.",
          "A second stage extracts the specific factual claims a draft would make, and records which source supports each one.",
          "A drafting model writes the article from that dossier. A separate model, from a different provider, then checks each claim against the collected sources.",
          "Statements the review could not support are removed from the article before publication.",
          "A deterministic gate then decides whether the article may publish. It is code, not a model: it checks article length, source counts, whether the central claim is verified by a primary source, whether the reviewed text is the text being published, and whether any link appeared that review never examined.",
        ],
      },
      {
        title: "Where a person decides",
        body: [
          "Northline's editor reviews and releases articles. The workflow can also release an article on its own once it has cleared every check above, and that automatic release is currently switched off.",
          "Sensitive subjects — elections and politics, health, personal finance, legal accusations, crime, and coverage involving minors — carry a higher bar and are routed to the editor rather than released by the workflow.",
          "Any article the gate blocks is held for a person. It is not retried until it passes.",
        ],
      },
      {
        title: "What we do not claim",
        body: [
          "We do not claim a human read an article unless a human review record exists. Every article states its own workflow on the page, and where no human reviewed it, it says so.",
          "We do not describe the fact review as independent unless a different provider actually performed it.",
          "We do not present generated imagery as a photograph of an event. Illustrations are labelled as illustrations.",
        ],
      },
      {
        title: "Limitations you should know",
        body: [
          "A model can misread a source. The review stage reduces that risk; it does not eliminate it.",
          "Verification is only as good as the sources found. Where a claim could not be supported, the article says what remains unclear rather than asserting it.",
          "If you find an error, the corrections page explains how to report it. Corrections are published as new versions and the previous published version is preserved.",
        ],
      },
    ],
  },
  security: {
    eyebrow: "TRUST",
    title: "Security",
    description:
      "How to report a vulnerability in Northline, and what we commit to in return.",
    sections: [
      {
        title: "Reporting a vulnerability",
        body: [
          "Send details to the contact address listed on our contact page with 'Security' in the subject line. Include the affected URL, the steps to reproduce, and what you were able to access or change.",
          "Please report privately first and give us a reasonable opportunity to fix the issue before disclosing it publicly.",
        ],
      },
      {
        title: "What we ask you not to do",
        body: [
          "Do not access, modify, or delete data belonging to other people.",
          "Do not run denial-of-service tests, automated scanners against production, or social-engineering attempts against staff.",
          "Do not use a finding to obtain data beyond what is needed to demonstrate it.",
        ],
      },
      {
        title: "What we commit to",
        body: [
          "We will acknowledge a report and tell you whether we can reproduce it.",
          "We will not pursue action against good-faith research that follows the boundaries above.",
          "We do not currently operate a paid bounty programme.",
        ],
      },
      {
        title: "How the publication is protected",
        body: [
          "The newsroom is behind an identity boundary and is not reachable from the public site.",
          "Published article versions are immutable at the database level, and the audit trail is append-only, so a change to what was published leaves a record.",
          "Content Security Policy, HSTS, and frame protections are enforced on every response.",
        ],
      },
    ],
  },
  corrections: {
    eyebrow: "TRUST",
    title: "Corrections and updates",
    description:
      "Material changes remain visible and prior published versions stay preserved.",
    sections: [
      {
        title: "Corrections",
        body: [
          "A correction identifies what was wrong, what is accurate now, when it changed, and who approved the change.",
        ],
      },
      {
        title: "Retractions",
        body: [
          "If the central premise cannot be sustained, the story is retracted with an explanation rather than silently removed.",
        ],
      },
    ],
  },
  ownership: {
    eyebrow: "COMPANY",
    title: "Ownership and funding",
    description:
      "Who publishes Northline, who funds it, and who can influence what it covers.",
    sections: [
      {
        title: "Publisher",
        body: [
          "Northline is published and operated by Omar Mohamed, an independent founder-operator. It is not owned by a media group, a political organisation, or an advertiser.",
          "Editorial responsibility for everything on this site rests with the publisher. Contact: editorial@usnorthline.com.",
        ],
      },
      {
        title: "Funding",
        body: [
          "The publication is currently self-funded. It carries no outside investment, no political funding, and no undisclosed commercial arrangements.",
          "If that changes, this page states what changed and when, before the relationship affects any coverage.",
        ],
      },
      {
        title: "Editorial independence",
        body: [
          "Advertising approval and editorial decisions are separate. A sponsor cannot review coverage before publication, cannot request that a story be changed, and cannot have a story removed.",
          "Sponsored placements are labelled as such. The sponsored-content policy sets out how.",
        ],
      },
      {
        title: "Corrections authority",
        body: [
          "Corrections are published as new versions and the previously published version is preserved, so the record of what was published, and when, cannot be quietly rewritten.",
        ],
      },
    ],
  },
  funding: {
    eyebrow: "COMPANY",
    title: "Funding disclosure",
    description: "Active funding relationships and material support are disclosed here.",
    sections: [
      {
        title: "Launch principle",
        body: [
          "Future funding relationships must be disclosed and cannot grant editorial approval.",
        ],
      },
    ],
  },
  advertise: {
    eyebrow: "ADVERTISE",
    title: "Reach readers without interrupting them",
    description:
      "A direct-first advertising product designed around useful context, clear labels, and reader trust.",
    sections: [
      {
        title: "Planned placements",
        body: [
          "The commercial foundation supports display inventory, newsletter sponsorship, sponsored content, and category partnerships after approval.",
          "Audience figures are shared only when backed by verified analytics and a clearly stated reporting period.",
        ],
      },
      {
        title: "Non-negotiable rules",
        body: [
          "Ads may not imitate navigation, cover editorial content, create accidental clicks, or appear on sensitive pages without an explicit safety decision.",
          "Campaign requests remain unavailable until the secure lead workflow is enabled.",
        ],
      },
    ],
  },
  "sponsored-content-policy": {
    eyebrow: "TRUST",
    title: "Sponsored content policy",
    description:
      "Paid work must look and read unmistakably different from independent reporting.",
    sections: [
      {
        title: "Labels and control",
        body: [
          "Paid material carries a prominent SPONSORED or PAID PARTNERSHIP label on every distribution surface.",
          "Sponsors may review brand facts but cannot turn paid work into unlabeled editorial coverage.",
        ],
      },
    ],
  },
  privacy: {
    eyebrow: "LEGAL",
    title: "Privacy",
    description:
      "Collect the minimum useful data, explain its purpose, and give readers control.",
    sections: [
      {
        title: "Local reader preferences",
        body: [
          "Anonymous saves, follows, history, hidden subjects, and text size stay in this browser and can be reset from the account page.",
        ],
      },
      {
        title: "Account boundary",
        body: [
          "Authenticated preferences are protected by server-side authorization, session controls, and account-level privacy settings.",
        ],
      },
      {
        title: "Advertising and Google services",
        body: [
          "When advertising is enabled, Google and approved partners may use cookies or similar technologies to deliver, measure, and limit ads. Advertising remains disabled until the required consent controls and provider approvals are active.",
          "Readers in regulated regions receive the applicable consent choices before optional advertising storage is used. Northline does not sell account credentials or private newsroom data to advertisers.",
        ],
      },
    ],
  },
  cookies: {
    eyebrow: "LEGAL",
    title: "Cookie choices",
    description:
      "Necessary storage keeps the product working; optional analytics and advertising require separate review.",
    sections: [
      {
        title: "Storage and consent",
        body: [
          "Necessary storage keeps authentication, security, and reader settings working. Optional analytics or advertising storage is activated only under the applicable consent policy.",
          "Google advertising cookies and personalized advertising are not activated where consent is required until the reader has made a valid choice through the configured consent-management platform. Consent can be changed later from the site privacy controls.",
        ],
      },
    ],
  },
  terms: {
    eyebrow: "LEGAL",
    title: "Terms of use",
    description:
      "These terms govern access to Northline’s public site, newsletters, reader tools, and newsroom services.",
    sections: [
      {
        title: "Content and availability",
        body: [
          "Reporting may be corrected, updated, withdrawn, or made unavailable when evidence, rights, safety, or legal requirements change. Staging fixtures are never presented as current production news.",
        ],
      },
    ],
  },
  contact: {
    eyebrow: "CONTACT",
    title: "Talk to the right desk",
    description:
      "Every address below is on this domain. AdSense, Google News and any reader with a complaint need a real channel, not a description of one.",
    sections: [
      {
        title: "Corrections and factual disputes",
        body: [
          "corrections@usnorthline.com",
          "Identify the story, quote the disputed statement, and say what the correct information is and how it can be checked. Corrections are published as a new version, and the previously published version is preserved.",
        ],
      },
      {
        title: "Editorial and news tips",
        body: [
          "editorial@usnorthline.com",
          "For story suggestions, source material, and questions about how a piece was reported.",
        ],
      },
      {
        title: "Advertising and sponsorship",
        body: [
          "advertising@usnorthline.com",
          "Commercial enquiries only. Advertising has no influence on editorial decisions; the sponsored-content policy explains how paid placements are labelled.",
        ],
      },
      {
        title: "Privacy and data requests",
        body: [
          "privacy@usnorthline.com",
          "For access, correction, or deletion requests relating to data this site holds about you.",
        ],
      },
      {
        title: "Security",
        body: [
          "security@usnorthline.com",
          "For vulnerability reports. The security page sets out the boundaries we ask researchers to work within.",
        ],
      },
      {
        title: "What we will not do",
        body: [
          "Only addresses published on this domain are official. We do not operate contact channels on other sites, and we will never ask for a password or a payment detail by email.",
        ],
      },
    ],
  },
};

export function PolicyPage({ slug }: { slug: string }) {
  const content = policyContent[slug];
  if (!content) notFound();
  return (
    <PageShell>
      <header className="policy-header">
        <div className="shell policy-width">
          <p className="story-eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
          <span>Last reviewed July 24, 2026</span>
        </div>
      </header>
      <div className="policy-layout shell policy-width">
        <aside>
          <p>ON THIS PAGE</p>
          {content.sections.map((section) => (
            <a key={section.title} href={`#${toPublicSlug(section.title)}`}>
              {section.title}
            </a>
          ))}
          <Link href="/contact">Contact information</Link>
        </aside>
        <article>
          {content.sections.map((section) => (
            <section id={toPublicSlug(section.title)} key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </PageShell>
  );
}

type DirectoryType =
  | "topics"
  | "sources"
  | "authors"
  | "people"
  | "companies"
  | "teams";
type DirectoryEntry = { label: string; slug: string };

/**
 * Accountability for the newsroom byline.
 *
 * Articles carry "Northline Newsroom" rather than a personal name, which is
 * accurate - they are assembled by an editorial workflow, not written by one
 * reporter - but on its own it leaves a reader with nobody to hold responsible.
 * The publisher is already named on /ownership; repeating it on the page a
 * reader reaches by clicking the byline is what makes the byline answerable.
 *
 * Every claim below restates /ownership. If that page changes, change this too.
 */
function NewsroomBylineNote() {
  return (
    <div className="byline-accountability">
      <p>
        Northline Newsroom is the byline for reporting assembled by
        Northline&rsquo;s editorial workflow, which researches a topic, gathers
        sources and prepares a draft. Every article lists the sources it was
        built from.
      </p>
      <p>
        Editorial responsibility rests with the publisher, Omar Mohamed, an
        independent founder-operator. Corrections and questions go to{" "}
        <a href="mailto:editorial@usnorthline.com">editorial@usnorthline.com</a>.
      </p>
      <p>
        <Link href="/ai-policy">How Northline reports</Link>
        {" · "}
        <Link href="/editorial-standards">Editorial standards</Link>
        {" · "}
        <Link href="/corrections">Corrections</Link>
        {" · "}
        <Link href="/ownership">Ownership</Link>
      </p>
    </div>
  );
}

export async function DirectoryPage({
  type,
  slug,
}: {
  type: DirectoryType;
  slug?: string;
}) {
  const brand = getBrandConfig();
  const { mode, stories } = await getPublicContentSnapshot();
  const labels: Record<DirectoryType, string> = {
    topics: "Topics",
    sources: "Sources",
    authors: "Authors",
    people: "People",
    companies: "Companies",
    teams: "Teams",
  };
  const entries = directoryEntries(type, stories, mode);

  if (slug) {
    const entry = entries.find((candidate) => candidate.slug === slug);
    if (!entry) notFound();
    const sourceRecord =
      type === "sources"
        ? stories
            .flatMap((story) => story.sources)
            .find((source) => source.id === slug)
        : undefined;
    const name = sourceRecord?.name ?? entry.label;
    const connectedStories = sourceRecord
      ? stories.filter((story) =>
          story.sources.some((source) => source.id === sourceRecord.id),
        )
      : stories.filter((story) =>
          storyMatchesDirectoryEntry(story, type, entry),
        );
    const followKind =
      type === "companies"
        ? "company"
        : type === "teams"
          ? "team"
          : type === "authors" || type === "people"
            ? "person"
            : type === "topics"
              ? "topic"
              : null;

    return (
      <PageShell>
        <PageIntro
          eyebrow={`${labels[type].toUpperCase()} PROFILE`}
          title={name}
          description={`A transparent profile connecting ${name} to published coverage and source notes.`}
          aside={
            followKind ? (
              <LocalFollowButton kind={followKind} label={name} />
            ) : undefined
          }
        />
        <section className="shell profile-layout section-space">
          <div className="profile-card">
            <span aria-hidden="true">{name[0]}</span>
            <div>
              <h2>{name}</h2>
              <p>
                {sourceRecord
                  ? `${mode === "DEMO_FIXTURES" ? "Development fixture · " : ""}Tier ${sourceRecord.tier} · ${sourceRecord.kind}`
                  : `${mode === "DEMO_FIXTURES" ? "Development fixture · " : ""}${type.slice(0, -1)} profile`}
              </p>
              {sourceRecord ? <p>{sourceRecord.note}</p> : null}
              {/* An author page listing articles and nothing else tells a
                  reader - and Google's news transparency guidance - nothing
                  about who stands behind them. Naming the accountable editor
                  and how to reach them is the whole point of the page. */}
              {type === "authors" ? <NewsroomBylineNote /> : null}
            </div>
            <ShieldCheck aria-hidden="true" />
          </div>
          <div>
            <SectionHeading title={`Coverage connected to ${name}`} />
            <div className="profile-stories">
              {connectedStories.map((story) => (
                <StoryCard
                  key={story.slug}
                  story={story}
                  variant="horizontal"
                  titleLevel={2}
                />
              ))}
            </div>
          </div>
        </section>
      </PageShell>
    );
  }

  if (type === "topics") {
    return <SectionsPage stories={stories} mode={mode} brand={brand} />;
  }

  return (
    <PageShell>
      <PageIntro
        eyebrow="DIRECTORY"
        title={labels[type]}
        description={
          mode === "DEMO_FIXTURES"
            ? `Browse ${brand.name}’s demo ${labels[type].toLowerCase()} directory.`
            : `Browse ${brand.name}’s ${labels[type].toLowerCase()} directory.`
        }
      />
      <section className="shell directory-grid section-space">
        {entries.length ? (
          entries.map((entry) => (
            <Link href={`/${type}/${entry.slug}`} key={entry.slug}>
              <div>
                <h2>{entry.label}</h2>
                <p>
                  {
                    stories.filter((story) =>
                      storyMatchesDirectoryEntry(story, type, entry),
                    ).length
                  }{" "}
                  published stories
                </p>
              </div>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))
        ) : (
          <div className="public-empty-state directory-empty-state">
            <h2>No published {labels[type].toLowerCase()} yet</h2>
            <p>
              This directory will populate from reviewed production coverage. It
              does not fall back to sample profiles or invented counts.
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}

/**
 * `/topics` used to list every distinct category and topic string as an
 * equal-weight tile - "Sports" beside "Ian Happ" beside "Lewis Hamilton" -
 * with no minimum for how many stories earned a subject its own tile. That
 * read as a database export, not a section front.
 *
 * This groups by section instead: one card per category, with its real
 * story count and a short preview of what is actually there right now. A
 * category never needs a minimum to appear - if Northline published one
 * weather story today, Weather is a real section - but a category is not
 * listed as a subsection alongside real ones either; genuine subsections
 * (Baseball, Tennis, Politics) would need each story classified into one,
 * which nothing in the pipeline does yet. Advertising subsections without
 * that classification behind them would be the same mistake this rebuild
 * exists to fix, just one level down.
 */
function SectionsPage({
  stories,
  mode,
  brand,
}: {
  stories: Story[];
  mode: "DATABASE" | "DEMO_FIXTURES";
  brand: ReturnType<typeof getBrandConfig>;
}) {
  const sections = Array.from(
    new Map(
      stories.map((story) => [story.category, story.category] as const),
    ).keys(),
  )
    .map((category) => {
      const inSection = stories.filter((story) => story.category === category);
      return {
        category,
        slug: toPublicSlug(category),
        label: sectionLabel(category),
        stories: inSection,
      };
    })
    .sort((a, b) => b.stories.length - a.stories.length);

  return (
    <PageShell>
      <PageIntro
        eyebrow="SECTIONS"
        title="Browse by section"
        description={
          mode === "DEMO_FIXTURES"
            ? `Browse ${brand.name}’s demo coverage by section.`
            : `Every section ${brand.name} is currently covering, with what is published right now.`
        }
      />
      <section className="shell sections-grid section-space">
        {sections.length ? (
          sections.map((section) => (
            <article className="sections-grid__card" key={section.category}>
              <Link href={`/topics/${section.slug}`}>
                <h2>{section.label}</h2>
                <span>
                  {section.stories.length}{" "}
                  {section.stories.length === 1 ? "story" : "stories"}
                </span>
              </Link>
              <ul>
                {section.stories.slice(0, 3).map((story) => (
                  <li key={story.slug}>
                    <Link href={`/story/${story.slug}`}>{story.headline}</Link>
                  </li>
                ))}
              </ul>
            </article>
          ))
        ) : (
          <div className="public-empty-state directory-empty-state">
            <h2>No published sections yet</h2>
            <p>
              This page will populate from reviewed production coverage. It
              does not fall back to sample profiles or invented counts.
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function sectionLabel(category: string): string {
  const key = category.trim().toUpperCase();
  const labels: Record<string, string> = {
    US_NEWS: "U.S.",
    WORLD: "World",
    POLITICS: "Politics",
    BUSINESS: "Business",
    FINANCE: "Finance",
    TECHNOLOGY: "Technology",
    SCIENCE: "Science",
    HEALTH: "Health",
    SPORTS: "Sports",
    ENTERTAINMENT: "Entertainment",
    GAMING: "Gaming",
    WEATHER: "Weather",
    INTERNET_TRENDS: "Internet",
  };
  return (
    labels[key] ??
    key
      .split(/[_\s]+/u)
      .filter(Boolean)
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ")
  );
}

export function PersonalPage({
  type,
}: {
  type: "saved" | "following" | "account";
}) {
  const copy = {
    saved: {
      eyebrow: "YOUR LIBRARY",
      title: "Saved stories",
      description: "Stories saved anonymously in this browser.",
    },
    following: {
      eyebrow: "YOUR WATCHLIST",
      title: "Following",
      description: "Topics and entities followed anonymously on this device.",
    },
    account: {
      eyebrow: "READER CONTROLS",
      title: "Your briefing",
      description:
        "Review local reading history, text size, and personalization boundaries.",
    },
  }[type];

  return (
    <PageShell>
      <PageIntro {...copy} />
      <div className="shell personal-page section-space">
        <ReaderPreferencePanel view={type} />
      </div>
    </PageShell>
  );
}

function directoryEntries(
  type: DirectoryType,
  stories: Story[],
  mode: "DATABASE" | "DEMO_FIXTURES",
): DirectoryEntry[] {
  if (type === "sources") {
    return Array.from(
      new Map(
        stories
          .flatMap((story) => story.sources)
          .map((source) => [
            source.id,
            { label: source.name, slug: source.id },
          ]),
      ).values(),
    );
  }
  if (type === "authors" || type === "people") {
    return Array.from(new Set(stories.map((story) => story.author))).map(
      (author) => ({ label: author, slug: toPublicSlug(author) }),
    );
  }
  if (type === "companies" || type === "teams") {
    if (mode !== "DEMO_FIXTURES") return [];
    const fixtureLabels =
      type === "companies"
        ? ["Arcadia Systems", "Lake Union Energy Cooperative", "Northstar Studios"]
        : ["Harbor City", "Summit"];
    return fixtureLabels.map((label) => ({ label, slug: toPublicSlug(label) }));
  }
  return Array.from(
    new Set(stories.flatMap((story) => [story.category, ...story.topics])),
  ).map((label) => ({ label, slug: toPublicSlug(label) }));
}

function storyMatchesDirectoryEntry(
  story: Story,
  type: DirectoryType,
  entry: DirectoryEntry,
): boolean {
  if (type === "sources") {
    return story.sources.some((source) => source.id === entry.slug);
  }
  if (type === "authors" || type === "people") {
    return toPublicSlug(story.author) === entry.slug;
  }
  if (type === "topics") {
    return (
      toPublicSlug(story.category) === entry.slug ||
      story.topics.some((topic) => toPublicSlug(topic) === entry.slug)
    );
  }
  return JSON.stringify(story)
    .toLowerCase()
    .includes(entry.label.toLowerCase());
}
