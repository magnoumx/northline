import { PortalOverview } from "@/components/advertiser/portal-client";

export default function AdvertiserPage() {
  return <PortalOverview enabled={process.env.FEATURE_ADVERTISER_PORTAL === "true"} />;
}

