import type { Metadata } from "next";
import Link from "next/link";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { getBrandConfig } from "@/lib/brand/config";
import { safeStandardAuthRedirectPath } from "@/lib/auth/standard-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secure sign in",
  description: "Request a one-time Northline sign-in link.",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string | string[] }>;
}) {
  const parameters = await searchParams;
  const returnTo = safeStandardAuthRedirectPath(
    typeof parameters.return_to === "string" ? parameters.return_to : "/",
  );
  const enabled =
    (process.env.AUTH_PROVIDER?.trim().toLowerCase() || "standard") ===
      "standard" && process.env.AUTH_MAGIC_LINK_ENABLED === "true";
  const brand = getBrandConfig();

  return (
    <main className="account-auth">
      <section className="account-auth__panel" aria-labelledby="sign-in-title">
        <Link className="account-auth__brand" href="/">
          {brand.wordmark}
        </Link>
        <p className="account-auth__eyebrow">SECURE ACCOUNT ACCESS</p>
        <h1 id="sign-in-title">Your inbox is your sign-in key.</h1>
        <p className="account-auth__intro">
          Request a one-time link. Northline does not send passwords through
          email, and each link expires after 15 minutes.
        </p>
        <MagicLinkForm
          allowRegistration={
            enabled && process.env.AUTH_ALLOW_REGISTRATION === "true"
          }
          enabled={enabled}
          returnTo={returnTo}
        />
        <p className="account-auth__privacy">
          Sign-in attempts are rate limited and recorded in the security audit
          trail. The response never reveals whether an address has an account.
        </p>
      </section>
      <aside className="account-auth__aside">
        <p>Reader accounts</p>
        <h2>Save coverage without weakening newsroom controls.</h2>
        <ul>
          <li>Saved stories and topic preferences stay separate from staff roles.</li>
          <li>Active devices can be reviewed and revoked.</li>
          <li>Editorial access always requires an explicit server-side role.</li>
        </ul>
        <Link href="/trust">How Northline earns trust</Link>
      </aside>
    </main>
  );
}
