import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const dynamic = "force-dynamic";

/**
 * Shown when a staff request reaches the origin without a valid Access
 * identity. It previously rendered with inline styles and no page shell, so
 * the one screen a locked-out operator sees was the only unstyled page on the
 * site - and it did not distinguish "you are not signed in" from "you are
 * signed in but hold no newsroom role", which are different problems with
 * different fixes.
 */
export default function AccessRequiredPage() {
  return (
    <PageShell>
      <main className="home-empty shell" id="main-content">
        <p className="kicker">
          <span>Staff access</span>
        </p>
        <h1>Sign in through Cloudflare Access</h1>
        <p>
          The newsroom console sits behind Cloudflare Access. This request
          reached the site without an Access identity, so the origin declined
          it.
        </p>
        <p>
          Open <strong>/newsroom</strong> and complete the Cloudflare sign-in
          with the address named in the Access policy. If sign-in succeeds and
          you still arrive here, the address is authenticated but carries no
          newsroom role.
        </p>
        <Link href="/newsroom">Open the newsroom console</Link>
      </main>
    </PageShell>
  );
}
