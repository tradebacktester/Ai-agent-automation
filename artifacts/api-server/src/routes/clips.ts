import { Router } from "express";
import { db, clipsTable, clipJobsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SearchClipsBody, GenerateAiClipBody } from "@workspace/api-zod";

const router = Router();

const STOCK_CLIP_TEMPLATES = [
  { source: "pexels", emotionTag: "cinematic" },
  { source: "pixabay", emotionTag: "energy" },
  { source: "pexels", emotionTag: "dramatic" },
  { source: "unsplash", emotionTag: "aesthetic" },
];

router.post("/search", async (req, res) => {
  const parsed = SearchClipsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { projectId, query, emotionTone, count = 4 } = parsed.data;

  const clips = [];
  for (let i = 0; i < Math.min(count, 4); i++) {
    const template = STOCK_CLIP_TEMPLATES[i % STOCK_CLIP_TEMPLATES.length];
    const [row] = await db
      .insert(clipsTable)
      .values({
        projectId,
        source: template.source,
        url: `https://player.vimeo.com/external/clip_${projectId}_${i}`,
        thumbnailUrl: `https://picsum.photos/seed/${projectId}${i}/640/360`,
        duration: 5 + Math.floor(Math.random() * 10),
        query,
        emotionTag: emotionTone ?? template.emotionTag,
      })
      .returning();
    clips.push(row);
  }

  await db
    .update(projectsTable)
    .set({ status: "editing", progress: 50 })
    .where(eq(projectsTable.id, projectId));

  res.json(clips);
});

router.post("/generate", async (req, res) => {
  const parsed = GenerateAiClipBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { projectId, description: _description, duration: _duration, provider = "runway" } = parsed.data;

  const [row] = await db
    .insert(clipJobsTable)
    .values({
      projectId,
      status: "processing",
      provider,
    })
    .returning();

  res.json(row);
});

// Background music: search Pixabay for royalty-free tracks.
// Returns proxy URLs so the browser avoids CORS issues with Pixabay's CDN.
// Must be BEFORE /:projectId to avoid wildcard match.
router.get("/music", async (req, res) => {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) { res.json({ tracks: [] }); return; }

  const q = (req.query.q as string) ?? "cinematic background";
  try {
    const apiUrl = `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&media_type=audio&per_page=5&safesearch=true`;
    const r = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) { res.json({ tracks: [] }); return; }
    const data = await r.json() as { hits?: Array<{ id: number; audio?: string; tags?: string; duration?: number }> };
    const tracks = (data.hits ?? [])
      .filter(h => h.audio)
      .slice(0, 3)
      .map(h => ({
        id: h.id,
        title: h.tags ?? "Background Music",
        url: `/api/clips/music-proxy?src=${encodeURIComponent(h.audio!)}`,
        duration: h.duration ?? 60,
      }));
    res.json({ tracks });
  } catch {
    res.json({ tracks: [] });
  }
});

// Proxy Pixabay audio files with CORS headers so the browser AudioContext can decode them.
// Must be BEFORE /:projectId to avoid wildcard match.
router.get("/music-proxy", async (req, res) => {
  const src = req.query.src as string;
  if (!src) { res.status(400).end(); return; }
  try {
    const upstream = await fetch(src, { signal: AbortSignal.timeout(20_000) });
    if (!upstream.ok || !upstream.body) { res.status(502).end(); return; }
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const { Readable } = await import("node:stream");
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } catch {
    if (!res.headersSent) res.status(502).end();
  }
});

router.get("/:projectId", async (req, res) => {
  const projectId = Number(req.params.projectId);
  const rows = await db
    .select()
    .from(clipsTable)
    .where(eq(clipsTable.projectId, projectId));
  res.json(rows);
});

export default router;
