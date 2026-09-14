import { ReadOnlyPortalPage } from "@/components/advertiser/portal-client";

export default function AdvertiserReportsPage() {
  return (
    <ReadOnlyPortalPage
      eyebrow="Reports"
      title="Evidence before metrics."
      description="Reports separate raw, validated, invalid, billable, and estimated activity."
      explanation="No campaign has completed a validated reporting window. Preview and internal traffic are excluded from revenue reporting."
    />
  );
}

