import { groqClient } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { viralityScoresTable } from "@workspace/db";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, ViralityBreakdown, AgentLog } from "./types.js";

export async function runViralityEngine(
  projectId: number,
  hook: string,
  script: string,
  emotionData: { bingeabilityScore?: number; replayScore?: number; dopamineSpikes?: number[] },
  retentionScore: number,
  platform: string = "all"
): Promise<AgentResult<ViralityBreakdown>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) => logs.push({ agent: "ViralityEngine", timestamp: new Date().toISOString(), message: msg, data });

  log("Running virality prediction engine");
  const memories = await recallMemories("virality_engine", 5);
  const benchmarks = memories.map((m) => m.content).join(". ");

  const prompt = `You are VIRALOS Virality Prediction Engine — an AI that predicts viral probability with surgical precision.
You analyze content across multiple dimensions and output actionable scores.
${benchmarks ? `Benchmark data from memory: ${benchmarks}` : ""}

Analyze this content for viral potential:

HOOK (first 2 seconds): "${hook}"
SCRIPT EXCERPT: "${script.slice(0, 500)}"
PLATFORM: ${platform}
EMOTION DATA: Bingeability ${emotionData.bingeabilityScore ?? "unknown"}/100, Replay ${emotionData.replayScore ?? "unknown"}/100, Dopamine spikes: ${emotionData.dopamineSpikes?.length ?? 0}
RETENTION SCORE: ${retentionScore}/100

Score each dimension (0-10) and calculate viral probability (0-100):

1. Hook Strength: Does it stop the scroll in 2 seconds?
2. Emotional Intensity: How strongly does it make people feel?
3. Curiosity Gap: Does it create an irresistible need to keep watching?
4. Replay Potential: Would people watch it more than once?
5. Watch Retention Probability: What % will watch to the end?
6. Shareability: Would people send this to friends?

Predict: viral_probability (0-100), retention_prediction (low/medium/high/very_high)
List 3 strengths, 3 weaknesses, 3 actionable recommendations.

Return ONLY valid JSON:
{
  "viral_probability": 0,
  "hook_score": 0,
  "emotion_score": 0,
  "curiosity_gap": 0,
  "replay_potential": 0,
  "retention_prediction": "medium",
  "shareability": 0,
  "strengths": ["","",""],
  "weaknesses": ["","",""],
  "recommendations": ["","",""]
}`;

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}") as ViralityBreakdown;
  log("Virality score computed", { probability: data.viral_probability });

  await db.insert(viralityScoresTable).values({
    projectId,
    viralProbability: data.viral_probability ?? 0,
    hookScore: data.hook_score ?? 0,
    emotionScore: data.emotion_score ?? 0,
    curiosityGap: data.curiosity_gap ?? 0,
    replayPotential: data.replay_potential ?? 0,
    retentionPrediction: data.retention_prediction ?? "medium",
    shareability: data.shareability ?? 0,
    breakdown: data as unknown as Record<string, unknown>,
  });

  await storeMemory("virality_engine", `score_${Date.now()}`, `Viral:${data.viral_probability}% Hook:${data.hook_score} Platform:${platform}`, data.viral_probability / 10, {
    retentionPrediction: data.retention_prediction,
  });

  return { success: true, data, logs };
}
