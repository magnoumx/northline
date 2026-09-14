import { ReadOnlyPortalPage } from "@/components/advertiser/portal-client";

export default function AdvertiserTeamPage() {
  return (
    <ReadOnlyPortalPage
      eyebrow="Team"
      title="Membership is scoped, explicit, and revocable."
      description="Owners can eventually invite administrators, managers, buyers, and read-only viewers without granting newsroom access."
      explanation="No invitation action is exposed until verified email delivery, invitation expiry, role review, and account recovery are operational."
    />
  );
}

