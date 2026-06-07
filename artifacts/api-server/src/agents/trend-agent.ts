import { openai } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, TrendSignal, AgentLog } from "./types.js";

export async function runTrendAgent(platforms: string[] = ["youtube_shorts", "tiktok", "reddit", "x", "google"]): Promise<AgentResult<{
  risingTrends: TrendSignal[];
  viralSounds: string[];
  emotionalPatterns: string[];
  highRetentionFormats: string[];
  trendingAesthetics: string[];
  platformBreakdown: Record<string, TrendSignal[]>;
  summary: string;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) => logs.push({ agent: "TrendAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Recalling past trend memories");
  const memories = await recallMemories("trend_agent", 5);
  const memoryContext = memories.map((m) => `Past insight: ${m.content}`).join("\n");

  log("Scanning platforms for trend signals", { platforms });

  const prompt = `You are VIRALOS Trend Agent — an expert at detecting viral content trends across social platforms.
${memoryContext ? `\nYour memory from previous analyses:\n${memoryContext}\n` : ""}

Analyze current trends across: ${platforms.join(", ")}

Generate a comprehensive trend report with:
1. 8-12 rising trend signals (topics gaining momentum RIGHT NOW)
2. 5-8 viral sounds/audio formats trending
3. 6-8 emotional patterns dominating content (e.g., "rage-then-hope arc", "underdog revenge")
4. 5-7 high-retention video formats (e.g., "3-part mystery reveal", "POV confession")
5. 5-7 trending visual aesthetics (e.g., "dark academia", "Y2K nostalgia", "raw documentary")
6. Platform-specific breakdowns

For each trend signal include: topic, platform, momentum (rising/peaking/declining), emotional_pattern, format, aesthetic, estimated_reach.

Return ONLY valid JSON:
{
  "risingTrends": [{"topic":"","platform":"","momentum":"rising","emotional_pattern":"","format":"","aesthetic":"","estimated_reach":""}],
  "viralSounds": [""],
  "emotionalPatterns": [""],
  "highRetentionFormats": [""],
  "trendingAesthetics": [""],
  "platformBreakdown": {"youtube_shorts":[],"tiktok":[],"reddit":[],"x":[]},
  "summary": ""
}`;

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const data = JSON.parse(raw);
  log("Trend scan complete", { trendCount: data.risingTrends?.length });

  await storeMemory("trend_agent", `report_${new Date().toISOString().split("T")[0]}`, data.summary ?? "", 1, {
    trendCount: data.risingTrends?.length,
  });

  return { success: true, data, logs };
}
