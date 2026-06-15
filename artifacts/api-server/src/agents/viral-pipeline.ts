/**
 * VIRALOS Multi-Agent Viral Pipeline
 *
 * Execution order:
 *  1. Research Agent        — audience intelligence
 *  2. Trend Intelligence    — winning angle selection
 *  3. Script Agent          — 3 hook approaches, pick best
 *  4. Judge Agent (pass 1)  — score ≥ 72 to proceed
 *  5. Script Agent (retry)  — if Judge rejected, revise with feedback
 *  6. Judge Agent (pass 2)  — final gate
 *  7. Optimization Agent    — apply remaining improvements
 *  8. Creative Director     — visual & retention plan
 *  9. Emotion Agent         — emotion arc
 * 10. Virality Engine       — final score & memory storage
 */

import { groqClient } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import { runResearchAgent } from "./research-agent.js";
import { runTrendIntelligenceAgent } from "./trend-intelligence-agent.js";
import { runJudgeAgent } from "./judge-agent.js";
import { runOptimizationAgent } from "./optimization-agent.js";
import { runCreativeDirectorAgent } from "./creative-director-agent.js";
import { runEmotionAgent } from "./emotion-agent.js";
import type { AgentLog } from "./types.js";

export interface PipelineResult {
  hook: string;
  script: string;
  cta: string;
  viralPotential: number;
  emotionalTrigger: string;
  hookStyle: string;
  estimatedWordCount: number;
  targetEmotion?: string;
  judgeScore?: number;
  judgeApproved?: boolean;
  retentionStrategy?: unknown;
  creativePlan?: unknown;
  agentLogs: AgentLog[];
  pipelineStages: string[];
  researchInsights?: {
    bestAngle: string;
    targetAudience: string;
    primaryEmotion: string;
    recommendedLength: number;
  };
}

async function generateScriptWithHooks(
  prompt: string,
  platform: string,
  winningAngle: string,
  targetEmotion: string,
  hookApproach: string,
  languageStyle: string,
  painPoints: string[],
  uniqueInsight: string,
  judgeInstructions?: string
): Promise<{ hook: string; script: string; cta: string; hookStyle: string; estimatedWordCount: number }> {
  const platformLabel = platform === "reels" ? "Instagram Reels" : "YouTube Shorts";
  const memories = await recallMemories("script_agent", 6);
  const topHooks = memories
    .filter((m) => (m.score ?? 0) > 2)
    .map((m) => m.content)
    .slice(0, 3)
    .join("\n");

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are VIRALOS Script Agent — the world's best viral short-form scriptwriter.
You generate MULTIPLE internal approaches then output only the strongest one.
Platform: ${platformLabel}
Target Emotion: ${targetEmotion}
Language Style: ${languageStyle}
${topHooks ? `\nTop-performing hooks from memory (study these patterns):\n${topHooks}` : ""}

Writing rules:
- Hook: ≤12 words, creates an irresistible curiosity gap or emotional spike
- Every sentence ≤15 words, spoken-word natural, zero filler
- Structure: Hook → Problem → Insight → Proof → CTA
- Body: 100-130 words total
- No "In this video", no "Today I'm going to", no "Let me show you"
- First word must be provocative or unexpected`,
      },
      {
        role: "user",
        content: `Write the highest-performing script for:

Topic: "${prompt}"
Winning Angle: "${winningAngle}"
Unique Insight to deliver: "${uniqueInsight}"
Primary Pain Points to agitate: ${painPoints.join(", ")}
Hook Approach to use: ${hookApproach}
${judgeInstructions ? `\nJUDGE FEEDBACK — apply these improvements:\n${judgeInstructions}` : ""}

Internally consider 3 hook approaches:
1. Curiosity gap: create an unanswered question
2. Contrarian: challenge a popular belief
3. Direct shock: lead with a bold, uncomfortable truth

Pick the strongest one. Output ONLY the winner.

Return JSON:
{
  "hook": "the winning hook line",
  "script": "full body script without hook or CTA (100-130 words)",
  "cta": "natural, emotion-matched call to action",
  "hookStyle": "curiosity_gap|contrarian|shock|story|data",
  "estimatedWordCount": 120,
  "hookReasoning": "why this hook will stop the scroll"
}`,
      },
    ],
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");

  await storeMemory(
    "script_agent",
    `script_${Date.now()}`,
    `Hook: "${(data.hook ?? "").slice(0, 80)}" | Style: ${data.hookStyle} | Platform: ${platform}`,
    5,
    { platform, hookStyle: data.hookStyle }
  );

  return {
    hook: data.hook ?? "",
    script: data.script ?? "",
    cta: data.cta ?? "",
    hookStyle: data.hookStyle ?? "curiosity_gap",
    estimatedWordCount: data.estimatedWordCount ?? 120,
  };
}

export async function runViralPipeline(
  prompt: string,
  platform: string = "youtube_shorts",
  niche?: string,
  videoStyle?: string
): Promise<PipelineResult> {
  const allLogs: AgentLog[] = [];
  const stages: string[] = [];
  const log = (agent: string, msg: string, data?: unknown) => {
    allLogs.push({ agent, timestamp: new Date().toISOString(), message: msg, data });
  };

  // ── Stage 1: Research ────────────────────────────────────────────────────
  log("Pipeline", "Stage 1: Research Agent starting");
  stages.push("research");
  let research;
  try {
    const r = await runResearchAgent(prompt, platform, niche);
    allLogs.push(...r.logs);
    research = r.data;
    log("Pipeline", "Research complete", { angle: research?.trendAlignment?.bestContentAngle });
  } catch (e) {
    log("Pipeline", `Research failed: ${e}`, {});
    research = {
      targetAudience: { painPoints: ["lack of clarity", "missing strategy"], desires: ["success", "recognition"], languageStyle: "casual", demographics: "", psychographics: "" },
      viewerPsychology: { primaryEmotion: "inspiration", triggerMechanism: "aspiration", attentionDrivers: ["transformation", "proof", "relatability"], dropOffRisks: ["slow pace", "no tension"] },
      trendAlignment: { currentTrends: ["short-form viral content"], viralAngles: ["contrarian truth", "hidden knowledge"], bestContentAngle: "revealing a non-obvious truth about " + prompt, competitorPatterns: [] },
      contentStrategy: { recommendedLength: "45s", hookApproach: "curiosity_gap", paceStyle: "fast", contentDepth: "moderate" },
      researchConfidence: 65,
    };
  }

  // ── Stage 2: Trend Intelligence ──────────────────────────────────────────
  log("Pipeline", "Stage 2: Trend Intelligence Agent starting");
  stages.push("trend_intelligence");
  let trendData;
  try {
    const t = await runTrendIntelligenceAgent(prompt, research!, platform);
    allLogs.push(...t.logs);
    trendData = t.data;
    log("Pipeline", "Trend analysis complete", { winner: trendData?.winningAngle?.angle });
  } catch (e) {
    log("Pipeline", `Trend intelligence failed: ${e}`, {});
    trendData = {
      winningAngle: {
        angle: research!.trendAlignment.bestContentAngle,
        score: 78,
        emotionToTarget: research!.viewerPsychology.primaryEmotion,
        hookApproach: research!.contentStrategy.hookApproach,
        uniqueInsight: `Most people get ${prompt} completely wrong — here's the pattern nobody talks about`,
      },
      retentionRisks: research!.viewerPsychology.dropOffRisks,
      dropOffPoints: ["8s if hook doesn't deliver", "25s if pacing slows"],
      recommendedLength: 45,
      contentFormat: "fast-cut with captions",
      audienceInsight: `This audience wants transformation proof, not theory`,
      confidenceScore: 70,
      viralOpportunities: [],
    };
  }

  const winningAngle = trendData!.winningAngle;

  // ── Stage 3: Script Generation ───────────────────────────────────────────
  log("Pipeline", "Stage 3: Script Agent generating (3 internal approaches)");
  stages.push("script_generation");
  let currentScript = await generateScriptWithHooks(
    prompt,
    platform,
    winningAngle.angle,
    winningAngle.emotionToTarget,
    winningAngle.hookApproach,
    research!.targetAudience.languageStyle,
    research!.targetAudience.painPoints,
    winningAngle.uniqueInsight
  );

  // ── Stage 4: Judge — Pass 1 ──────────────────────────────────────────────
  log("Pipeline", "Stage 4: Judge Agent evaluating (pass 1)");
  stages.push("judge_pass_1");
  const judgeResult1 = await runJudgeAgent(
    { hook: currentScript.hook, script: currentScript.script, cta: currentScript.cta },
    { platform, targetEmotion: winningAngle.emotionToTarget, niche, attemptNumber: 1 }
  );
  allLogs.push(...judgeResult1.logs);
  const verdict1 = judgeResult1.data!;

  log("Pipeline", `Judge pass 1: ${verdict1.overallScore}/100 — ${verdict1.approved ? "APPROVED" : "REJECTED"}`);

  // ── Stage 5: Script Revision (if rejected) ───────────────────────────────
  let finalVerdict = verdict1;
  if (!verdict1.approved && verdict1.overallScore < 72) {
    stages.push("script_revision");
    log("Pipeline", "Stage 5: Script Agent revising based on judge feedback");

    const judgeInstructions = verdict1.improvements
      ?.map((i) => `[${i.priority.toUpperCase()}] ${i.agent}: ${i.instruction}`)
      .join("\n");

    currentScript = await generateScriptWithHooks(
      prompt,
      platform,
      winningAngle.angle,
      winningAngle.emotionToTarget,
      winningAngle.hookApproach,
      research!.targetAudience.languageStyle,
      research!.targetAudience.painPoints,
      winningAngle.uniqueInsight,
      judgeInstructions
    );

    // ── Stage 6: Judge — Pass 2 ────────────────────────────────────────────
    stages.push("judge_pass_2");
    log("Pipeline", "Stage 6: Judge Agent evaluating (pass 2)");
    const judgeResult2 = await runJudgeAgent(
      { hook: currentScript.hook, script: currentScript.script, cta: currentScript.cta },
      { platform, targetEmotion: winningAngle.emotionToTarget, niche, attemptNumber: 2 }
    );
    allLogs.push(...judgeResult2.logs);
    finalVerdict = judgeResult2.data!;
    log("Pipeline", `Judge pass 2: ${finalVerdict.overallScore}/100 — ${finalVerdict.approved ? "APPROVED" : "BEST EFFORT"}`);
  }

  // ── Stage 7: Optimization ────────────────────────────────────────────────
  stages.push("optimization");
  log("Pipeline", "Stage 7: Optimization Agent applying final improvements");
  let optimizedScript = currentScript;
  try {
    const optResult = await runOptimizationAgent(
      currentScript,
      finalVerdict,
      {
        targetEmotion: winningAngle.emotionToTarget,
        bestAngle: winningAngle.angle,
        languageStyle: research!.targetAudience.languageStyle,
        painPoints: research!.targetAudience.painPoints,
      },
      platform
    );
    allLogs.push(...optResult.logs);
    if (optResult.data?.hook) {
      optimizedScript = {
        hook: optResult.data.hook,
        script: optResult.data.script,
        cta: optResult.data.cta,
        hookStyle: optResult.data.hookStyle ?? currentScript.hookStyle,
        estimatedWordCount: optResult.data.estimatedWordCount ?? currentScript.estimatedWordCount,
      };
    }
    log("Pipeline", "Optimization complete", { finalScore: optResult.data?.finalViralScore });
  } catch (e) {
    log("Pipeline", `Optimization skipped: ${e}`, {});
  }

  // ── Stage 8: Creative Director ───────────────────────────────────────────
  stages.push("creative_direction");
  log("Pipeline", "Stage 8: Creative Director planning visual strategy");
  let creativePlan;
  try {
    const cdResult = await runCreativeDirectorAgent(
      { hook: optimizedScript.hook, body: optimizedScript.script, cta: optimizedScript.cta },
      {
        primaryEmotion: winningAngle.emotionToTarget,
        attentionDrivers: research!.viewerPsychology.attentionDrivers,
        paceStyle: research!.contentStrategy.paceStyle,
      },
      platform,
      videoStyle ?? "dark_motivation"
    );
    allLogs.push(...cdResult.logs);
    creativePlan = cdResult.data;
    log("Pipeline", "Creative direction complete", { retentionScore: creativePlan?.retentionStrategy?.retentionScore });
  } catch (e) {
    log("Pipeline", `Creative direction skipped: ${e}`, {});
  }

  // ── Stage 9: Emotion Arc ─────────────────────────────────────────────────
  stages.push("emotion_arc");
  log("Pipeline", "Stage 9: Emotion Agent mapping arc");
  let emotionData;
  try {
    const fullText = `${optimizedScript.hook}\n\n${optimizedScript.script}\n\n${optimizedScript.cta}`;
    const emotionResult = await runEmotionAgent(fullText, platform);
    allLogs.push(...emotionResult.logs);
    emotionData = emotionResult.data;
  } catch (e) {
    log("Pipeline", `Emotion mapping skipped: ${e}`, {});
  }

  // ── Stage 10: Final viral score ──────────────────────────────────────────
  stages.push("final_scoring");
  const viralPotential = Math.min(
    100,
    Math.round(
      (finalVerdict.overallScore * 0.5) +
      ((winningAngle.score ?? 75) * 0.25) +
      ((creativePlan?.retentionStrategy?.retentionScore ?? 70) * 0.25)
    )
  );

  log("Pipeline", `Pipeline complete — viral potential: ${viralPotential}%`, { stages });

  return {
    hook: optimizedScript.hook,
    script: optimizedScript.script,
    cta: optimizedScript.cta,
    viralPotential,
    emotionalTrigger: winningAngle.emotionToTarget,
    hookStyle: optimizedScript.hookStyle,
    estimatedWordCount: optimizedScript.estimatedWordCount,
    targetEmotion: winningAngle.emotionToTarget,
    judgeScore: finalVerdict.overallScore,
    judgeApproved: finalVerdict.approved,
    retentionStrategy: creativePlan?.retentionStrategy,
    creativePlan,
    agentLogs: allLogs,
    pipelineStages: stages,
    researchInsights: {
      bestAngle: winningAngle.angle,
      targetAudience: research!.targetAudience.demographics,
      primaryEmotion: winningAngle.emotionToTarget,
      recommendedLength: trendData!.recommendedLength,
    },
  };
}
