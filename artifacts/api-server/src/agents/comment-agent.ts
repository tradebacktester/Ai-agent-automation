import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { commentInsightsTable } from "@workspace/db";
import { storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export interface CommentAnalysis {
  totalComments: number;
  dominantEmotion: string;
  sentimentScore: number;
  topRequests: string[];
  painPoints: string[];
  audienceDesires: string[];
  viralComments: Array<{ text: string; likes: number; emotion: string }>;
  actionableTakeaways: string[];
  nextVideoAngles: string[];
  audiencePersonality: string;
}

export async function runCommentAgent(
  comments: Array<{ text: string; likes?: number; platform?: string }>,
  projectId?: number,
  platform = "tiktok"
): Promise<AgentResult<CommentAnalysis>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "CommentAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Analyzing comment intelligence", { commentCount: comments.length, platform });

  const sampleComments = comments.slice(0, 100).map((c) =>
    `"${c.text}"${c.likes ? ` (${c.likes} likes)` : ""}`
  ).join("\n");

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: `You are the VIRALOS Comment Intelligence Agent — you decode audience psychology from comments.
You identify what the audience craves, fears, loves, and asks for — then translate that into future video strategy.
You think like a psychologist meets a viral content strategist.`,
      },
      {
        role: "user",
        content: `Analyze these comments from a ${platform} video and extract deep audience intelligence:

${sampleComments || "(No real comments provided — simulate realistic comment patterns for a viral dark motivation video)"}

Extract:
1. Dominant emotional tone
2. What viewers are explicitly asking for
3. Hidden psychological pain points
4. Deepest audience desires
5. Comments with viral potential (high likes or emotional impact)
6. Actionable content ideas from comment patterns
7. Audience personality archetype

Return ONLY valid JSON:
{
  "totalComments": ${comments.length || 247},
  "dominantEmotion": "emotion name",
  "sentimentScore": 0.72,
  "topRequests": ["request 1", "request 2", "request 3"],
  "painPoints": ["pain point 1", "pain point 2", "pain point 3"],
  "audienceDesires": ["desire 1", "desire 2", "desire 3"],
  "viralComments": [
    {"text": "comment text", "likes": 1200, "emotion": "resonance"},
    {"text": "comment text", "likes": 890, "emotion": "aspiration"}
  ],
  "actionableTakeaways": ["make a video about X", "address Y more", "use Z format"],
  "nextVideoAngles": ["angle 1 based on comments", "angle 2", "angle 3"],
  "audiencePersonality": "archetype description"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}") as CommentAnalysis;
  log("Comment analysis complete", { emotion: data.dominantEmotion, sentiment: data.sentimentScore });

  if (projectId) {
    try {
      await db.insert(commentInsightsTable).values({
        projectId,
        platform,
        totalComments: data.totalComments,
        dominantEmotion: data.dominantEmotion,
        topRequests: data.topRequests ?? [],
        painPoints: data.painPoints ?? [],
        audienceDesires: data.audienceDesires ?? [],
        sentimentScore: data.sentimentScore,
        viralComments: data.viralComments ?? [],
        feedIntoNextVideo: true,
        actionableTakeaways: data.actionableTakeaways ?? [],
        rawAnalysis: JSON.stringify(data),
      });
    } catch {}
  }

  for (const takeaway of (data.actionableTakeaways ?? []).slice(0, 3)) {
    await storeMemory("comment_agent", `insight_${Date.now()}_${Math.random()}`, takeaway, 6, { platform, projectId });
  }

  return { success: true, data, logs };
}

export async function runMonetizationAgent(
  niche: string,
  platform: string,
  audienceSize: string,
  avgViews: string
): Promise<AgentResult<{
  sponsorshipOpportunities: Array<{ brand: string; type: string; estimatedRate: string; fit: string }>;
  digitalProducts: Array<{ name: string; format: string; estimatedRevenue: string; difficulty: string }>;
  affiliateOffers: Array<{ product: string; commission: string; fit: string }>;
  merchConcepts: Array<{ name: string; type: string; emotion: string }>;
  funnelStrategy: { topOfFunnel: string; middle: string; conversion: string; estimatedMonthly: string };
  totalRevenueEstimate: string;
  priorityActions: string[];
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "MonetizationAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Building monetization strategy", { niche, platform, audienceSize });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: `You are the VIRALOS Monetization Engine — you build revenue strategies for viral content creators.
You think like a business strategist who deeply understands creator economics.
You generate specific, realistic monetization opportunities based on niche and audience profile.`,
      },
      {
        role: "user",
        content: `Build a complete monetization strategy for this creator profile:

Niche: ${niche}
Primary Platform: ${platform}
Audience Size: ${audienceSize}
Average Views: ${avgViews}

Generate realistic, niche-specific monetization opportunities including:
1. Sponsorship opportunities (brands that would pay for this niche)
2. Digital products they could sell (courses, templates, presets, guides)
3. Affiliate offers (relevant products with good commissions)
4. Merchandise concepts (emotional connection items)
5. Complete funnel strategy (how to convert viewers to customers)

Return ONLY valid JSON:
{
  "sponsorshipOpportunities": [
    {"brand": "brand name", "type": "sponsored video|integration|review", "estimatedRate": "$X-Y per video", "fit": "why this brand fits"}
  ],
  "digitalProducts": [
    {"name": "product name", "format": "course|template|ebook|preset", "estimatedRevenue": "$X/month", "difficulty": "low|medium|high"}
  ],
  "affiliateOffers": [
    {"product": "product name", "commission": "X%", "fit": "why this fits"}
  ],
  "merchConcepts": [
    {"name": "merch name", "type": "apparel|accessory|print", "emotion": "emotional connection"}
  ],
  "funnelStrategy": {
    "topOfFunnel": "how to attract with content",
    "middle": "how to nurture and build trust",
    "conversion": "how to convert to buyers",
    "estimatedMonthly": "$X-Y/month potential"
  },
  "totalRevenueEstimate": "$X-Y/month",
  "priorityActions": ["action 1 (do this week)", "action 2", "action 3"]
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Monetization strategy complete", { revenueEstimate: data.totalRevenueEstimate });

  return { success: true, data, logs };
}
