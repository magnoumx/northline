import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  aiCostLedger,
  aiTasks,
} from "../../db/schema-v3-ai";
import { operationalEvents } from "../../db/schema-v3-operations";
import type { AiWorkflowLedger } from "../editorial/ai-workflow";

type NorthlineDb = Awaited<ReturnType<typeof getDb>>;

export function createD1AiWorkflowLedger({
  database,
  storyId,
  dossierId,
}: {
  database?: NorthlineDb;
  storyId?: string;
  dossierId?: string;
} = {}): AiWorkflowLedger {
  let databasePromise = database ? Promise.resolve(database) : undefined;
  const db = () => (databasePromise ??= getDb());
  return {
    async record(event) {
      const database = await db();
      if (!event.metadata) {
        await database.insert(operationalEvents).values({
          id: `op_${crypto.randomUUID()}`,
          category: "AI_EDITORIAL",
          severity:
            event.disposition === "FAILED" ? "ERROR" : "WARNING",
          service: "ai-newsroom",
          event: event.stage,
          correlationId: event.workflowId,
          metadataJson: JSON.stringify({
            disposition: event.disposition,
            detail: event.detail.slice(0, 1_000),
          }),
          occurredAt: new Date(event.occurredAt),
        });
        return;
      }
      const taskId = `ai_task_${crypto.randomUUID()}`;
      const costMicros = Math.max(
        0,
        Math.round(event.metadata.costUsd * 1_000_000),
      );
      const dateUtc = event.metadata.endedAt.slice(0, 10);
      await database.batch([
        database.insert(aiTasks).values({
          id: taskId,
          taskKind: event.stage,
          storyId: storyId ?? null,
          dossierId: dossierId ?? null,
          inputContentHash: event.metadata.inputContentHash,
          provider: event.metadata.provider,
          model: event.metadata.model,
          promptVersion: event.metadata.promptVersion,
          policyVersion: event.metadata.policyVersion,
          dataClass: "PUBLIC",
          startedAt: new Date(event.metadata.startedAt),
          endedAt: new Date(event.metadata.endedAt),
          inputTokens: event.metadata.usage.inputTokens,
          outputTokens: event.metadata.usage.outputTokens,
          estimatedCostMicros: costMicros,
          retryCount: event.metadata.retryCount,
          structuredOutputValid: event.metadata.structuredOutputValid,
          evidenceIdsJson: JSON.stringify(event.metadata.evidenceIds),
          resultDisposition: event.metadata.resultDisposition,
          requestId: event.metadata.requestId ?? null,
          createdAt: new Date(event.metadata.startedAt),
        }),
        database
          .insert(aiCostLedger)
          .values({
            id: `ai_cost_${crypto.randomUUID()}`,
            dateUtc,
            provider: event.metadata.provider,
            model: event.metadata.model,
            storyId: storyId ?? null,
            inputTokens: event.metadata.usage.inputTokens,
            outputTokens: event.metadata.usage.outputTokens,
            costMicros,
            createdAt: new Date(event.metadata.endedAt),
          })
          .onConflictDoUpdate({
            target: [
              aiCostLedger.dateUtc,
              aiCostLedger.provider,
              aiCostLedger.model,
              aiCostLedger.storyId,
            ],
            set: {
              inputTokens: sql`${aiCostLedger.inputTokens} + ${event.metadata.usage.inputTokens}`,
              outputTokens: sql`${aiCostLedger.outputTokens} + ${event.metadata.usage.outputTokens}`,
              costMicros: sql`${aiCostLedger.costMicros} + ${costMicros}`,
            },
          }),
      ]);
    },
  };
}

export async function readAiSpend({
  database,
  dateUtc,
  storyId,
}: {
  database?: NorthlineDb;
  dateUtc: string;
  storyId?: string;
}): Promise<{ dailyCostUsd: number; storyCostUsd: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dateUtc)) {
    throw new TypeError("AI ledger date must use YYYY-MM-DD.");
  }
  const resolvedDatabase = database ?? (await getDb());
  const rows = await resolvedDatabase
    .select({
      storyId: aiCostLedger.storyId,
      costMicros: aiCostLedger.costMicros,
    })
    .from(aiCostLedger)
    .where(sql`${aiCostLedger.dateUtc} = ${dateUtc}`);
  const dailyMicros = rows.reduce((total, row) => total + row.costMicros, 0);
  const storyMicros = storyId
    ? rows
        .filter((row) => row.storyId === storyId)
        .reduce((total, row) => total + row.costMicros, 0)
    : 0;
  return {
    dailyCostUsd: dailyMicros / 1_000_000,
    storyCostUsd: storyMicros / 1_000_000,
  };
}
