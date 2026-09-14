import type { Metadata } from "next";
import { LiveIndexPage } from "@/components/public-pages";
import { publicRouteMetadata } from "@/lib/site/public-routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = publicRouteMetadata("live")!;

export default function Page() {
  return <LiveIndexPage />;
}
