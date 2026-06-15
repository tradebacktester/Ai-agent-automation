import { Router } from "express";
import { db, trendsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { ListTrendsQueryParams } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.get("/", async (req, res) => {
  const params = ListTrendsQueryParams.safeParse(req.query);
  let rows = await db.select().from(trendsTable).orderBy(desc(trendsTable.score));

  if (params.success) {
    if (params.data.platform) {
      rows = rows.filter((r) => r.platform === params.data.platform);
    }
    if (params.data.category) {
      rows = rows.filter((r) => r.category === params.data.category);
    }
  }

  res.json(rows);
});

router.post("/refresh", async (req, res) => {
  const { platforms } = req.body as { platforms?: string[] };
  const targetPlatforms = platforms ?? ["youtube_shorts", "tiktok", "reels", "x_clips"];

  try {
    const aiRes = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a viral trend intelligence system. You track what topics, formats, and content styles are exploding right now on short-form video platforms. Be specific, current, and data-driven. Generate realistic trending topics that reflect current cultural moments, viral patterns, and audience psychology.`,
        },
        {
          role: "user",
          content: `Generate 20 trending topics for short-form video content right now in ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.

Platforms: ${targetPlatforms.join(", ")}
Categories: motivation, finance, fitness, business, lifestyle, education, entertainment, sports, tech, psychology

For each trend, assign:
- A realistic viral score (50-99) based on momentum
- Momentum: "rising" (new trend), "peaking" (at maximum), or "falling" (losing steam)
- The best platform for this trend
- An appropriate emoji

Return JSON:
{
  "trends": [
    {
      "topic": "specific trend topic or format",
      "score": 94,
      "momentum": "rising",
      "platform": "tiktok",
      "category": "motivation",
      "emoji": "🔥",
      "description": "why this is trending right now"
    }
  ]
}`,
        },
      ],
    });

    const raw = JSON.parse(aiRes.choices[0]?.message?.content ?? "{}");
    const freshTrends: Array<{
      topic: string; score: number; momentum: string;
      platform: string; category: string; emoji: string; description: string;
    }> = raw.trends ?? [];

    if (freshTrends.length === 0) {
      res.status(500).json({ error: "AI returned no trends" });
      return;
    }

    // Clear old trends and insert fresh ones
    await db.delete(trendsTable);

    const inserted = [];
    for (const t of freshTrends) {
      const [row] = await db.insert(trendsTable).values({
        topic: t.topic,
        score: Math.max(1, Math.min(100, Math.round(t.score))),
        momentum: t.momentum ?? "rising",
        platform: targetPlatforms.includes(t.platform) ? t.platform : "tiktok",
        category: t.category ?? "general",
        emoji: t.emoji ?? "🔥",
        description: t.description ?? "",
      }).returning();
      inserted.push(row);
    }

    res.json({ success: true, count: inserted.length, trends: inserted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

export default router;
