import {
  readCloudflareAccessToken,
  verifyCloudflareAccessRequest,
} from "@/lib/auth/cloudflare-access";

export const dynamic = "force-dynamic";

/**
 * Explains why a staff sign-in was refused.
 *
 * Access verification returns null for every failure mode - unset audience,
 * missing token, bad signature, wrong issuer - which left an operator with a
 * sign-in loop and no way to tell which. This reports the decision without
 * disclosing anything usable: no token, no claims beyond the caller's own
 * email, and the configured audience only as a short prefix so it can be
 * compared against the dashboard.
 *
 * It is safe to leave enabled. An unauthenticated caller learns only whether
 * the site is configured for Access, which the redirect already reveals.
 */
export async function GET(request: Request): Promise<Response> {
  const headers = request.headers;
  const identity = await verifyCloudflareAccessRequest(headers);
  const token = readCloudflareAccessToken(headers);

  const audience = (process.env.CLOUDFLARE_ACCESS_AUD ?? "").trim();
  const teamDomain = (process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? "").trim();

  return Response.json(
    {
      verified: Boolean(identity),
      email: identity?.email ?? null,
      diagnosis: identity
        ? "Access identity accepted. If the console still refuses you, the address has no newsroom role."
        : !audience || !teamDomain
          ? "The Worker has no Access audience or team domain configured."
          : !token
            ? "No Access token reached the origin. Cloudflare did not attach one, so the request never passed an Access policy."
            : "A token arrived but failed verification. The configured audience or team domain does not match the Access application that issued it.",
      config: {
        audienceConfigured: Boolean(audience),
        audiencePrefix: audience ? `${audience.slice(0, 8)}…` : null,
        teamDomain: teamDomain || null,
        accessEnabled:
          (process.env.CLOUDFLARE_ACCESS_ENABLED ?? "").trim() === "true",
      },
      request: {
        tokenPresent: Boolean(token),
        assertionHeaderPresent: Boolean(
          headers.get("cf-access-jwt-assertion"),
        ),
        cookiePresent: Boolean(headers.get("cookie")),
      },
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    },
  );
}
