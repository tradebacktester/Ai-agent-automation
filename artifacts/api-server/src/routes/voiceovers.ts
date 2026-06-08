import { Router } from "express";
import { db, voiceoverJobsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GenerateVoiceoverBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const VOICE_DURATIONS: Record<string, number> = {
  motivational_male: 45000,
  motivational_female: 47000,
  dramatic_male: 52000,
  dramatic_female: 50000,
  calm_male: 60000,
  calm_female: 58000,
};

// ElevenLabs voice IDs (may require paid plan)
const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  motivational_male: "pNInz6obpgDQGcFmaJgB",
  cinematic_female: "21m00Tcm4TlvDq8ikWAM",
  calm_authority: "ErXwobaYiN019PkySvjV",
  intense_narrator: "VR6AewLTigWG4xSOukaG",
};

// OpenAI TTS voices — free-tier fallback
const OPENAI_VOICE_MAP: Record<string, string> = {
  motivational_male: "onyx",
  cinematic_female: "nova",
  calm_authority: "echo",
  intense_narrator: "fable",
};

export interface WordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
}

export interface PhraseTimestamp {
  phrase: string;
  words: WordTimestamp[];
  startSec: number;
  endSec: number;
  isHook: boolean;
  isCTA: boolean;
}

// Build phrase timestamps from ElevenLabs character-level alignment
function buildPhraseTimestamps(
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  },
  sections: { hook: string; body: string; cta: string },
  maxWordsPerPhrase = 3,
): PhraseTimestamp[] {
  const words: { word: string; start: number; end: number }[] = [];
  let currentWord = "";
  let wordStart = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    if (/\s/.test(char)) {
      if (currentWord) {
        words.push({
          word: currentWord,
          start: wordStart,
          end: alignment.character_end_times_seconds[i - 1] ?? alignment.character_start_times_seconds[i],
        });
        currentWord = "";
      }
    } else {
      if (!currentWord) wordStart = alignment.character_start_times_seconds[i];
      currentWord += char;
    }
  }
  if (currentWord && alignment.character_end_times_seconds.length > 0) {
    words.push({
      word: currentWord,
      start: wordStart,
      end: alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1],
    });
  }

  return groupWordsIntoPhrases(words, sections, maxWordsPerPhrase);
}

// Build phrase timestamps from Whisper word-level output
function buildPhraseTimestampsFromWords(
  whisperWords: { word: string; start: number; end: number }[],
  sections: { hook: string; body: string; cta: string },
  maxWordsPerPhrase = 3,
): PhraseTimestamp[] {
  const words = whisperWords.map(w => ({
    word: w.word.replace(/^\s+|\s+$/g, ""),
    start: w.start,
    end: w.end,
  })).filter(w => w.word.length > 0);
  return groupWordsIntoPhrases(words, sections, maxWordsPerPhrase);
}

// Shared grouping logic
function groupWordsIntoPhrases(
  words: { word: string; start: number; end: number }[],
  sections: { hook: string; body: string; cta: string },
  maxWordsPerPhrase: number,
): PhraseTimestamp[] {
  if (words.length === 0) return [];

  const hookWordCount = sections.hook.trim().split(/\s+/).filter(Boolean).length;
  const bodyWordCount = sections.body.trim().split(/\s+/).filter(Boolean).length;
  const ctaStartIdx   = hookWordCount + bodyWordCount;

  const result: PhraseTimestamp[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerPhrase) {
    const group = words.slice(i, Math.min(i + maxWordsPerPhrase, words.length));
    result.push({
      phrase:   group.map((w) => w.word).join(" "),
      words:    group.map((w) => ({ word: w.word, startSec: w.start, endSec: w.end })),
      startSec: group[0].start,
      endSec:   group[group.length - 1].end + 0.15,
      isHook:   i < hookWordCount,
      isCTA:    i >= ctaStartIdx,
    });
  }
  return result;
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
async function synthesizeWithElevenLabs(text: string, voiceStyle: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const voiceId = ELEVENLABS_VOICE_MAP[voiceStyle] ?? ELEVENLABS_VOICE_MAP["motivational_male"];

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify({
      text: text.slice(0, 5000),
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.35, use_speaker_boost: true },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`ElevenLabs error ${response.status}: ${err}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// ── OpenAI TTS ────────────────────────────────────────────────────────────────
async function synthesizeWithOpenAI(text: string, voiceStyle: string): Promise<Buffer> {
  const voice = (OPENAI_VOICE_MAP[voiceStyle] ?? "onyx") as
    "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text.slice(0, 4096),
    response_format: "mp3",
    speed: 1.05,
  });

  return Buffer.from(await response.arrayBuffer());
}

// ── OpenAI TTS + Whisper word timestamps ──────────────────────────────────────
async function synthesizeWithOpenAIAndTimestamps(
  text: string,
  voiceStyle: string,
  sections: { hook: string; body: string; cta: string },
): Promise<{ audioBase64: string; phrases: PhraseTimestamp[] }> {
  const audioBuffer = await synthesizeWithOpenAI(text, voiceStyle);

  // Use Whisper to get word-level timestamps from the generated audio
  const file = new File([audioBuffer], "speech.mp3", { type: "audio/mpeg" });
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  } as Parameters<typeof openai.audio.transcriptions.create>[0]);

  const whisperWords = (transcription as unknown as {
    words?: { word: string; start: number; end: number }[];
  }).words ?? [];

  const phrases = whisperWords.length > 0
    ? buildPhraseTimestampsFromWords(whisperWords, sections)
    : [];

  return {
    audioBase64: audioBuffer.toString("base64"),
    phrases,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  const parsed = GenerateVoiceoverBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { projectId, voiceStyle = "motivational_male" } = parsed.data;

  const [existing] = await db.select().from(voiceoverJobsTable)
    .where(eq(voiceoverJobsTable.projectId, projectId));

  let row;
  if (existing) {
    [row] = await db.update(voiceoverJobsTable)
      .set({ status: "done", voiceStyle, audioUrl: `/api/audio/voiceover_${projectId}.mp3`, durationMs: VOICE_DURATIONS[voiceStyle] ?? 45000 })
      .where(eq(voiceoverJobsTable.projectId, projectId)).returning();
  } else {
    [row] = await db.insert(voiceoverJobsTable)
      .values({ projectId, status: "done", voiceStyle, audioUrl: `/api/audio/voiceover_${projectId}.mp3`, durationMs: VOICE_DURATIONS[voiceStyle] ?? 45000 })
      .returning();
  }

  await db.update(projectsTable).set({ status: "finding_clips", progress: 35 })
    .where(eq(projectsTable.id, projectId));
  res.json(row);
});

// ── /synthesize — ElevenLabs → OpenAI TTS fallback ───────────────────────────
router.post("/synthesize", async (req, res) => {
  const { text, voiceStyle = "motivational_male", projectId } = req.body as {
    text?: string; voiceStyle?: string; projectId?: number;
  };

  if (!text?.trim()) { res.status(400).json({ error: "text is required" }); return; }

  let buffer: Buffer;

  // 1. Try ElevenLabs
  try {
    buffer = await synthesizeWithElevenLabs(text, voiceStyle);
    console.log("[TTS] ElevenLabs OK");
  } catch (elevenErr) {
    console.warn("[TTS] ElevenLabs failed, trying OpenAI TTS:", String(elevenErr).slice(0, 80));
    // 2. Fallback: OpenAI TTS
    try {
      buffer = await synthesizeWithOpenAI(text, voiceStyle);
      console.log("[TTS] OpenAI TTS OK");
    } catch (openaiErr) {
      console.error("[TTS] OpenAI TTS also failed:", openaiErr);
      res.status(500).json({ error: "Voice synthesis failed", details: String(openaiErr) });
      return;
    }
  }

  if (projectId) {
    try {
      const [existing] = await db.select().from(voiceoverJobsTable)
        .where(eq(voiceoverJobsTable.projectId, Number(projectId)));
      const payload = { status: "done" as const, voiceStyle, audioUrl: `/api/audio/voiceover_${projectId}.mp3`, durationMs: Math.round((buffer.length / 16000) * 1000) };
      if (existing) {
        await db.update(voiceoverJobsTable).set(payload).where(eq(voiceoverJobsTable.projectId, Number(projectId)));
      } else {
        await db.insert(voiceoverJobsTable).values({ projectId: Number(projectId), ...payload });
      }
    } catch {}
  }

  res.set("Content-Type", "audio/mpeg");
  res.set("Content-Length", String(buffer.length));
  res.set("Cache-Control", "no-store");
  res.send(buffer);
});

// ── /synthesize-with-timestamps — ElevenLabs → OpenAI+Whisper fallback ───────
router.post("/synthesize-with-timestamps", async (req, res) => {
  const { text, voiceStyle = "motivational_male", hook = "", body = "", cta = "" } = req.body as {
    text?: string; voiceStyle?: string; hook?: string; body?: string; cta?: string;
  };

  if (!text?.trim()) { res.status(400).json({ error: "text is required" }); return; }

  const sections = { hook, body, cta };

  // 1. Try ElevenLabs with-timestamps
  const elApiKey = process.env.ELEVENLABS_API_KEY;
  if (elApiKey) {
    try {
      const voiceId = ELEVENLABS_VOICE_MAP[voiceStyle] ?? ELEVENLABS_VOICE_MAP["motivational_male"];
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
        {
          method: "POST",
          headers: { "xi-api-key": elApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.slice(0, 5000),
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.35, use_speaker_boost: true },
          }),
        },
      );

      if (response.ok) {
        const data = await response.json() as {
          audio_base64: string;
          alignment: {
            characters: string[];
            character_start_times_seconds: number[];
            character_end_times_seconds: number[];
          };
        };
        const phrases = buildPhraseTimestamps(data.alignment, sections);
        console.log("[TTS] ElevenLabs with-timestamps OK");
        res.json({ audioBase64: data.audio_base64, phrases, mimeType: "audio/mpeg" });
        return;
      }

      const errText = await response.text().catch(() => response.statusText);
      console.warn("[TTS] ElevenLabs with-timestamps failed:", response.status, errText.slice(0, 80));
    } catch (err) {
      console.warn("[TTS] ElevenLabs with-timestamps error:", String(err).slice(0, 80));
    }
  }

  // 2. Fallback: OpenAI TTS + Whisper word timestamps
  try {
    console.log("[TTS] Falling back to OpenAI TTS + Whisper");
    const { audioBase64, phrases } = await synthesizeWithOpenAIAndTimestamps(text, voiceStyle, sections);
    console.log("[TTS] OpenAI TTS+Whisper OK, phrases:", phrases.length);
    res.json({ audioBase64, phrases, mimeType: "audio/mpeg" });
  } catch (err) {
    console.error("[TTS] OpenAI fallback failed:", err);
    res.status(500).json({ error: "Voice synthesis failed", details: String(err) });
  }
});

router.get("/:projectId", async (req, res) => {
  const projectId = Number(req.params.projectId);
  const [row] = await db.select().from(voiceoverJobsTable)
    .where(eq(voiceoverJobsTable.projectId, projectId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
