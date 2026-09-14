import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { Permission } from "@/lib/auth/permissions";
import { authorizeStaffIdentity } from "@/lib/auth/rbac";
import { getBrandConfig } from "@/lib/brand/config";

export async function NewsroomPermissionGate({
  children,
  permissions,
}: {
  children: ReactNode;
  permissions: readonly Permission[];
}) {
  const brand = getBrandConfig();
  const user = await getChatGPTUser();

  // The parent layout owns the unauthenticated sign-in experience. Returning
  // no child content also prevents a protected page from entering the RSC
  // payload while that layout renders its gate.
  if (!user) return null;

  const authorization = await authorizeStaffIdentity(user, permissions);
  if (!authorization.allowed) {
    return (
      <main className="auth-gate">
        <Link className="auth-gate__brand" href="/">
          <span>{brand.shortName.charAt(0)}</span>
          {brand.name.toUpperCase()}
        </Link>
        <div>
          <ShieldX size={31} />
          <p>IDENTITY VERIFIED · PERMISSION DENIED</p>
          <h1>This newsroom desk is outside your role</h1>
          <span>
            Access is checked server-side for each workspace surface. Ask an
            owner or administrator if your assignment needs to change.
          </span>
          <Link href="/newsroom">Return to the newsroom dashboard</Link>
          <Link href="/">Return to the public site</Link>
        </div>
      </main>
    );
  }

  return children;
}
