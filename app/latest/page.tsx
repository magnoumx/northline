import type { Metadata } from "next";
import { LatestPage } from "@/components/public-pages";
import { publicRouteMetadata } from "@/lib/site/public-routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = publicRouteMetadata("latest")!;

export default function Page() {
  return <LatestPage />;
}
