import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAdminAuth } from "@/contexts/AdminAuth";
import {
  LayoutDashboard, Video, FolderOpen, BarChart3, TrendingUp,
  Settings, Zap, Bot, Brain, Cpu, Database, Upload, FlaskConical,
  Lightbulb, DollarSign, ChevronDown, ChevronRight,
  Dna, Store, Globe, Clapperboard, Server, Film, LogOut,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "OS Core",
    items: [
      { path: "/dashboard", label: "Mission Control", icon: LayoutDashboard },
      { path: "/command", label: "JARVIS AI", icon: Cpu, badge: "AI" },
      { path: "/enterprise", label: "Enterprise Ops", icon: Server, badge: "NEW" },
    ],
  },
  {
    label: "Create",
    items: [
      { path: "/create", label: "Create Video", icon: Video },
      { path: "/cinematic", label: "Cinematic FX Engine", icon: Film, badge: "NEW" },
      { path: "/agents", label: "Agent Studio", icon: Bot },
      { path: "/strategy", label: "Strategy AI", icon: Brain },
    ],
  },
  {
    label: "Creator DNA",
    items: [
      { path: "/personality", label: "Personality Clone", icon: Dna, badge: "NEW" },
      { path: "/marketplace", label: "Style Marketplace", icon: Store },
      { path: "/brand", label: "Brand Engine", icon: Globe, badge: "NEW" },
      { path: "/universe", label: "Story Universe", icon: Clapperboard },
    ],
  },
  {
    label: "Grow & Distribute",
    items: [
      { path: "/publisher", label: "Auto Publisher", icon: Upload },
      { path: "/ab-testing", label: "A/B Testing", icon: FlaskConical },
      { path: "/trends", label: "Trend Radar", icon: TrendingUp },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { path: "/insights", label: "Self-Learning", icon: Lightbulb },
      { path: "/memory", label: "Memory Vault", icon: Database },
      { path: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Revenue",
    items: [
      { path: "/monetization", label: "Monetization", icon: DollarSign },
      { path: "/projects", label: "Projects", icon: FolderOpen },
      { path: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { logout } = useAdminAuth();

  const toggleGroup = (label: string) =>
    setCollapsed((p) => ({ ...p, [label]: !p[label] }));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center glow-blue relative">
              <Zap className="w-3.5 h-3.5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-black text-foreground tracking-widest uppercase">VIRALOS</p>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">Creator OS</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 overflow-y-auto scrollbar-none" data-testid="sidebar-nav">
          {NAV_GROUPS.map((group) => {
            const isCollapsed = collapsed[group.label];
            return (
              <div key={group.label} className="mb-0.5">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest hover:text-muted-foreground transition-colors"
                >
                  {group.label}
                  {isCollapsed ? <ChevronRight className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pb-1">
                        {group.items.map((item) => {
                          const active = location === item.path || location.startsWith(item.path + "/");
                          const Icon = item.icon;
                          return (
                            <Link key={item.path} href={item.path}>
                              <motion.div
                                whileHover={{ x: 2 }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs font-medium ${
                                  active
                                    ? "bg-primary/15 text-primary border border-primary/20"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                                }`}
                              >
                                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-primary" : ""}`} />
                                <span className="flex-1 truncate text-[11px]">{item.label}</span>
                                {item.badge && (
                                  <span className={`ml-auto text-[9px] px-1 py-0.5 rounded font-bold tracking-wide ${
                                    item.badge === "AI" ? "bg-primary/20 text-primary"
                                    : item.badge === "NEW" ? "bg-emerald-400/15 text-emerald-400"
                                    : "bg-muted/50 text-muted-foreground"
                                  }`}>
                                    {item.badge}
                                  </span>
                                )}
                              </motion.div>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Admin + system status */}
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-foreground truncate">Admin</p>
              <p className="text-[9px] text-emerald-400 flex items-center gap-1">● Autonomous · Online</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="text-muted-foreground hover:text-red-400 transition-colors p-1 rounded"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[["Agents", "8"], ["Loop", "ON"], ["Auto", "✓"]].map(([label, val]) => (
              <div key={label} className="text-center p-1 rounded-lg bg-muted/30">
                <p className="text-[10px] font-black text-foreground">{val}</p>
                <p className="text-[8px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto bg-background">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
