import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Loader2, ChevronRight, Target, Sparkles, TrendingUp,
  BookOpen, Zap, Calendar, Copy, RefreshCw, CheckCircle, BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StrategyResult {
  data?: {
    contentPillars?: Array<{
      name: string;
      description: string;
      content_types: string[];
      posting_frequency: string;
      viral_angle?: string;
    }>;
    postingSchedule?: Array<{
      day: string; time: string; platform: string;
      content_type: string; rationale?: string;
    }>;
    hookStrategies?: string[];
    emotionalPositioning?: string;
    nicheAnalysis?: string;
    dominationPlan?: string;
    keyMessages?: string[];
    competitiveEdge?: string;
    weeklyContentMap?: Array<{ week: number; theme: string; keyContent: string[] }>;
    growthMetrics?: { week4: string; week8: string; week12: string };
  };
  success?: boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube_shorts: "bg-red-400/10 text-red-400 border-red-400/20",
  reels: "bg-violet-400/10 text-violet-400 border-violet-400/20",
};

const EXAMPLE_NICHES = [
  "Dark motivation", "Finance & wealth", "Fitness transformation",
  "Tech reviews", "True crime", "Self improvement",
  "Luxury lifestyle", "Anime edits", "Stoicism",
];

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); }}
      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
      <Copy className="w-3 h-3" />
    </button>
  );
}

export default function StrategyPage() {
  const { toast } = useToast();
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["youtube_shorts", "reels"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [tab, setTab] = useState<"pillars" | "schedule" | "hooks" | "plan" | "growth">("pillars");

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? (prev.length > 1 ? prev.filter((x) => x !== p) : prev) : [...prev, p]
    );
  };

  const generate = async () => {
    if (!niche.trim() || !goal.trim()) {
      toast({ title: "Enter your niche and goal", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/agents/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, goal, platforms }),
      });
      const data = await res.json() as StrategyResult;
      setResult(data);
      setTab("pillars");
      toast({
        title: "Strategy generated!",
        description: `${data.data?.contentPillars?.length ?? 0} content pillars · ${data.data?.hookStrategies?.length ?? 0} hooks`,
      });
    } catch {
      toast({ title: "Strategy generation failed — check API connection", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" /> Content Strategy Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Type your niche — Groq AI builds your complete niche domination plan</p>
        </div>
        {result && (
          <button onClick={() => { setResult(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> New Strategy
          </button>
        )}
      </div>

      {/* Input panel */}
      <div className="glass rounded-xl border border-border p-5 space-y-4">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Your Niche</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {EXAMPLE_NICHES.map((n) => (
              <button key={n} onClick={() => setNiche(n)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${niche === n ? "bg-primary/15 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"}`}>
                {n}
              </button>
            ))}
          </div>
          <input value={niche} onChange={(e) => setNiche(e.target.value)}
            placeholder="Or type your own niche..."
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Your Goal</label>
          <input value={goal} onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Grow a dark motivation page to 100k followers in 90 days"
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Platforms</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "youtube_shorts", label: "YouTube Shorts", desc: "60s max · High retention" },
              { value: "reels", label: "Instagram Reels", desc: "60s max · High shareability" },
            ].map((p) => (
              <button key={p.value} onClick={() => togglePlatform(p.value)}
                className={`px-4 py-3 rounded-xl border text-xs font-medium transition-colors text-left ${platforms.includes(p.value) ? "bg-primary/15 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/20"}`}>
                <p className="font-semibold">{p.label}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <button onClick={generate} disabled={loading || !niche.trim() || !goal.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 glow-blue">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Groq AI building strategy...</>
            : <><Sparkles className="w-4 h-4" /> Generate Strategy</>}
        </button>
      </div>

      {/* Results */}
      <AnimatePresence>
        {result?.data && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Top-line metrics */}
            {result.data.growthMetrics && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Week 4 Target", value: result.data.growthMetrics.week4, color: "text-primary" },
                  { label: "Week 8 Target", value: result.data.growthMetrics.week8, color: "text-emerald-400" },
                  { label: "Week 12 Goal", value: result.data.growthMetrics.week12, color: "text-yellow-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="glass rounded-xl border border-border p-4 text-center">
                    <p className={`text-lg font-black ${color}`}>{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Positioning + Edge */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.data.emotionalPositioning && (
                <div className="glass rounded-xl border border-primary/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-primary" />
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Emotional Positioning</p>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{result.data.emotionalPositioning}</p>
                </div>
              )}
              {result.data.competitiveEdge && (
                <div className="glass rounded-xl border border-emerald-400/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Competitive Edge</p>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{result.data.competitiveEdge}</p>
                </div>
              )}
            </div>

            {/* Key Messages */}
            {result.data.keyMessages && result.data.keyMessages.length > 0 && (
              <div className="glass rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Core Brand Messages</p>
                  <CopyButton text={result.data.keyMessages.join("\n")} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.data.keyMessages.map((m, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-muted/50 border border-border text-foreground">
                      "{m}"
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
              {([
                ["pillars", "Content Pillars", BookOpen],
                ["schedule", "Posting Schedule", Calendar],
                ["hooks", "Hook Strategies", Zap],
                ["plan", "Domination Plan", Brain],
                ...(result.data.weeklyContentMap ? [["growth", "Growth Map", BarChart3]] : []),
              ] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setTab(id as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>

            {/* Content Pillars */}
            {tab === "pillars" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.data.contentPillars?.map((pillar, i) => (
                  <div key={i} className="glass rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-semibold text-foreground">{pillar.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0 ml-2">{pillar.posting_frequency}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{pillar.description}</p>
                    {pillar.viral_angle && (
                      <p className="text-xs text-primary/80 mb-2 flex items-start gap-1">
                        <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />{pillar.viral_angle}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {pillar.content_types.map((ct, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground">{ct}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Posting Schedule */}
            {tab === "schedule" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {result.data.postingSchedule?.map((slot, i) => (
                  <div key={i} className="glass rounded-lg border border-border p-3 flex items-start gap-4">
                    <span className="text-sm font-semibold text-foreground w-24 shrink-0">{slot.day}</span>
                    <span className="text-sm text-primary font-mono w-20 shrink-0">{slot.time}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${PLATFORM_COLORS[slot.platform] ?? "bg-muted/50 text-muted-foreground border-border"}`}>
                      {slot.platform === "youtube_shorts" ? "YT Shorts" : slot.platform === "reels" ? "Reels" : slot.platform}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{slot.content_type}</p>
                      {slot.rationale && <p className="text-[10px] text-muted-foreground mt-0.5">{slot.rationale}</p>}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Hook Strategies */}
            {tab === "hooks" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {result.data.hookStrategies?.map((hook, i) => (
                  <div key={i} className="glass rounded-lg border border-yellow-400/20 p-3 flex items-start gap-3">
                    <span className="text-xs font-bold text-yellow-400 w-5 shrink-0">#{i + 1}</span>
                    <p className="text-sm text-foreground flex-1">{hook}</p>
                    <CopyButton text={hook} />
                  </div>
                ))}
              </motion.div>
            )}

            {/* Domination Plan */}
            {tab === "plan" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass rounded-xl border border-primary/20 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold text-primary">90-Day Niche Domination Plan</p>
                  </div>
                  {result.data.dominationPlan && <CopyButton text={result.data.dominationPlan} />}
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{result.data.dominationPlan}</p>
                {result.data.nicheAnalysis && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Niche Analysis</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.data.nicheAnalysis}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Growth Map */}
            {tab === "growth" && result.data.weeklyContentMap && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {result.data.weeklyContentMap.map((week) => (
                  <div key={week.week} className="glass rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-primary">W{week.week}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{week.theme}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {week.keyContent.map((c, i) => (
                        <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-muted/50 border border-border text-muted-foreground">
                          {c}
                        </span>
                      ))}
                    </div>
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
