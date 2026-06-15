import { groqClient } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export async function runRetentionAgent(script: string, storyboard: unknown[], platform: string = "all"): Promise<AgentResult<{
  boringSegments: Array<{ start: string; end: string; reason: string; fix: string }>;
  pacingDrops: Array<{ timestamp: string; severity: "low" | "medium" | "high"; suggestion: string }>;
  weakTransitions: Array<{ between: string; fix: string }>;
  patternInterrupts: Array<{ timestamp: string; type: string; description: string }>;
  optimizedScript: string;
  retentionScore: number;
  editorNotes: string;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) => logs.push({ agent: "RetentionAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Scanning for retention killers");
  const memories = await recallMemories("retention_agent", 5);
  const retentionWisdom = memories.map((m) => m.content).join(". ");

  const prompt = `You are VIRALOS Retention Agent — a ruthless editor obsessed with keeping every viewer glued to the screen.
You identify boring sections, pacing drops, and weak transitions — then you FIX them automatically.
${retentionWisdom ? `Retention wisdom from memory: ${retentionWisdom}` : ""}

Script to analyze:
${script}

Storyboard (first 5 scenes):
${JSON.stringify(storyboard?.slice(0, 5))}

Platform: ${platform}

Your job:
1. Find ALL boring/dead segments (where viewers would scroll away)
2. Identify pacing drops (too slow, too much of the same energy)
3. Spot weak transitions (jarring cuts, awkward flow)
4. Design pattern interrupts to inject throughout (sudden zoom, unexpected cut, text pop, sound effect, perspective shift)
5. Rewrite the script with all optimizations applied
6. Give a retention score (0-100) for the optimized version

Pattern interrupt types: zoom_cut, text_pop, perspective_shift, sound_shock, speed_ramp, unexpected_visual, direct_camera, scene_jump

Return ONLY valid JSON:
{
  "boringSegments": [{"start":"","end":"","reason":"","fix":""}],
  "pacingDrops": [{"timestamp":"","severity":"medium","suggestion":""}],
  "weakTransitions": [{"between":"","fix":""}],
  "patternInterrupts": [{"timestamp":"","type":"","description":""}],
  "optimizedScript": "",
  "retentionScore": 0,
  "editorNotes": ""
}`;

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Retention analysis complete", { score: data.retentionScore, interrupts: data.patternInterrupts?.length });

  await storeMemory("retention_agent", `retention_${Date.now()}`, `Score:${data.retentionScore} Interrupts:${data.patternInterrupts?.length}`, data.retentionScore / 10, {
    boringCount: data.boringSegments?.length,
  });

  return { success: true, data, logs };
}
