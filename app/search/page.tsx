import type { Metadata } from "next";
import { SearchPage } from "@/components/public-pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Search Northline",
  description: "Find verified reporting, explainers, and topics on Northline.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: Props) {
  const query = await searchParams;
  const raw = query.q;
  return <SearchPage query={Array.isArray(raw) ? raw[0] : raw} />;
}
