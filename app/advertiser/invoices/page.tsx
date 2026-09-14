import { ReadOnlyPortalPage } from "@/components/advertiser/portal-client";

export default function AdvertiserInvoicesPage() {
  return (
    <ReadOnlyPortalPage
      eyebrow="Invoices"
      title="Nothing is charged before terms and approval."
      description="Invoices preserve currency, tax metadata, provider references, credits, refunds, and a commercial audit trail."
      explanation="No invoice has been issued to this workspace. Payments remain disabled until provider eligibility, tax, refund, and support operations are approved."
    />
  );
}

