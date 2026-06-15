import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Brain, Eye, Zap, Target, Type, TrendingUp, Sparkles,
  Play, ChevronRight, CheckCircle, Loader2, AlertCircle, BarChart3,
  RefreshCw, Activity, Copy, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AGENTS = [
  {
    id: "trend", name: "Trend Agent", icon: TrendingUp,
    color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20",
    description: "Scans YouTube, Instagram, Reddit & Google for rising trends, viral sounds, and emotional patterns.",
    capabilities: ["Rising trend detection", "Viral sound analysis", "Emotional pattern mapping", "Daily trend reports"],
  },
  {
    id: "hook", name: "Hook Agent", icon: Zap,
    color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20",
    description: "Obsessed with the first 2 seconds. Generates 10 hook variations ranked by predicted retention.",
    capabilities: ["Curiosity gap creation", "Emotional triggers", "Controversy openings", "Attention capture"],
  },
  {
    id: "emotion", name: "Emotion Agent", icon: Brain,
    color: "text-pink-400", bg: "bg-pink-400/10", border: "border-pink-400/20",
    description: "Controls emotional pacing, tension building, and dopamine spikes for maximum bingeability.",
    capabilities: ["Emotion arc mapping", "Dopamine spike timing", "Tension building", "Replay optimization"],
  },
  {
    id: "visual", name: "Visual Director", icon: Eye,
    color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20",
    description: "Creates cinematic storyboards, camera movement plans, and color tone strategies.",
    capabilities: ["Cinematic storyboard", "Camera motion", "Color palette", "Scene intensity map"],
  },
  {
    id: "retention", name: "Retention Agent", icon: Activity,
    color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20",
    description: "Analyzes boring sections and pacing drops, then auto-inserts pattern interrupts.",
    capabilities: ["Dead moment detection", "Pacing optimization", "Pattern interrupts", "Weak transition fixes"],
  },
  {
    id: "caption", name: "Caption Agent", icon: Type,
    color: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/20",
    description: "Creates Hormozi-style, dark cinematic, anime edit, and dopamine typography captions.",
    capabilities: ["Alex Hormozi style", "Dark cinematic", "Anime edit subs", "Dopamine typography"],
  },
  {
    id: "virality", name: "Virality Engine", icon: BarChart3,
    color: "text-primary", bg: "bg-primary/10", border: "border-primary/20",
    description: "Predicts viral probability across 6 dimensions: hook, emotion, curiosity, replay, retention, shareability.",
    capabilities: ["Viral probability score", "Hook strength", "Retention prediction", "Shareability score"],
  },
  {
    id: "memory", name: "AI Memory", icon: Sparkles,
    color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20",
    description: "Remembers best-performing hooks, pacing styles, caption styles, and audience preferences across sessions.",
    capabilities: ["Hook memory bank", "Pacing style recall", "Caption preferences", "Cross-session learning"],
  },
];

type RunMode = "full_pipeline" | "hooks_only" | "virality_check" | "visual_only" | "captions_only";

interface AgentRunResult {
  runId?: number;
  status: string;
  hooks?: {
    topHook?: { hook: string; predicted_retention: number; style: string };
    hooks?: Array<{ hook: string; rank: number; predicted_retention: number; style: string; emotional_trigger: string }>;
    allHooks?: Array<{ hook: string; rank: number; predicted_retention: number; style: string; emotional_trigger: string }>;
  };
  emotion?: {
    bingeabilityScore?: number; replayScore?: number;
    dopamineSpikes?: number[]; tensionPoints?: string[];
    arc?: string; emotionArc?: string[];
  };
  virality?: {
    viral_probability?: number; hook_score?: number;
    retention_prediction?: string; strengths?: string[];
    weaknesses?: string[]; recommendations?: string[];
  };
  visuals?: {
    storyboard?: Array<{ scene: string; camera_motion: string; emotion: string; visual_style: string }>;
    overallTone?: string; colorStrategy?: string;
  };
  retention?: {
    retentionScore?: number;
    patternInterrupts?: Array<{ type: string; description: string }>;
    optimizedScript?: string;
    boringSegments?: unknown[];
  };
  captions?: { captionSets?: Array<{ style: string; styleDescription: string; captions?: string[] }>; recommendedStyle?: string };
  allLogs?: Array<{ agent: string; message: string; timestamp: string }>;
  error?: string;
}

interface TrendData {
  risingTrends?: Array<{ topic: string; platform: string; momentum: string; emotional_pattern: string }>;
  viralSounds?: string[];
  summary?: string;
}

const viralColor = (score: number) => score >= 75 ? "text-emerald-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
const viralBg = (score: number) => score >= 75 ? "bg-emerald-400" : score >= 50 ? "bg-yellow-400" : "bg-red-400";

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); }}
      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
      <Copy className="w-3 h-3" />
    </button>
  );
}

export default function AgentStudio() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("youtube_shorts");
  const [niche, setNiche] = useState("");
  const [mode, setMode] = useState<RunMode>("full_pipeline");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [activeTab, setActiveTab] = useState<"hooks" | "emotion" | "visuals" | "virality" | "captions" | "logs">("virality");
  const [trendScanning, setTrendScanning] = useState(false);
  const [trendResult, setTrendResult] = useState<TrendData | null>(null);
  const [liveAgentLogs, setLiveAgentLogs] = useState<Array<{ agent: string; message: string; timestamp: string }>>([]);

  const runAgents = async () => {
    if (!prompt.trim()) { toast({ title: "Enter a video concept", variant: "destructive" }); return; }
    setRunning(true);
    setResult(null);
    setLiveAgentLogs([]);

    const agentSteps = [
      { agent: "Trend Agent", message: "Scanning YouTube & Instagram for rising trends and viral signals..." },
      { agent: "Hook Agent", message: "Engineering 10 hook variations — curiosity gaps, emotional triggers..." },
      { agent: "Emotion Agent", message: "Mapping emotional arc and dopamine spike points across the script..." },
      { agent: "Visual Director", message: "Composing cinematic storyboard and color strategy..." },
      { agent: "Retention Agent", message: "Analyzing pacing, detecting dead zones, inserting pattern interrupts..." },
      { agent: "Caption Agent", message: "Generating Hormozi-style, dark cinematic, and anime caption sets..." },
      { agent: "Virality Engine", message: "Computing viral probability across 6 dimensions with Groq AI..." },
      { agent: "AI Memory", message: "Storing high-performance patterns to cross-session memory bank..." },
    ];

    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      if (stepIdx < agentSteps.length) {
        setLiveAgentLogs((prev) => [...prev, { ...agentSteps[stepIdx], timestamp: new Date().toISOString() }]);
        stepIdx++;
      }
    }, 900);

    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platform, niche: niche || undefined, mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as AgentRunResult;
      setResult(data);
      if (data.virality) setActiveTab("virality");
      else if (data.hooks) setActiveTab("hooks");
      toast({ title: data.status === "completed" ? "All agents completed!" : "Pipeline finished", description: data.runId ? `Run #${data.runId}` : undefined });
    } catch {
      toast({ title: "Agent run failed — check API connection", variant: "destructive" });
    } finally {
      clearInterval(stepInterval);
      setRunning(false);
    }
  };

  const scanTrends = async () => {
    setTrendScanning(true);
    try {
      const res = await fetch("/api/agents/trends/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: [platform] }),
      });
      const data = await res.json();
      if (data?.data) {
        setTrendResult(data.data as TrendData);
        toast({ title: "Trend scan complete!", description: `${data.data.risingTrends?.length ?? 0} trends detected` });
      } else {
        toast({ title: "Trend scan returned no data", variant: "destructive" });
      }
    } catch {
      toast({ title: "Trend scan failed — check API connection", variant: "destructive" });
    } finally {
      setTrendScanning(false);
    }
  };

  const tabs = [
    { id: "virality" as const, label: "Virality", show: !!result?.virality },
    { id: "hooks" as const, label: "Hooks", show: !!result?.hooks },
    { id: "emotion" as const, label: "Emotion", show: !!result?.emotion },
    { id: "visuals" as const, label: "Visuals", show: !!result?.visuals },
    { id: "captions" as const, label: "Captions", show: !!result?.captions },
    { id: "logs" as const, label: "Logs", show: !!(result?.allLogs?.length) },
  ].filter((t) => t.show);

  const allHooks = result?.hooks?.allHooks ?? result?.hooks?.hooks ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" /> AI Agent Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">8-agent autonomous content pipeline — Groq / Llama 3.3 powered</p>
        </div>
        <button onClick={scanTrends} disabled={trendScanning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
          {trendScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Scan Trends
        </button>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <motion.div key={agent.id} whileHover={{ y: -2, scale: 1.01 }}
              className={`glass rounded-xl border ${agent.border} p-4 cursor-default`}>
              <div className={`w-8 h-8 rounded-lg ${agent.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${agent.color}`} />
              </div>
              <p className="text-xs font-semibold text-foreground">{agent.name}</p>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Trend scan result */}
      <AnimatePresence>
        {trendResult && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="glass rounded-xl border border-emerald-400/20 p-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Live Trend Report
            </h3>
            {trendResult.summary && <p className="text-xs text-muted-foreground mb-3">{trendResult.summary}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trendResult.risingTrends && trendResult.risingTrends.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rising Trends</p>
                  <div className="space-y-1.5">
                    {trendResult.risingTrends.slice(0, 6).map((t, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${t.momentum === "rising" || t.momentum === "viral" ? "bg-emerald-400/15 text-emerald-400" : "bg-yellow-400/15 text-yellow-400"}`}>
                          {t.momentum}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-foreground truncate">{t.topic}</p>
                          {t.emotional_pattern && <p className="text-[9px] text-muted-foreground/70">{t.emotional_pattern}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {trendResult.viralSounds && trendResult.viralSounds.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Viral Sounds</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trendResult.viralSounds.slice(0, 8).map((s, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Run Panel */}
      <div className="glass rounded-xl border border-border p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" /> Run Agent Pipeline
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Video Concept / Prompt</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Why most people never achieve their goals — dark motivation"
              rows={2}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none" />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Platform</label>
            <div className="flex gap-2">
              {[
                { value: "youtube_shorts", label: "YouTube Shorts" },
                { value: "reels", label: "Instagram Reels" },
              ].map((p) => (
                <button key={p.value} onClick={() => setPlatform(p.value)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${platform === p.value ? "bg-primary/15 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Niche (optional)</label>
            <input value={niche} onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. dark motivation, finance, fitness"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Agent Mode</label>
            <div className="flex flex-wrap gap-2">
              {([
                ["full_pipeline", "Full Pipeline", "All 8 agents · Groq AI"],
                ["hooks_only", "Hooks Only", "Hook Agent"],
                ["virality_check", "Virality Check", "Emotion + Virality"],
                ["visual_only", "Visual Only", "Visual Director"],
                ["captions_only", "Captions Only", "Caption Agent"],
              ] as const).map(([val, label, sub]) => (
                <button key={val} onClick={() => setMode(val)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${mode === val ? "bg-primary/15 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"}`}>
                  {label}
                  <span className="block text-[10px] opacity-60">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={runAgents} disabled={running || !prompt.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed glow-blue">
          {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Agents...</>
            : <><Play className="w-4 h-4" /> Run Agents</>}
        </button>
      </div>

      {/* Live Agent Activity Log */}
      <AnimatePresence>
        {(running || liveAgentLogs.length > 0) && !result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-xl border border-primary/20 bg-primary/3 p-5"
          >
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className={`w-3.5 h-3.5 ${running ? "animate-pulse" : ""}`} />
              Live Agent Pipeline
              {running && <span className="ml-auto text-[10px] font-normal text-muted-foreground">Processing...</span>}
            </p>
            <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-none">
              {liveAgentLogs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2.5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  <span className="text-[10px] font-bold text-primary shrink-0 min-w-[90px]">{log.agent}</span>
                  <span className="text-[11px] text-muted-foreground">{log.message}</span>
                </motion.div>
              ))}
              {running && liveAgentLogs.length === 0 && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                  Initializing 8-agent Groq AI pipeline...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${
              result.status === "completed" ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
              : result.status === "failed" ? "bg-red-400/10 border-red-400/20 text-red-400"
              : "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
            }`}>
              {result.status === "completed" ? <CheckCircle className="w-4 h-4" />
                : result.status === "failed" ? <AlertCircle className="w-4 h-4" />
                : <Loader2 className="w-4 h-4 animate-spin" />}
              Run #{result.runId ?? "—"} — {result.status}
              {result.error && <span className="ml-2 opacity-75 text-xs">: {result.error}</span>}
            </div>

            {tabs.length > 0 && (
              <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Virality Tab ── */}
            {activeTab === "virality" && result.virality && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="glass rounded-xl border border-border p-6">
                  <div className="flex items-center gap-6 mb-6">
                    <div className="text-center">
                      <div className={`text-5xl font-black ${viralColor(result.virality.viral_probability ?? 0)}`}>
                        {result.virality.viral_probability ?? 0}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Viral Probability</div>
                      <div className={`mt-2 h-2 w-full rounded-full bg-muted/30 overflow-hidden`}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.virality.viral_probability ?? 0}%` }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          className={`h-full rounded-full ${viralBg(result.virality.viral_probability ?? 0)}`}
                        />
                      </div>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      {[
                        ["Hook", (result.virality as any).hook_score],
                        ["Emotion", (result.virality as any).emotion_score],
                        ["Curiosity", (result.virality as any).curiosity_gap],
                        ["Replay", (result.virality as any).replay_potential],
                        ["Shareability", (result.virality as any).shareability],
                        ["Retention", result.virality.retention_prediction],
                      ].map(([label, val]) => (
                        <div key={label as string} className="glass rounded-lg p-2 text-center">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="text-sm font-bold text-foreground mt-0.5">
                            {typeof val === "number" ? `${val}/10` : val ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {result.virality.strengths && result.virality.strengths.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">Strengths</p>
                        {result.virality.strengths.map((s, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 mb-1.5">
                            <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />{s}
                          </p>
                        ))}
                      </div>
                    )}
                    {result.virality.weaknesses && result.virality.weaknesses.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">Weaknesses</p>
                        {result.virality.weaknesses.map((w, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 mb-1.5">
                            <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{w}
                          </p>
                        ))}
                      </div>
                    )}
                    {result.virality.recommendations && result.virality.recommendations.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">Recommendations</p>
                        {result.virality.recommendations.map((r, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 mb-1.5">
                            <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />{r}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Hooks Tab ── */}
            {activeTab === "hooks" && result.hooks && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {result.hooks.topHook && (
                  <div className="glass rounded-xl border border-yellow-400/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">
                          #1 Hook — {result.hooks.topHook.predicted_retention}/10 retention score
                        </span>
                      </div>
                      <CopyButton text={result.hooks.topHook.hook} />
                    </div>
                    <p className="text-lg font-bold text-foreground">"{result.hooks.topHook.hook}"</p>
                    <span className="text-[10px] text-muted-foreground mt-1 inline-block">{result.hooks.topHook.style}</span>
                  </div>
                )}
                {allHooks.map((h, i) => (
                  <div key={i} className="glass rounded-lg border border-border p-3 flex items-start gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 pt-0.5">#{h.rank ?? i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">"{h.hook}"</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{h.style}</span>
                        {h.emotional_trigger && <><span className="text-[10px] text-muted-foreground">·</span><span className="text-[10px] text-muted-foreground">{h.emotional_trigger}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`text-sm font-bold ${h.predicted_retention >= 8 ? "text-emerald-400" : h.predicted_retention >= 6 ? "text-yellow-400" : "text-muted-foreground"}`}>
                        {h.predicted_retention}/10
                      </div>
                      <CopyButton text={h.hook} />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* ── Emotion Tab ── */}
            {activeTab === "emotion" && result.emotion && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Bingeability", val: result.emotion.bingeabilityScore, color: "text-pink-400", border: "border-pink-400/20" },
                    { label: "Replay Score", val: result.emotion.replayScore, color: "text-purple-400", border: "border-purple-400/20" },
                    { label: "Dopamine Spikes", val: result.emotion.dopamineSpikes?.length, color: "text-amber-400", border: "border-amber-400/20" },
                  ].map(({ label, val, color, border }) => (
                    <div key={label} className={`glass rounded-xl border ${border} p-4 text-center`}>
                      <div className={`text-3xl font-black ${color}`}>{val ?? 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                {result.emotion.arc && (
                  <div className="glass rounded-xl border border-border p-4">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Emotional Arc</p>
                    <p className="text-sm text-foreground">{result.emotion.arc}</p>
                  </div>
                )}
                {result.emotion.tensionPoints && result.emotion.tensionPoints.length > 0 && (
                  <div className="glass rounded-xl border border-border p-4">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tension Points</p>
                    <div className="space-y-1.5">
                      {result.emotion.tensionPoints.map((tp, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-pink-400 w-4 shrink-0 pt-0.5">#{i + 1}</span>
                          <p className="text-xs text-foreground">{tp}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Visuals Tab ── */}
            {activeTab === "visuals" && result.visuals && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {(result.visuals.overallTone || result.visuals.colorStrategy) && (
                  <div className="grid grid-cols-2 gap-3">
                    {result.visuals.overallTone && (
                      <div className="glass rounded-xl border border-cyan-400/20 p-4">
                        <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1">Overall Tone</p>
                        <p className="text-sm text-foreground">{result.visuals.overallTone}</p>
                      </div>
                    )}
                    {result.visuals.colorStrategy && (
                      <div className="glass rounded-xl border border-violet-400/20 p-4">
                        <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-1">Color Strategy</p>
                        <p className="text-sm text-foreground">{result.visuals.colorStrategy}</p>
                      </div>
                    )}
                  </div>
                )}
                {result.visuals.storyboard && result.visuals.storyboard.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Storyboard</p>
                    {result.visuals.storyboard.map((scene, i) => (
                      <div key={i} className="glass rounded-lg border border-border p-3 flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">{scene.scene}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {scene.camera_motion && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400">{scene.camera_motion}</span>}
                            {scene.emotion && <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-400/10 text-pink-400">{scene.emotion}</span>}
                            {scene.visual_style && <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400">{scene.visual_style}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Captions Tab ── */}
            {activeTab === "captions" && result.captions && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {result.captions.recommendedStyle && (
                  <div className="glass rounded-xl border border-violet-400/20 p-3">
                    <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-1">Recommended Style</p>
                    <p className="text-sm font-bold text-foreground">{result.captions.recommendedStyle}</p>
                  </div>
                )}
                {result.captions.captionSets?.map((set, i) => (
                  <div key={i} className="glass rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-foreground">{set.style}</p>
                      {set.captions && set.captions.length > 0 && (
                        <CopyButton text={set.captions.join("\n")} />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2">{set.styleDescription}</p>
                    {set.captions && set.captions.length > 0 && (
                      <div className="space-y-1">
                        {set.captions.slice(0, 3).map((c, j) => (
                          <p key={j} className="text-xs text-foreground font-medium border-l-2 border-primary/30 pl-2">{c}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            {/* ── Logs Tab ── */}
            {activeTab === "logs" && result.allLogs && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass rounded-xl border border-border p-4 space-y-2 max-h-80 overflow-y-auto">
                {result.allLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 py-1.5 border-b border-border/50">
                    <span className="text-[9px] font-mono text-muted-foreground/50 shrink-0 pt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] font-bold text-primary shrink-0">{log.agent}</span>
                    <span className="text-[10px] text-muted-foreground">{log.message}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
