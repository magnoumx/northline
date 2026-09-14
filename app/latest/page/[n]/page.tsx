import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LatestPage } from "@/components/public-pages";
import { STATIC_PUBLIC_ROUTES } from "@/lib/site/public-routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parsePageNumber(raw: string): number | null {
  if (!/^[1-9][0-9]*$/u.test(raw)) return null;
  return Number(raw);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  const page = parsePageNumber(n);
  const base = STATIC_PUBLIC_ROUTES.latest;
  return {
    title: page ? `${base.title} — page ${page}` : base.title,
    description: base.description,
    alternates: { canonical: `/latest/page/${n}` },
    openGraph: {
      type: "website",
      title: base.title,
      description: base.description,
      url: `/latest/page/${n}`,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const page = parsePageNumber(n);
  // /latest/page/1 is the same content as /latest under a second URL, which
  // splits ranking signal between two pages instead of indexing either one
  // properly - the canonical entry point for page one is /latest itself.
  if (!page || page === 1) notFound();
  return <LatestPage page={page} />;
}
