import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { learningInsightsTable, performanceAnalyticsTable } from "@workspace/db";
import { storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";
import { desc } from "drizzle-orm";

export interface OptimizationInsight {
  category: string;
  insight: string;
  pattern: string;
  impactMetric: string;
  impactValue: number;
  confidence: number;
  recommendation: string;
}

export interface ReinforceLoopResult {
  insights: OptimizationInsight[];
  appliedPatterns: string[];
  nextVideoRecommendations: string[];
  selfImprovementScore: number;
  loopIteration: number;
}

export async function runSelfOptimizerAgent(
  projectId?: number,
  recentAnalytics?: Record<string, unknown>[]
): Promise<AgentResult<ReinforceLoopResult>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "SelfOptimizer", timestamp: new Date().toISOString(), message: msg, data });

  log("Initializing self-optimization loop");

  const storedInsights = await db.select().from(learningInsightsTable)
    .orderBy(desc(learningInsightsTable.confidence))
    .limit(20);

  const pastAnalytics = recentAnalytics ?? await db.select()
    .from(performanceAnalyticsTable)
    .orderBy(desc(performanceAnalyticsTable.collectedAt))
    .limit(10);

  log("Analyzing performance patterns", { analyticsCount: pastAnalytics.length, insightsCount: storedInsights.length });

  const existingPatterns = storedInsights.map((i) =>
    `• ${i.insight} (impact: +${i.impactValue}% ${i.impactMetric}, confidence: ${Math.round((i.confidence ?? 0) * 100)}%)`
  ).join("\n");

  const analyticsContext = pastAnalytics.length > 0
    ? JSON.stringify(pastAnalytics.slice(0, 5), null, 2)
    : '{"note": "No real analytics yet — generating synthetic training patterns from viral content research"}';

  const systemPrompt = `You are the VIRALOS Self-Optimizer — an autonomous AI that learns from performance data and improves future content.

You operate the reinforcement learning loop:
Generate → Upload → Analyze → Learn → Improve → Regenerate

You synthesize patterns from performance data and convert them into actionable improvements.
Think like a data scientist who also deeply understands viral psychology.

${existingPatterns ? `Existing learned patterns:\n${existingPatterns}` : ""}`;

  const userPrompt = `Analyze this performance data and extract learning insights:

${analyticsContext}

Generate 8-10 specific, measurable optimization insights. Focus on:
- Retention patterns (what keeps viewers watching)
- Hook effectiveness (what stops the scroll)
- Caption performance (style vs engagement)
- Pacing insights (cut speed vs completion rate)
- Emotional patterns (which emotions drive shares)
- Upload timing (when audiences are most receptive)
- Visual style impacts (color/motion vs retention)
- Audio patterns (music tempo vs engagement)

For each insight, be SPECIFIC with numbers. Examples:
- "0.7-second hooks outperform 1.5-second hooks by 23% on retention"
- "White subtitles convert 18% worse than yellow on dark backgrounds"
- "Fast-cut (8fps+) edits increase replay rate by 31%"

Return ONLY valid JSON:
{
  "insights": [
    {
      "category": "retention|hook|caption|pacing|visual|audio|emotion|posting_time",
      "insight": "specific finding with numbers",
      "pattern": "machine_readable_key",
      "impactMetric": "retention|engagement|shares|replays|completion",
      "impactValue": 15.5,
      "confidence": 0.82,
      "recommendation": "what to do differently next time"
    }
  ],
  "appliedPatterns": ["pattern_key_1", "pattern_key_2"],
  "nextVideoRecommendations": ["specific action 1", "specific action 2", "specific action 3"],
  "selfImprovementScore": 78,
  "loopIteration": 1
}`;

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 3000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}") as ReinforceLoopResult;

  log("Insights extracted", { count: data.insights?.length });

  for (const insight of (data.insights ?? [])) {
    try {
      await db.insert(learningInsightsTable).values({
        category: insight.category,
        insight: insight.insight,
        pattern: insight.pattern,
        impactMetric: insight.impactMetric,
        impactValue: insight.impactValue,
        confidence: insight.confidence,
        sampleSize: pastAnalytics.length,
        isActive: true,
        appliedCount: 0,
        avgImprovementPct: insight.impactValue,
        evidence: [],
      });

      await storeMemory(
        "self_optimizer",
        insight.pattern,
        `${insight.insight} → ${insight.recommendation}`,
        Math.round(insight.confidence * 10),
        { category: insight.category, impactValue: insight.impactValue }
      );
    } catch {}
  }

  log("Optimization loop complete", { selfImprovementScore: data.selfImprovementScore });

  return { success: true, data, logs };
}

export async function runABTestAnalyzer(
  variants: Array<{ id: string; label: string; content: string; metrics: Record<string, number> }>
): Promise<AgentResult<{ winnerId: string; winnerReason: string; confidence: number; insights: string[] }>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "ABTestAnalyzer", timestamp: new Date().toISOString(), message: msg, data });

  log("Analyzing A/B test variants", { variantCount: variants.length });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content: "You are a data-driven A/B test analyzer for viral short-form content. You pick winners based on retention, engagement, and viral metrics.",
      },
      {
        role: "user",
        content: `Analyze these A/B test variants and select the winner:

${JSON.stringify(variants, null, 2)}

Return ONLY valid JSON:
{
  "winnerId": "variant_id",
  "winnerReason": "specific explanation with metrics",
  "confidence": 0.87,
  "insights": ["insight about what worked", "insight about what to avoid"]
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Winner selected", data);
  return { success: true, data, logs };
}
