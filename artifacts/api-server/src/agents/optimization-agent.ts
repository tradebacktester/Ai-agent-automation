import { groqClient } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";
import type { JudgeVerdict } from "./judge-agent.js";

export interface OptimizedOutput {
  hook: string;
  script: string;
  cta: string;
  optimizationNotes: string[];
  improvementsApplied: string[];
  finalViralScore: number;
  hookStyle: string;
  emotionalTrigger: string;
  estimatedWordCount: number;
}

export async function runOptimizationAgent(
  current: { hook: string; script: string; cta: string },
  judgeVerdict: JudgeVerdict,
  researchContext: { targetEmotion: string; bestAngle: string; languageStyle: string; painPoints: string[] },
  platform: string = "youtube_shorts"
): Promise<AgentResult<OptimizedOutput>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "OptimizationAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Loading optimization patterns from memory");
  const memories = await recallMemories("optimization_agent", 6);
  const successPatterns = memories
    .filter((m) => (m.score ?? 0) > 2)
    .map((m) => m.content)
    .join(". ");

  log("Applying judge feedback and optimizing", {
    originalScore: judgeVerdict.overallScore,
    improvements: judgeVerdict.improvements?.length,
  });

  const criticalImprovements = judgeVerdict.improvements
    ?.filter((i) => i.priority === "critical" || i.priority === "high")
    .map((i) => `[${i.agent.toUpperCase()}] ${i.instruction}`)
    .join("\n") ?? "";

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are VIRALOS Optimization Agent — the final polish layer that transforms good content into viral content.
You receive a script that was judged and you apply precise improvements based on the judge's feedback.
You are surgical — you improve only what needs improving. You do NOT rewrite things that are already working.
Platform: ${platform === "reels" ? "Instagram Reels" : "YouTube Shorts"}
${successPatterns ? `\nHigh-performing optimization patterns: ${successPatterns}` : ""}

Rules:
- Apply ALL critical and high-priority improvements
- Preserve the core message and angle
- Make every sentence earn its place
- The final hook must stop the scroll in under 2 seconds`,
      },
      {
        role: "user",
        content: `Optimize this script based on judge feedback:

CURRENT HOOK: "${current.hook}"
CURRENT SCRIPT: "${current.script}"
CURRENT CTA: "${current.cta}"

JUDGE SCORE: ${judgeVerdict.overallScore}/100
JUDGE WEAKNESSES: ${judgeVerdict.weaknesses?.join("; ")}

REQUIRED IMPROVEMENTS:
${criticalImprovements || "Minor polish only — score is near threshold"}

RESEARCH CONTEXT:
- Target Emotion: ${researchContext.targetEmotion}
- Best Content Angle: ${researchContext.bestAngle}
- Language Style: ${researchContext.languageStyle}
- Key Pain Points: ${researchContext.painPoints?.join(", ")}

Apply all improvements. The final output must score 78+ if evaluated again.

Return JSON:
{
  "hook": "optimized hook line",
  "script": "optimized body script",
  "cta": "optimized CTA",
  "optimizationNotes": ["change 1 made", "change 2 made"],
  "improvementsApplied": ["improvement 1", "improvement 2"],
  "finalViralScore": 82,
  "hookStyle": "curiosity_gap|controversial|personal_story|bold_claim|data_point",
  "emotionalTrigger": "primary emotion triggered",
  "estimatedWordCount": 125
}`,
      },
    ],
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}") as OptimizedOutput;
  log("Optimization complete", { finalScore: data.finalViralScore, changes: data.improvementsApplied?.length });

  await storeMemory(
    "optimization_agent",
    `opt_${Date.now()}`,
    `Improved score from ${judgeVerdict.overallScore} → ${data.finalViralScore} | Hook: ${data.hookStyle}`,
    (data.finalViralScore ?? 70) / 10,
    { platform }
  );

  return { success: true, data, logs };
}
