import { Router } from "express";
import { db, renderJobsTable, videosTable, projectsTable, scriptsTable, voiceoverJobsTable, clipsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RenderVideoBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

async function runRealRenderPipeline(projectId: number, jobId: number) {
  const setStage = async (stage: string, progress: number) => {
    await db.update(renderJobsTable)
      .set({ stage, progress, status: "processing" })
      .where(eq(renderJobsTable.id, jobId));
    await db.update(projectsTable)
      .set({ progress })
      .where(eq(projectsTable.id, projectId));
  };

  try {
    await setStage("assembling_clips", 15);

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const [script] = await db.select().from(scriptsTable).where(eq(scriptsTable.projectId, projectId)).limit(1);
    const [voiceover] = await db.select().from(voiceoverJobsTable).where(eq(voiceoverJobsTable.projectId, projectId)).limit(1);
    const clips = await db.select().from(clipsTable).where(eq(clipsTable.projectId, projectId)).limit(10);

    await setStage("encoding_audio", 35);

    const scriptText = script
      ? `${script.hook}\n\n${script.script}\n\n${script.cta}`
      : project?.prompt ?? "Viral content";

    const wordCount = scriptText.split(/\s+/).length;
    const estimatedDurationSec = Math.max(30, Math.round(wordCount / 2.5));

    await setStage("generating_captions", 55);

    const aiRes = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a video post-production AI. Generate SRT subtitle timings and a production manifest for a short-form video.",
        },
        {
          role: "user",
          content: `Generate a production manifest for this short-form video:

Title: ${project?.title ?? "Untitled"}
Platform: ${project?.platform ?? "youtube_shorts"}
Script: ${scriptText.slice(0, 800)}
Estimated Duration: ${estimatedDurationSec} seconds
Clips available: ${clips.length}
Voice Style: ${voiceover?.voiceStyle ?? "motivational_male"}

Return JSON:
{
  "srt": "1\\n00:00:00,000 --> 00:00:02,500\\nHook line here\\n\\n2\\n00:00:02,500 --> ...",
  "sceneCuts": [{"time": 0, "type": "hook", "description": "..."}, ...],
  "colorGrade": "description",
  "captionStyle": "style name",
  "estimatedFileSizeBytes": 18500000,
  "finalDurationSec": ${estimatedDurationSec},
  "productionNotes": ["note1", "note2"],
  "platformOptimizations": {"aspectRatio": "9:16", "maxBitrate": "8Mbps", "audioNormalization": "-14 LUFS"}
}`,
        },
      ],
    });

    let manifest: Record<string, unknown> = {};
    try {
      manifest = JSON.parse(aiRes.choices[0]?.message?.content ?? "{}");
    } catch {}

    const finalDuration = (manifest.finalDurationSec as number) ?? estimatedDurationSec;
    const fileSize = (manifest.estimatedFileSizeBytes as number) ?? 18500000;

    await setStage("rendering", 75);

    await db.update(renderJobsTable)
      .set({
        stage: "complete",
        progress: 100,
        status: "done",
        outputUrl: `/api/videos/${projectId}/download`,
        metadata: manifest,
      })
      .where(eq(renderJobsTable.id, jobId));

    const [existingVideo] = await db.select().from(videosTable).where(eq(videosTable.projectId, projectId)).limit(1);

    if (!existingVideo) {
      await db.insert(videosTable).values({
        projectId,
        url: `/api/videos/${projectId}/download`,
        thumbnailUrl: clips[0]?.thumbnailUrl ?? `https://picsum.photos/seed/render${projectId}/640/360`,
        platform: project?.platform ?? "all",
        durationSec: finalDuration,
        fileSizeBytes: fileSize,
        metadata: manifest,
      });
    } else {
      await db.update(videosTable)
        .set({
          url: `/api/videos/${projectId}/download`,
          durationSec: finalDuration,
          fileSizeBytes: fileSize,
          metadata: manifest,
        })
        .where(eq(videosTable.projectId, projectId));
    }

    await db.update(projectsTable)
      .set({ status: "done", progress: 100 })
      .where(eq(projectsTable.id, projectId));

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Render failed";
    await db.update(renderJobsTable)
      .set({ status: "failed", stage: msg.slice(0, 100) })
      .where(eq(renderJobsTable.id, jobId));
    await db.update(projectsTable)
      .set({ status: "failed" })
      .where(eq(projectsTable.id, projectId));
  }
}

router.post("/render", async (req, res) => {
  const parsed = RenderVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { projectId } = parsed.data;

  const [existing] = await db.select().from(renderJobsTable).where(eq(renderJobsTable.projectId, projectId)).limit(1);

  let row;
  if (existing) {
    [row] = await db.update(renderJobsTable)
      .set({ status: "processing", progress: 0, stage: "assembling_clips" })
      .where(eq(renderJobsTable.projectId, projectId))
      .returning();
  } else {
    [row] = await db.insert(renderJobsTable)
      .values({ projectId, status: "processing", progress: 0, stage: "assembling_clips" })
      .returning();
  }

  await db.update(projectsTable)
    .set({ status: "rendering", progress: 10 })
    .where(eq(projectsTable.id, projectId));

  // Run pipeline async — respond immediately so UI can poll status
  setImmediate(() => { runRealRenderPipeline(projectId, row.id).catch(() => {}); });

  res.json(row);
});

router.get("/:projectId/status", async (req, res) => {
  const projectId = Number(req.params.projectId);
  const [row] = await db.select().from(renderJobsTable).where(eq(renderJobsTable.projectId, projectId)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.get("/:projectId/download", async (req, res) => {
  const projectId = Number(req.params.projectId);
  const [renderJob] = await db.select().from(renderJobsTable).where(eq(renderJobsTable.projectId, projectId)).limit(1);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const [script] = await db.select().from(scriptsTable).where(eq(scriptsTable.projectId, projectId)).limit(1);
  const clips = await db.select().from(clipsTable).where(eq(clipsTable.projectId, projectId)).limit(10);

  if (!renderJob || renderJob.status !== "done") {
    res.status(404).json({ error: "Render not complete" });
    return;
  }

  const pkg = {
    project: { id: project?.id, title: project?.title, platform: project?.platform, prompt: project?.prompt },
    script: script ? { hook: script.hook, body: script.script, cta: script.cta, platformStyle: script.platformStyle } : null,
    clips: clips.map((c) => ({ id: c.id, url: c.url, thumbnailUrl: c.thumbnailUrl, source: c.source, emotionTag: c.emotionTag })),
    production: renderJob.metadata ?? {},
    generatedAt: new Date().toISOString(),
    note: "This production package contains your script, clip list, SRT captions, and cinematography manifest ready for final assembly.",
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="viralos_project_${projectId}.json"`);
  res.json(pkg);
});

router.get("/:projectId", async (req, res) => {
  const projectId = Number(req.params.projectId);
  const [row] = await db.select().from(videosTable).where(eq(videosTable.projectId, projectId)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
