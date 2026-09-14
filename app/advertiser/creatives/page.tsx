import { ReadOnlyPortalPage } from "@/components/advertiser/portal-client";

export default function AdvertiserCreativesPage() {
  return (
    <ReadOnlyPortalPage
      eyebrow="Creatives"
      title="Upload begins in quarantine."
      description="Every new file creates an immutable version and must pass type, size, dimension, malware, destination, rights, and human policy review."
      explanation="No upload is accepted in this environment because approved object storage, malware scanning, and safe derivative generation are not configured. SVG and arbitrary scripts remain blocked."
    />
  );
}

