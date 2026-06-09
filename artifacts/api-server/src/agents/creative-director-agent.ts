import { openai } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export interface CreativeDirectorPlan {
  retentionStrategy: {
    attentionResets: Array<{ timestamp: string; technique: string; reason: string }>;
    patternInterrupts: string[];
    paceMap: Array<{ segment: string; pace: "fast" | "medium" | "slow"; durationSec: number }>;
    retentionScore: number;
  };
  visualPlan: {
    openingShot: string;
    sceneSequence: Array<{ scene: number; description: string; motion: string; durationSec: number; emotion: string }>;
    overlayMoments: Array<{ timestamp: string; type: "text" | "graphic" | "zoom" | "cut"; content: string }>;
    colorGradeDirection: string;
  };
  pacingDirectives: {
    avgSceneDuration: number;
    cutFrequency: "every 2s" | "every 3-4s" | "every 5-7s";
    motionStyle: string;
    energyArc: string;
  };
  retentionHooks: {
    secondaryHooksAt: number[];
    payoffMoments: number[];
    ctaSetupAt: number;
  };
  watchTimeOptimization: string[];
}

export async function runCreativeDirectorAgent(
  script: { hook: string; body: string; cta: string },
  research: { primaryEmotion: string; attentionDrivers: string[]; paceStyle: string },
  platform: string = "youtube_shorts",
  videoStyle: string = "dark_motivation"
): Promise<AgentResult<CreativeDirectorPlan>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "CreativeDirector", timestamp: new Date().toISOString(), message: msg, data });

  log("Loading creative memory bank");
  const memories = await recallMemories("creative_director", 5);
  const topPatterns = memories.filter((m) => (m.score ?? 0) > 2).map((m) => m.content).join(". ");

  log("Directing visual & retention strategy", { style: videoStyle, emotion: research.primaryEmotion });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are VIRALOS Creative Director — obsessed with RETENTION, not aesthetics.
Your sole objective: maximize average watch time and completion rate.
You think in attention resets, pattern interrupts, dopamine cycles, and visual pacing.
Style context: ${videoStyle}
${topPatterns ? `High-retention patterns from memory: ${topPatterns}` : ""}

You direct every frame decision with one question: "Will viewers still be watching 3 seconds from now?"`,
      },
      {
        role: "user",
        content: `Direct the visual and retention strategy for this script:

HOOK: "${script.hook}"
BODY: "${script.body.slice(0, 400)}"
CTA: "${script.cta}"

Platform: ${platform === "reels" ? "Instagram Reels" : "YouTube Shorts"}
Primary Emotion: ${research.primaryEmotion}
Pace Style: ${research.paceStyle}
Attention Drivers: ${research.attentionDrivers.join(", ")}

Create a complete creative direction plan optimized for MAXIMUM retention. 

Return JSON:
{
  "retentionStrategy": {
    "attentionResets": [{"timestamp":"0:03","technique":"zoom cut","reason":"prevent first drop-off"}],
    "patternInterrupts": ["technique 1", "technique 2", "technique 3"],
    "paceMap": [{"segment":"hook","pace":"fast","durationSec":3},{"segment":"body","pace":"medium","durationSec":35},{"segment":"cta","pace":"fast","durationSec":5}],
    "retentionScore": 85
  },
  "visualPlan": {
    "openingShot": "description of most attention-grabbing first frame",
    "sceneSequence": [{"scene":1,"description":"","motion":"","durationSec":3,"emotion":""}],
    "overlayMoments": [{"timestamp":"0:02","type":"text","content":"bold stat or question"}],
    "colorGradeDirection": "grade style description"
  },
  "pacingDirectives": {
    "avgSceneDuration": 4,
    "cutFrequency": "every 3-4s",
    "motionStyle": "slow-motion + quick cuts",
    "energyArc": "low → explosive → peak → resolution"
  },
  "retentionHooks": {
    "secondaryHooksAt": [8, 20, 35],
    "payoffMoments": [25, 42],
    "ctaSetupAt": 48
  },
  "watchTimeOptimization": ["tip 1", "tip 2", "tip 3", "tip 4"]
}`,
      },
    ],
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}") as CreativeDirectorPlan;
  log("Creative direction complete", { retentionScore: data.retentionStrategy?.retentionScore });

  await storeMemory(
    "creative_director",
    `plan_${Date.now()}`,
    `Retention:${data.retentionStrategy?.retentionScore}% | Style:${videoStyle} | Cuts:${data.pacingDirectives?.cutFrequency}`,
    (data.retentionStrategy?.retentionScore ?? 50) / 10,
    { videoStyle, platform }
  );

  return { success: true, data, logs };
}
