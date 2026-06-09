import { db } from "@workspace/db";
import { agentRunsTable, projectsTable, scriptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runHookAgent } from "./hook-agent.js";
import { runEmotionAgent } from "./emotion-agent.js";
import { runVisualDirectorAgent } from "./visual-director-agent.js";
import { runRetentionAgent } from "./retention-agent.js";
import { runCaptionAgent } from "./caption-agent.js";
import { runViralityEngine } from "./virality-engine.js";
import { runViralPipeline } from "./viral-pipeline.js";
import type { AgentLog, AgentContext } from "./types.js";

export type OrchestratorMode =
  | "full_pipeline"
  | "viral_pipeline"
  | "hooks_only"
  | "virality_check"
  | "visual_only"
  | "captions_only";

export interface OrchestratorResult {
  runId: number;
  projectId: number;
  mode: OrchestratorMode;
  hooks?: Awaited<ReturnType<typeof runHookAgent>>["data"];
  emotion?: Awaited<ReturnType<typeof runEmotionAgent>>["data"];
  visuals?: Awaited<ReturnType<typeof runVisualDirectorAgent>>["data"];
  retention?: Awaited<ReturnType<typeof runRetentionAgent>>["data"];
  captions?: Awaited<ReturnType<typeof runCaptionAgent>>["data"];
  virality?: Awaited<ReturnType<typeof runViralityEngine>>["data"];
  viralPipeline?: Awaited<ReturnType<typeof runViralPipeline>>;
  allLogs: AgentLog[];
  status: "completed" | "failed" | "partial";
  error?: string;
}

export async function orchestrateAgents(
  context: AgentContext,
  mode: OrchestratorMode = "full_pipeline"
): Promise<OrchestratorResult> {
  const allLogs: AgentLog[] = [];
  const addLog = (logs: AgentLog[]) => allLogs.push(...logs);

  const [runRow] = await db.insert(agentRunsTable).values({
    projectId: context.projectId,
    runType: mode,
    status: "running",
    input: context as unknown as Record<string, unknown>,
    agentLogs: [],
  }).returning();

  const runId = runRow.id;

  const result: OrchestratorResult = {
    runId,
    projectId: context.projectId ?? 0,
    mode,
    allLogs,
    status: "completed",
  };

  try {
    const prompt = context.prompt ?? "";
    const platform = context.platform ?? "all";

    // ── Viral Pipeline mode: runs the full 10-agent cascade ─────────────────
    if (mode === "viral_pipeline") {
      const pipelineResult = await runViralPipeline(
        prompt,
        platform,
        context.niche as string | undefined,
        context.videoStyle as string | undefined
      );
      addLog(pipelineResult.agentLogs);
      result.viralPipeline = pipelineResult;

      if (context.projectId) {
        await db.update(projectsTable)
          .set({ status: "done", progress: 100, updatedAt: new Date() })
          .where(eq(projectsTable.id, context.projectId));
      }

      await db.update(agentRunsTable)
        .set({ status: "completed", output: result as unknown as Record<string, unknown>, agentLogs: allLogs })
        .where(eq(agentRunsTable.id, runId));

      return result;
    }

    // ── Standard pipeline modes ──────────────────────────────────────────────
    let script = prompt;
    if (context.projectId) {
      const scriptRows = await db.select().from(scriptsTable)
        .where(eq(scriptsTable.projectId, context.projectId)).limit(1);
      if (scriptRows.length > 0 && scriptRows[0].script) {
        script = scriptRows[0].script;
      }
    }

    if (mode === "full_pipeline" || mode === "hooks_only") {
      const hookResult = await runHookAgent(prompt, platform, context.niche as string);
      addLog(hookResult.logs);
      result.hooks = hookResult.data;
    }

    if (mode === "full_pipeline" || mode === "virality_check") {
      const emotionResult = await runEmotionAgent(script, platform);
      addLog(emotionResult.logs);
      result.emotion = emotionResult.data;

      if (mode === "full_pipeline") {
        const [visualResult, retentionResult] = await Promise.all([
          runVisualDirectorAgent(script, result.emotion?.emotionArc ?? [], platform),
          runRetentionAgent(script, [], platform),
        ]);
        addLog(visualResult.logs);
        addLog(retentionResult.logs);
        result.visuals = visualResult.data;
        result.retention = retentionResult.data;

        const captionResult = await runCaptionAgent(retentionResult.data?.optimizedScript ?? script);
        addLog(captionResult.logs);
        result.captions = captionResult.data;
      }

      if (context.projectId) {
        const viralityResult = await runViralityEngine(
          context.projectId,
          result.hooks?.topHook?.hook ?? prompt.slice(0, 100),
          script,
          {
            bingeabilityScore: result.emotion?.bingeabilityScore,
            replayScore: result.emotion?.replayScore,
            dopamineSpikes: result.emotion?.dopamineSpikes,
          },
          result.retention?.retentionScore ?? 50,
          platform
        );
        addLog(viralityResult.logs);
        result.virality = viralityResult.data;
      }
    }

    if (mode === "visual_only") {
      const visualResult = await runVisualDirectorAgent(script, [], platform);
      addLog(visualResult.logs);
      result.visuals = visualResult.data;
    }

    if (mode === "captions_only") {
      const captionResult = await runCaptionAgent(script);
      addLog(captionResult.logs);
      result.captions = captionResult.data;
    }

    if (context.projectId) {
      await db.update(projectsTable)
        .set({ status: "done", progress: 100, updatedAt: new Date() })
        .where(eq(projectsTable.id, context.projectId));
    }

    await db.update(agentRunsTable)
      .set({ status: "completed", output: result as unknown as Record<string, unknown>, agentLogs: allLogs })
      .where(eq(agentRunsTable.id, runId));

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    result.status = "failed";
    result.error = msg;
    await db.update(agentRunsTable)
      .set({ status: "failed", errorMessage: msg, agentLogs: allLogs })
      .where(eq(agentRunsTable.id, runId));
  }

  return result;
}
