import { groqClient } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export interface JudgeVerdict {
  approved: boolean;
  overallScore: number;
  scores: {
    hookQuality: number;
    retentionProbability: number;
    emotionalImpact: number;
    shareability: number;
    visualPacing: number;
    ctaEffectiveness: number;
  };
  weaknesses: string[];
  improvements: {
    agent: "script" | "hook" | "pacing" | "cta";
    instruction: string;
    priority: "critical" | "high" | "medium";
  }[];
  judgeReasoning: string;
  passThreshold: number;
}

const PASS_THRESHOLD = 72;

export async function runJudgeAgent(
  content: {
    hook: string;
    script: string;
    cta: string;
    viralPotential?: number;
  },
  context: {
    platform: string;
    targetEmotion: string;
    niche?: string;
    attemptNumber?: number;
  }
): Promise<AgentResult<JudgeVerdict>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "JudgeAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Loading judge benchmarks from memory");
  const memories = await recallMemories("judge_agent", 5);
  const benchmarks = memories.filter((m) => (m.score ?? 0) > 2).map((m) => m.content).join(". ");

  log("Running critical quality evaluation", { attempt: context.attemptNumber ?? 1 });

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are VIRALOS Judge Agent — the strictest quality gate in the system.
Your job: evaluate content with brutal honesty. You do NOT approve mediocre work.
Pass threshold: ${PASS_THRESHOLD}/100. Anything below is REJECTED and sent back for revision.
You are harder on first attempts. You reward specific, emotionally charged, psychologically precise content.
${benchmarks ? `\nBenchmark standards from memory: ${benchmarks}` : ""}

You ask yourself: "Would I stop scrolling for this? Would I share this? Would I still be watching at the 30-second mark?"
If the answer to any of these is "maybe" — the score drops.`,
      },
      {
        role: "user",
        content: `Evaluate this ${context.platform === "reels" ? "Instagram Reels" : "YouTube Shorts"} script:

HOOK: "${content.hook}"
SCRIPT: "${content.script}"
CTA: "${content.cta}"

Target Emotion: ${context.targetEmotion}
${context.niche ? `Niche: ${context.niche}` : ""}
Attempt #${context.attemptNumber ?? 1}

Score each dimension 0-10:
1. Hook Quality: Does it stop the scroll in 2 seconds? Does it create an irresistible curiosity gap?
2. Retention Probability: Will viewers watch past the 30-second mark?
3. Emotional Impact: How powerfully does this make the viewer FEEL something?
4. Shareability: Would a viewer send this to a friend or post it themselves?
5. Visual Pacing: Can a video editor create a compelling visual rhythm from this?
6. CTA Effectiveness: Is the CTA compelling and natural, or forced?

Overall score = weighted average (hook x2, retention x2, emotion x1.5, shareability x1, visual x1, cta x0.5) / 8

For each weakness, give SPECIFIC improvement instructions to the responsible agent.

Approve if overall >= ${PASS_THRESHOLD}. Reject otherwise.

Return JSON:
{
  "approved": true,
  "overallScore": 78,
  "scores": {
    "hookQuality": 8,
    "retentionProbability": 7,
    "emotionalImpact": 8,
    "shareability": 7,
    "visualPacing": 6,
    "ctaEffectiveness": 7
  },
  "weaknesses": ["weakness 1", "weakness 2"],
  "improvements": [
    {"agent":"hook","instruction":"specific rewrite instruction","priority":"high"}
  ],
  "judgeReasoning": "1-sentence summary of why this passed or failed",
  "passThreshold": ${PASS_THRESHOLD}
}`,
      },
    ],
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}") as JudgeVerdict;
  data.passThreshold = PASS_THRESHOLD;

  // Force correct approval logic based on score
  data.approved = (data.overallScore ?? 0) >= PASS_THRESHOLD;

  log("Verdict rendered", { approved: data.approved, score: data.overallScore, threshold: PASS_THRESHOLD });

  await storeMemory(
    "judge_agent",
    `verdict_${Date.now()}`,
    `Score:${data.overallScore} | Approved:${data.approved} | Hook:${data.scores?.hookQuality}/10 | Retention:${data.scores?.retentionProbability}/10`,
    data.overallScore / 10,
    { platform: context.platform, approved: data.approved }
  );

  return { success: true, data, logs };
}
