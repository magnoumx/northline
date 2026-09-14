import { runtimeFetch } from "../runtime/fetch";
import { withDeadline } from "../security/api";
import type { PaymentProvider } from "./providers";

export class PaymentProviderError extends Error {
  constructor(message = "The payment provider did not accept the request.") {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export function assertCampaignChargeAuthorized(input: {
  termsAccepted: boolean;
  creativeApproved: boolean;
  totalPriceClear: boolean;
  refundRulesVisible: boolean;
  cancellationRulesVisible: boolean;
}): void {
  if (
    !input.termsAccepted ||
    !input.creativeApproved ||
    !input.totalPriceClear ||
    !input.refundRulesVisible ||
    !input.cancellationRulesVisible
  ) {
    throw new PaymentProviderError(
      "A charge requires accepted terms, approved creative, clear price, and visible refund and cancellation rules.",
    );
  }
}

export function createStripePaymentProvider(input: {
  secretKey: string;
  fetcher?: typeof fetch;
}): PaymentProvider {
  if (!/^sk_(?:test|live)_[A-Za-z0-9]+$/u.test(input.secretKey)) {
    throw new PaymentProviderError("Stripe credentials are not configured.");
  }
  const fetcher = input.fetcher ?? runtimeFetch;
  return {
    name: "STRIPE",
    async createPaymentIntent(request) {
      validateMoney(request.amountCents, request.currency);
      const form = new URLSearchParams({
        amount: String(request.amountCents),
        currency: request.currency.toLowerCase(),
        "metadata[invoice_id]": request.invoiceId,
        "automatic_payment_methods[enabled]": "true",
      });
      const response = await stripeRequest({
        path: "/v1/payment_intents",
        secretKey: input.secretKey,
        idempotencyKey: request.idempotencyKey,
        form,
        fetcher,
      });
      return { providerReference: response.id };
    },
    async refund(request) {
      if (!request.paymentReference.startsWith("pi_")) {
        throw new PaymentProviderError("Invalid payment reference.");
      }
      if (!Number.isSafeInteger(request.amountCents) || request.amountCents <= 0) {
        throw new PaymentProviderError("Invalid refund amount.");
      }
      const response = await stripeRequest({
        path: "/v1/refunds",
        secretKey: input.secretKey,
        idempotencyKey: request.idempotencyKey,
        form: new URLSearchParams({
          payment_intent: request.paymentReference,
          amount: String(request.amountCents),
        }),
        fetcher,
      });
      return {
        providerReference: response.id,
        status: response.status === "succeeded" ? "SUCCEEDED" : "PENDING",
      };
    },
  };
}

async function stripeRequest(input: {
  path: string;
  secretKey: string;
  idempotencyKey: string;
  form: URLSearchParams;
  fetcher: typeof fetch;
}): Promise<{ id: string; status?: string }> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u.test(input.idempotencyKey)) {
    throw new PaymentProviderError("Invalid idempotency key.");
  }
  const response = await withDeadline(
    (signal) =>
      input.fetcher(`https://api.stripe.com${input.path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
          "idempotency-key": input.idempotencyKey,
        },
        body: input.form.toString(),
        signal,
      }),
    10_000,
  );
  if (!response.ok) throw new PaymentProviderError();
  const body = (await response.json()) as { id?: unknown; status?: unknown };
  if (typeof body.id !== "string" || body.id.length < 3) {
    throw new PaymentProviderError();
  }
  return {
    id: body.id,
    status: typeof body.status === "string" ? body.status : undefined,
  };
}

function validateMoney(amountCents: number, currency: string): void {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new PaymentProviderError("Invalid payment amount.");
  }
  if (!/^[A-Z]{3}$/u.test(currency)) {
    throw new PaymentProviderError("Invalid payment currency.");
  }
}

