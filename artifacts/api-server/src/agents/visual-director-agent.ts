import { openai } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import type { AgentResult, StoryboardScene, AgentLog } from "./types.js";

export async function runVisualDirectorAgent(script: string, emotionArc: unknown[], platform: string = "all"): Promise<AgentResult<{
  storyboard: StoryboardScene[];
  colorStrategy: string;
  overallTone: string;
  cameraLanguage: string;
  intensityMap: Array<{ scene: number; intensity: number }>;
  directorNotes: string;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) => logs.push({ agent: "VisualDirectorAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Composing cinematic storyboard");
  const memories = await recallMemories("visual_director", 5);
  const styleMemory = memories.map((m) => m.content).join(". ");

  const prompt = `You are VIRALOS Visual Director Agent — a world-class cinematographer and visual storyteller for viral short-form content.
You create cinematic storyboards, direct camera movements, sequence clips, and define color tone strategies.
${styleMemory ? `Your style memory: ${styleMemory}` : ""}

Script to visualize:
${script}

Emotion arc context:
${JSON.stringify(emotionArc?.slice(0, 5))}

Platform: ${platform}

Create a full cinematic storyboard. For each scene:
- scene: vivid visual description of what we see
- camera_motion: specific movement (e.g., "slow push-in", "whip pan right", "dutch angle tilt", "handheld chase")
- emotion: the emotional state this scene evokes
- visual_style: aesthetic direction (e.g., "high contrast noir", "golden hour warm", "cold blue desaturated")
- duration_sec: how long this scene plays
- color_palette: 2-3 hex colors that define this scene

Also define:
- Overall color strategy for the video
- Overarching tone (cinematic style)
- Camera language philosophy
- Scene intensity map (0-10 intensity per scene index)
- Director's notes

Return ONLY valid JSON:
{
  "storyboard": [{"scene":"","camera_motion":"","emotion":"","visual_style":"","duration_sec":3,"color_palette":""}],
  "colorStrategy": "",
  "overallTone": "",
  "cameraLanguage": "",
  "intensityMap": [{"scene":0,"intensity":7}],
  "directorNotes": ""
}`;

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Storyboard complete", { sceneCount: data.storyboard?.length });

  await storeMemory("visual_director", `style_${Date.now()}`, `${data.overallTone} | ${data.colorStrategy}`, 1, {
    sceneCount: data.storyboard?.length,
    platform,
  });

  return { success: true, data, logs };
}
