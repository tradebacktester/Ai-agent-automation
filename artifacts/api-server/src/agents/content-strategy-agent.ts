import { groqClient } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { contentStrategiesTable } from "@workspace/db";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, ContentPillar, PostingSchedule, AgentLog } from "./types.js";

export async function runContentStrategyAgent(niche: string, goal: string, platforms: string[] = ["tiktok", "youtube_shorts", "instagram"]): Promise<AgentResult<{
  contentPillars: ContentPillar[];
  postingSchedule: PostingSchedule[];
  hookStrategies: string[];
  emotionalPositioning: string;
  nicheAnalysis: string;
  dominationPlan: string;
  keyMessages: string[];
  competitiveEdge: string;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) => logs.push({ agent: "ContentStrategyAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Building content strategy", { niche, goal, platforms });
  const memories = await recallMemories("content_strategy", 5);
  const strategyWisdom = memories.map((m) => m.content).join(". ");

  const prompt = `You are VIRALOS Content Strategy Engine — a viral growth strategist who builds niche domination plans.
You think like a media empire, not a content creator.
${strategyWisdom ? `Strategic memory: ${strategyWisdom}` : ""}

Build a complete content strategy for:
NICHE: "${niche}"
GOAL: "${goal}"
PLATFORMS: ${platforms.join(", ")}

Deliver:
1. Content Pillars (4-6 core content themes, each with 3-4 content types)
2. Posting Schedule (7 days, platform-specific, best times)
3. Hook Strategies (8-10 proven hook frameworks for this niche)
4. Emotional Positioning (how this page makes the audience FEEL)
5. Niche Analysis (who dominates now, gaps to exploit)
6. Niche Domination Plan (90-day roadmap in 3 phases)
7. Key Messages (5-7 core messages that define the brand voice)
8. Competitive Edge (what makes this different from all others)

Return ONLY valid JSON:
{
  "contentPillars": [{"name":"","description":"","content_types":[""],"posting_frequency":""}],
  "postingSchedule": [{"day":"Monday","time":"7:00 PM","platform":"tiktok","content_type":""}],
  "hookStrategies": [""],
  "emotionalPositioning": "",
  "nicheAnalysis": "",
  "dominationPlan": "",
  "keyMessages": [""],
  "competitiveEdge": ""
}`;

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Strategy complete", { pillars: data.contentPillars?.length });

  await db.insert(contentStrategiesTable).values({
    niche,
    pillars: data.contentPillars ?? [],
    postingSchedule: data.postingSchedule ?? [],
    hookStrategies: data.hookStrategies ?? [],
    emotionalPositioning: data.emotionalPositioning ?? "",
    nicheAnalysis: data.nicheAnalysis ?? "",
  });

  await storeMemory("content_strategy", `niche_${niche.replace(/\s+/g, "_")}_${Date.now()}`, `${niche}: ${data.emotionalPositioning?.slice(0, 100)}`, 1, {
    platformCount: platforms.length,
    pillarsCount: data.contentPillars?.length,
  });

  return { success: true, data, logs };
}
