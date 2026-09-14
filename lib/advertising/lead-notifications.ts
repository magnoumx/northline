import { runtimeFetch } from "../runtime/fetch";
import type { AdvertisingLeadInput } from "./leads";
import { withDeadline } from "../security/api";

export type LeadNotificationResult =
  | { status: "SENT" }
  | { status: "NOT_CONFIGURED" }
  | { status: "FAILED" };

export async function sendLeadNotifications(input: {
  leadId: string;
  lead: AdvertisingLeadInput;
  environment: {
    EMAIL_PROVIDER?: string;
    EMAIL_API_KEY?: string;
    EMAIL_FROM_ADDRESS?: string;
    SALES_NOTIFICATION_EMAIL?: string;
  };
  fetcher?: typeof fetch;
}): Promise<LeadNotificationResult> {
  const env = input.environment;
  if (
    env.EMAIL_PROVIDER !== "resend" ||
    !env.EMAIL_API_KEY ||
    !env.EMAIL_FROM_ADDRESS ||
    !env.SALES_NOTIFICATION_EMAIL
  ) {
    return { status: "NOT_CONFIGURED" };
  }
  const fetcher = input.fetcher ?? runtimeFetch;
  const messages = [
    {
      from: env.EMAIL_FROM_ADDRESS,
      to: [input.lead.workEmail],
      subject: "We received your campaign request",
      text: `Thanks for contacting our advertising team. Your request reference is ${input.leadId}. We will review it before proposing inventory or pricing.`,
    },
    {
      from: env.EMAIL_FROM_ADDRESS,
      to: [env.SALES_NOTIFICATION_EMAIL],
      subject: `New advertising lead: ${input.lead.company}`,
      text: `Lead ${input.leadId} from ${input.lead.fullName} (${input.lead.workEmail}) is ready for qualification. No campaign has been approved or activated.`,
    },
  ];
  try {
    for (const [index, message] of messages.entries()) {
      const response = await withDeadline(
        (signal) =>
          fetcher("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              authorization: `Bearer ${env.EMAIL_API_KEY}`,
              "content-type": "application/json",
              "idempotency-key": `advertising-lead-${input.leadId}-${index}`,
            },
            body: JSON.stringify(message),
            signal,
          }),
        8_000,
      );
      if (!response.ok) return { status: "FAILED" };
    }
    return { status: "SENT" };
  } catch {
    return { status: "FAILED" };
  }
}
