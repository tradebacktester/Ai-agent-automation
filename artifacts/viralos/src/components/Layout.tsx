import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAdminAuth } from "@/contexts/AdminAuth";
import {
  LayoutDashboard, Video, FolderOpen, Settings, Zap, LogOut, Cpu,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/create", label: "Create Video", icon: Video },
  { path: "/command", label: "JARVIS AI", icon: Cpu, badge: "AI" },
  { path: "/projects", label: "Projects", icon: FolderOpen },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAdminAuth();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center glow-blue relative">
              <Zap className="w-3.5 h-3.5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-black text-foreground tracking-widest uppercase">VIRALOS</p>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">Video AI</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = location === item.path || location.startsWith(item.path + "/");
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path}>
                <motion.div
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs font-medium ${
                    active
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-primary" : ""}`} />
                  <span className="flex-1 text-[11px]">{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] px-1 py-0.5 rounded font-bold bg-primary/20 text-primary">
                      {item.badge}
                    </span>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-foreground truncate">Admin</p>
              <p className="text-[9px] text-emerald-400">● Online</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="text-muted-foreground hover:text-red-400 transition-colors p-1 rounded"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
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
