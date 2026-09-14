import { z } from "zod";
import { readAdvertisingJson } from "./body";
import { apiErrorResponse } from "../security/api";
import { validateMutationRequest } from "../security/origin";

export const signedEventInput = z
  .object({ token: z.string().min(40).max(4_096) })
  .strict();

export const viewabilityEventInput = signedEventInput.extend({
  visiblePercent: z.number().int().min(0).max(100),
  visibleMilliseconds: z.number().int().min(0).max(3_600_000),
});

export async function readProtectedEvent<T>(
  request: Request,
  schema: z.ZodType<T>,
  requestId: string,
): Promise<{ valid: true; data: T } | { valid: false; response: Response }> {
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_ENV === "production" ? undefined : new URL(request.url).origin,
  ].filter((value): value is string => Boolean(value));
  const protection = validateMutationRequest(request, {
    allowedOrigins,
    allowedMediaTypes: ["application/json"],
  });
  if (!protection.allowed) {
    return {
      valid: false,
      response: apiErrorResponse(
        protection.status === 415 ? "UNSUPPORTED_MEDIA_TYPE" : "FORBIDDEN",
        {
          status: protection.status,
          message: "The advertising event was not accepted.",
          requestId,
        },
      ),
    };
  }
  try {
    const parsed = schema.safeParse(await readAdvertisingJson(request, 8_192));
    return parsed.success
      ? { valid: true, data: parsed.data }
      : {
          valid: false,
          response: apiErrorResponse("BAD_REQUEST", {
            status: 400,
            message: "Send a valid advertising event.",
            requestId,
          }),
        };
  } catch {
    return {
      valid: false,
      response: apiErrorResponse("BAD_REQUEST", {
        status: 400,
        message: "Send a valid advertising event.",
        requestId,
      }),
    };
  }
}

