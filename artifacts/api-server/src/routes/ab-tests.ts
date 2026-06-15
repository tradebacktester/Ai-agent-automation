import { Router } from "express";
import { db } from "@workspace/db";
import { abTestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { runABTestAnalyzer } from "../agents/self-optimizer-agent.js";
import { runHookAgent } from "../agents/hook-agent.js";
import { runCaptionAgent } from "../agents/caption-agent.js";
import { groqClient } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.get("/", async (_req, res) => {
  const tests = await db.select().from(abTestsTable).orderBy(desc(abTestsTable.createdAt)).limit(30);
  res.json(tests);
});

router.get("/:id", async (req, res) => {
  const [test] = await db.select().from(abTestsTable).where(eq(abTestsTable.id, Number(req.params.id))).limit(1);
  if (!test) { res.status(404).json({ error: "Test not found" }); return; }
  res.json(test);
});

router.post("/generate", async (req, res) => {
  const { testType, prompt, platform, niche, projectId } = req.body as {
    testType: "hook" | "caption" | "thumbnail" | "cta" | "upload_time";
    prompt?: string; platform?: string; niche?: string; projectId?: number;
  };
  if (!testType) { res.status(400).json({ error: "testType required" }); return; }

  let variants: Array<{ id: string; label: string; content: string; impressions: number; views: number; retention: number; engagement: number; score: number }> = [];
  let name = "";

  if (testType === "hook" && prompt) {
    const hookResult = await runHookAgent(prompt, platform, niche);
    variants = (hookResult.data?.hooks ?? []).slice(0, 4).map((h, i) => ({
      id: `variant_${i}`,
      label: `Hook ${String.fromCharCode(65 + i)}: ${h.style}`,
      content: h.hook,
      impressions: 0, views: 0,
      retention: h.predicted_retention * 10,
      engagement: 0, score: h.predicted_retention,
    }));
    name = `Hook A/B Test — ${prompt.slice(0, 40)}`;
  } else if (testType === "caption" && prompt) {
    const captionResult = await runCaptionAgent(prompt);
    variants = (captionResult.data?.captionSets ?? []).slice(0, 4).map((cs, i) => ({
      id: `variant_${i}`,
      label: `${cs.style} Style`,
      content: cs.styleDescription,
      impressions: 0, views: 0, retention: 0, engagement: 0,
      score: i === 0 ? 8 : i === 1 ? 7.5 : 6.5,
    }));
    name = `Caption Style Test`;
  } else {
    const response = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1500,
      messages: [
        { role: "system", content: "Generate A/B test variants for viral content optimization." },
        {
          role: "user",
          content: `Create 4 variants for a ${testType} A/B test${prompt ? ` for: "${prompt}"` : ""}.
Platform: ${platform ?? "tiktok"}

Return ONLY valid JSON:
{
  "name": "test name",
  "variants": [
    {"id": "variant_0", "label": "Variant A", "content": "content description", "impressions": 0, "views": 0, "retention": 0, "engagement": 0, "score": 0}
  ]
}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    variants = parsed.variants ?? [];
    name = parsed.name ?? `${testType} A/B Test`;
  }

  const [test] = await db.insert(abTestsTable).values({
    projectId, name,
    testType, platform,
    variants,
    status: "running",
    totalImpressions: 0,
    autoApply: true,
    insights: [],
  }).returning();

  res.json(test);
});

router.post("/:id/simulate", async (req, res) => {
  const [test] = await db.select().from(abTestsTable).where(eq(abTestsTable.id, Number(req.params.id))).limit(1);
  if (!test) { res.status(404).json({ error: "Not found" }); return; }

  const updatedVariants = (test.variants ?? []).map((v) => ({
    ...v,
    impressions: Math.floor(1000 + Math.random() * 9000),
    views: Math.floor(500 + Math.random() * 4500),
    retention: 40 + Math.random() * 50,
    engagement: 3 + Math.random() * 12,
    score: 5 + Math.random() * 5,
  }));

  const totalImpressions = updatedVariants.reduce((s, v) => s + v.impressions, 0);
  const analysisResult = await runABTestAnalyzer(
    updatedVariants.map((v) => ({
      id: v.id,
      label: v.label,
      content: v.content,
      metrics: { retention: v.retention, engagement: v.engagement, views: v.views, score: v.score },
    }))
  );

  const winner = analysisResult.data;
  const [updated] = await db.update(abTestsTable)
    .set({
      variants: updatedVariants,
      totalImpressions,
      winnerId: winner?.winnerId,
      winnerReason: winner?.winnerReason,
      confidenceLevel: winner?.confidence ?? 0,
      status: "completed",
      completedAt: new Date(),
      insights: winner?.insights ?? [],
    })
    .where(eq(abTestsTable.id, Number(req.params.id)))
    .returning();

  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await db.delete(abTestsTable).where(eq(abTestsTable.id, Number(req.params.id)));
  res.json({ success: true });
});

export default router;
