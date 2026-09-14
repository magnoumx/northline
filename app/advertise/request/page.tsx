import type { Metadata } from "next";
import { AdvertisingRequestPage } from "@/components/advertising/commercial-pages";
import { publicRouteMetadata } from "@/lib/site/public-routes";

export const metadata: Metadata = publicRouteMetadata("advertise/request")!;

export default function Page() {
  return <AdvertisingRequestPage />;
}
