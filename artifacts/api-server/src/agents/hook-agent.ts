import { openai } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, HookVariant, AgentLog } from "./types.js";

export async function runHookAgent(prompt: string, platform: string = "all", niche?: string): Promise<AgentResult<{
  hooks: HookVariant[];
  topHook: HookVariant;
  analysisNotes: string;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) => logs.push({ agent: "HookAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Loading hook memory bank");
  const memories = await recallMemories("hook_agent", 8);
  const topMemories = memories.filter((m) => (m.score ?? 0) > 1).map((m) => `High-performing hook: ${m.content}`).join("\n");

  log("Generating 10 hook variations", { prompt, platform });

  const systemPrompt = `You are VIRALOS Hook Agent — obsessed with the first 2 seconds of video content.
You are a master of curiosity gaps, emotional triggers, controversial openings, and rapid attention capture.
You study the psychology of why humans stop scrolling and cannot look away.
${topMemories ? `\nTop-performing hooks from your memory:\n${topMemories}` : ""}`;

  const userPrompt = `Generate 10 powerful hook variations for this video concept:

Topic: "${prompt}"
Platform: ${platform}
${niche ? `Niche: ${niche}` : ""}

For each hook create:
- The actual hook text (max 15 words, punchy, immediate)
- Style: one of [curiosity_gap, controversy, emotional_trigger, pattern_interrupt, direct_value, social_proof, fear, desire, story_open]
- Predicted retention score (0-10)
- Emotional trigger being activated
- Rank (1 = best)

Rules:
- Hook must work in 2 seconds of viewing
- No "In this video..." or "Today we..."
- Lead with conflict, mystery, or bold claim
- Make viewer feel they MUST keep watching

Return ONLY valid JSON:
{
  "hooks": [
    {"hook":"","style":"","predicted_retention":0,"emotional_trigger":"","rank":1}
  ],
  "topHook": {"hook":"","style":"","predicted_retention":0,"emotional_trigger":"","rank":1},
  "analysisNotes": ""
}`;

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Hooks generated", { count: data.hooks?.length, topScore: data.topHook?.predicted_retention });

  if (data.topHook) {
    await storeMemory("hook_agent", `hook_${Date.now()}`, data.topHook.hook, data.topHook.predicted_retention ?? 5, {
      style: data.topHook.style,
      platform,
    });
  }

  return { success: true, data, logs };
}
