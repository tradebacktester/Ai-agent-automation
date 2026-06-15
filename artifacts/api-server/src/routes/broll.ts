import { Router } from "express";
import { groqClient } from "@workspace/integrations-openai-ai-server";

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
    const response = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a viral video director choosing B-roll for short-form content (YouTube Shorts/Reels).
Style context: ${styleHint}
Rules:
- Generate 8 search queries for stock video footage
- Each query must be 1-4 CONCRETE visual words (e.g. "money wallet hand", "person typing laptop", "city skyline night")
- Queries must match the script EMOTION and TOPIC — not generic filler
- Think scene-by-scene: what would you SEE on screen during each sentence?
- Prioritize slow-motion, dramatic, high-contrast, vertical-friendly footage
- Mix: action shots, close-ups, environmental/atmospheric, symbolic visuals
- Avoid abstract words — only what a camera can literally film
Return ONLY JSON: { "queries": ["query1", "query2", ...] }`,
        },
        {
          role: "user",
          content: `Script content:
HOOK: ${hook ?? ""}
BODY: ${(script ?? "").slice(0, 400)}
CTA: ${cta ?? ""}
Niche: ${niche ?? "motivation"}

For each major scene/sentence, give a concrete visual search term for stock footage.`,
        },
      ],
    });

    const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    const queries: string[] = Array.isArray(data.queries) ? data.queries : [];
    res.json({ queries });
  } catch (err) {
    console.error("[ERROR] B-roll keyword generation failed:", String(err));
    res.status(500).json({ error: String(err), queries: [] });
  }
});

// ── Shared clip normaliser ────────────────────────────────────────────────────
interface NormClip {
  id: string | number;
  url: string | null;
  width: number;
  height: number;
  duration: number;
  thumbnail: string | null;
  query: string;
  source: string;
}

function proxyUrl(raw: string): string {
  return `/api/broll/proxy?url=${encodeURIComponent(raw)}`;
}

// ── Pexels ────────────────────────────────────────────────────────────────────
async function searchPexels(query: string, perPage: number): Promise<NormClip[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("no_key");

  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=${perPage}`;
  const r = await fetch(url, { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Pexels ${r.status}`);

  const data = await r.json() as any;
  return ((data.videos ?? []) as any[]).flatMap((v) => {
    const files: any[] = v.video_files ?? [];
    const portrait = files.find((f) => f.height > f.width && f.quality === "hd")
      ?? files.find((f) => f.height > f.width && f.quality === "sd")
      ?? files.find((f) => f.height > f.width)
      ?? files.find((f) => f.quality === "hd")
      ?? files[0];
    const rawUrl = portrait?.link ?? null;
    if (!rawUrl) return [];
    return [{
      id: v.id, url: proxyUrl(rawUrl),
      width: portrait?.width ?? 540, height: portrait?.height ?? 960,
      duration: v.duration ?? 10, thumbnail: v.image ?? null,
      query, source: "pexels",
    }];
  });
}

// ── Pixabay ───────────────────────────────────────────────────────────────────
async function searchPixabay(query: string, perPage: number): Promise<NormClip[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) throw new Error("no_key");

  const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&video_type=all&orientation=vertical&per_page=${perPage}&safesearch=true`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Pixabay ${r.status}`);

  const data = await r.json() as any;
  return ((data.hits ?? []) as any[]).flatMap((v) => {
    const sizes = v.videos ?? {};
    // Pick largest portrait variant available
    const best = sizes.large ?? sizes.medium ?? sizes.small ?? sizes.tiny;
    const rawUrl: string | null = best?.url ?? null;
    if (!rawUrl) return [];
    return [{
      id: v.id, url: proxyUrl(rawUrl),
      width: best?.width ?? 540, height: best?.height ?? 960,
      duration: v.duration ?? 10, thumbnail: `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg`,
      query, source: "pixabay",
    }];
  });
}

// ── Coverr (no API key required) ──────────────────────────────────────────────
async function searchCoverr(query: string, perPage: number): Promise<NormClip[]> {
  const url = `https://api.coverr.co/videos?query=${encodeURIComponent(query)}&page=1&token=`;
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Coverr ${r.status}`);

  const data = await r.json() as any;
  const hits: any[] = (data.hits ?? data.videos ?? []).slice(0, perPage);

  return hits.flatMap((v) => {
    // Coverr returns an mp4 url directly
    const rawUrl: string | null =
      v.urls?.mp4 ?? v.mp4 ?? v.url ?? v.video_url ?? null;
    if (!rawUrl) return [];
    return [{
      id: v.id ?? String(Math.random()), url: proxyUrl(rawUrl),
      width: v.width ?? 540, height: v.height ?? 960,
      duration: v.duration ?? 10, thumbnail: v.coverImage ?? v.thumbnail ?? null,
      query, source: "coverr",
    }];
  });
}

// ── /search — Pexels → Pixabay → Coverr ──────────────────────────────────────
router.get("/search", async (req, res) => {
  const { query, per_page = "3" } = req.query as Record<string, string>;
  if (!query) {
    res.status(400).json({ error: "query required", clips: [] });
    return;
  }

  const n = Math.min(parseInt(per_page, 10) || 3, 10);
  const errors: string[] = [];

  // 1. Pexels
  try {
    const clips = await searchPexels(query, n);
    if (clips.length > 0) {
      console.log(`[broll] Pexels OK — ${clips.length} clips for "${query}"`);
      res.json({ clips, source: "pexels" });
      return;
    }
    errors.push("Pexels: 0 results");
  } catch (e) {
    const msg = String(e);
    if (msg === "Error: no_key") {
      // No Pexels key — don't log noise, just fall through
    } else {
      console.warn(`[broll] Pexels failed: ${msg}`);
      errors.push(`Pexels: ${msg}`);
    }
  }

  // 2. Pixabay
  try {
    const clips = await searchPixabay(query, n);
    if (clips.length > 0) {
      console.log(`[broll] Pixabay OK — ${clips.length} clips for "${query}"`);
      res.json({ clips, source: "pixabay" });
      return;
    }
    errors.push("Pixabay: 0 results");
  } catch (e) {
    const msg = String(e);
    if (msg !== "Error: no_key") {
      console.warn(`[broll] Pixabay failed: ${msg}`);
      errors.push(`Pixabay: ${msg}`);
    }
  }

  // 3. Coverr (no key required)
  try {
    const clips = await searchCoverr(query, n);
    if (clips.length > 0) {
      console.log(`[broll] Coverr OK — ${clips.length} clips for "${query}"`);
      res.json({ clips, source: "coverr" });
      return;
    }
    errors.push("Coverr: 0 results");
  } catch (e) {
    console.warn(`[broll] Coverr failed: ${e}`);
    errors.push(`Coverr: ${e}`);
  }

  // All sources failed or returned 0 results
  const noKey = !process.env.PEXELS_API_KEY && !process.env.PIXABAY_API_KEY;
  console.log(`[broll] No clips found for "${query}". noKey=${noKey}`);
  res.json({ clips: [], noKey, errors });
});

// ── Streaming proxy with Range support ───────────────────────────────────────
router.get("/proxy", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).end(); return; }

  try {
    const decoded = decodeURIComponent(url);

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
