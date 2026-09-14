import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "@/app/chatgpt-auth";
import { getBrandConfig } from "@/lib/brand/config";
import { AdvertiserNavigation } from "@/components/advertiser/portal-shell";
import styles from "@/components/advertiser/portal.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Advertiser portal",
  robots: { index: false, follow: false },
};

export default async function AdvertiserLayout({
  children,
}: {
  children: ReactNode;
}) {
  const brand = getBrandConfig();
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className={styles.authGate}>
        <Link href="/" className={styles.authBrand}>
          {brand.wordmark}
        </Link>
        <div>
          <ShieldCheck aria-hidden />
          <p>Protected advertiser workspace</p>
          <h1>Sign in before opening commercial records.</h1>
          <span>
            Organization membership is enforced on the server. Signing in does not
            automatically grant access to an advertiser.
          </span>
          <a href={chatGPTSignInPath("/advertiser")}>Sign in securely</a>
          <Link href="/advertise">Return to advertising information</Link>
        </div>
      </main>
    );
  }

  const enabled = process.env.FEATURE_ADVERTISER_PORTAL === "true";
  return (
    <div className={styles.portal}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.portalBrand}>
          <Building2 aria-hidden />
          <span>
            <strong>{brand.wordmark}</strong>
            <small>Advertiser portal</small>
          </span>
        </Link>
        <AdvertiserNavigation />
        <div className={styles.portalUser}>
          <strong>{user.displayName}</strong>
          <span>{user.email}</span>
          <a href={chatGPTSignOutPath("/")}>Sign out</a>
        </div>
      </aside>
      <main className={styles.portalMain}>
        {!enabled ? (
          <section className={styles.disabledBanner} role="status">
            <strong>Advertiser self-service is disabled in this environment.</strong>
            <span>
              The protected data model and workflows are installed, but no advertiser
              action is available until authentication, email, storage, policy, and
              operational review are complete.
            </span>
          </section>
        ) : null}
        <div aria-disabled={!enabled} data-portal-enabled={enabled}>
          {children}
        </div>
      </main>
    </div>
  );
}

