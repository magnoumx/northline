import Link from "next/link";
import { getBrandConfig } from "@/lib/brand/config";
import { resolveContentMode } from "@/lib/content/read-service";
import { BrandMark } from "./brand-mark";

const footerGroups = [
  {
    title: "Read",
    links: [
      ["Latest", "/latest"],
      ["U.S.", "/topics/u-s-news"],
      ["Sports", "/topics/sports"],
      ["Entertainment", "/topics/entertainment"],
      ["Weather", "/topics/weather"],
    ],
  },
  {
    title: "About",
    links: [
      ["About", "/about"],
      ["Editorial standards", "/editorial-standards"],
      ["AI policy", "/ai-policy"],
      // Editorial output rather than policy, but it belongs beside the
      // accountability pages because it is the evidence for them.
      ["Verification record", "/record"],
      ["Corrections", "/corrections"],
      ["Ownership", "/ownership"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Business",
    links: [
      ["Advertise", "/advertise"],
      // The staff console is reachable at /newsroom by anyone who holds an
      // Access identity. Advertising it in the public footer only invites
      // readers to a sign-in wall they can never pass.
    ],
  },
] as const;

export function SiteFooter() {
  const brand = getBrandConfig();
  const demoMode = resolveContentMode() === "DEMO_FIXTURES";
  return (
    <footer className="site-footer">
      <div className="shell site-footer__grid">
        <div className="site-footer__brand">
          <BrandMark brand={brand} inverted showWordmark />
          <p>{brand.tagline}</p>
          {demoMode ? (
            <small>
              Product preview. Every editorial story and audience signal is
              fictional unless identified as a licensed media credit.
            </small>
          ) : null}
        </div>
        {footerGroups.map((group) => (
          <nav key={group.title} aria-label={`${group.title} links`}>
            <h2>{group.title}</h2>
            {group.links.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="shell site-footer__bottom">
        <p>© {new Date().getFullYear()} {brand.name}</p>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
