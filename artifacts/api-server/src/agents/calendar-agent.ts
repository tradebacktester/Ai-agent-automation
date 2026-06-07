import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { contentCalendarTable, contentSeriesTable } from "@workspace/db";
import { storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export interface CalendarDay {
  date: string;
  platform: string;
  contentType: string;
  pillar: string;
  theme: string;
  hookIdea: string;
  emotionalAngle: string;
  optimalUploadTime: string;
  predictedViralScore: number;
  aiRationale: string;
  seriesEpisode?: { seriesName: string; episode: number };
}

export interface ContentCalendarResult {
  niche: string;
  strategy: string;
  contentPillars: Array<{ name: string; percentage: number; description: string }>;
  weeklyPlan: CalendarDay[];
  postingFrequency: string;
  peakHours: Record<string, string>;
  trendWindows: string[];
  projectedGrowth: string;
}

export async function runCalendarAgent(
  niche: string,
  platforms: string[],
  daysAhead = 30,
  goal = "grow virally"
): Promise<AgentResult<ContentCalendarResult>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "CalendarAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Building AI content calendar", { niche, platforms, daysAhead });

  const today = new Date();
  const dateRange = Array.from({ length: Math.min(daysAhead, 14) }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: `You are the VIRALOS Content Calendar Agent — you build autonomous content strategies that dominate niches.

You understand:
- Platform algorithm timing (when to post for maximum reach)
- Seasonal trend windows
- Content pillar theory
- Binge-trigger sequencing
- Niche domination strategy

You think 30 days ahead and plan with scientific precision.`,
      },
      {
        role: "user",
        content: `Build a complete AI content calendar for:

Niche: ${niche}
Platforms: ${platforms.join(", ")}
Goal: ${goal}
Dates: ${dateRange[0]} to ${dateRange[dateRange.length - 1]} (${dateRange.length} days)

Create a posting plan that:
1. Maximizes reach through algorithm-timed uploads
2. Balances content pillars (educational, emotional, entertainment, trending, proof)
3. Creates binge patterns with serialized content
4. Exploits trend windows
5. Builds toward niche dominance

Return ONLY valid JSON:
{
  "niche": "${niche}",
  "strategy": "overall strategy description",
  "contentPillars": [
    {"name": "pillar name", "percentage": 30, "description": "what this pillar does"}
  ],
  "weeklyPlan": [
    {
      "date": "YYYY-MM-DD",
      "platform": "tiktok|youtube_shorts|reels|twitter",
      "contentType": "hook_test|trend_surf|series_episode|educational|viral_attempt|emotional",
      "pillar": "pillar name",
      "theme": "specific theme",
      "hookIdea": "actual hook text (max 12 words)",
      "emotionalAngle": "specific emotion to trigger",
      "optimalUploadTime": "HH:MM",
      "predictedViralScore": 75,
      "aiRationale": "why this will perform"
    }
  ],
  "postingFrequency": "X posts per day",
  "peakHours": {"tiktok": "7pm-9pm", "youtube_shorts": "12pm-2pm"},
  "trendWindows": ["window 1", "window 2"],
  "projectedGrowth": "X-Y followers in 30 days at this cadence"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}") as ContentCalendarResult;
  log("Calendar generated", { days: data.weeklyPlan?.length, pillars: data.contentPillars?.length });

  for (const day of (data.weeklyPlan ?? []).slice(0, 30)) {
    try {
      await db.insert(contentCalendarTable).values({
        date: day.date,
        platform: day.platform,
        contentType: day.contentType,
        pillar: day.pillar,
        theme: day.theme,
        hookIdea: day.hookIdea,
        emotionalAngle: day.emotionalAngle,
        optimalUploadTime: day.optimalUploadTime,
        predictedViralScore: day.predictedViralScore ?? 0,
        aiRationale: day.aiRationale,
        isGenerated: true,
        isPosted: false,
      });
    } catch {}
  }

  await storeMemory("calendar_agent", `plan_${niche}_${Date.now()}`, data.strategy, 7, { niche, platforms, daysAhead });

  return { success: true, data, logs };
}

export async function runSeriesAgent(
  niche: string,
  platform: string,
  targetEpisodes = 10
): Promise<AgentResult<{
  seriesName: string;
  concept: string;
  emotionalArc: string;
  visualIdentity: Record<string, string>;
  episodes: Array<{ number: number; title: string; hook: string; emotionalBeat: string; cliffhanger: string }>;
  bingeStrategy: string;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "SeriesAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Designing serialized content series", { niche, platform, targetEpisodes });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 3000,
    messages: [
      {
        role: "system",
        content: `You are the VIRALOS Series Architect — you design short-form content series engineered for binge-watching.

You understand:
- Cliffhanger psychology
- Episodic emotional arcs
- Visual identity systems for recognition
- Dopamine sequencing across episodes
- Algorithmic boost from series completion signals`,
      },
      {
        role: "user",
        content: `Design a ${targetEpisodes}-episode short-form series for:

Niche: ${niche}
Platform: ${platform}

The series should:
- Have a compelling overarching narrative or journey
- Build tension across episodes with cliffhangers
- Create a distinctive visual identity viewers recognize instantly
- Maximize replay and binge watching
- Each episode should end making viewers NEED to see the next one

Return ONLY valid JSON:
{
  "seriesName": "series name",
  "concept": "core concept in 2 sentences",
  "emotionalArc": "rising_tension|cyclical|progressive_revelation|character_journey",
  "visualIdentity": {
    "colorPalette": "primary colors description",
    "fontStyle": "typography feel",
    "cameraStyle": "handheld|cinematic|POV|static",
    "editingRhythm": "fast-cut|slow-burn|mixed"
  },
  "episodes": [
    {
      "number": 1,
      "title": "episode title",
      "hook": "opening hook text (max 12 words)",
      "emotionalBeat": "primary emotion this episode triggers",
      "cliffhanger": "how this episode ends to pull viewers to next"
    }
  ],
  "bingeStrategy": "psychological explanation of why viewers won't be able to stop"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Series designed", { name: data.seriesName, episodes: data.episodes?.length });

  try {
    await db.insert(contentSeriesTable).values({
      name: data.seriesName,
      niche,
      platform,
      emotionalArc: data.emotionalArc,
      visualIdentity: data.visualIdentity,
      recurringThemes: [],
      targetEpisodes,
      episodesCreated: 0,
      isActive: true,
      description: data.concept,
    });
  } catch {}

  return { success: true, data, logs };
}
