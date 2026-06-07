import { openai } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, EmotionArc, AgentLog } from "./types.js";

export async function runEmotionAgent(script: string, targetPlatform: string = "all"): Promise<AgentResult<{
  emotionArc: EmotionArc[];
  dopamineSpikes: number[];
  bingeabilityScore: number;
  replayScore: number;
  pacingNotes: string;
  optimizedScript: string;
  tensionPoints: string[];
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) => logs.push({ agent: "EmotionAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Analyzing emotional architecture");
  const memories = await recallMemories("emotion_agent", 5);
  const memCtx = memories.map((m) => m.content).join(". ");

  const prompt = `You are VIRALOS Emotion Agent — a master of emotional pacing, tension building, dopamine spikes, and emotional transitions.
Your goal: maximize bingeability and replay potential of short-form video content.
${memCtx ? `Memory context: ${memCtx}` : ""}

Analyze and optimize this script for maximum emotional impact on ${targetPlatform}:

SCRIPT:
${script}

Tasks:
1. Map the complete emotional arc (timestamp approximations like "0:00-0:03", "0:03-0:08", etc.)
2. Identify 3-5 dopamine spike moments (timestamp percentages 0-100)
3. Score bingeability (0-100) and replay potential (0-100)
4. Add tension points that make viewers unable to stop
5. Rewrite/optimize the script to maximize emotional intensity
6. Pacing notes on what works and what to fix

Return ONLY valid JSON:
{
  "emotionArc": [{"timestamp":"0:00-0:03","emotion":"curiosity","intensity":7,"type":"buildup"}],
  "dopamineSpikes": [25, 50, 80],
  "bingeabilityScore": 0,
  "replayScore": 0,
  "pacingNotes": "",
  "optimizedScript": "",
  "tensionPoints": [""]
}`;

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Emotion arc mapped", { bingeability: data.bingeabilityScore, replay: data.replayScore });

  await storeMemory(
    "emotion_agent",
    `pacing_${Date.now()}`,
    `Bingeability:${data.bingeabilityScore} Replay:${data.replayScore} Platform:${targetPlatform}`,
    (data.bingeabilityScore ?? 0) / 10,
    { spikeCount: data.dopamineSpikes?.length }
  );

  return { success: true, data, logs };
}
