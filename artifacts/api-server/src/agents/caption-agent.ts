import { groqClient } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export type CaptionStyle = "hormozi" | "dark_cinematic" | "anime_edit" | "dopamine_typography" | "minimalist" | "hype";

export interface CaptionSet {
  style: CaptionStyle;
  captions: Array<{
    text: string;
    startTime: number;
    endTime: number;
    fontSize: string;
    fontWeight: string;
    color: string;
    highlight?: string;
    animation: string;
    position: "top" | "center" | "bottom";
  }>;
  styleDescription: string;
}

export async function runCaptionAgent(script: string, styles: CaptionStyle[] = ["hormozi", "dark_cinematic", "anime_edit", "dopamine_typography"]): Promise<AgentResult<{
  captionSets: CaptionSet[];
  recommendedStyle: CaptionStyle;
  typographyNotes: string;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) => logs.push({ agent: "CaptionAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Generating caption styles", { styles });
  const memories = await recallMemories("caption_agent", 5);
  const styleWisdom = memories.map((m) => m.content).join(". ");

  const prompt = `You are VIRALOS Caption Agent — a typography and subtitle specialist obsessed with dopamine-inducing text on screen.
You create captions that make viewers read AND feel simultaneously.
${styleWisdom ? `Style memory: ${styleWisdom}` : ""}

Script to caption:
${script}

Generate caption sets for these styles: ${styles.join(", ")}

Style guides:
- hormozi: Big bold white caps, yellow/orange highlight on key word, black outline, bottom-third, 3-5 words at a time, punchy
- dark_cinematic: Thin elegant serif or mono font, white or gold, letter-spacing wide, centered, minimal 2-4 words
- anime_edit: Colorful overlapping text, high energy, multiple sizes, neon colors, fast timing, dramatic reveals
- dopamine_typography: Kinetic text, words that pop in/scale up on beats, color changes per syllable, energetic

For each caption in a set:
- text: 2-6 words max per line
- startTime/endTime: seconds (estimate from script pacing)
- fontSize: "sm" | "md" | "lg" | "xl" | "2xl"
- fontWeight: "normal" | "bold" | "black"  
- color: hex color
- highlight: hex color for highlighted word (optional)
- animation: "fade_in" | "pop" | "slide_up" | "typewriter" | "scale_bounce" | "flash"
- position: "top" | "center" | "bottom"

Return ONLY valid JSON:
{
  "captionSets": [
    {
      "style": "hormozi",
      "captions": [{"text":"","startTime":0,"endTime":2,"fontSize":"xl","fontWeight":"bold","color":"#ffffff","highlight":"#FFD700","animation":"pop","position":"bottom"}],
      "styleDescription": ""
    }
  ],
  "recommendedStyle": "hormozi",
  "typographyNotes": ""
}`;

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Captions generated", { sets: data.captionSets?.length, recommended: data.recommendedStyle });

  await storeMemory("caption_agent", `style_${data.recommendedStyle}_${Date.now()}`, `Best style: ${data.recommendedStyle} — ${data.typographyNotes?.slice(0, 100)}`, 1, {
    styleCount: data.captionSets?.length,
  });

  return { success: true, data, logs };
}
