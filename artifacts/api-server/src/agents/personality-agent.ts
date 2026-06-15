import { groqClient } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { styleProfilesTable } from "@workspace/db";
import { storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export interface StyleGenome {
  hookDNA: { openingStyle: string; avgLengthMs: number; paceWords: number; emotionTrigger: string; exampleHooks: string[] };
  pacingDNA: { avgCutRateMs: number; rhythmStyle: string; pauseFrequency: string; energyLevel: number; transitionStyle: string };
  emotionalDNA: { primaryEmotion: string; emotionalArc: string; intensityProgression: string; triggerPsychology: string[]; audienceDesire: string };
  visualDNA: { colorPalette: string[]; brightness: string; contrastLevel: string; motionStyle: string; cameraWork: string; overlayStyle: string };
  typographyDNA: { captionStyle: string; fontWeight: string; fontSize: string; animationStyle: string; colorScheme: string; position: string; outlineStyle: string };
  storytellingDNA: { narrativeStructure: string; conflictStyle: string; resolutionPattern: string; characterVoice: string; vocabularyLevel: string; humorStyle: string };
  viralScore: number;
  avgRetention: number;
  creatorPersonality: string;
  signaturePatterns: string[];
}

export async function runPersonalityAgent(
  creatorHandle: string,
  styleDescription: string,
  sampleScripts: string[],
  category: string
): Promise<AgentResult<{ profile: StyleGenome; profileId: number; name: string }>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "PersonalityAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Analyzing creator style genome", { handle: creatorHandle, category });

  const samplesText = sampleScripts.length > 0
    ? sampleScripts.map((s, i) => `Sample ${i + 1}:\n${s}`).join("\n\n")
    : "(No sample scripts provided — infer style from description)";

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: `You are the VIRALOS Personality Cloning Agent — you reverse-engineer creator styles into precise, reusable DNA profiles.

You analyze pacing, hook patterns, emotional triggers, visual aesthetics, caption behavior, and storytelling structure.
You extract the EXACT formula that makes each creator's style work.

Think like a Hollywood director meets a neuroscientist meets a viral content strategist.`,
      },
      {
        role: "user",
        content: `Clone the creator style for: @${creatorHandle}

Category: ${category}
Style Description: ${styleDescription}

Sample Content:
${samplesText}

Extract a complete Style Genome — the DNA of this creator's content format.
Be extremely specific with numbers, techniques, and patterns.

Return ONLY valid JSON:
{
  "hookDNA": {
    "openingStyle": "question|statement|shock|curiosity|controversial",
    "avgLengthMs": 650,
    "paceWords": 4.2,
    "emotionTrigger": "specific emotion this hook triggers",
    "exampleHooks": ["hook 1 in their style", "hook 2 in their style", "hook 3 in their style"]
  },
  "pacingDNA": {
    "avgCutRateMs": 800,
    "rhythmStyle": "staccato|flowing|mixed|build-release",
    "pauseFrequency": "frequent|rare|dramatic",
    "energyLevel": 8,
    "transitionStyle": "hard cut|dissolve|zoom punch|whip pan"
  },
  "emotionalDNA": {
    "primaryEmotion": "ambition|loneliness|fear|ego|revenge|discipline|hope|anger",
    "emotionalArc": "how emotions build through the video",
    "intensityProgression": "flat|crescendo|wave|spike",
    "triggerPsychology": ["specific psychological trigger 1", "trigger 2"],
    "audienceDesire": "what this creator's audience secretly wants"
  },
  "visualDNA": {
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "brightness": "dark|neutral|bright",
    "contrastLevel": "high|medium|low",
    "motionStyle": "fast-kinetic|slow-cinematic|punchy|smooth",
    "cameraWork": "handheld|static|POV|tracking|mixed",
    "overlayStyle": "minimal|text-heavy|graphic-rich|raw"
  },
  "typographyDNA": {
    "captionStyle": "bold-minimal|cinematic-lower-third|full-screen|animated-word",
    "fontWeight": "black|bold|medium",
    "fontSize": "large|medium|small",
    "animationStyle": "pop|fade|typewriter|none",
    "colorScheme": "white-black-outline|yellow|color-coded-emotion|minimal-white",
    "position": "center|bottom-third|top",
    "outlineStyle": "thick-stroke|thin-outline|drop-shadow|none"
  },
  "storytellingDNA": {
    "narrativeStructure": "hero-journey|problem-solution|reveal|rant|tutorial|contrast",
    "conflictStyle": "internal|external|systemic",
    "resolutionPattern": "triumph|open-loop|insight|challenge",
    "characterVoice": "authoritative|vulnerable|rebellious|mentor|peer",
    "vocabularyLevel": "street|professional|academic|conversational",
    "humorStyle": "dark|self-deprecating|deadpan|none|observational"
  },
  "viralScore": 87,
  "avgRetention": 72,
  "creatorPersonality": "2-3 sentence personality archetype description",
  "signaturePatterns": ["signature pattern 1", "pattern 2", "pattern 3"]
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const genome = JSON.parse(response.choices[0]?.message?.content ?? "{}") as StyleGenome;
  log("Genome extracted", { viralScore: genome.viralScore, retention: genome.avgRetention });

  const [saved] = await db.insert(styleProfilesTable).values({
    name: `@${creatorHandle} Style`,
    creatorHandle,
    category,
    description: styleDescription,
    hookDNA: genome.hookDNA,
    pacingDNA: genome.pacingDNA,
    emotionalDNA: genome.emotionalDNA,
    visualDNA: genome.visualDNA,
    typographyDNA: genome.typographyDNA,
    storytellingDNA: genome.storytellingDNA,
    viralScore: genome.viralScore,
    avgRetention: genome.avgRetention,
    tags: [category, genome.emotionalDNA?.primaryEmotion ?? ""],
    isMarketplaceListing: false,
  }).returning();

  await storeMemory(
    "personality_agent",
    `style_${creatorHandle}`,
    `${creatorHandle} style: ${genome.creatorPersonality}`,
    Math.round(genome.viralScore / 10),
    { genome }
  );

  log("Style profile saved", { id: saved.id });

  return {
    success: true,
    data: { profile: genome, profileId: saved.id, name: saved.name },
    logs,
  };
}

export async function applyStyleToContent(
  profileId: number,
  rawScript: string,
  topic: string
): Promise<AgentResult<{ styledScript: string; hooks: string[]; captions: string[]; directingNotes: string[] }>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "PersonalityAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Applying style genome to content", { profileId, topic });

  const [profile] = await db.select().from(styleProfilesTable)
    .where((t) => t.id.eq ? t.id.eq(profileId) : t.id).limit(1) as any;

  if (!profile) {
    return { success: false, error: "Style profile not found", logs };
  }

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: `You are a content transformer. You rewrite content in an exact creator style using their DNA genome.`,
      },
      {
        role: "user",
        content: `Transform this content into the style of @${profile.creatorHandle}:

Topic: ${topic}
Raw Script: ${rawScript}

Style Genome:
- Hook DNA: ${JSON.stringify(profile.hookDNA)}
- Pacing DNA: ${JSON.stringify(profile.pacingDNA)}
- Emotional DNA: ${JSON.stringify(profile.emotionalDNA)}
- Storytelling DNA: ${JSON.stringify(profile.storytellingDNA)}
- Typography DNA: ${JSON.stringify(profile.typographyDNA)}

Return ONLY valid JSON:
{
  "styledScript": "full rewritten script in their style",
  "hooks": ["hook option 1 in their style", "hook option 2", "hook option 3"],
  "captions": ["caption 1 in their typography style", "caption 2", "caption 3"],
  "directingNotes": ["directing note 1 based on pacing DNA", "note 2", "note 3"]
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Style applied", { hooks: data.hooks?.length });

  return { success: true, data, logs };
}
