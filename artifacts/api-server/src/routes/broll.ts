import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/keywords", async (req, res) => {
  const { hook, script, cta, videoStyle, niche } = req.body as {
    hook?: string; script?: string; cta?: string; videoStyle?: string; niche?: string;
  };

  if (!hook && !script) {
    res.status(400).json({ error: "script content required" });
    return;
  }

  const styleHints: Record<string, string> = {
    dark_motivation: "dark cinematic, intense, dramatic, fitness, success, grind",
    luxury_cinematic: "luxury, premium, elegant, wealth, city skyline, golden hour",
    documentary: "authentic, real people, streets, natural, storytelling",
    anime_edit: "energy, power, speed, light beams, abstract, futuristic city",
  };

  const styleHint = styleHints[videoStyle ?? "dark_motivation"] ?? styleHints["dark_motivation"];

  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a video director extracting B-roll search queries for stock footage.
Style: ${styleHint}
Generate cinematic, visual, specific search terms for portrait video (9:16 vertical format).
Return JSON: { "queries": ["query1", "query2", ...] } — 5-7 queries, each 1-3 words, visual nouns/scenes.`,
        },
        {
          role: "user",
          content: `Script content:
HOOK: ${hook ?? ""}
BODY: ${(script ?? "").slice(0, 300)}
CTA: ${cta ?? ""}
Niche: ${niche ?? "motivation"}

Extract 5-7 B-roll video search queries that match this script visually.`,
        },
      ],
    });

    const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    const queries: string[] = Array.isArray(data.queries) ? data.queries : [];
    res.json({ queries });
  } catch (err) {
    console.error("B-roll keywords error:", err);
    res.status(500).json({ error: String(err), queries: [] });
  }
});

router.get("/search", async (req, res) => {
  const { query, per_page = "3" } = req.query as Record<string, string>;
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    res.json({ clips: [], noKey: true });
    return;
  }
  if (!query) {
    res.status(400).json({ error: "query required", clips: [] });
    return;
  }

  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=${per_page}`;
    const pexelsRes = await fetch(url, { headers: { Authorization: apiKey } });

    if (!pexelsRes.ok) {
      res.json({ clips: [], error: `Pexels ${pexelsRes.status}` });
      return;
    }

    const data = await pexelsRes.json() as any;

    const clips = ((data.videos ?? []) as any[]).map((v) => {
      const files: any[] = v.video_files ?? [];
      const portrait = files.find((f) => f.height > f.width && f.quality === "hd")
        ?? files.find((f) => f.height > f.width)
        ?? files.find((f) => f.quality === "hd")
        ?? files[0];

      return {
        id: v.id,
        url: portrait?.link ?? null,
        width: portrait?.width ?? 1080,
        height: portrait?.height ?? 1920,
        duration: v.duration ?? 10,
        thumbnail: v.image ?? null,
        query,
      };
    }).filter((c) => c.url);

    res.json({ clips });
  } catch (err) {
    console.error("Pexels search error:", err);
    res.status(500).json({ error: String(err), clips: [] });
  }
});

export default router;
