import { authorizeEditorialRequest } from "@/lib/newsroom/editorial-api-security";
import { apiErrorResponse } from "@/lib/security/api";
import {
  parseServiceAccountCredentials,
  readSearchConsoleOverview,
} from "@/lib/seo/search-console";

export const runtime = "edge";

/**
 * Google Search Console, read into the newsroom.
 *
 * The autonomous pipeline published entirely blind to what actually happened
 * after publication - what Google chose to show, what people clicked, what
 * page one search result nobody bothered to click through to. This is that
 * feedback loop, read-only.
 */
export async function GET(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["audit.view"]);
  if (!access.allowed) return access.response;

  const credentials = parseServiceAccountCredentials(
    process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON,
  );
  if (!credentials) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Search Console is not connected.",
    });
  }

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 28)));
  if (!Number.isInteger(days)) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Days must be an integer from 1 through 90.",
    });
  }
  // Search Console's own data has a roughly two-day reporting lag - a window
  // ending "today" is always missing its most recent days rather than
  // reporting them as zero.
  const end = new Date(Date.now() - 2 * 86_400_000);
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  const isoDate = (value: Date) => value.toISOString().slice(0, 10);

  const siteHost = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://usnorthline.com")
    .replace(/^https?:\/\//u, "")
    .replace(/\/+$/u, "");

  const result = await readSearchConsoleOverview({
    credentials,
    // A Domain property is registered and queried as `sc-domain:host`, not as
    // the https URL - the URL form is only for a URL-prefix property.
    siteUrl: `sc-domain:${siteHost}`,
    startDate: isoDate(start),
    endDate: isoDate(end),
  });

  if (!result.ok) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 502,
      message: result.detail,
    });
  }

  return Response.json(
    {
      periodDays: days,
      startDate: isoDate(start),
      endDate: isoDate(end),
      ...result.overview,
    },
    { headers: { "cache-control": "private, max-age=600" } },
  );
}
