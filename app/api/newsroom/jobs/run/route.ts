import { z } from "zod";
import { readJsonBodyWithLimit } from "@/lib/newsletter/body";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

const MAXIMUM_BODY_BYTES = 2_048;
const requestSchema = z
  .object({
    kind: z.literal("trend.refresh"),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["trend.manage"]);
  if (!access.allowed) return access.response;

  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;

  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, MAXIMUM_BODY_BYTES);
  } catch {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a valid bounded JSON job request.",
    });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Only an explicit trend refresh can be started from this control.",
    });
  }

  if (
    process.env.FEATURE_DURABLE_JOBS !== "true" ||
    process.env.FEATURE_TREND_CONNECTORS !== "true" ||
    process.env.CONNECTORS_ENABLED !== "true" ||
    process.env.CONNECTORS_GLOBAL_KILL !== "false"
  ) {
    return apiErrorResponse("CONFLICT", {
      status: 409,
      message: "Trend discovery is not enabled in this environment.",
    });
  }

  try {
    const { env } = await import("cloudflare:workers");
    if (!env.EDITORIAL_QUEUE) {
      return apiErrorResponse("UNAVAILABLE", {
        status: 503,
        message: "The editorial queue binding is unavailable.",
      });
    }

    const scheduledTime = new Date().toISOString();
    await env.EDITORIAL_QUEUE.send({
      kind: parsed.data.kind,
      scheduledTime,
      source: "manual-newsroom",
    });

    return Response.json(
      {
        accepted: true,
        kind: parsed.data.kind,
        scheduledTime,
        message: "Discovery refresh queued. New signals appear after the queue consumer finishes.",
      },
      {
        status: 202,
        headers: { "cache-control": "private, no-store" },
      },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "The discovery refresh could not be queued.",
    });
  }
}
