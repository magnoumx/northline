import { CampaignRequestForm } from "@/components/advertiser/portal-client";

export default function NewAdvertiserCampaignPage() {
  return <CampaignRequestForm enabled={process.env.FEATURE_ADVERTISER_PORTAL === "true"} />;
}

