import type { Metadata } from "next";
import { AdvertisePage } from "@/components/advertising/commercial-pages";
import { publicRouteMetadata } from "@/lib/site/public-routes";

export const metadata: Metadata = publicRouteMetadata("advertise")!;

export default function Page() {
  return <AdvertisePage />;
}
