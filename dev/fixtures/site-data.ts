import type { Story, Trend } from "../../lib/site/types";

export const sections = [
  "Top Stories",
  "Latest",
  "Trending",
  "Technology",
  "Business",
  "Entertainment",
  "Sports",
  "Gaming",
  "Science",
] as const;

export const stories: Story[] = [
  {
    slug: "neighborhood-batteries-heat-grid",
    category: "Science",
    eyebrow: "Energy · Field guide",
    headline:
      "Neighborhood batteries get their first real test during a week of extreme heat",
    dek: "Five pilot communities are measuring whether shared storage can cut peak demand without asking households to change their routines.",
    summary:
      "A regional energy cooperative has activated community-scale batteries across five fictional pilot neighborhoods. Early operating data shows lower evening demand, but the most important reliability test is still ahead.",
    status: "Developing",
    format: "Deep Explainer",
    published: "July 24, 2026 · 8:10 a.m. ET",
    updated: "July 24, 2026 · 11:42 a.m. ET",
    readTime: 7,
    image:
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1800&q=84",
    imageAlt:
      "Rows of solar panels under a clear sky, used as illustrative demo media",
    imageCredit: "Illustrative photo · Unsplash",
    accent: "coral",
    score: 96,
    trend: 92,
    author: "Maya Chen",
    reviewer: "Elena Brooks",
    topics: ["Energy", "Extreme heat", "Infrastructure"],
    whyItMatters:
      "Shared storage could give dense neighborhoods grid resilience without requiring every renter or homeowner to buy a battery. The pilot will also show whether the economics work when demand is highest.",
    whyTrending:
      "Search interest accelerated after the cooperative issued its first public operating bulletin and heat advisories expanded across the demo region.",
    keyFacts: [
      "Five fictional neighborhoods are participating in the two-week pilot.",
      "The batteries discharge between 5 p.m. and 9 p.m., when demand is highest.",
      "No outages have been attributed to the pilot system.",
      "A full independent performance report is scheduled for August.",
    ],
    body: [
      {
        paragraphs: [
          "A network of neighborhood-scale batteries began discharging during peak hours this week as a prolonged heat wave pushed electricity use higher across the fictional Lake Union service area.",
          "The trial is designed to answer a practical question: can shared batteries reduce stress on local equipment without requiring residents to monitor prices or manually change when they use power?",
        ],
      },
      {
        heading: "What the first readings show",
        paragraphs: [
          "The cooperative’s demo bulletin reports a measurable reduction in evening demand at four of the five sites. Engineers cautioned that those figures are operational readings, not yet an independently audited result.",
          "The fifth site held more energy in reserve because its feeder serves a cooling center. That choice lowered its peak reduction but preserved emergency capacity.",
        ],
      },
      {
        heading: "The bigger test",
        paragraphs: [
          "Reliability matters more than a single strong evening. The pilot must repeat its performance through several high-demand days, document battery degradation, and show that benefits are distributed fairly among participating households.",
          "This Story Intelligence page will be updated when the cooperative posts daily data and when the independent review is released.",
        ],
      },
    ],
    timeline: [
      {
        time: "July 8",
        title: "Pilot commissioned",
        detail:
          "Five community battery sites complete safety checks and begin baseline monitoring.",
        status: "context",
      },
      {
        time: "July 22 · 5 p.m.",
        title: "First heat activation",
        detail:
          "Operators begin the first four-hour peak-discharge window.",
        status: "confirmed",
      },
      {
        time: "July 24 · 10 a.m.",
        title: "Operating bulletin posted",
        detail:
          "The cooperative publishes preliminary readings from the first two evenings.",
        status: "confirmed",
      },
      {
        time: "August",
        title: "Independent report expected",
        detail:
          "Auditors are scheduled to publish performance and equity findings.",
        status: "watching",
      },
    ],
    sources: [
      {
        id: "demo-grid-bulletin",
        locator: "/sources/demo-grid-bulletin",
        name: "Lake Union Energy Cooperative",
        kind: "Primary",
        tier: 1,
        note: "Demo operating bulletin and hourly readings",
      },
      {
        id: "demo-safety-record",
        locator: "/sources/demo-safety-record",
        name: "Regional Safety Commission",
        kind: "Primary",
        tier: 1,
        note: "Demo commissioning record",
      },
      {
        id: "demo-lab-context",
        locator: "/sources/demo-lab-context",
        name: "Center for Distributed Energy",
        kind: "Context",
        tier: 2,
        note: "Technical background on community storage",
      },
    ],
    uncertainties: [
      "Performance across a longer multi-day heat event has not been independently verified.",
      "The final cost per participating household has not been published.",
    ],
    next:
      "Daily operating data is expected through the weekend. The decisive evidence will be the independent August report, including equipment stress and cost findings.",
  },
  {
    slug: "relay-ai-device-private-beta",
    category: "Technology",
    eyebrow: "AI & Technology",
    headline:
      "Relay’s on-device assistant enters a limited beta with one unusual privacy promise",
    dek: "The fictional product processes personal context locally by default. Our checklist separates the documented controls from the company’s marketing claims.",
    summary:
      "Arcadia Systems has opened a fictional beta for Relay, an on-device assistant that keeps its personal memory on the user’s hardware unless cloud features are explicitly enabled.",
    status: "Verified",
    format: "Quick Brief",
    published: "July 24, 2026 · 9:25 a.m. ET",
    updated: "July 24, 2026 · 9:25 a.m. ET",
    readTime: 4,
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=84",
    imageAlt: "Close view of electronic circuitry used as a demo illustration",
    imageCredit: "Illustrative photo · Unsplash",
    accent: "blue",
    score: 95,
    trend: 88,
    author: "Noah Williams",
    reviewer: "Priya Raman",
    topics: ["Artificial intelligence", "Privacy", "Consumer technology"],
    whyItMatters:
      "On-device processing can limit exposure of personal information, but the privacy benefit depends on which tasks still leave the device and how clearly the product communicates those boundaries.",
    whyTrending:
      "Interest rose after beta invitations reached developers and a short product demo was posted to the fictional company newsroom.",
    keyFacts: [
      "The beta is fictional demo content and is not a real product announcement.",
      "Personal memory is documented as local by default.",
      "Cloud-powered actions require a separate opt-in.",
      "Independent security testing has not yet been published.",
    ],
    body: [
      {
        paragraphs: [
          "Arcadia Systems opened a limited beta Thursday for Relay, a fictional personal assistant designed to store its memory on a user’s device rather than in a central account.",
          "The distinction is meaningful, but it does not make every action local. The product documentation says web research and cross-device sync still use cloud services after a user opts in.",
        ],
      },
      {
        heading: "What is documented",
        paragraphs: [
          "Beta materials include a data-flow screen, a one-tap memory reset, and per-feature cloud controls. They do not yet include a third-party security assessment or a complete retention schedule for optional cloud actions.",
        ],
      },
      {
        heading: "What testers should watch",
        paragraphs: [
          "The clearest test will be whether network logs match the controls shown in the interface. We will add independent findings to this dossier when they are available.",
        ],
      },
    ],
    timeline: [
      {
        time: "July 18",
        title: "Developer documentation published",
        detail: "Arcadia outlines the fictional product’s local memory model.",
        status: "confirmed",
      },
      {
        time: "July 24",
        title: "Limited beta begins",
        detail: "Invitations begin rolling out to a small tester group.",
        status: "confirmed",
      },
      {
        time: "Not scheduled",
        title: "Independent assessment",
        detail: "No third-party security report has been announced.",
        status: "watching",
      },
    ],
    sources: [
      {
        id: "relay-docs",
        locator: "/sources/relay-docs",
        name: "Arcadia Systems beta documentation",
        kind: "Primary",
        tier: 1,
        note: "Demo product and privacy documentation",
      },
      {
        id: "relay-release-notes",
        locator: "/sources/relay-release-notes",
        name: "Relay release notes",
        kind: "Primary",
        tier: 1,
        note: "Demo build scope and known limitations",
      },
      {
        id: "privacy-lab",
        locator: "/sources/privacy-lab",
        name: "Applied Privacy Lab",
        kind: "Context",
        tier: 2,
        note: "General framework for evaluating local AI claims",
      },
    ],
    uncertainties: [
      "No independent security review is available.",
      "The company has not published beta crash-log retention periods.",
    ],
    next:
      "The beta is expected to expand in August. The most useful next evidence will be network testing and a complete data-retention table.",
  },
  {
    slug: "aurora-3-final-test",
    category: "Science",
    eyebrow: "Space · Mission tracker",
    headline:
      "Aurora-3 clears its thermal test, keeping an October launch window in reach",
    dek: "The fictional weather satellite still has two review gates before it can ship to the launch site.",
    summary:
      "Aurora-3 completed a 12-day thermal-vacuum test. Program records show two remaining reviews before the fictional satellite can be cleared for shipment.",
    status: "Updated",
    format: "Standard",
    published: "July 23, 2026 · 4:40 p.m. ET",
    updated: "July 24, 2026 · 7:05 a.m. ET",
    readTime: 5,
    image:
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1600&q=84",
    imageAlt: "Space shuttle above Earth used as illustrative demo media",
    imageCredit: "Illustrative photo · Unsplash",
    accent: "violet",
    score: 94,
    trend: 74,
    author: "Avery Brooks",
    reviewer: "Elena Brooks",
    topics: ["Space", "Weather", "Satellites"],
    whyItMatters:
      "The fictional spacecraft is designed to improve storm-intensity measurements, but the schedule only matters if the remaining software and flight-readiness reviews close without major findings.",
    whyTrending:
      "The project released time-lapse footage of its chamber test, leading to a short burst of interest among space and weather communities.",
    keyFacts: [
      "The fictional thermal-vacuum test lasted 12 days.",
      "No major hardware anomaly was reported.",
      "Software validation and flight readiness remain open.",
      "The target launch window begins in October.",
    ],
    body: [
      {
        paragraphs: [
          "Aurora-3 has completed the environmental test most likely to expose how its instruments respond to rapid temperature changes in orbit.",
          "Program managers said the fictional spacecraft met its thermal limits, but they have not declared it ready to launch.",
        ],
      },
      {
        heading: "Two gates remain",
        paragraphs: [
          "A software validation review is scheduled before the flight-readiness board. Either review could produce additional work and move the shipping date.",
        ],
      },
    ],
    timeline: [
      {
        time: "July 11",
        title: "Thermal testing begins",
        detail: "The spacecraft enters the vacuum chamber.",
        status: "confirmed",
      },
      {
        time: "July 23",
        title: "Test completed",
        detail: "The program reports no major hardware anomaly.",
        status: "confirmed",
      },
      {
        time: "August",
        title: "Software review",
        detail: "Validation results are due before flight readiness.",
        status: "watching",
      },
    ],
    sources: [
      {
        id: "aurora-test-log",
        locator: "/sources/aurora-test-log",
        name: "Aurora-3 mission test log",
        kind: "Primary",
        tier: 1,
        note: "Demo environmental test record",
      },
      {
        id: "aurora-board",
        locator: "/sources/aurora-board",
        name: "Joint Weather Mission Board",
        kind: "Primary",
        tier: 1,
        note: "Demo review calendar",
      },
    ],
    uncertainties: ["The complete anomaly log has not been released."],
    next:
      "The mission’s software validation review is scheduled for August. A launch date cannot be considered firm before the later flight-readiness review.",
  },
  {
    slug: "harbor-city-final-comeback",
    category: "Sports",
    eyebrow: "Sports · Final",
    headline:
      "Harbor City turns a six-point deficit into a final-minute championship win",
    dek: "A verified fictional result, the decisive sequence, and the numbers that changed the game.",
    summary:
      "Harbor City scored eight unanswered points in the final 74 seconds to win the fictional National Summer League title.",
    status: "Verified",
    format: "Quick Brief",
    published: "July 23, 2026 · 11:18 p.m. ET",
    updated: "July 23, 2026 · 11:55 p.m. ET",
    readTime: 3,
    image:
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=84",
    imageAlt: "Basketball hoop in an arena used as illustrative demo media",
    imageCredit: "Illustrative photo · Unsplash",
    accent: "gold",
    score: 94,
    trend: 81,
    author: "Marcus Lee",
    reviewer: "Jon Bell",
    topics: ["Basketball", "Harbor City", "National Summer League"],
    whyItMatters:
      "The result completes a fictional season-long turnaround and gives Harbor City its first title in the demo league.",
    whyTrending:
      "A final-minute steal and go-ahead shot drove a sharp spike in searches immediately after the broadcast.",
    keyFacts: [
      "Final score: Harbor City 88, Summit 86.",
      "Harbor City closed on an 8–0 run.",
      "The box score and final result were verified against the official demo league feed.",
    ],
    body: [
      {
        paragraphs: [
          "Harbor City erased a six-point deficit in the final 74 seconds Thursday night, defeating Summit 88–86 for its first fictional National Summer League championship.",
          "A steal with 14 seconds remaining created the go-ahead possession. The final attempt at the other end missed at the buzzer.",
        ],
      },
    ],
    timeline: [
      {
        time: "1:14 remaining",
        title: "Summit leads by six",
        detail: "Harbor City calls its final timeout.",
        status: "confirmed",
      },
      {
        time: "0:14 remaining",
        title: "Decisive steal",
        detail: "Harbor City takes possession and scores on the next trip.",
        status: "confirmed",
      },
      {
        time: "Final",
        title: "Harbor City wins 88–86",
        detail: "The league feed marks the result official.",
        status: "confirmed",
      },
    ],
    sources: [
      {
        id: "nsl-box",
        locator: "/sources/nsl-box",
        name: "National Summer League box score",
        kind: "Primary",
        tier: 1,
        note: "Demo official result and play-by-play",
      },
      {
        id: "nsl-video",
        locator: "/sources/nsl-video",
        name: "National Summer League broadcast",
        kind: "Primary",
        tier: 1,
        note: "Demo official video",
      },
    ],
    uncertainties: [],
    next:
      "The league is expected to publish its full officiating report Friday afternoon.",
  },
  {
    slug: "summer-light-festival-access",
    category: "Entertainment",
    eyebrow: "Culture · What changed",
    headline:
      "Summer Light Festival adds quiet spaces and a clearer accessibility map",
    dek: "The fictional event’s redesign follows a year of attendee feedback. Here is what is new and what remains unclear.",
    summary:
      "A fictional music festival has expanded quiet areas, captioned stages, and accessible routes. Its shuttle plan is not yet final.",
    status: "Verified",
    format: "Standard",
    published: "July 23, 2026 · 2:15 p.m. ET",
    updated: "July 23, 2026 · 3:01 p.m. ET",
    readTime: 4,
    image:
      "https://images.unsplash.com/photo-1553101497-d1cd9d74660b?auto=format&fit=crop&w=1600&q=84",
    imageAlt: "Crowd gathered at an outdoor music festival",
    imageCredit: "Photo by Toa Heftiba · Unsplash",
    accent: "green",
    score: 92,
    trend: 69,
    author: "Sofia Alvarez",
    reviewer: "Priya Raman",
    topics: ["Live music", "Accessibility", "Summer Light"],
    whyItMatters:
      "Accessibility information is most useful before tickets and travel are finalized. Clear route and service details help attendees decide whether an event can meet their needs.",
    whyTrending:
      "The updated access guide circulated widely after disability advocates highlighted its venue maps.",
    keyFacts: [
      "Two quiet spaces are shown on the new fictional site map.",
      "Three stages are listed with live captions.",
      "Accessible shuttle details remain pending.",
    ],
    body: [
      {
        paragraphs: [
          "Summer Light Festival published a redesigned fictional access guide Thursday, adding step-free route maps, two quiet spaces, and live captions at three stages.",
          "The guide is more specific than last year’s version, but transportation details remain incomplete.",
        ],
      },
      {
        heading: "What still needs an answer",
        paragraphs: [
          "The festival has not posted accessible shuttle frequency or the cutoff for advance assistance requests. Organizers say those details will be added before August ticket fulfillment.",
        ],
      },
    ],
    timeline: [
      {
        time: "June",
        title: "Attendee feedback review",
        detail: "Organizers summarize the fictional 2025 access survey.",
        status: "context",
      },
      {
        time: "July 23",
        title: "New access map published",
        detail: "Routes, quiet spaces and captioned stages are added.",
        status: "confirmed",
      },
    ],
    sources: [
      {
        id: "festival-guide",
        locator: "/sources/festival-guide",
        name: "Summer Light access guide",
        kind: "Primary",
        tier: 1,
        note: "Demo venue map and service list",
      },
      {
        id: "festival-faq",
        locator: "/sources/festival-faq",
        name: "Summer Light attendee FAQ",
        kind: "Primary",
        tier: 1,
        note: "Demo transportation status",
      },
    ],
    uncertainties: ["Accessible shuttle schedules have not been published."],
    next:
      "Organizers say transportation and assistance-request details will arrive before August ticket fulfillment.",
  },
  {
    slug: "driftline-cooperative-mode",
    category: "Gaming",
    eyebrow: "Gaming · Hands-on",
    headline:
      "Driftline’s cooperative mode fixes the game’s loneliest problem",
    dek: "The fictional update turns a beautiful solo builder into a shared planning game—without changing its calm pace.",
    summary:
      "Northstar Studios has released a fictional cooperative update for Driftline, adding shared building and a reversible permissions system.",
    status: "Verified",
    format: "Standard",
    published: "July 22, 2026 · 1:20 p.m. ET",
    updated: "July 22, 2026 · 1:20 p.m. ET",
    readTime: 5,
    image:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1600&q=84",
    imageAlt: "Gaming computers lit in a dark venue, used as demo media",
    imageCredit: "Illustrative photo · Unsplash",
    accent: "blue",
    score: 91,
    trend: 66,
    author: "Jamie Park",
    reviewer: "Jon Bell",
    topics: ["Gaming", "Driftline", "Co-op"],
    whyItMatters:
      "The update answers the most consistent fictional player request while preserving granular control over who can change a shared world.",
    whyTrending:
      "The studio’s update video led to a short increase in searches for multiplayer limits and cross-platform support.",
    keyFacts: [
      "Co-op supports four fictional players.",
      "Hosts can reverse guest changes for 72 hours.",
      "Cross-platform play remains in testing.",
    ],
    body: [
      {
        paragraphs: [
          "Driftline’s long-requested cooperative mode is now available in the fictional game’s 2.0 update, allowing up to four players to plan and build in the same world.",
          "The strongest idea is not the player count. It is a reversible permission history that lets hosts inspect and undo guest changes without rolling back the entire session.",
        ],
      },
    ],
    timeline: [
      {
        time: "March",
        title: "Co-op announced",
        detail: "Northstar Studios previews shared building.",
        status: "context",
      },
      {
        time: "July 22",
        title: "Version 2.0 released",
        detail: "Four-player co-op becomes available.",
        status: "confirmed",
      },
    ],
    sources: [
      {
        id: "driftline-notes",
        locator: "/sources/driftline-notes",
        name: "Driftline 2.0 release notes",
        kind: "Primary",
        tier: 1,
        note: "Demo feature list and limitations",
      },
      {
        id: "driftline-guide",
        locator: "/sources/driftline-guide",
        name: "Northstar support guide",
        kind: "Primary",
        tier: 1,
        note: "Demo permissions and restore behavior",
      },
    ],
    uncertainties: ["Cross-platform launch timing is not confirmed."],
    next:
      "The studio says cross-platform testing will expand next month, with a public schedule to follow.",
  },
];

export const trends: Trend[] = [
  {
    rank: 1,
    term: "Neighborhood batteries",
    category: "Energy",
    velocity: 94,
    regions: ["Pacific Northwest", "Northeast", "California"],
    explanation:
      "A public operating bulletin and expanding heat advisories produced a sustained rise in search and source activity.",
    confidence: "High",
    related: ["community storage", "heat grid", "peak demand"],
    storySlug: "neighborhood-batteries-heat-grid",
  },
  {
    rank: 2,
    term: "Relay AI beta",
    category: "Technology",
    velocity: 88,
    regions: ["Nationwide", "Bay Area", "Austin"],
    explanation:
      "Developer invitations and a product demo concentrated interest around privacy controls and local processing.",
    confidence: "High",
    related: ["on-device AI", "local memory", "Arcadia Relay"],
    storySlug: "relay-ai-device-private-beta",
  },
  {
    rank: 3,
    term: "Harbor City final",
    category: "Sports",
    velocity: 81,
    regions: ["Mid-Atlantic", "Great Lakes"],
    explanation:
      "A dramatic final sequence triggered a short, event-driven spike immediately after the broadcast.",
    confidence: "High",
    related: ["final score", "championship", "last play"],
    storySlug: "harbor-city-final-comeback",
  },
  {
    rank: 4,
    term: "Aurora-3 mission",
    category: "Science",
    velocity: 74,
    regions: ["Nationwide"],
    explanation:
      "Thermal-test footage increased discovery, while search behavior centers on schedule and mission purpose.",
    confidence: "Medium",
    related: ["weather satellite", "October launch", "thermal test"],
    storySlug: "aurora-3-final-test",
  },
  {
    rank: 5,
    term: "Summer Light access map",
    category: "Entertainment",
    velocity: 69,
    regions: ["West Coast", "Mountain West"],
    explanation:
      "Accessibility advocates shared the revised venue guide, creating a focused interest spike.",
    confidence: "Medium",
    related: ["festival accessibility", "quiet space", "live captions"],
    storySlug: "summer-light-festival-access",
  },
];

export const storyBySlug = (slug: string) =>
  stories.find((story) => story.slug === slug);

export const featuredStory = stories[0];

export const mostRead = [
  stories[1],
  stories[3],
  stories[0],
  stories[4],
  stories[2],
];

export const liveUpdates = [
  {
    time: "11:42 a.m. ET",
    title: "Peak-demand readings added to the battery pilot dossier",
    detail:
      "Four of five demo sites recorded lower evening demand. Independent verification is still pending.",
    story: stories[0],
  },
  {
    time: "10:18 a.m. ET",
    title: "Relay beta documentation clarifies when cloud processing begins",
    detail:
      "The new flow chart separates local memory from opt-in web and sync actions.",
    story: stories[1],
  },
  {
    time: "9:04 a.m. ET",
    title: "Aurora-3 program posts its next two review gates",
    detail:
      "Software validation remains scheduled before the flight-readiness board.",
    story: stories[2],
  },
];

export const sourceComparison = [
  {
    source: "Primary bulletin",
    focus: "Hourly performance",
    adds: "Operating readings and reserve decisions",
    omits: "Independent cost analysis",
  },
  {
    source: "Safety record",
    focus: "Commissioning",
    adds: "Inspection dates and equipment limits",
    omits: "Live performance",
  },
  {
    source: "Technical context",
    focus: "How shared storage works",
    adds: "Comparable pilot design principles",
    omits: "Project-specific conclusions",
  },
];

export const newsroomStats = [
  { label: "Signals today", value: "247", delta: "+18%" },
  { label: "Qualified candidates", value: "12", delta: "4 new" },
  { label: "Human review", value: "6", delta: "2 high risk" },
  { label: "Published today", value: "3", delta: "0 auto" },
];

export const candidateQueue = [
  {
    title: "Regional battery pilots enter peak-demand test",
    category: "Science",
    score: 92,
    risk: "Medium",
    state: "RESEARCHING",
    sources: 7,
    primary: 2,
  },
  {
    title: "On-device AI beta opens to first testers",
    category: "Technology",
    score: 88,
    risk: "Low",
    state: "FACT_REVIEW",
    sources: 5,
    primary: 2,
  },
  {
    title: "Emergency cooling centers extend hours",
    category: "U.S.",
    score: 86,
    risk: "High",
    state: "HUMAN_REVIEW_REQUIRED",
    sources: 9,
    primary: 4,
  },
  {
    title: "Four-player builder update draws steady interest",
    category: "Gaming",
    score: 72,
    risk: "Low",
    state: "CANDIDATE",
    sources: 3,
    primary: 1,
  },
];
