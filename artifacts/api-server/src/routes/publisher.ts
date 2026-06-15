import { Router } from "express";
import { db } from "@workspace/db";
import {
  socialAccountsTable, scheduledPostsTable, performanceAnalyticsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { groqClient } from "@workspace/integrations-openai-ai-server";

const router = Router();

const PLATFORMS = ["youtube", "tiktok", "instagram", "twitter", "snapchat"];

router.get("/accounts", async (_req, res) => {
  const accounts = await db.select().from(socialAccountsTable).orderBy(desc(socialAccountsTable.createdAt));
  res.json(accounts);
});

router.post("/accounts", async (req, res) => {
  const { platform, accountName, niche, followersCount, avgViews } = req.body as {
    platform: string; accountName: string; niche?: string; followersCount?: string; avgViews?: string;
  };
  if (!platform || !accountName) { res.status(400).json({ error: "platform and accountName required" }); return; }

  const [account] = await db.insert(socialAccountsTable).values({
    platform, accountName, niche, followersCount: followersCount ?? "0", avgViews: avgViews ?? "0",
    isConnected: true,
  }).returning();
  res.json(account);
});

router.delete("/accounts/:id", async (req, res) => {
  await db.delete(socialAccountsTable).where(eq(socialAccountsTable.id, Number(req.params.id)));
  res.json({ success: true });
});

router.get("/scheduled", async (_req, res) => {
  const posts = await db.select().from(scheduledPostsTable).orderBy(desc(scheduledPostsTable.scheduledAt)).limit(50);
  res.json(posts);
});

router.post("/schedule", async (req, res) => {
  const { projectId, platform, scheduledAt, title, description, hashtags, thumbnailUrl, videoUrl } = req.body as {
    projectId?: number; platform: string; scheduledAt: string;
    title?: string; description?: string; hashtags?: string[];
    thumbnailUrl?: string; videoUrl?: string;
  };

  if (!platform || !scheduledAt) { res.status(400).json({ error: "platform and scheduledAt required" }); return; }

  const [post] = await db.insert(scheduledPostsTable).values({
    projectId, platform,
    scheduledAt: new Date(scheduledAt),
    title, description,
    hashtags: hashtags ?? [],
    thumbnailUrl, videoUrl,
    status: "scheduled",
  }).returning();

  res.json(post);
});

router.post("/generate-metadata", async (req, res) => {
  const { topic, platform, niche, style = "viral" } = req.body as {
    topic: string; platform?: string; niche?: string; style?: string;
  };
  if (!topic) { res.status(400).json({ error: "topic required" }); return; }

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content: `You are a viral content metadata expert. You write titles, descriptions, and hashtags that maximize reach on ${platform ?? "social media"}.`,
      },
      {
        role: "user",
        content: `Generate viral-optimized metadata for:
Topic: "${topic}"
Platform: ${platform ?? "tiktok"}
Niche: ${niche ?? "general"}
Style: ${style}

Return ONLY valid JSON:
{
  "title": "compelling title under 60 chars",
  "description": "hook-driven description (150-200 chars)",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7"],
  "altTitles": ["alt title 1", "alt title 2", "alt title 3"],
  "cta": "call to action text",
  "bestUploadTime": "HH:MM platform-specific optimal time",
  "thumbnailConcept": "visual description for thumbnail"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  res.json(data);
});

router.post("/simulate-post/:id", async (req, res) => {
  const post = await db.select().from(scheduledPostsTable)
    .where(eq(scheduledPostsTable.id, Number(req.params.id))).limit(1);
  if (!post.length) { res.status(404).json({ error: "Post not found" }); return; }

  await db.update(scheduledPostsTable)
    .set({ status: "posted", postedAt: new Date(), platformPostId: `sim_${Date.now()}` })
    .where(eq(scheduledPostsTable.id, Number(req.params.id)));

  const views = Math.floor(Math.random() * 50000) + 1000;
  const [analytics] = await db.insert(performanceAnalyticsTable).values({
    projectId: post[0].projectId,
    scheduledPostId: post[0].id,
    platform: post[0].platform,
    views,
    likes: Math.floor(views * (0.05 + Math.random() * 0.15)),
    comments: Math.floor(views * 0.02),
    shares: Math.floor(views * 0.03),
    saves: Math.floor(views * 0.04),
    watchTimeSeconds: Math.floor(views * 28),
    avgWatchPct: 40 + Math.floor(Math.random() * 40),
    completionRate: 0.3 + Math.random() * 0.5,
    replayRate: 0.05 + Math.random() * 0.2,
    swipeAwayRate: 0.2 + Math.random() * 0.3,
    engagementRate: 0.05 + Math.random() * 0.15,
    retentionCurve: Array.from({ length: 10 }, (_, i) => 100 - i * (7 + Math.random() * 5)),
  }).returning();

  res.json({ post: post[0], analytics });
});

router.get("/analytics/:projectId", async (req, res) => {
  const rows = await db.select().from(performanceAnalyticsTable)
    .where(eq(performanceAnalyticsTable.projectId, Number(req.params.projectId)))
    .orderBy(desc(performanceAnalyticsTable.collectedAt)).limit(20);
  res.json(rows);
});

router.get("/analytics", async (_req, res) => {
  const rows = await db.select().from(performanceAnalyticsTable)
    .orderBy(desc(performanceAnalyticsTable.collectedAt)).limit(100);
  res.json(rows);
});

router.post("/ingest-analytics", async (req, res) => {
  const { scheduledPostId, projectId, platform, metrics } = req.body as {
    scheduledPostId?: number; projectId?: number; platform: string;
    metrics: Record<string, number>;
  };
  if (!platform) { res.status(400).json({ error: "platform required" }); return; }

  const [row] = await db.insert(performanceAnalyticsTable).values({
    scheduledPostId, projectId, platform,
    views: metrics.views ?? 0,
    likes: metrics.likes ?? 0,
    comments: metrics.comments ?? 0,
    shares: metrics.shares ?? 0,
    saves: metrics.saves ?? 0,
    watchTimeSeconds: metrics.watchTimeSeconds ?? 0,
    avgWatchPct: metrics.avgWatchPct ?? 0,
    completionRate: metrics.completionRate ?? 0,
    replayRate: metrics.replayRate ?? 0,
    swipeAwayRate: metrics.swipeAwayRate ?? 0,
    engagementRate: metrics.engagementRate ?? 0,
  }).returning();
  res.json(row);
});

router.get("/repost-candidates", async (_req, res) => {
  const analytics = await db.select().from(performanceAnalyticsTable)
    .orderBy(desc(performanceAnalyticsTable.views)).limit(20);

  const candidates = analytics
    .filter((a) => (a.avgWatchPct ?? 0) > 50 || (a.views ?? 0) > 10000)
    .map((a) => ({
      id: a.id,
      scheduledPostId: a.scheduledPostId,
      projectId: a.projectId,
      platform: a.platform,
      views: a.views,
      avgWatchPct: a.avgWatchPct,
      engagementRate: a.engagementRate,
      repostSuggestion: (a.avgWatchPct ?? 0) > 70
        ? "Change hook, repost same video"
        : "Adjust pacing, test new caption style",
    }));

  res.json(candidates);
});

export default router;
