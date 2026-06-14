import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "ViralosVideoGallery";
const DB_VERSION = 1;
const STORE = "videos";

interface VideoEntry {
  blob: Blob;
  mimeType: string;
  savedAt: number;
}

let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
  return _db;
}

// ── In-memory URL cache (avoids re-creating object URLs repeatedly) ──────────
const urlCache = new Map<number, string>();
const mimeCache = new Map<number, string>();

// ── Public API ────────────────────────────────────────────────────────────────

/** Save a video blob — persists to IndexedDB and updates in-memory cache. */
export async function storeVideoBlob(projectId: number, blob: Blob): Promise<string> {
  const existing = urlCache.get(projectId);
  if (existing) URL.revokeObjectURL(existing);

  const url = URL.createObjectURL(blob);
  urlCache.set(projectId, url);
  mimeCache.set(projectId, blob.type || "video/webm");

  try {
    const db = await getDB();
    const entry: VideoEntry = { blob, mimeType: blob.type || "video/webm", savedAt: Date.now() };
    await db.put(STORE, entry, projectId);
  } catch (err) {
    console.warn("[video-store] IndexedDB save failed:", err);
  }

  try {
    sessionStorage.setItem(`viralos_video_${projectId}`, "ready");
  } catch {}

  return url;
}

/**
 * Get a blob URL for a project. Returns cached URL if available.
 * Returns null if not in memory — caller should use loadVideoFromDB() to restore.
 */
export function getVideoUrl(projectId: number): string | null {
  return urlCache.get(projectId) ?? null;
}

export function getMimeType(projectId: number): string {
  return mimeCache.get(projectId) ?? "video/webm";
}

export function hasVideoBlob(projectId: number): boolean {
  return urlCache.has(projectId);
}

/**
 * Load a single video from IndexedDB into the in-memory cache.
 * Returns a blob URL, or null if not found.
 */
export async function loadVideoFromDB(projectId: number): Promise<string | null> {
  if (urlCache.has(projectId)) return urlCache.get(projectId)!;

  try {
    const db = await getDB();
    const entry = await db.get(STORE, projectId) as VideoEntry | undefined;
    if (!entry) return null;

    const url = URL.createObjectURL(entry.blob);
    urlCache.set(projectId, url);
    mimeCache.set(projectId, entry.mimeType);
    return url;
  } catch (err) {
    console.warn("[video-store] IndexedDB load failed:", err);
    return null;
  }
}

/**
 * Load ALL saved project IDs from IndexedDB.
 * Call this on gallery mount to restore videos from previous sessions.
 */
export async function loadAllVideosFromDB(): Promise<number[]> {
  try {
    const db = await getDB();
    const keys = await db.getAllKeys(STORE) as number[];
    return keys;
  } catch (err) {
    console.warn("[video-store] IndexedDB getAllKeys failed:", err);
    return [];
  }
}

/** Delete a video from IndexedDB and in-memory cache. */
export async function deleteVideoFromDB(projectId: number): Promise<void> {
  const url = urlCache.get(projectId);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(projectId);
  mimeCache.delete(projectId);

  try {
    const db = await getDB();
    await db.delete(STORE, projectId);
  } catch (err) {
    console.warn("[video-store] IndexedDB delete failed:", err);
  }
}

export function downloadVideo(projectId: number, title: string): boolean {
  const url = urlCache.get(projectId);
  if (!url) return false;
  const mime = mimeCache.get(projectId) ?? "video/webm";
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  const safe = title.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 40);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}_viralos.${ext}`;
  a.click();
  return true;
}
