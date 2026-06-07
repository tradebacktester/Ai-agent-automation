import { Router } from "express";
import { db, scriptsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GenerateScriptBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const PLATFORM_SYSTEM: Record<string, string> = {
  youtube_shorts: "YouTube Shorts (9:16, 30–60s). High-energy hook, punchy pacing, strong CTA. Algorithm rewards watch-time completion and comments in first 10 minutes.",
  reels: "Instagram Reels (9:16, 15–60s). Visually aesthetic, emotional arc, highly shareable. Rewards saves and shares. Caption should add context.",
};

const EMOTION_CURVES: Record<string, string[]> = {
  motivational: ["intrigue", "tension", "struggle", "breakthrough", "triumph"],
  educational: ["curiosity", "confusion", "revelation", "clarity", "inspiration"],
  dramatic: ["shock", "disbelief", "tension", "climax", "resolution"],
};

router.post("/generate", async (req, res) => {
  const parsed = GenerateScriptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { projectId, prompt, platform, style } = parsed.data;
  const platformStyle = PLATFORM_SYSTEM[platform] ?? PLATFORM_SYSTEM["youtube_shorts"];
  const emotionCurve = EMOTION_CURVES[style ?? "motivational"] ?? EMOTION_CURVES["motivational"];

  let hook = `What if ${prompt} could change everything you thought you knew?`;
  let script = `[HOOK] ${hook}\n\n[BODY] Here's what the top 1% understand about ${prompt} that most people miss...\n\n[CTA] Follow for more.`;
  let cta = "Follow for more. Drop a comment if this hit different.";

  // Use GPT-4o for real AI script generation
  try {
    const aiRes = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an elite viral content scriptwriter. You write scripts for ${platformStyle}.

Your scripts follow the VIRAL formula:
- Hook (0–2s): Pattern-interrupt opening that creates immediate curiosity
- Problem (2–8s): Agitate the pain point the viewer resonates with
- Insight (8–30s): Counter-intuitive truth, dense with value
- Proof (30–45s): Evidence, example, or relatable story
- CTA (final 3s): Simple, emotion-matched call to action

Writing rules:
- Short, punchy sentences (under 12 words)
- No filler words
- Every sentence earns its place
- First word should be provocative

Respond in JSON: { "hook": "...", "script": "...", "cta": "..." }`,
        },
        {
          role: "user",
          content: `Write a viral ${platform === "reels" ? "Instagram Reels" : "YouTube Shorts"} script for this concept:\n\n"${prompt}"\n\nMake it 45–55 seconds when read aloud. Write for the platform style: ${platformStyle}`,
        },
      ],
    });

    const raw = aiRes.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    if (parsed.hook) hook = parsed.hook;
    if (parsed.script) script = parsed.script;
    if (parsed.cta) cta = parsed.cta;
  } catch {
    // fallback to template above
  }

  const scenes = [
    { index: 0, description: `Opening shot — powerful visual of ${prompt}`, emotion: emotionCurve[0], duration: 3 },
    { index: 1, description: "B-roll: relatable struggle or problem", emotion: emotionCurve[1], duration: 5 },
    { index: 2, description: "Text overlay with key insight", emotion: emotionCurve[2], duration: 5 },
    { index: 3, description: "Transformation / proof visual", emotion: emotionCurve[3], duration: 6 },
    { index: 4, description: "CTA screen with follow prompt", emotion: emotionCurve[4], duration: 3 },
  ];

  const [existing] = await db.select().from(scriptsTable).where(eq(scriptsTable.projectId, projectId));

  let row;
  if (existing) {
    [row] = await db.update(scriptsTable)
      .set({ hook, script, emotionCurve, cta, platformStyle, scenes })
      .where(eq(scriptsTable.projectId, projectId))
      .returning();
  } else {
    [row] = await db.insert(scriptsTable)
      .values({ projectId, hook, script, emotionCurve, cta, platformStyle, scenes })
      .returning();
  }

  await db.update(projectsTable)
    .set({ status: "voicing", progress: 20 })
    .where(eq(projectsTable.id, projectId));

  res.json(row);
});

// Standalone AI script generation (no project ID required)
router.post("/generate-ai", async (req, res) => {
  const { prompt, platform } = req.body as { prompt: string; platform?: string };
  if (!prompt) { res.status(400).json({ error: "prompt required" }); return; }

  const platformStyle = PLATFORM_SYSTEM[platform ?? "youtube_shorts"] ?? PLATFORM_SYSTEM["youtube_shorts"];
  const platformLabel = platform === "reels" ? "Instagram Reels" : "YouTube Shorts";

  try {
    const aiRes = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an elite viral short-form content scriptwriter. You specialize in ${platformLabel}.

You understand viral psychology: curiosity gaps, emotional resonance, pattern interrupts, and dopamine engineering.

Your scripts are structured: Hook → Problem → Insight → Proof → CTA.

Rules:
- Hook MUST create a curiosity gap in ≤12 words
- Body: dense value, no filler, every sentence earns its place
- Sentences: short and punchy (≤15 words each)  
- Natural spoken language — not written
- 50–60 seconds when spoken at normal pace (~130 wpm = ~110–130 words)

Respond in JSON with this exact format:
{
  "hook": "Opening line that grabs attention immediately",
  "script": "Full body script (without the hook, without CTA)",
  "cta": "The closing call to action",
  "viralPotential": 85,
  "emotionalTrigger": "curiosity|fear|inspiration|anger|awe",
  "targetEmotion": "description of the core emotion this evokes",
  "estimatedWordCount": 120,
  "hookStyle": "curiosity_gap|controversial|personal_story|bold_claim|data_point"
}`,
        },
        {
          role: "user",
          content: `Write a viral ${platformLabel} script for this concept:\n\n"${prompt}"\n\nPlatform context: ${platformStyle}`,
        },
      ],
    });

    const raw = aiRes.choices[0]?.message?.content ?? "";
    const result = JSON.parse(raw);
    res.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

router.get("/:projectId", async (req, res) => {
  const projectId = Number(req.params.projectId);
  const [row] = await db.select().from(scriptsTable).where(eq(scriptsTable.projectId, projectId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
