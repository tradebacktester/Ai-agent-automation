/**
 * VIRALOS Self-Learning API
 * Records real-world video performance and reinforces agent memories
 * so every future generation benefits from past results.
 */

import { Router } from "express";
import { reinforceMemory, storeMemory, recallMemories } from "../agents/memory.js";

const router = Router();

// POST /api/learning/performance
// Called after a video gets real engagement data
router.post("/performance", async (req, res) => {
  const {
    hook,
    hookStyle,
    platform,
    niche,
    videoStyle,
    viralPotential,
    // real-world metrics
    views,
    watchTimePercent,   // 0-100 — avg % of video watched
    completionRate,     // 0-100
    shares,
    saves,
    comments,
    likes,
  } = req.body as {
    hook?: string;
    hookStyle?: string;
    platform?: string;
    niche?: string;
    videoStyle?: string;
    viralPotential?: number;
    views?: number;
    watchTimePercent?: number;
    completionRate?: number;
    shares?: number;
    saves?: number;
    comments?: number;
    likes?: number;
  };

  if (!hook) {
    res.status(400).json({ error: "hook required" });
    return;
  }

  // Compute a performance score (0-10) from engagement signals
  const v = views ?? 0;
  const wt = watchTimePercent ?? 0;
  const cr = completionRate ?? 0;
  const sh = shares ?? 0;
  const sv = saves ?? 0;

  // Weighted engagement formula
  const engagementScore = Math.min(10, (
    (wt / 100) * 3.5 +          // watch time weighted highest
    (cr / 100) * 2.5 +           // completion rate
    (sh > 0 ? Math.min(sh / 100, 1) * 2 : 0) +  // shares
    (sv > 0 ? Math.min(sv / 50, 1) * 1.5 : 0) + // saves
    (v > 1000 ? 0.5 : 0)         // reached meaningful view count
  ));

  const memoryContent = `Hook: "${hook.slice(0, 80)}" | Style:${hookStyle ?? "unknown"} | Watch:${wt}% | Completion:${cr}% | Shares:${sh} | Score:${engagementScore.toFixed(1)}`;

  // Reinforce multiple agent memories in parallel
  const reinforcements: Promise<void>[] = [];

  // Reinforce hook agent with real-world data
  reinforcements.push(
    storeMemory(
      "hook_agent",
      `perf_hook_${Date.now()}`,
      memoryContent,
      engagementScore,
      { hookStyle, platform, niche, views: v, watchTimePercent: wt }
    )
  );

  // Reinforce script agent
  reinforcements.push(
    storeMemory(
      "script_agent",
      `perf_script_${Date.now()}`,
      `Hook "${hook.slice(0, 60)}" got ${wt}% watch time on ${platform ?? "unknown"} | Completion: ${cr}%`,
      engagementScore,
      { hookStyle, platform, niche, videoStyle }
    )
  );

  // Reinforce research agent with what worked for this niche
  if (niche) {
    reinforcements.push(
      storeMemory(
        "research_agent",
        `perf_niche_${Date.now()}`,
        `${niche} niche: hook style "${hookStyle}" got ${wt}% watch time, ${sh} shares, ${cr}% completion`,
        engagementScore,
        { niche, platform, videoStyle, hookStyle }
      )
    );
  }

  // Reinforce trend intelligence with what angles are working
  reinforcements.push(
    storeMemory(
      "trend_intelligence",
      `perf_trend_${Date.now()}`,
      `Platform ${platform ?? "unknown"} — ${hookStyle ?? "hook"} approach got ${wt}% watch time | Views: ${v} | Shares: ${sh}`,
      engagementScore,
      { platform, hookStyle, videoStyle }
    )
  );

  // If this was a high-performer, reinforce judge agent's standards
  if (engagementScore >= 7) {
    reinforcements.push(
      storeMemory(
        "judge_agent",
        `perf_approved_${Date.now()}`,
        `HIGH PERFORMER: "${hook.slice(0, 60)}" — ${hookStyle} hook got ${wt}% watch time. This is the quality standard.`,
        engagementScore,
        { platform, hookStyle }
      )
    );
    reinforcements.push(
      storeMemory(
        "optimization_agent",
        `perf_winner_${Date.now()}`,
        `Winning pattern: ${hookStyle} hook + ${videoStyle ?? "any"} style on ${platform ?? "any"} → ${wt}% watch time`,
        engagementScore,
        { platform, hookStyle, videoStyle }
      )
    );
  }

  await Promise.allSettled(reinforcements);

  res.json({
    success: true,
    engagementScore: parseFloat(engagementScore.toFixed(2)),
    agentsReinforced: ["hook_agent", "script_agent", "research_agent", "trend_intelligence",
      ...(engagementScore >= 7 ? ["judge_agent", "optimization_agent"] : [])],
    message: engagementScore >= 7
      ? "High-performer stored — future generations will use this pattern more"
      : engagementScore >= 4
      ? "Moderate result stored — agents updated"
      : "Below-average result stored — agents will deprioritize this pattern",
  });
});

// GET /api/learning/insights — what the system has learned
router.get("/insights", async (_req, res) => {
  const [hookMems, scriptMems, trendMems, judgeMems, researchMems] = await Promise.all([
    recallMemories("hook_agent", 5),
    recallMemories("script_agent", 5),
    recallMemories("trend_intelligence", 5),
    recallMemories("judge_agent", 3),
    recallMemories("research_agent", 5),
  ]);

  const topHooks = hookMems.filter((m) => (m.score ?? 0) >= 7).map((m) => ({
    content: m.content,
    score: m.score,
    metadata: m.metadata,
  }));

  const topPatterns = trendMems.filter((m) => (m.score ?? 0) >= 7).map((m) => ({
    content: m.content,
    score: m.score,
  }));

  res.json({
    success: true,
    totalMemories: hookMems.length + scriptMems.length + trendMems.length + judgeMems.length + researchMems.length,
    topPerformingHooks: topHooks,
    topTrendPatterns: topPatterns,
    agentMemoryCounts: {
      hook_agent: hookMems.length,
      script_agent: scriptMems.length,
      trend_intelligence: trendMems.length,
      judge_agent: judgeMems.length,
      research_agent: researchMems.length,
    },
    systemStatus: "self-learning active",
  });
});

export default router;
