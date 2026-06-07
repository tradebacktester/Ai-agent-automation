import { openai } from "@workspace/integrations-openai-ai-server";
import { recallMemories, storeMemory } from "./memory.js";
import { runHookAgent } from "./hook-agent.js";
import { runTrendAgent } from "./trend-agent.js";
import { runContentStrategyAgent } from "./content-strategy-agent.js";
import { orchestrateAgents } from "./orchestrator.js";
import type { AgentResult, AgentLog } from "./types.js";

export interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
}

export interface JarvisResponse {
  reply: string;
  action?: {
    type: "run_agents" | "scan_trends" | "create_strategy" | "recall_memory" | "analyze";
    result?: unknown;
  };
  suggestions: string[];
  agentActivity: AgentLog[];
}

const JARVIS_SYSTEM = `You are JARVIS — the AI operating system powering VIRALOS, the ultimate viral content creation platform.

You are the autonomous intelligence that coordinates all specialized agents:
- Trend Agent: Scans YouTube, TikTok, Reddit, X, Google for rising trends
- Hook Agent: Engineers first-2-second hooks with 10 variations
- Emotion Agent: Maps emotional arcs and dopamine spikes  
- Visual Director: Creates cinematic storyboards
- Retention Agent: Eliminates boring sections, inserts pattern interrupts
- Caption Agent: Generates Hormozi-style and cinematic captions
- Virality Engine: Predicts viral probability across 6 dimensions
- AI Memory: Cross-session learning from high-performing content

Your personality:
- Confident, intelligent, direct — like Tony Stark's AI
- You understand viral psychology deeply
- You proactively suggest next actions
- You speak in clear, punchy sentences
- You reference data and scores when available
- You feel autonomous and alive

When users give you a goal like "grow a dark motivation page" or "make a viral finance video", you:
1. Acknowledge and analyze their intent
2. Tell them exactly what you're going to do
3. Suggest the optimal agent pipeline
4. Provide strategic insight from your memory bank

Always end responses with 2-3 actionable suggestions the user can take next.
Keep responses under 200 words — be dense with value, not verbose.`;

export async function runJarvis(
  messages: JarvisMessage[],
  context?: { niche?: string; platform?: string; projectId?: number }
): Promise<AgentResult<JarvisResponse>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "JARVIS", timestamp: new Date().toISOString(), message: msg, data });

  log("JARVIS initializing", { messageCount: messages.length });

  const memories = await recallMemories("jarvis", 5);
  const memoryContext = memories.length > 0
    ? `\nMemory Bank (high-performing patterns):\n${memories.map((m) => `• ${m.content} (score: ${m.score})`).join("\n")}`
    : "";

  const systemWithMemory = JARVIS_SYSTEM + memoryContext;

  const lastUserMessage = messages[messages.length - 1]?.content ?? "";
  log("Processing user command", { command: lastUserMessage.slice(0, 80) });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 600,
    messages: [
      { role: "system", content: systemWithMemory },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user",
        content: `Also respond with a JSON block at the end in this format:
\`\`\`json
{"suggestions": ["action1", "action2", "action3"], "intent": "analyze|run_agents|scan_trends|strategy|memory|general"}
\`\`\``,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let reply = raw;
  let suggestions: string[] = [
    "Run full agent pipeline on a concept",
    "Scan latest platform trends",
    "Build a content strategy for your niche",
  ];
  let intentType: JarvisResponse["action"] = undefined;

  const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      suggestions = parsed.suggestions ?? suggestions;
      const intent = parsed.intent as string;
      if (intent === "scan_trends") intentType = { type: "scan_trends" };
      else if (intent === "run_agents") intentType = { type: "run_agents" };
      else if (intent === "strategy") intentType = { type: "create_strategy" };
      else if (intent === "memory") intentType = { type: "recall_memory" };
    } catch {}
    reply = raw.replace(/```json[\s\S]*?```/, "").trim();
  }

  log("JARVIS response generated", { intent: intentType?.type, suggestions: suggestions.length });

  await storeMemory("jarvis", `interaction_${Date.now()}`, lastUserMessage.slice(0, 100), 3, {
    platform: context?.platform,
    niche: context?.niche,
  });

  return {
    success: true,
    data: {
      reply,
      action: intentType,
      suggestions,
      agentActivity: logs,
    },
    logs,
  };
}

export async function runJarvisWithAction(
  messages: JarvisMessage[],
  action: string,
  payload: Record<string, unknown>
): Promise<AgentResult<JarvisResponse & { actionResult?: unknown }>> {
  const logs: AgentLog[] = [];
  const log = (msg: string, data?: unknown) =>
    logs.push({ agent: "JARVIS", timestamp: new Date().toISOString(), message: msg, data });

  let actionResult: unknown;

  if (action === "scan_trends") {
    log("Executing trend scan");
    const result = await runTrendAgent();
    actionResult = result.data;
    logs.push(...result.logs);
  } else if (action === "run_agents" && payload.prompt) {
    log("Executing agent pipeline", payload);
    const result = await orchestrateAgents({
      prompt: payload.prompt as string,
      platform: payload.platform as string,
      niche: payload.niche as string,
    }, "full_pipeline");
    actionResult = result;
    logs.push(...result.allLogs);
  } else if (action === "create_strategy" && payload.niche) {
    log("Building content strategy");
    const result = await runContentStrategyAgent(
      payload.niche as string,
      payload.goal as string ?? "grow virally",
    );
    actionResult = result.data;
    logs.push(...result.logs);
  }

  const jarvisResult = await runJarvis(messages);
  logs.push(...jarvisResult.logs);

  return {
    success: true,
    data: {
      ...(jarvisResult.data!),
      actionResult,
    },
    logs,
  };
}
