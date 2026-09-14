import { z } from "zod";
import { validateExternalHttpUrl } from "../security/url";

const countryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const shortChoice = z.string().trim().min(2).max(80);

export const advertisingLeadInput = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    workEmail: z.string().trim().email().max(254),
    company: z.string().trim().min(2).max(160),
    companyWebsite: z.string().trim().min(1).max(2_048),
    campaignObjective: z.string().trim().min(2).max(160),
    productOrService: z.string().trim().min(2).max(500),
    targetAudience: z.string().trim().min(2).max(1_000),
    targetCountries: z.array(countryCode).min(1).max(20),
    preferredCategories: z.array(shortChoice).max(20),
    preferredPlacements: z.array(shortChoice).max(20),
    estimatedBudget: z.number().int().min(0).max(100_000_000).nullable(),
    desiredStartDate: z.string().date().nullable(),
    desiredEndDate: z.string().date().nullable(),
    creativeStatus: z.enum([
      "READY",
      "NEEDS_SUPPORT",
      "NOT_STARTED",
      "UNKNOWN",
    ]),
    sponsoredContentInterest: z.boolean(),
    newsletterSponsorshipInterest: z.boolean(),
    message: z.string().trim().max(5_000),
    consent: z.literal(true),
    captchaToken: z.string().trim().max(2_048).optional().default(""),
    website: z.string().max(0).optional().default(""),
    formStartedAt: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const url = validateExternalHttpUrl(input.companyWebsite);
    if (!url.valid) {
      context.addIssue({
        code: "custom",
        path: ["companyWebsite"],
        message: "Use a public HTTPS company website.",
      });
    }
    if (
      input.desiredStartDate &&
      input.desiredEndDate &&
      input.desiredEndDate < input.desiredStartDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["desiredEndDate"],
        message: "The end date must not be earlier than the start date.",
      });
    }
  });

export type AdvertisingLeadInput = z.infer<typeof advertisingLeadInput>;

const disposableDomains = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "yopmail.com",
]);

export interface LeadRisk {
  reject: boolean;
  spamScore: number;
  reasons: string[];
}

export function assessLeadRisk(
  lead: AdvertisingLeadInput,
  nowMs = Date.now(),
): LeadRisk {
  const reasons: string[] = [];
  let spamScore = 0;
  const emailDomain = lead.workEmail.split("@").at(-1)?.toLowerCase() ?? "";
  if (disposableDomains.has(emailDomain)) {
    spamScore += 100;
    reasons.push("DISPOSABLE_EMAIL");
  }
  if (lead.website) {
    spamScore += 100;
    reasons.push("HONEYPOT_FILLED");
  }
  if (lead.formStartedAt && nowMs - lead.formStartedAt < 2_000) {
    spamScore += 40;
    reasons.push("IMPOSSIBLY_FAST_FORM");
  }
  const links = lead.message.match(/https?:\/\//giu)?.length ?? 0;
  if (links > 3) {
    spamScore += 30;
    reasons.push("EXCESSIVE_MESSAGE_LINKS");
  }
  return {
    reject: spamScore >= 100,
    spamScore: Math.min(100, spamScore),
    reasons,
  };
}

export function normalizeLead(input: AdvertisingLeadInput) {
  const website = validateExternalHttpUrl(input.companyWebsite);
  if (!website.valid) throw new Error("invalid company website");
  const desiredStartAt = input.desiredStartDate
    ? new Date(`${input.desiredStartDate}T00:00:00.000Z`)
    : null;
  const desiredEndAt = input.desiredEndDate
    ? new Date(`${input.desiredEndDate}T23:59:59.999Z`)
    : null;
  return {
    ...input,
    fullName: input.fullName.replace(/\s+/gu, " "),
    workEmail: input.workEmail.toLowerCase(),
    company: input.company.replace(/\s+/gu, " "),
    companyWebsite: website.url.toString(),
    targetCountries: [...new Set(input.targetCountries.map((item) => item.toUpperCase()))],
    preferredCategories: [...new Set(input.preferredCategories)],
    preferredPlacements: [...new Set(input.preferredPlacements)],
    estimatedBudgetCents:
      input.estimatedBudget === null ? null : input.estimatedBudget * 100,
    desiredStartAt,
    desiredEndAt,
  };
}
