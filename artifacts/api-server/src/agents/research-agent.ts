import { groqClient } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export interface ResearchIntelligence {
  targetAudience: {
    demographics: string;
    psychographics: string;
    painPoints: string[];
    desires: string[];
    languageStyle: string;
  };
  viewerPsychology: {
    primaryEmotion: string;
    triggerMechanism: string;
    attentionDrivers: string[];
    dropOffRisks: string[];
  };
  trendAlignment: {
    currentTrends: string[];
    viralAngles: string[];
    bestContentAngle: string;
    competitorPatterns: string[];
  };
  contentStrategy: {
    recommendedLength: string;
    hookApproach: string;
    paceStyle: string;
    contentDepth: string;
  };
  researchConfidence: number;
}

export async function runResearchAgent(
  prompt: string,
  platform: string = "youtube_shorts",
  niche?: string
): Promise<AgentResult<ResearchIntelligence>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "ResearchAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Loading research memory bank");
  const memories = await recallMemories("research_agent", 6);
  const pastInsights = memories
    .filter((m) => (m.score ?? 0) > 1)
    .map((m) => `Past insight: ${m.content}`)
    .join("\n");

  log("Running audience & trend research", { prompt, platform, niche });

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are VIRALOS Research Agent — the intelligence foundation for all content decisions.
Your role: Before any script is written, you must understand the audience at a deep psychological level.
You study viewer behavior, platform trends, competitor patterns, and emotional triggers.
${pastInsights ? `\nMemory insights:\n${pastInsights}` : ""}

You NEVER generate scripts. You ONLY generate intelligence that guides other agents.
Your research must be actionable and specific — not generic platitudes.`,
      },
      {
        role: "user",
        content: `Research this video concept deeply:

Topic: "${prompt}"
Platform: ${platform === "reels" ? "Instagram Reels" : "YouTube Shorts"}
${niche ? `Niche: ${niche}` : ""}

Determine:
1. Exact target audience (age, mindset, aspirations, fears)
2. Deep viewer psychology (what emotion will drive them to watch to the end?)
3. Current trend alignment (what angles are working RIGHT NOW in this niche?)
4. Content strategy (length, pacing, depth level)

Return JSON matching this exact structure:
{
  "targetAudience": {
    "demographics": "specific age/situation description",
    "psychographics": "mindset and worldview",
    "painPoints": ["specific pain 1", "specific pain 2", "specific pain 3"],
    "desires": ["core desire 1", "core desire 2"],
    "languageStyle": "casual/professional/raw/aspirational"
  },
  "viewerPsychology": {
    "primaryEmotion": "the dominant emotion to engineer",
    "triggerMechanism": "the psychological lever to pull",
    "attentionDrivers": ["driver 1", "driver 2", "driver 3"],
    "dropOffRisks": ["risk 1", "risk 2"]
  },
  "trendAlignment": {
    "currentTrends": ["trend 1", "trend 2", "trend 3"],
    "viralAngles": ["angle 1", "angle 2", "angle 3"],
    "bestContentAngle": "the single strongest angle for virality",
    "competitorPatterns": ["pattern 1", "pattern 2"]
  },
  "contentStrategy": {
    "recommendedLength": "30s/45s/60s",
    "hookApproach": "curiosity_gap/shock/story/data/contrarian",
    "paceStyle": "fast/medium/slow-burn",
    "contentDepth": "surface/moderate/deep"
  },
  "researchConfidence": 85
}`,
      },
    ],
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}") as ResearchIntelligence;
  log("Research complete", { angle: data.trendAlignment?.bestContentAngle, confidence: data.researchConfidence });

  await storeMemory(
    "research_agent",
    `research_${Date.now()}`,
    `Best angle for "${prompt.slice(0, 50)}": ${data.trendAlignment?.bestContentAngle} | Emotion: ${data.viewerPsychology?.primaryEmotion}`,
    (data.researchConfidence ?? 50) / 10,
    { platform, niche }
  );

  return { success: true, data, logs };
}
