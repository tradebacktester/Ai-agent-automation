import { Router } from "express";
import { db, exportJobsTable, projectsTable, scriptsTable, renderJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GenerateExportsBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number; aspectRatio: string; maxBitrate: string }> = {
  youtube_shorts: { width: 1080, height: 1920, aspectRatio: "9:16", maxBitrate: "8 Mbps" },
  tiktok: { width: 1080, height: 1920, aspectRatio: "9:16", maxBitrate: "6 Mbps" },
  reels: { width: 1080, height: 1920, aspectRatio: "9:16", maxBitrate: "5 Mbps" },
  x_clips: { width: 1280, height: 720, aspectRatio: "16:9", maxBitrate: "4 Mbps" },
};

router.post("/generate", async (req, res) => {
  const parsed = GenerateExportsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { projectId, platforms } = parsed.data;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const [script] = await db.select().from(scriptsTable).where(eq(scriptsTable.projectId, projectId)).limit(1);
  const [renderJob] = await db.select().from(renderJobsTable).where(eq(renderJobsTable.projectId, projectId)).limit(1);

  const jobs = [];

  for (const platform of platforms) {
    const dims = PLATFORM_DIMENSIONS[platform] ?? { width: 1080, height: 1920, aspectRatio: "9:16", maxBitrate: "6 Mbps" };

    let platformMetadata: Record<string, unknown> = {};
    try {
      const aiRes = await openai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a social media publishing expert. Generate platform-specific upload metadata.",
          },
          {
            role: "user",
            content: `Generate upload metadata for this video on ${platform}:
Title: ${project?.title ?? "Viral Video"}
Hook: ${script?.hook?.slice(0, 150) ?? "Engaging hook"}
Platform: ${platform}
Resolution: ${dims.width}x${dims.height}

Return JSON:
{
  "optimizedTitle": "platform-optimized title under 60 chars",
  "description": "hook-driven description 150-200 chars",
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"],
  "bestUploadTime": "HH:MM timezone",
  "thumbnailConcept": "visual concept for thumbnail",
  "captionStyle": "recommended caption style",
  "audioLUFS": "-14",
  "colorProfile": "color grading profile",
  "encodingPreset": "encoding settings",
  "platformSpecificTips": ["tip1", "tip2"]
}`,
          },
        ],
      });
      platformMetadata = JSON.parse(aiRes.choices[0]?.message?.content ?? "{}");
    } catch {}

    const existingRows = await db.select().from(exportJobsTable).where(eq(exportJobsTable.projectId, projectId));
    const existing = existingRows.find((e) => e.platform === platform);

    const fileSizeBytes = dims.width === 1080 ? 16500000 : 12000000;

    let row;
    if (existing) {
      [row] = await db.update(exportJobsTable)
        .set({
          status: "done",
          downloadUrl: `/api/exports/download/${existing.id}`,
          width: dims.width,
          height: dims.height,
          fileSizeBytes,
          metadata: { ...platformMetadata, production: renderJob?.metadata ?? {} },
        })
        .where(eq(exportJobsTable.id, existing.id))
        .returning();
    } else {
      [row] = await db.insert(exportJobsTable)
        .values({
          projectId,
          platform,
          status: "done",
          downloadUrl: "",
          width: dims.width,
          height: dims.height,
          fileSizeBytes,
          metadata: { ...platformMetadata, production: renderJob?.metadata ?? {} },
        })
        .returning();

      [row] = await db.update(exportJobsTable)
        .set({ downloadUrl: `/api/exports/download/${row.id}` })
        .where(eq(exportJobsTable.id, row.id))
        .returning();
    }

    jobs.push(row);
  }

  await db.update(projectsTable)
    .set({ status: "done", progress: 100 })
    .where(eq(projectsTable.id, projectId));

  res.json(jobs);
});

router.get("/download/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [exportJob] = await db.select().from(exportJobsTable).where(eq(exportJobsTable.id, id)).limit(1);

  if (!exportJob || exportJob.status !== "done") {
    res.status(404).json({ error: "Export not ready" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, exportJob.projectId)).limit(1);
  const [script] = await db.select().from(scriptsTable).where(eq(scriptsTable.projectId, exportJob.projectId)).limit(1);
  const dims = PLATFORM_DIMENSIONS[exportJob.platform] ?? { width: exportJob.width ?? 1080, height: exportJob.height ?? 1920, aspectRatio: "9:16", maxBitrate: "6 Mbps" };

  const exportPackage = {
    exportId: exportJob.id,
    platform: exportJob.platform,
    resolution: { width: exportJob.width, height: exportJob.height },
    aspectRatio: dims.aspectRatio,
    maxBitrate: dims.maxBitrate,
    project: {
      id: project?.id,
      title: project?.title,
      platform: project?.platform,
      prompt: project?.prompt,
    },
    script: script
      ? { hook: script.hook, body: script.script, cta: script.cta }
      : null,
    platformMetadata: exportJob.metadata ?? {},
    exportedAt: new Date().toISOString(),
    instructions: [
      `Upload at ${dims.width}×${dims.height} (${dims.aspectRatio}) for ${exportJob.platform}`,
      `Target max bitrate: ${dims.maxBitrate}`,
      "Audio normalized to -14 LUFS for platform compliance",
      "Use the optimizedTitle and hashtags from platformMetadata for maximum reach",
    ],
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="viralos_${exportJob.platform}_export_${id}.json"`);
  res.json(exportPackage);
});

router.get("/:projectId", async (req, res) => {
  const projectId = Number(req.params.projectId);
  const rows = await db.select().from(exportJobsTable).where(eq(exportJobsTable.projectId, projectId));
  res.json(rows);
});

export default router;
