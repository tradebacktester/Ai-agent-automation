import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects,
  useDeleteProject,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  hasVideoBlob,
  downloadVideo,
  getVideoUrl,
  getMimeType,
  loadAllVideosFromDB,
  loadVideoFromDB,
  deleteVideoFromDB,
} from "@/lib/video-store";
import { Video, Plus, Trash2, ChevronRight, Search, Loader2, Download, Play, X } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-muted-foreground bg-muted",
  scripting: "text-blue-400 bg-blue-400/15",
  voicing: "text-purple-400 bg-purple-400/15",
  finding_clips: "text-yellow-400 bg-yellow-400/15",
  editing: "text-orange-400 bg-orange-400/15",
  rendering: "text-cyan-400 bg-cyan-400/15",
  done: "text-emerald-400 bg-emerald-400/15",
  failed: "text-destructive bg-destructive/15",
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube_shorts: "YT Shorts",
  tiktok: "TikTok",
  reels: "Reels",
  x_clips: "X Clips",
  all: "All",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

interface VideoPreview {
  projectId: number;
  title: string;
  url: string;
  mime: string;
}

export default function Projects() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [preview, setPreview] = useState<VideoPreview | null>(null);
  // Track which project IDs have videos available (in-memory OR IndexedDB)
  const [availableVideos, setAvailableVideos] = useState<Set<number>>(new Set());

  const { data: projects, isLoading } = useListProjects({
    status: statusFilter || undefined,
    platform: platformFilter || undefined,
  });

  const deleteProject = useDeleteProject();

  // On mount: restore all video IDs from IndexedDB into memory cache
  useEffect(() => {
    loadAllVideosFromDB().then((ids) => {
      if (ids.length > 0) {
        setAvailableVideos(new Set(ids));
      }
    });
  }, []);

  // When projects load, merge with in-memory blobs
  useEffect(() => {
    if (!projects) return;
    const doneIds = projects.filter((p) => p.status === "done").map((p) => p.id);
    const inMemory = doneIds.filter((id) => hasVideoBlob(id));
    if (inMemory.length > 0) {
      setAvailableVideos((prev) => new Set([...prev, ...inMemory]));
    }
  }, [projects]);

  async function handleDelete(id: number, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deleteProject.mutateAsync({ id });
      await deleteVideoFromDB(id);
      setAvailableVideos((prev) => { const s = new Set(prev); s.delete(id); return s; });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      toast({ title: "Project deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  async function handlePlay(id: number, title: string) {
    // 1. Try in-memory cache first
    let url = getVideoUrl(id);

    // 2. Fall back to IndexedDB
    if (!url) {
      url = await loadVideoFromDB(id);
      if (url) {
        // Update available set now that we've confirmed it's in DB
        setAvailableVideos((prev) => new Set([...prev, id]));
      }
    }

    if (!url) {
      toast({
        title: "Video not found",
        description: "This video was not saved. Re-generate it to create a new copy.",
        variant: "destructive",
      });
      return;
    }

    setPreview({ projectId: id, title, url, mime: getMimeType(id) });
  }

  const filtered = projects?.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.prompt.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{projects?.length ?? 0} total</p>
        </div>
        <Link href="/create">
          <Button data-testid="button-new-project" className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-input border-border"
          />
        </div>
        <select
          data-testid="select-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          {["pending","scripting","voicing","finding_clips","editing","rendering","done","failed"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          data-testid="select-platform-filter"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 filter"
        >
          <option value="">All Platforms</option>
          {Object.entries(PLATFORM_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl border border-border p-16 text-center">
          <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No projects found</p>
          <Link href="/create">
            <Button variant="outline" size="sm" className="mt-3 gap-2">
              <Plus className="w-3.5 h-3.5" />
              Create first project
            </Button>
          </Link>
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
          {filtered.map((project) => (
            <motion.div key={project.id} variants={item}>
              <div
                className="glass rounded-xl border border-border hover:border-primary/30 transition-colors flex items-center gap-4 px-4 py-3.5"
                data-testid={`card-project-${project.id}`}
              >
                <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{project.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{project.prompt}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">{PLATFORM_LABELS[project.platform]}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status] ?? "text-muted-foreground bg-muted"}`}>
                    {project.status.replace(/_/g, " ")}
                  </span>
                  {project.status !== "pending" && project.status !== "done" && project.status !== "failed" && (
                    <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${project.progress}%` }} />
                    </div>
                  )}
                  {project.status === "done" && availableVideos.has(project.id) && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePlay(project.id, project.title)}
                        title="Preview video"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary text-[11px] font-semibold hover:bg-primary/25 transition-colors"
                      >
                        <Play className="w-3 h-3" /> Play
                      </button>
                      <button
                        onClick={async () => {
                          // Ensure URL is loaded from IndexedDB if needed
                          if (!hasVideoBlob(project.id)) await loadVideoFromDB(project.id);
                          const ok = downloadVideo(project.id, project.title);
                          if (ok) toast({ title: "Download started" });
                          else toast({ title: "Video not found", variant: "destructive" });
                        }}
                        title="Download video"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors"
                      >
                        <Download className="w-3 h-3" /> Download
                      </button>
                    </div>
                  )}
                  <Link href={`/projects/${project.id}`}>
                    <button data-testid={`button-open-project-${project.id}`} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </Link>
                  <button
                    data-testid={`button-delete-project-${project.id}`}
                    onClick={() => handleDelete(project.id, project.title)}
                    disabled={deleteProject.isPending}
                    className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    {deleteProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Video Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground truncate pr-2">{preview.title}</p>
              <button
                onClick={() => setPreview(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Video player */}
            <div className="bg-black aspect-[9/16] w-full">
              <video
                src={preview.url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                style={{ maxHeight: "70vh" }}
              >
                <source src={preview.url} type={preview.mime} />
              </video>
            </div>
            {/* Footer */}
            <div className="flex gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={async () => {
                  if (!hasVideoBlob(preview.projectId)) await loadVideoFromDB(preview.projectId);
                  const ok = downloadVideo(preview.projectId, preview.title);
                  if (ok) toast({ title: "Download started" });
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
