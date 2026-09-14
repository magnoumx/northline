import type { Metadata } from "next";
import { PolicyPage } from "@/components/public-pages";
import { publicRouteMetadata } from "@/lib/site/public-routes";

export const metadata: Metadata = publicRouteMetadata("privacy")!;

export default function Page() {
  return <PolicyPage slug="privacy" />;
}
