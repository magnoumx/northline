import type { Metadata } from "next";
import { TrendingPage } from "@/components/public-pages";
import { publicRouteMetadata } from "@/lib/site/public-routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = publicRouteMetadata("trending")!;

export default function Page() {
  return <TrendingPage />;
}
