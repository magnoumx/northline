import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { NewsroomSessionProvider } from "@/components/newsroom/session";
import { authorizeStaffIdentity } from "@/lib/auth/rbac";
import { getBrandConfig } from "@/lib/brand/config";
import { resolveContentMode } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NewsroomLayout({
  children,
}: {
  children: ReactNode;
}) {
  const brand = getBrandConfig();
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className="auth-gate">
        <Link className="auth-gate__brand" href="/">
          <span>{brand.shortName.charAt(0)}</span>
          {brand.name.toUpperCase()}
        </Link>
        <div>
          <ShieldCheck size={31} />
          <p>PROTECTED EDITORIAL WORKSPACE</p>
          <h1>Sign in to open Newsroom OS</h1>
          <span>
            Reader pages are public. Editorial tools require an authenticated
            identity and server-side permission checks.
          </span>
          <a href={chatGPTSignInPath("/newsroom")}>Sign in securely</a>
          <Link href="/">Return to the public site</Link>
        </div>
      </main>
    );
  }
  const authorization = await authorizeStaffIdentity(user, [
    "workspace.access",
  ]);
  if (!authorization.allowed) {
    return (
      <main className="auth-gate">
        <Link className="auth-gate__brand" href="/">
          <span>{brand.shortName.charAt(0)}</span>
          {brand.name.toUpperCase()}
        </Link>
        <div>
          <ShieldCheck size={31} />
          <p>IDENTITY VERIFIED · ACCESS DENIED</p>
          <h1>Your account has no newsroom role</h1>
          <span>
            An owner or administrator must add an explicit server-side role
            assignment before editorial data can be rendered.
          </span>
          <Link href="/">Return to the public site</Link>
        </div>
      </main>
    );
  }
  return (
    <NewsroomSessionProvider
      session={{
        email: user.email,
        role: authorization.role,
        permissions: authorization.permissions,
        brandName: brand.name,
        brandShortName: brand.shortName,
        demoMode: resolveContentMode() === "DEMO_FIXTURES",
      }}
    >
      {children}
    </NewsroomSessionProvider>
  );
}
