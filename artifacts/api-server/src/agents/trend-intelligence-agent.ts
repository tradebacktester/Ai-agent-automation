import { groqClient } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export interface TrendIntelligence {
  viralOpportunities: Array<{
    angle: string;
    score: number;
    reasoning: string;
    trend: string;
  }>;
  winningAngle: {
    angle: string;
    score: number;
    emotionToTarget: string;
    hookApproach: string;
    uniqueInsight: string;
  };
  retentionRisks: string[];
  dropOffPoints: string[];
  recommendedLength: number;
  contentFormat: string;
  audienceInsight: string;
  confidenceScore: number;
}

export async function runTrendIntelligenceAgent(
  prompt: string,
  researchData: {
    targetAudience: { painPoints: string[]; desires: string[]; languageStyle: string };
    trendAlignment: { currentTrends: string[]; viralAngles: string[]; bestContentAngle: string };
    viewerPsychology: { primaryEmotion: string; attentionDrivers: string[]; dropOffRisks: string[] };
  },
  platform: string = "youtube_shorts"
): Promise<AgentResult<TrendIntelligence>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "TrendIntelligence", timestamp: new Date().toISOString(), message: msg, data });

  log("Loading trend memory");
  const memories = await recallMemories("trend_intelligence", 5);
  const pastWinners = memories.filter((m) => (m.score ?? 0) > 2).map((m) => m.content).join(". ");

  log("Analyzing viral opportunities", { prompt, platform });

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are VIRALOS Trend Intelligence Agent — a viral strategist who predicts what will perform.
You study patterns across thousands of viral videos and identify the exact angles, emotions, and formats that are winning RIGHT NOW.
${pastWinners ? `\nWinning patterns from memory: ${pastWinners}` : ""}

You evaluate MULTIPLE approaches and select only the HIGHEST-SCORING one to pass forward.
You are a strategist, not a creator. You pick the angle. Others execute it.`,
      },
      {
        role: "user",
        content: `Analyze viral opportunities for this concept:

Topic: "${prompt}"
Platform: ${platform === "reels" ? "Instagram Reels" : "YouTube Shorts"}

Research context:
- Current trends: ${researchData.trendAlignment.currentTrends.join(", ")}
- Pain points: ${researchData.targetAudience.painPoints.join(", ")}
- Viewer desires: ${researchData.targetAudience.desires.join(", ")}
- Primary emotion: ${researchData.viewerPsychology.primaryEmotion}
- Drop-off risks: ${researchData.viewerPsychology.dropOffRisks.join(", ")}

Generate 4 viral angle options, rank them, select the winner.
Identify retention risks and drop-off prediction points.

Return JSON:
{
  "viralOpportunities": [
    {"angle":"angle description","score":88,"reasoning":"why this works","trend":"trend it aligns with"}
  ],
  "winningAngle": {
    "angle": "the single best angle for maximum virality",
    "score": 88,
    "emotionToTarget": "the dominant emotion",
    "hookApproach": "curiosity_gap|shock|story|data|contrarian",
    "uniqueInsight": "what makes this angle different from everyone else posting about this"
  },
  "retentionRisks": ["risk 1", "risk 2"],
  "dropOffPoints": ["likely drop-off at 8s if...", "likely drop-off at 25s if..."],
  "recommendedLength": 45,
  "contentFormat": "fast-cut montage / single talking head / story arc / list format",
  "audienceInsight": "one deep insight about what this audience actually wants",
  "confidenceScore": 84
}`,
      },
    ],
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}") as TrendIntelligence;
  log("Trend analysis complete", { winningAngle: data.winningAngle?.angle, confidence: data.confidenceScore });

  await storeMemory(
    "trend_intelligence",
    `trend_${Date.now()}`,
    `Winning angle: "${data.winningAngle?.angle}" | Score:${data.winningAngle?.score} | Emotion:${data.winningAngle?.emotionToTarget}`,
    (data.confidenceScore ?? 50) / 10,
    { platform }
  );

  return { success: true, data, logs };
}
