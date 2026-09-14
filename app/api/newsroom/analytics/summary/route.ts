import { getD1Binding } from "@/db";
import { authorizeEditorialRequest } from "@/lib/newsroom/editorial-api-security";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["audit.view"]);
  if (!access.allowed) return access.response;
  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 30)));
  if (!Number.isInteger(days)) return apiErrorResponse("BAD_REQUEST", { status: 400, message: "Days must be an integer from 1 through 90." });
  const since = Date.now() - days * 86_400_000;
  try {
    const db = await getD1Binding();
    const [totals, articles, countries, aiCosts] = await Promise.all([
      db.prepare(`SELECT event_type AS eventType, COUNT(*) AS count FROM analytics_events WHERE stream='READER' AND occurred_at>=?1 GROUP BY event_type`).bind(since).all<{eventType:string;count:number}>(),
      // Every reader event carries an article_id - SCROLL_DEPTH, ENGAGED_READING,
      // ARTICLE_COMPLETION, SHARE, and PAGE_VIEW alike - so counting every joined
      // row and labelling it "pageviews" summed all of them together. A single
      // engaged read that fired a scroll event and a completion event on top of
      // its page view counted as three.
      db.prepare(`SELECT a.id, a.slug, v.headline,
        SUM(CASE WHEN e.event_type='PAGE_VIEW' THEN 1 ELSE 0 END) AS pageviews,
        COUNT(DISTINCT e.anonymous_id_hash) AS readers,
        SUM(CASE WHEN e.event_type='ARTICLE_COMPLETION' THEN 1 ELSE 0 END) AS completions
        FROM articles a LEFT JOIN article_versions v ON v.id=a.current_version_id
        LEFT JOIN analytics_events e ON e.article_id=a.id AND e.occurred_at>=?1
        GROUP BY a.id, a.slug, v.headline ORDER BY pageviews DESC LIMIT 50`).bind(since).all(),
      db.prepare(`SELECT json_extract(metadata_json,'$.country') AS country, COUNT(*) AS events
        FROM analytics_events WHERE stream='READER' AND occurred_at>=?1
        AND json_extract(metadata_json,'$.country') IS NOT NULL
        GROUP BY country ORDER BY events DESC LIMIT 25`).bind(since).all(),
      db.prepare(`SELECT provider, model, SUM(cost_micros) AS costMicros,
        SUM(input_tokens) AS inputTokens, SUM(output_tokens) AS outputTokens
        FROM ai_cost_ledger WHERE created_at>=?1 GROUP BY provider, model ORDER BY costMicros DESC`).bind(since).all(),
    ]);
    return Response.json({
      periodDays: days,
      totals: Object.fromEntries(totals.results.map((row) => [row.eventType, Number(row.count)])),
      articles: articles.results,
      audience: { countries: countries.results },
      ai: aiCosts.results.map((row) => ({ ...row, costUsd: Number((row as {costMicros?:number}).costMicros ?? 0) / 1_000_000 })),
      limitations: [
        "Country data appears only when a consented coarse-country value is supplied.",
        "Advertising revenue is reported by the advertising ledger, not inferred from reader events.",
        "Preview and staff traffic are excluded by the ingestion route.",
      ],
    }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return apiErrorResponse("UNAVAILABLE", { status: 503, message: "Analytics reporting is temporarily unavailable." });
  }
}
