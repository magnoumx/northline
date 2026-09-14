import { z } from "zod";
import { getD1Binding } from "@/db";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import { readJsonBodyWithLimit } from "@/lib/newsletter/body";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

const SAFE_ID = /^[A-Za-z0-9:_-]{8,128}$/u;
const inputSchema = z
  .object({
    action: z.enum(["PROMOTE", "START_RESEARCH", "WATCH", "REJECT", "ARCHIVE"]),
    reason: z.string().trim().min(20).max(1_000),
    expectedState: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

type Context = { params: Promise<{ trendId: string }> };

export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  const access = await authorizeEditorialRequest(["trend.manage"]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;

  const { trendId } = await context.params;
  if (!SAFE_ID.test(trendId)) return notFound();

  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, 16_000);
  } catch {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a bounded trend decision.",
    });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Choose a supported decision and provide a specific reason.",
    });
  }

  const db = await getD1Binding();
  const current = await db
    .prepare(
      `SELECT id, original_term AS term, category, score, risk_level AS risk,
        editorial_state AS state
       FROM trends WHERE id=?1 LIMIT 1`,
    )
    .bind(trendId)
    .first<{
      id: string;
      term: string;
      category: string;
      score: number;
      risk: string;
      state: string;
    }>();
  if (!current) return notFound();
  if (parsed.data.expectedState && parsed.data.expectedState !== current.state) {
    return apiErrorResponse("CONFLICT", {
      status: 409,
      message: "The trend changed after this page was opened. Refresh and review it again.",
    });
  }

  const decision = decisionFor(parsed.data.action, current.score);
  const now = Date.now();
  const auditId = `audit_${crypto.randomUUID().replaceAll("-", "")}`;
  const transitionId = `transition_${crypto.randomUUID().replaceAll("-", "")}`;
  const opportunityId = `opp_${trendId}`;

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE trends SET editorial_state=?1, updated_at=?2
         WHERE id=?3 AND editorial_state=?4`,
      )
      .bind(decision.trendState, now, trendId, current.state),
    db
      .prepare(
        `INSERT INTO state_transitions (
           id, entity_type, entity_id, from_state, to_state, actor_id,
           reason, metadata_json, occurred_at
         )
         SELECT ?1, 'TREND', ?2, ?3, ?4, ?5, ?6, ?7, ?8
         WHERE changes() = 1`,
      )
      .bind(
        transitionId,
        trendId,
        current.state,
        decision.trendState,
        access.user.userId,
        parsed.data.reason,
        JSON.stringify({ action: parsed.data.action, score: current.score }),
        now,
      ),
  ];

  if (decision.opportunityState) {
    statements.push(
      db
        .prepare(
          `INSERT INTO story_opportunities (
             id, trend_id, story_cluster_id, state, recommended_format,
             reason_codes_json, explanation, internal_scores_json,
             evidence_ids_json, market, window, created_at, updated_at
           )
           SELECT ?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, '[]', 'US', '24h', ?8, ?8
           WHERE EXISTS (SELECT 1 FROM state_transitions WHERE id=?9)
           ON CONFLICT(id) DO UPDATE SET
             state=excluded.state,
             recommended_format=excluded.recommended_format,
             reason_codes_json=excluded.reason_codes_json,
             explanation=excluded.explanation,
             internal_scores_json=excluded.internal_scores_json,
             updated_at=excluded.updated_at`,
        )
        .bind(
          opportunityId,
          trendId,
          decision.opportunityState,
          decision.format,
          JSON.stringify([
            `manual:${parsed.data.action.toLowerCase()}`,
            `score:${current.score}`,
            `risk:${current.risk}`,
          ]),
          parsed.data.reason,
          JSON.stringify({ score: current.score, risk: current.risk }),
          now,
          transitionId,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO audit_logs (
           id, actor_id, action, target_type, target_id, decision,
           reason, metadata_json, occurred_at
         )
         SELECT ?1, ?2, 'TREND_DECISION_RECORDED', 'TREND', ?3,
           'ALLOWED', ?4, ?5, ?6
         WHERE EXISTS (SELECT 1 FROM state_transitions WHERE id=?7)`,
      )
      .bind(
        auditId,
        access.user.userId,
        trendId,
        parsed.data.reason,
        JSON.stringify({
          action: parsed.data.action,
          fromState: current.state,
          toState: decision.trendState,
          opportunityState: decision.opportunityState,
        }),
        now,
        transitionId,
      ),
  );

  try {
    const results = await db.batch(statements);
    if (!results[1]?.success || Number(results[1].meta.changes ?? 0) !== 1) {
      return apiErrorResponse("CONFLICT", {
        status: 409,
        message: "The trend changed before the decision could be saved.",
      });
    }
    return Response.json({
      trend: {
        id: trendId,
        state: decision.trendState,
        opportunityState: decision.opportunityState,
      },
    });
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "The trend decision could not be persisted.",
    });
  }
}

function decisionFor(action: z.infer<typeof inputSchema>["action"], score: number) {
  const format = score >= 88 ? "DEEP_EXPLAINER" : score >= 72 ? "STANDARD_NEWS" : "QUICK_BRIEF";
  switch (action) {
    case "PROMOTE":
      return { trendState: "CANDIDATE", opportunityState: "RESEARCH", format };
    case "START_RESEARCH":
      return { trendState: "RESEARCHING", opportunityState: "RESEARCH", format };
    case "WATCH":
      return { trendState: "CANDIDATE", opportunityState: "WATCH", format };
    case "REJECT":
      return { trendState: "REJECTED_EARLY", opportunityState: "REJECT", format };
    case "ARCHIVE":
      return { trendState: "ARCHIVED", opportunityState: null, format };
  }
}

function notFound(): Response {
  return apiErrorResponse("NOT_FOUND", {
    status: 404,
    message: "Trend signal not found.",
  });
}
