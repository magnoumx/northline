import type { Metadata } from "next";
import { NewsletterPage } from "@/components/public-pages";
import { publicRouteMetadata } from "@/lib/site/public-routes";

export const metadata: Metadata = publicRouteMetadata("newsletter")!;

export default function Page() {
  return <NewsletterPage />;
}
