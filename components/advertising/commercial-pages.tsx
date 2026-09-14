import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  FileCheck2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBrandConfig } from "@/lib/brand/config";
import { getMediaKitData } from "@/lib/advertising/media-kit";
import { AdvertisingRequestForm } from "./request-form";
import { MediaKitPrintButton } from "./media-kit-print";
import styles from "./commercial-pages.module.css";

const placements = [
  ["Homepage moments", "Reserved, responsive placements around publisher content."],
  ["Article context", "Top, inline, end, and desktop sidebar options with density limits."],
  ["Category sponsorship", "A clearly labeled association with an eligible coverage area."],
  ["Newsletter", "Header, inline, or footer sponsorship booked to a specific issue."],
] as const;

const formats = [
  ["Image", "Approved static creative with a validated destination."],
  ["Native card", "Publisher-rendered copy, image, label, and call to action."],
  ["Newsletter sponsorship", "Issue-specific placement with preview and approval."],
  ["Sponsored content", "A separately reviewed, conspicuously labeled commercial format."],
] as const;

export function AdvertisePage() {
  const brand = getBrandConfig();
  return (
    <>
      <SiteHeader />
      <main className={styles.commercialPage}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Advertise with {brand.shortName}</p>
          <h1>Reach readers when context matters more than noise.</h1>
          <p>
            We are building a direct, brand-safe marketplace around useful US
            reporting. Every campaign is reviewed by people, every placement is
            labeled, and no commercial purchase changes editorial ranking.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/advertise/request">
              Start a campaign request <ArrowRight aria-hidden size={17} />
            </Link>
            <Link className={styles.secondaryAction} href="/advertise/media-kit">
              View media kit
            </Link>
          </div>
          <span className={styles.dataNotice}>
            Audience data available on request after launch.
          </span>
        </section>

        <section className={styles.valueStrip} aria-label="Commercial principles">
          <div>
            <Eye aria-hidden />
            <strong>Reader attention</strong>
            <span>Limited density and content-first loading.</span>
          </div>
          <div>
            <ShieldCheck aria-hidden />
            <strong>Brand safety</strong>
            <span>Sensitive pages can suppress all commercial inventory.</span>
          </div>
          <div>
            <FileCheck2 aria-hidden />
            <strong>Human approval</strong>
            <span>No campaign or creative publishes itself.</span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLead}>
            <p className={styles.eyebrow}>Placements</p>
            <h2>A small inventory, intentionally controlled.</h2>
            <p>
              Availability depends on editorial context, device behavior, campaign
              dates, frequency controls, and verified supply.
            </p>
          </div>
          <div className={styles.optionGrid}>
            {placements.map(([title, description]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.darkSection}>
          <div className={styles.sectionLead}>
            <p className={styles.eyebrow}>Launch formats</p>
            <h2>Creative that cannot take over the page.</h2>
          </div>
          <div className={styles.formatList}>
            {formats.map(([title, description], index) => (
              <div key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
          <p className={styles.policyNote}>
            Arbitrary third-party JavaScript, unlabeled coverage, sensitive-trait
            targeting, external CSS, and unapproved redirects are not accepted.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLead}>
            <p className={styles.eyebrow}>Campaign starting points</p>
            <h2>Briefs built around an objective—not invented scale.</h2>
          </div>
          <div className={styles.packageList}>
            <article>
              <span>Launch brief</span>
              <h3>One controlled placement</h3>
              <p>Useful for a focused message with a clear date window.</p>
            </article>
            <article>
              <span>Context sponsorship</span>
              <h3>Category or collection</h3>
              <p>Clearly labeled alignment around eligible, non-sensitive coverage.</p>
            </article>
            <article>
              <span>Inbox moment</span>
              <h3>Newsletter issue</h3>
              <p>A booked issue, previewed and approved before it sends.</p>
            </article>
          </div>
        </section>

        <section className={styles.faqSection}>
          <div>
            <p className={styles.eyebrow}>Frequently asked</p>
            <h2>Clear commercial boundaries.</h2>
          </div>
          <div>
            <details>
              <summary>Can I buy editorial coverage?</summary>
              <p>
                No. Sponsored work is commissioned and reviewed separately, carries a
                persistent SPONSORED label, and never masquerades as breaking news.
              </p>
            </details>
            <details>
              <summary>Can I run third-party tags?</summary>
              <p>
                Not at launch. Image and publisher-rendered native creative are the
                preferred formats. Any future provider requires privacy, consent, CSP,
                policy, and performance review.
              </p>
            </details>
            <details>
              <summary>What audience can I target?</summary>
              <p>
                Eligible country, device, placement, and broad content category only.
                Sensitive personal traits are prohibited.
              </p>
            </details>
            <details>
              <summary>Are forecasts guaranteed?</summary>
              <p>
                No. Forecasts are conservative ranges with assumptions and confidence;
                contracts define remedies for verified under-delivery.
              </p>
            </details>
          </div>
        </section>

        <section className={styles.closingCta}>
          <Mail aria-hidden />
          <h2>Bring us the objective. We’ll tell you what is actually available.</h2>
          <div>
            <Link className={styles.primaryAction} href="/advertise/request">
              Contact sales
            </Link>
            <Link className={styles.secondaryAction} href="/advertise/media-kit">
              View the media kit
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

export function MediaKitPage() {
  const brand = getBrandConfig();
  const kit = getMediaKitData();
  return (
    <>
      <SiteHeader />
      <main className={`${styles.commercialPage} ${styles.mediaKit}`}>
        <section className={styles.kitHeader}>
          <div>
            <p className={styles.eyebrow}>{brand.shortName} media kit</p>
            <h1>A transparent brief for thoughtful campaigns.</h1>
            <p>
              Public values appear only after a measurement source and verification
              date are configured. Private detail can be shared during qualification.
            </p>
          </div>
          <MediaKitPrintButton />
        </section>

        <section className={styles.metricSection}>
          <h2>Audience</h2>
          {kit.metrics.length > 0 ? (
            <div className={styles.metricGrid}>
              {kit.metrics.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>
                    {metric.source} · verified {metric.verifiedAt}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.unverifiedBlock}>
              <strong>Audience data available on request after launch.</strong>
              <p>
                No unverified pageview, user, subscriber, country, device, or
                interest figure is displayed in this preview.
              </p>
            </div>
          )}
        </section>

        <section className={styles.kitColumns}>
          <article>
            <h2>Geographic focus</h2>
            <p>{kit.countryDistribution ?? "United States launch focus; verified distribution pending."}</p>
          </article>
          <article>
            <h2>Device distribution</h2>
            <p>{kit.deviceDistribution ?? "Verified device distribution pending launch measurement."}</p>
          </article>
          <article>
            <h2>Category interests</h2>
            <p>{kit.categoryInterests ?? "No inferred sensitive interests are offered for targeting."}</p>
          </article>
        </section>

        <section className={styles.specTable}>
          <h2>Controlled placement guide</h2>
          <div
            aria-label="Advertising placement table"
            className={styles.tableScroll}
            role="region"
            tabIndex={0}
          >
            <table>
              <caption className="sr-only">Advertising placement guide</caption>
              <thead>
                <tr>
                  <th scope="col">Placement</th>
                  <th scope="col">Launch format</th>
                  <th scope="col">Mobile behavior</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Homepage leaderboard</th>
                  <td>Image</td>
                  <td>Responsive, reserved height</td>
                </tr>
                <tr>
                  <th scope="row">Article inline</th>
                  <td>Image or native card</td>
                  <td>Between content sections, never overlay</td>
                </tr>
                <tr>
                  <th scope="row">Newsletter</th>
                  <td>Image and approved copy</td>
                  <td>Issue preview required</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.kitPolicies}>
          <h2>What every campaign accepts</h2>
          <ul>
            <li><CheckCircle2 aria-hidden /> Conspicuous advertisement or sponsorship labeling.</li>
            <li><CheckCircle2 aria-hidden /> Creative, landing-page, rights, and policy review.</li>
            <li><CheckCircle2 aria-hidden /> Invalid activity excluded before billing.</li>
            <li><CheckCircle2 aria-hidden /> Editorial independence and sensitive-page suppression.</li>
            <li><CheckCircle2 aria-hidden /> Estimates separated from validated and billable events.</li>
          </ul>
        </section>

        <section className={styles.closingCta}>
          <h2>Ask for availability, dimensions, and a measured proposal.</h2>
          <Link className={styles.primaryAction} href="/advertise/request">
            Start a campaign request
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

export function AdvertisingRequestPage() {
  const production = process.env.APP_ENV === "production";
  const captchaRequired =
    production && process.env.CAPTCHA_REQUIRED?.toLowerCase() !== "false";
  const captchaServerConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY);
  return (
    <>
      <SiteHeader />
      <main className={styles.requestPage}>
        <AdvertisingRequestForm
          captchaServerConfigured={captchaServerConfigured}
          captchaRequired={captchaRequired}
        />
        <aside className={styles.requestAside}>
          <p className={styles.eyebrow}>Before you send</p>
          <h2>What happens next</h2>
          <ol>
            <li><span>1</span> Sales qualifies the company, objective, and policy fit.</li>
            <li><span>2</span> Ad Operations checks conservative inventory ranges.</li>
            <li><span>3</span> You receive a proposal; nothing runs without approval.</li>
          </ol>
          <div>
            <strong>We will never promise:</strong>
            <p>Exact future reach, editorial influence, hidden sponsorship, or targeting based on sensitive personal traits.</p>
          </div>
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}

export function SponsoredPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.policyHero}>
        <p className={styles.eyebrow}>Sponsored work</p>
        <h1>Commercial storytelling must look and behave like commercial storytelling.</h1>
        <p>
          Sponsored projects use a persistent SPONSORED label, sponsor identity,
          separate commercial authorship and analytics, claim review, and media-rights
          review. They do not enter ordinary breaking-news presentation.
        </p>
        <Link className={styles.primaryAction} href="/advertise/request">
          Discuss a sponsored brief
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}

export function MembershipPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.policyHero}>
        <p className={styles.eyebrow}>Membership foundation</p>
        <h1>A quieter, more personal edition is being prepared—not sold yet.</h1>
        <p>
          The product model supports ad-free reading, a premium briefing, saved Story
          Intelligence collections, advanced alerts, and audio briefings. Paid
          membership remains disabled until pricing, tax, support, refund, privacy, and
          payment operations are approved.
        </p>
        <Link className={styles.secondaryAction} href="/newsletter">
          Join the free briefing
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
