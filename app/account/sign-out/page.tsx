import type { Metadata } from "next";
import Link from "next/link";
import { SignOutForm } from "@/components/auth/sign-out-form";
import { getBrandConfig } from "@/lib/brand/config";
import { safeStandardAuthRedirectPath } from "@/lib/auth/standard-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign out",
  robots: { index: false, follow: false },
};

export default async function SignOutPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string | string[] }>;
}) {
  const parameters = await searchParams;
  const returnTo = safeStandardAuthRedirectPath(
    typeof parameters.return_to === "string" ? parameters.return_to : "/",
  );
  const brand = getBrandConfig();

  return (
    <main className="account-auth account-auth--compact">
      <section className="account-auth__panel" aria-labelledby="sign-out-title">
        <Link className="account-auth__brand" href="/">
          {brand.wordmark}
        </Link>
        <p className="account-auth__eyebrow">ACCOUNT SECURITY</p>
        <h1 id="sign-out-title">Sign out of this device?</h1>
        <p className="account-auth__intro">
          This revokes the current server-side session and clears its signed
          browser cookie.
        </p>
        <SignOutForm returnTo={returnTo} />
        <Link className="account-auth__cancel" href={returnTo}>
          Keep me signed in
        </Link>
      </section>
    </main>
  );
}
