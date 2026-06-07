import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { brandIdentitiesTable, channelsTable, storyUniversesTable } from "@workspace/db";
import { storeMemory } from "./memory.js";
import type { AgentResult, AgentLog } from "./types.js";

export async function runBrandAgent(prompt: string): Promise<AgentResult<{
  brandName: string; tagline: string; niche: string; missionStatement: string;
  brandPersonality: string[]; targetAudience: Record<string, string>;
  visualIdentity: Record<string, unknown>; contentPillars: unknown[];
  channelStrategy: Record<string, unknown>; thumbnailStyle: string;
  channelName: string; channelDescription: string; introHook: string;
  brandVoice: string; competitorGaps: string[]; monetizationPath: string;
  brandId: number;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "BrandAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Building brand identity", { prompt });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: `You are the VIRALOS Brand Creation Engine — you build complete media brand identities from a single prompt.

You think like a world-class brand strategist, creative director, and growth hacker combined.
You create brands that feel inevitable — like they were always meant to exist.

Every brand you create has:
- A name that's iconic and memorable
- A visual identity that's instantly recognizable
- Content pillars that drive algorithm growth
- A channel strategy engineered for viral dominance`,
      },
      {
        role: "user",
        content: `Build a complete media brand empire from this prompt:

"${prompt}"

Create a full brand identity package that feels cinematic, elite, and dangerously powerful.

Return ONLY valid JSON:
{
  "brandName": "ICONIC brand name",
  "tagline": "short punchy tagline (5-7 words max)",
  "niche": "specific niche category",
  "missionStatement": "1-2 sentence mission",
  "brandPersonality": ["trait 1", "trait 2", "trait 3", "trait 4"],
  "targetAudience": {
    "age": "18-24",
    "gender": "primary gender/all",
    "psychographic": "psychological profile of ideal viewer",
    "painPoint": "their #1 pain point",
    "desire": "their deepest desire"
  },
  "visualIdentity": {
    "primaryColor": "#hexcode",
    "secondaryColor": "#hexcode",
    "accentColor": "#hexcode",
    "logoConceptDescription": "detailed logo concept",
    "fontStyle": "typography description",
    "moodboardKeywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
    "aestheticStyle": "dark-cinematic|minimal-luxury|raw-energy|neon-underground"
  },
  "contentPillars": [
    {
      "name": "pillar name",
      "percentage": 30,
      "description": "what this pillar does for growth",
      "exampleHooks": ["hook 1", "hook 2"]
    }
  ],
  "channelStrategy": {
    "primaryPlatform": "tiktok|youtube|instagram",
    "secondaryPlatforms": ["platform2", "platform3"],
    "postingFrequency": "X posts per day",
    "peakUploadTimes": ["7pm EST", "12pm EST"],
    "growthStrategy": "specific growth strategy",
    "firstMonthGoal": "specific 30-day goal with numbers"
  },
  "thumbnailStyle": "detailed thumbnail style description",
  "channelName": "@channelname",
  "channelDescription": "channel bio (150 chars max)",
  "introHook": "opening hook the brand always uses",
  "brandVoice": "tone and voice description",
  "competitorGaps": ["gap 1 to exploit", "gap 2", "gap 3"],
  "monetizationPath": "specific monetization roadmap"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Brand identity created", { name: data.brandName });

  const [saved] = await db.insert(brandIdentitiesTable).values({
    prompt,
    brandName: data.brandName,
    tagline: data.tagline,
    niche: data.niche,
    missionStatement: data.missionStatement,
    brandPersonality: data.brandPersonality ?? [],
    targetAudience: data.targetAudience,
    visualIdentity: data.visualIdentity,
    contentPillars: data.contentPillars ?? [],
    channelStrategy: data.channelStrategy,
    thumbnailStyle: data.thumbnailStyle,
    channelName: data.channelName,
    channelDescription: data.channelDescription,
    introHook: data.introHook,
    brandVoice: data.brandVoice,
    competitorGaps: data.competitorGaps ?? [],
    monetizationPath: data.monetizationPath,
    isDeployed: false,
  }).returning();

  await storeMemory("brand_agent", `brand_${saved.id}`, `${data.brandName}: ${data.tagline}`, 8, { niche: data.niche });

  return { success: true, data: { ...data, brandId: saved.id }, logs };
}

export async function runPsychologyAgent(
  topic: string,
  targetEmotion: string,
  platform: string
): Promise<AgentResult<{
  psychologicalProfile: string;
  emotionalTriggers: Array<{ trigger: string; technique: string; placement: string }>;
  optimizedHook: string;
  retentionStrategy: string;
  dopamineHits: string[];
  shareabilityDriver: string;
  addictionLoop: string;
  contentBlueprint: string;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "PsychologyAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Running psychological content optimization", { topic, targetEmotion, platform });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: `You are the VIRALOS Psychological Content Engine — you engineer content that hijacks specific emotional states.

You understand:
- Variable reward loops (dopamine engineering)
- Identity resonance psychology
- Loss aversion triggers
- Social proof cascades
- Tribal belonging mechanics
- Ego threat and protection
- Progress illusion design

You build content blueprints optimized for psychological impact and maximum shareability.`,
      },
      {
        role: "user",
        content: `Build a psychologically optimized content blueprint:

Topic: "${topic}"
Target Emotion: ${targetEmotion}
Platform: ${platform}

Emotional drivers available: ambition | loneliness | fear | ego | revenge | discipline | success_addiction | identity_threat | belonging

Return ONLY valid JSON:
{
  "psychologicalProfile": "profile of viewer in this emotional state",
  "emotionalTriggers": [
    {"trigger": "trigger name", "technique": "specific technique", "placement": "hook|middle|end"}
  ],
  "optimizedHook": "psychologically engineered opening hook",
  "retentionStrategy": "how to keep viewer watching using psychology",
  "dopamineHits": ["dopamine hit 1 at 0:07", "hit 2 at 0:23", "hit 3 at 0:45"],
  "shareabilityDriver": "the core psychological reason someone would share this",
  "addictionLoop": "how this content makes viewers need the next one",
  "contentBlueprint": "full content structure optimized for target emotion"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Psychological blueprint complete", { emotion: targetEmotion });
  return { success: true, data, logs };
}

export async function runUniverseAgent(
  niche: string,
  universeTheme: string,
  episodeCount = 12
): Promise<AgentResult<{
  universeName: string; logline: string; worldDescription: string;
  characters: unknown[]; narrativeArcs: unknown[];
  recurringThemes: string[]; visualLore: string;
  audienceAttachmentStrategy: string; bingeLoopDesign: string;
  universeId: number;
}>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "UniverseAgent", timestamp: new Date().toISOString(), message: msg, data });

  log("Building story universe", { niche, universeTheme });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 3500,
    messages: [
      {
        role: "system",
        content: `You are the VIRALOS Story Universe Architect — you build cinematic content universes for short-form video.

Think Marvel Cinematic Universe, but for TikTok/YouTube Shorts.

You create:
- Worlds with consistent visual lore
- Characters audiences become emotionally attached to
- Narrative arcs with cliffhangers that span multiple episodes
- Binge loops that make stopping impossible
- Recurring themes that build brand recognition`,
      },
      {
        role: "user",
        content: `Build a story universe for:

Niche: ${niche}
Theme: "${universeTheme}"
Episodes to plan: ${episodeCount}

Create a cinematic, binge-able content universe.

Return ONLY valid JSON:
{
  "universeName": "UNIVERSE NAME",
  "logline": "one-sentence universe premise",
  "worldDescription": "immersive world description (2-3 sentences)",
  "characters": [
    {"name": "character name", "archetype": "hero|villain|mentor|anti-hero", "backstory": "backstory", "voiceTone": "how they speak", "role": "their role in content"}
  ],
  "narrativeArcs": [
    {"arcName": "arc name", "episodes": 4, "tensionBuild": "how tension builds", "climax": "what happens at peak", "payoff": "emotional resolution"}
  ],
  "recurringThemes": ["theme 1", "theme 2", "theme 3", "theme 4"],
  "visualLore": "consistent visual elements that define this universe",
  "audienceAttachmentStrategy": "specific psychological technique to create audience attachment",
  "bingeLoopDesign": "exactly how each episode ends to force the next view"
}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  log("Universe built", { name: data.universeName, arcs: data.narrativeArcs?.length });

  const [saved] = await db.insert(storyUniversesTable).values({
    name: data.universeName,
    niche,
    logline: data.logline,
    worldDescription: data.worldDescription,
    characters: data.characters ?? [],
    narrativeArcs: data.narrativeArcs ?? [],
    recurringThemes: data.recurringThemes ?? [],
    visualLore: data.visualLore,
    audienceAttachmentStrategy: data.audienceAttachmentStrategy,
    bingeLoopDesign: data.bingeLoopDesign,
    isActive: true,
  }).returning();

  return { success: true, data: { ...data, universeId: saved.id }, logs };
}
