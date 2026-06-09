/**
 * VIRALOS Groq Review Agent
 * Reviews video rendering metadata and returns issues + fixes.
 * If issues exist, the frontend retries with adjusted parameters.
 * Loop continues until Groq finds no issues (or max 3 attempts).
 */

import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

export interface RenderMetadata {
  clipsRequested: number;
  clipsLoaded: number;
  clipDurations: number[];
  totalDuration: number;
  fps: number;
  style: string;
  captionPhrases: number;
  attempt?: number;
  previousIssues?: string[];
}

export interface ReviewResult {
  approved: boolean;
  issues: string[];
  fixes: {
    adjustClipCount?: number;
    adjustMaxClipSec?: number;
    adjustFps?: number;
    refetchClips?: boolean;
    refetchQuery?: string;
    captionFix?: string;
    notes?: string;
  };
  score: number;
  summary: string;
}

router.post("/review", async (req, res) => {
  const meta: RenderMetadata = req.body;

  if (!meta) {
    res.status(400).json({ error: "metadata required" });
    return;
  }

  const attempt = meta.attempt ?? 1;
  const avgClipDur = meta.clipDurations.length
    ? meta.clipDurations.reduce((a, b) => a + b, 0) / meta.clipDurations.length
    : 0;

  const uniqueClips = meta.clipsLoaded;
  const totalCoverage = meta.totalDuration;

  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are VIRALOS Groq Review Agent — a strict video quality inspector for viral short-form content.
You review rendering metadata and identify REAL technical problems that will make the video look bad or lag.

Your job: find actual issues, not hypothetical ones. If everything is fine, say so and approve.

Scoring criteria:
- Clips: ≥4 unique clips loaded = good. 2-3 = acceptable. 1 = BAD (video will look repetitive).
- Coverage: total clip duration should be ≥ 30s for a 45s video. Less = clips will loop awkwardly.
- Avg clip duration: 4-8s per clip is ideal for viral pacing. >10s = boring. <2s = too choppy.
- FPS: 24 is ideal for canvas. 30 is ok. <20 = laggy.
- Captions: ≥8 caption phrases for a 45s video is good. Less = gaps in captions.

Be STRICT on the "only 1 clip" problem — this is the worst issue. Always flag it.`,
        },
        {
          role: "user",
          content: `Review this video render:

Attempt: #${attempt}
Clips requested: ${meta.clipsRequested}
Clips actually loaded: ${meta.clipsLoaded}
Clip durations: [${meta.clipDurations.map(d => d.toFixed(1)).join(", ")}]s
Average clip duration: ${avgClipDur.toFixed(1)}s
Total clip coverage: ${totalCoverage.toFixed(1)}s
Video FPS: ${meta.fps}
Video style: ${meta.style}
Caption phrases: ${meta.captionPhrases}
${meta.previousIssues?.length ? `\nPrevious attempt issues: ${meta.previousIssues.join("; ")}` : ""}

Analyze each criterion. List ONLY real problems. If clips loaded ≥ 4 AND coverage ≥ 30s AND fps ≥ 20 AND captions ≥ 8, approve it.

Return JSON:
{
  "approved": false,
  "issues": ["specific issue 1", "specific issue 2"],
  "fixes": {
    "adjustClipCount": 8,
    "adjustMaxClipSec": 7,
    "adjustFps": 24,
    "refetchClips": true,
    "refetchQuery": "more specific search term if clips failed",
    "captionFix": "instruction if captions are the problem",
    "notes": "one line summary of what to fix"
  },
  "score": 45,
  "summary": "1 clip loaded out of 12 requested — video will loop the same footage the entire duration. Refetch clips with fallback queries."
}`,
        },
      ],
    });

    const result = JSON.parse(response.choices[0]?.message?.content ?? "{}") as ReviewResult;

    // Hard override: if only 1 clip loaded, always reject
    if (meta.clipsLoaded <= 1 && !result.issues.some(i => i.toLowerCase().includes("clip"))) {
      result.approved = false;
      result.issues.unshift(`Only ${meta.clipsLoaded} clip(s) loaded — video will repeat the same footage`);
      result.fixes.refetchClips = true;
      result.score = Math.min(result.score, 30);
    }

    // Hard override: if 0 clips loaded, always reject
    if (meta.clipsLoaded === 0) {
      result.approved = false;
      result.issues.unshift("No B-roll clips loaded — video will have no footage");
      result.fixes.refetchClips = true;
      result.fixes.refetchQuery = meta.style === "dark_motivation"
        ? "dark motivation fitness cinematic"
        : meta.style === "luxury_cinematic"
        ? "luxury lifestyle aerial city"
        : meta.style === "anime_edit"
        ? "neon city night vertical"
        : "documentary street authentic";
      result.score = 0;
    }

    // Approve if score >= 65 (regardless of model output)
    if (result.score >= 65) result.approved = true;

    res.json({ success: true, attempt, result });
  } catch (err) {
    console.error("[VIRALOS] Groq review error:", err);
    // On error, approve so we don't block the user
    res.json({
      success: false,
      attempt,
      result: {
        approved: true,
        issues: [],
        fixes: {},
        score: 70,
        summary: "Review agent unavailable — proceeding with current render",
      },
    });
  }
});

export default router;
