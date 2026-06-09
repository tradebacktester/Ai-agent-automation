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
    dark_motivation: "dark cinematic gym, slow motion athlete, intense training, dramatic shadows, fire sparks, silhouette determination, black and white warrior, explosive energy",
    luxury_cinematic: "luxury penthouse golden hour, sleek sports car night, champagne slow motion, wealthy lifestyle rooftop, city skyline aerial, premium watch close-up",
    documentary: "close-up real emotion face, candid street portrait, dramatic sky timelapse, authentic hands working, raw storytelling moment, journalistic urban",
    anime_edit: "neon city rain vertical, speed lines explosion, glowing energy aura, futuristic portal light, cyberpunk street vertical, particle burst cinematic",
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
          content: `You are a viral video director choosing B-roll for short-form content (YouTube Shorts/Reels).
Style context: ${styleHint}
Rules:
- Generate 7 search queries for stock video footage
- Each query must be 1-4 words, highly visual, cinematic
- Queries must match the script EMOTION and TOPIC — not just generic
- Prioritize slow-motion, dramatic, high-contrast, vertical-friendly footage
- Mix: action shots, close-ups, environmental/atmospheric, face expressions, symbolic visuals
Return ONLY JSON: { "queries": ["query1", "query2", ...] }`,
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
      // Prefer HD portrait for quality; fall back to SD portrait; then any portrait; then any
      const portrait = files.find((f) => f.height > f.width && f.quality === "hd")
        ?? files.find((f) => f.height > f.width && f.quality === "sd")
        ?? files.find((f) => f.height > f.width)
        ?? files.find((f) => f.quality === "hd")
        ?? files[0];

      const rawUrl = portrait?.link ?? null;

      return {
        id: v.id,
        url: rawUrl ? `/api/broll/proxy?url=${encodeURIComponent(rawUrl)}` : null,
        width: portrait?.width ?? 540,
        height: portrait?.height ?? 960,
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

// Streaming proxy with Range support — lets browser buffer video progressively
router.get("/proxy", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).end(); return; }

  try {
    const decoded = decodeURIComponent(url);

    // Forward Range header so browser can seek/buffer video
    const upstreamHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      "Referer": "https://www.pexels.com/",
      "Accept": "video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8",
    };

    const rangeHeader = req.headers["range"];
    if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

    const upstream = await fetch(decoded, { headers: upstreamHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      console.error(`Proxy upstream error ${upstream.status} for ${decoded}`);
      res.status(upstream.status).end();
      return;
    }

    const ct = upstream.headers.get("content-type") ?? "video/mp4";
    const cl = upstream.headers.get("content-length");
    const cr = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges") ?? "bytes";

    res.setHeader("Content-Type", ct);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    res.setHeader("Accept-Ranges", acceptRanges);
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (cl) res.setHeader("Content-Length", cl);
    if (cr) res.setHeader("Content-Range", cr);

    res.status(upstream.status);

    if (!upstream.body) { res.end(); return; }

    // Stream the response chunk by chunk — browser can start playing immediately
    const reader = upstream.body.getReader();

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          const canContinue = res.write(Buffer.from(value));
          if (!canContinue) {
            await new Promise<void>((resolve) => res.once("drain", resolve));
          }
        }
      } catch {
        if (!res.headersSent) res.status(500).end();
        else res.end();
      }
    };

    req.on("close", () => reader.cancel().catch(() => {}));
    pump();
  } catch (err) {
    console.error("Broll proxy error:", err);
    if (!res.headersSent) res.status(500).end();
  }
});

export default router;
