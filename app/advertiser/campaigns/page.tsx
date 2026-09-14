import { CampaignsView } from "@/components/advertiser/portal-client";

export default function AdvertiserCampaignsPage() {
  return <CampaignsView enabled={process.env.FEATURE_ADVERTISER_PORTAL === "true"} />;
}

