import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessibilityAudit } from "@/components/dev/accessibility-audit";
import { safeStandardAuthRedirectPath } from "@/lib/auth/standard-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Development accessibility audit",
  robots: { index: false, follow: false },
};

const allowedWidths = new Set([
  320, 360, 390, 430, 768, 1024, 1440, 1920,
]);
const allowedHeights = new Set([700, 780, 844, 860, 900, 1080]);

export default async function AccessibilityAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const appEnvironment = (
    process.env.APP_ENV ?? process.env.NODE_ENV ?? "production"
  ).trim().toLowerCase();
  if (appEnvironment !== "development" && appEnvironment !== "test") {
    notFound();
  }

  const parameters = await searchParams;
  const target = safeAuditTarget(single(parameters.path) ?? "/");
  const requestedWidth = Number(single(parameters.width));
  const requestedHeight = Number(single(parameters.height));
  const width = allowedWidths.has(requestedWidth) ? requestedWidth : 390;
  const height = allowedHeights.has(requestedHeight) ? requestedHeight : 844;
  const theme = single(parameters.theme) === "dark" ? "dark" : "light";
  const capture = single(parameters.capture) === "1";

  return (
    <AccessibilityAudit
      capture={capture}
      height={height}
      target={target}
      theme={theme}
      width={width}
    />
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function safeAuditTarget(value: string): string {
  const safe = safeStandardAuthRedirectPath(value);
  return safe.startsWith("/dev-audit/") ? "/" : safe;
}
