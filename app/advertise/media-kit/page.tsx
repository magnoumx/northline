import type { Metadata } from "next";
import { MediaKitPage } from "@/components/advertising/commercial-pages";
import { publicRouteMetadata } from "@/lib/site/public-routes";

export const metadata: Metadata = publicRouteMetadata("advertise/media-kit")!;

export default function Page() {
  return <MediaKitPage />;
}
