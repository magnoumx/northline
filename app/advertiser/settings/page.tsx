import { ReadOnlyPortalPage } from "@/components/advertiser/portal-client";

export default function AdvertiserSettingsPage() {
  return (
    <ReadOnlyPortalPage
      eyebrow="Settings"
      title="Organization controls without editorial controls."
      description="Commercial users can manage permitted organization details, billing contacts, sessions, and consent—not newsroom content or ranking."
      explanation="No organization settings are editable until an active organization membership is loaded."
    />
  );
}

