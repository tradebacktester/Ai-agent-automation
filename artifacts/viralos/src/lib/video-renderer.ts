export interface VideoScript {
  title: string;
  hook: string;
  body: string;
  cta: string;
  videoStyle?: string;
}

export interface BrollClip {
  url: string;
  duration: number;
  thumbnail?: string;
}

export interface WordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
}

export interface PhraseTimestamp {
  phrase: string;
  words?: WordTimestamp[];
  startSec: number;
  endSec: number;
  isHook: boolean;
  isCTA: boolean;
}

export interface RenderMetadata {
  clipsRequested: number;
  clipsLoaded: number;
  clipDurations: number[];
  totalDuration: number;
  fps: number;
  style: string;
  captionPhrases: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const FPS      = 24;           // 24fps — smooth enough, 20% less CPU than 30
const W        = 540;
const H        = 960;
const MAX_CLIPS = 8;           // cap: more than 8 adds diminishing returns
const CLIP_CAP_SEC = 10;       // max seconds per clip before sequencer cuts

// Pre-built font strings — avoids repeated string concat every frame
const FONT_HOOK  = `900 60px system-ui,-apple-system,sans-serif`;
const FONT_BODY  = `900 52px system-ui,-apple-system,sans-serif`;
const FONT_CTA   = `900 46px system-ui,-apple-system,sans-serif`;
const FONT_LOWER = `700 17px system-ui,sans-serif`;
const FONT_MARK  = `bold 13px system-ui,sans-serif`;

// ─── Easing ──────────────────────────────────────────────────────────────────
function easeOut(t: number) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3); }
function easeInOut(t: number) {
  t = Math.min(Math.max(t, 0), 1);
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Particles ───────────────────────────────────────────────────────────────
interface Particle { x: number; y: number; r: number; vx: number; vy: number; va: number; alpha: number; color: string; }

const STYLE_COLORS: Record<string, string[]> = {
  dark_motivation: ["#FF2222","#FF6600","#FF4444","#CC0000","#FF8800"],
  luxury_cinematic: ["#FFD700","#FFC200","#FFE066","#B8960C","#FFFACD"],
  documentary:      ["#D4A574","#C8956A","#E8C9A0","#A0784A","#F0D8B4"],
  anime_edit:       ["#00FFFF","#8800FF","#FF00FF","#0088FF","#FFFFFF"],
};

function spawnParticles(style: string): Particle[] {
  const colors = STYLE_COLORS[style] ?? STYLE_COLORS["dark_motivation"];
  return Array.from({ length: 20 }, () => ({       // 20 max — was 100
    x: Math.random() * W, y: H + Math.random() * H,
    r: Math.random() * 2.5 + 0.5,
    vx: (Math.random() - 0.5) * 1.2, vy: -(Math.random() * 3 + 1),
    va: (Math.random() - 0.5) * 0.02,
    alpha: Math.random() * 0.7 + 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
}

function tickParticles(ps: Particle[], dt: number) {
  for (const p of ps) {
    p.x += p.vx * dt * FPS; p.y += p.vy * dt * FPS; p.alpha += p.va;
    if (p.y < -20 || p.alpha <= 0) { p.x = Math.random() * W; p.y = H + 10; p.alpha = Math.random() * 0.6 + 0.2; }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[]) {
  for (const p of ps) {
    ctx.save();
    ctx.globalAlpha = Math.min(Math.max(p.alpha, 0), 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ─── Backgrounds ─────────────────────────────────────────────────────────────
function drawAnimatedBg(ctx: CanvasRenderingContext2D, sec: number, style: string) {
  switch (style) {
    case "luxury_cinematic": {
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#030510"); bg.addColorStop(0.5, "#06071A"); bg.addColorStop(1, "#020308");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      break;
    }
    case "documentary": {
      ctx.fillStyle = "#0D0A08"; ctx.fillRect(0, 0, W, H);
      break;
    }
    case "anime_edit": {
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, H);
      // simplified: 6 rays instead of 12
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + sec * 0.1;
        ctx.beginPath();
        ctx.moveTo(W/2, H*0.4);
        ctx.lineTo(W/2 + Math.cos(a) * W, H*0.4 + Math.sin(a) * W * 2);
        ctx.lineTo(W/2 + Math.cos(a + 0.06) * W, H*0.4 + Math.sin(a + 0.06) * W * 2);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? "rgba(0,200,255,0.03)" : "rgba(150,0,255,0.03)";
        ctx.fill();
      }
      break;
    }
    default: {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#000000"); bg.addColorStop(0.5, "#080000"); bg.addColorStop(1, "#000000");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const pulse = 0.5 + Math.sin(sec * 1.5) * 0.15;
      const glow = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H*0.4, W * 0.7 * pulse);
      glow.addColorStop(0, "rgba(160,15,15,0.22)"); glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    }
  }
}

// Cached vignette
let _vigCtx: CanvasRenderingContext2D | null = null;
let _vigGrad: CanvasGradient | null = null;
function drawVignette(ctx: CanvasRenderingContext2D) {
  if (ctx !== _vigCtx || !_vigGrad) {
    _vigCtx = ctx;
    _vigGrad = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.86);
    _vigGrad.addColorStop(0, "rgba(0,0,0,0)");
    _vigGrad.addColorStop(0.55, "rgba(0,0,0,0.22)");
    _vigGrad.addColorStop(1, "rgba(0,0,0,0.88)");
  }
  ctx.fillStyle = _vigGrad;
  ctx.fillRect(0, 0, W, H);
}

// ─── Script parsing ───────────────────────────────────────────────────────────
function buildScript(script: VideoScript) {
  const split = (text: string, n: number) => {
    const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const out: string[] = [];
    for (let i = 0; i < words.length; i += n) out.push(words.slice(i, i + n).join(" "));
    return out;
  };
  const h = split(script.hook, 3), b = split(script.body, 3), c = split(script.cta, 3);
  return { phrases: [...h, ...b, ...c], hookEnd: h.length, bodyEnd: h.length + b.length };
}

// ─── Karaoke captions ─────────────────────────────────────────────────────────
const ACCENT: Record<string, string> = {
  dark_motivation: "#FF3333",
  luxury_cinematic: "#FFD700",
  documentary: "#F5DEB3",
  anime_edit: "#00FFFF",
};

function drawKaraoke(ctx: CanvasRenderingContext2D, pt: PhraseTimestamp, sec: number, style: string) {
  const age = sec - pt.startSec;
  if (age < 0) return;
  const appear = easeOut(Math.min(age * 8, 1));
  if (appear < 0.02) return;

  const accent = ACCENT[style] ?? "#FF3333";
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.font = pt.isHook ? FONT_HOOK : pt.isCTA ? FONT_CTA : FONT_BODY;
  const fs = pt.isHook ? 60 : pt.isCTA ? 46 : 52;
  ctx.textAlign = "left";

  const rawWords: WordTimestamp[] = pt.words?.length
    ? pt.words
    : pt.phrase.split(" ").filter(Boolean).map((w, i, arr) => {
        const dur = (pt.endSec - pt.startSec) / arr.length;
        return { word: w, startSec: pt.startSec + i * dur, endSec: pt.startSec + (i + 1) * dur };
      });

  const maxW = W - 64;
  const lh = fs * 1.4;
  const lines: WordTimestamp[][] = [[]];
  let lw = 0;
  for (const wt of rawWords) {
    const ww = ctx.measureText(wt.word + " ").width;
    if (lw + ww > maxW && lines[lines.length - 1].length > 0) {
      lines.push([wt]); lw = ww;
    } else {
      lines[lines.length - 1].push(wt); lw += ww;
    }
  }

  const totalH = lines.length * lh;
  const baseY = H * 0.63 - totalH / 2;

  lines.forEach((line, li) => {
    const lineW = line.reduce((s, wt) => s + ctx.measureText(wt.word + " ").width, 0);
    let x = (W - lineW) / 2;
    const y = baseY + li * lh + fs;

    line.forEach((wt) => {
      const ww = ctx.measureText(wt.word + " ").width;
      const isActive = sec >= wt.startSec && sec < wt.endSec;
      const isPast   = sec >= wt.endSec;

      if (isActive) {
        const t = (sec - wt.startSec) / Math.max(wt.endSec - wt.startSec, 0.001);
        const pop = 1 + Math.sin(t * Math.PI) * 0.08;
        ctx.save();
        ctx.translate(x + ww / 2, y); ctx.scale(pop, pop); ctx.translate(-(x + ww / 2), -y);
        ctx.shadowColor = accent; ctx.shadowBlur = 8;
        ctx.strokeStyle = "rgba(0,0,0,0.9)"; ctx.lineWidth = 8; ctx.lineJoin = "round";
        ctx.strokeText(wt.word, x, y);
        ctx.shadowBlur = 0;
        ctx.fillStyle = accent; ctx.fillText(wt.word, x, y);
        ctx.restore();
      } else if (isPast) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(0,0,0,0.75)"; ctx.lineWidth = 6; ctx.lineJoin = "round";
        ctx.strokeText(wt.word, x, y);
        ctx.fillStyle = "#FFFFFF"; ctx.fillText(wt.word, x, y);
      } else {
        ctx.save();
        ctx.globalAlpha = appear * 0.3;
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#BBBBBB"; ctx.fillText(wt.word, x, y);
        ctx.restore();
      }
      x += ww;
    });
  });
  ctx.restore();
}

// ─── Clip loading — direct streaming (no full blob download) ─────────────────
// The /api/broll/proxy endpoint returns CORS headers, so crossOrigin="anonymous"
// lets canvas drawImage work without downloading the entire file first.
interface LoadedClip { el: HTMLVideoElement; duration: number; blobUrl: string; }

async function loadClipStream(url: string, container: HTMLElement): Promise<LoadedClip | null> {
  return new Promise((resolve) => {
    const vid = document.createElement("video");
    vid.muted        = true;
    vid.playsInline  = true;
    vid.preload      = "auto";
    vid.loop         = false;                  // sequencer controls looping manually
    vid.crossOrigin  = "anonymous";            // proxy sends Access-Control-Allow-Origin: *
    vid.style.cssText =
      "position:absolute;left:0;top:0;width:540px;height:960px;pointer-events:none;opacity:0;";
    container.appendChild(vid);

    let done = false;
    const finish = (ok: boolean) => {
      if (done) return; done = true;
      clearTimeout(timer);
      if (ok) {
        const dur = isFinite(vid.duration) && vid.duration > 0
          ? Math.min(vid.duration, CLIP_CAP_SEC)
          : CLIP_CAP_SEC;
        resolve({ el: vid, duration: dur, blobUrl: "" });
      } else {
        try { container.removeChild(vid); } catch {}
        resolve(null);
      }
    };

    const timer = setTimeout(() => { console.warn("[VIRALOS] Clip load timeout:", url.slice(-40)); finish(false); }, 12000);
    vid.addEventListener("loadeddata", () => finish(true), { once: true });
    vid.addEventListener("error",      () => finish(false), { once: true });
    vid.src = url;     // ← direct streaming URL — no blob download
    vid.load();
  });
}

// ─── Sequencer — one active clip at a time, switch on boundary ───────────────
interface Sequencer {
  getCurrentEl(sec: number): HTMLVideoElement | null;
  getActiveIndex(): number;
  totalClips: number;
}

function buildSequencer(clips: LoadedClip[]): Sequencer {
  if (!clips.length) return { getCurrentEl: () => null, getActiveIndex: () => -1, totalClips: 0 };

  // Build time windows capped at CLIP_CAP_SEC per clip
  let t = 0;
  const windows = clips.map(({ el, duration }) => {
    const capDur = Math.min(duration, CLIP_CAP_SEC);
    const w = { start: t, end: t + capDur, el };
    t += capDur;
    return w;
  });
  const total = t;
  let activeIdx = -1;

  const switchTo = (idx: number) => {
    if (idx === activeIdx) return;
    // Pause previous
    if (activeIdx >= 0) {
      try { clips[activeIdx].el.pause(); } catch {}
    }
    activeIdx = idx;
    // Seek to start and play new clip
    const el = clips[idx].el;
    try {
      el.currentTime = 0;
      el.play().catch(() => {});
    } catch {}
  };

  // Pre-buffer first clip immediately
  switchTo(0);

  return {
    totalClips: clips.length,
    getActiveIndex: () => activeIdx,
    getCurrentEl(sec: number) {
      if (!total) return null;
      const looped = sec % total;
      let idx = windows.findIndex(w => looped >= w.start && looped < w.end);
      if (idx < 0) idx = windows.length - 1;
      switchTo(idx);

      // Pre-buffer next clip silently (reduces switch stutter)
      const nextIdx = (idx + 1) % clips.length;
      if (nextIdx !== idx) {
        const nextEl = clips[nextIdx].el;
        if (nextEl.paused && nextEl.readyState < 3) {
          nextEl.load();
        }
      }

      return clips[activeIdx].el;
    },
  };
}

// ─── Frame draw ───────────────────────────────────────────────────────────────
function drawFrame(
  ctx: CanvasRenderingContext2D,
  sec: number,
  dt: number,
  particles: Particle[],
  sequencer: Sequencer,
  script: VideoScript,
  style: string,
  scriptData: ReturnType<typeof buildScript>,
  totalSec: number,
  phraseTimestamps?: PhraseTimestamp[],
) {
  const clipEl = sequencer.getCurrentEl(sec);
  let clipDrawn = false;

  if (clipEl && clipEl.videoWidth > 0 && clipEl.videoHeight > 0 && clipEl.readyState >= 2) {
    try {
      const zoom  = 1.0 + ((sec % 10) / 10) * 0.05;
      const scale = Math.max(W / clipEl.videoWidth, H / clipEl.videoHeight) * zoom;
      const sw = clipEl.videoWidth  * scale;
      const sh = clipEl.videoHeight * scale;
      ctx.drawImage(clipEl, (W - sw) / 2, (H - sh) / 2, sw, sh);
      clipDrawn = true;
    } catch {}
  }

  if (!clipDrawn) {
    drawAnimatedBg(ctx, sec, style);
    tickParticles(particles, dt);
    drawParticles(ctx, particles);
  }

  // Cinematic overlay over footage
  if (clipDrawn) {
    const overlays: Record<string, string> = {
      dark_motivation:  "rgba(0,0,0,0.42)",
      luxury_cinematic: "rgba(5,3,15,0.38)",
      documentary:      "rgba(10,5,2,0.28)",
      anime_edit:       "rgba(0,0,16,0.44)",
    };
    ctx.fillStyle = overlays[style] ?? "rgba(0,0,0,0.40)";
    ctx.fillRect(0, 0, W, H);
  }

  drawVignette(ctx);

  // Captions
  if (phraseTimestamps?.length) {
    const current = phraseTimestamps.find(pt => sec >= pt.startSec && sec < pt.endSec + 0.1);
    if (current) drawKaraoke(ctx, current, sec, style);
  } else {
    const { phrases, hookEnd, bodyEnd } = scriptData;
    if (phrases.length > 0 && sec < totalSec * 0.92) {
      const pDur = (totalSec * 0.92) / phrases.length;
      const idx  = Math.min(Math.floor(sec / pDur), phrases.length - 1);
      drawKaraoke(ctx, {
        phrase: phrases[idx],
        startSec: idx * pDur,
        endSec: (idx + 1) * pDur,
        isHook: idx < hookEnd,
        isCTA: idx >= bodyEnd,
      }, sec, style);
    }
  }

  // Lower-third
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, H - 60, W, 60);
  ctx.font = FONT_LOWER;
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(script.title.toUpperCase().slice(0, 34), W / 2, H - 21);
  ctx.restore();

  // Watermark
  ctx.save();
  ctx.font = FONT_MARK;
  ctx.fillStyle = "rgba(255,255,255,0.11)";
  ctx.textAlign = "right";
  ctx.shadowBlur = 0;
  ctx.fillText("VIRALOS AI", W - 16, 26);
  ctx.restore();

  // Flash on scene transitions
  for (const moment of [totalSec * 0.15, totalSec * 0.82]) {
    const dist = Math.abs(sec - moment);
    if (dist < 0.18) {
      ctx.save(); ctx.globalAlpha = (1 - dist / 0.18) * 0.25;
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }
}

// ─── Recorder ────────────────────────────────────────────────────────────────
function buildRecorder(stream: MediaStream): MediaRecorder | null {
  const types = ["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      try { return new MediaRecorder(stream, { mimeType: t, videoBitsPerSecond: 5_000_000 }); } catch {}
    }
  }
  try { return new MediaRecorder(stream); } catch { return null; }
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function generateVideo(
  script: VideoScript,
  onProgress?: (pct: number) => void,
  audioBlob?: Blob,
  brollClips?: BrollClip[],
  phraseTimestamps?: PhraseTimestamp[],
  onMetadata?: (meta: RenderMetadata) => void,
): Promise<Blob> {
  const style      = script.videoStyle ?? "dark_motivation";
  const scriptData = buildScript(script);
  const particles  = spawnParticles(style);

  let audioCtx: AudioContext | null = null;
  if (audioBlob) {
    try {
      audioCtx = new AudioContext();
      audioCtx.resume().catch(() => {});
    } catch (e) {
      console.warn("AudioContext pre-creation failed:", e);
    }
  }

  const clipContainer = document.createElement("div");
  clipContainer.style.cssText =
    "position:fixed;left:-3000px;top:0;width:540px;height:960px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(clipContainer);

  const cleanup = (clips: LoadedClip[]) => {
    // Pause all clips and remove elements
    for (const c of clips) {
      try { c.el.pause(); c.el.src = ""; } catch {}
    }
    try { document.body.removeChild(clipContainer); } catch {}
    _vigCtx = null; _vigGrad = null;
  };

  // Load clips — sequential batches of 3 to avoid overwhelming the browser
  const loadedClips: LoadedClip[] = [];
  if (brollClips?.length) {
    onProgress?.(-1);
    // Take only the first MAX_CLIPS unique URLs
    const uniqueClips = brollClips
      .filter((c, i, a) => a.findIndex(x => x.url === c.url) === i)
      .slice(0, MAX_CLIPS);

    // Load in batches of 3 to avoid overwhelming the network
    for (let i = 0; i < uniqueClips.length; i += 3) {
      const batch = uniqueClips.slice(i, i + 3);
      const results = await Promise.all(batch.map(c => loadClipStream(c.url, clipContainer)));
      for (const r of results) { if (r) loadedClips.push(r); }
    }
    console.log(`[VIRALOS] Loaded ${loadedClips.length}/${uniqueClips.length} clips (streaming)`);
  }

  const sequencer = buildSequencer(loadedClips);

  // Emit render metadata for Groq review
  onMetadata?.({
    clipsRequested: brollClips?.length ?? 0,
    clipsLoaded: loadedClips.length,
    clipDurations: loadedClips.map(c => c.duration),
    totalDuration: loadedClips.reduce((s, c) => s + c.duration, 0),
    fps: FPS,
    style,
    captionPhrases: phraseTimestamps?.length ?? scriptData.phrases.length,
  });

  return new Promise(async (resolve, reject) => {
    const canvas  = document.createElement("canvas");
    canvas.width  = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) { cleanup(loadedClips); reject(new Error("Canvas 2D unavailable")); return; }

    let totalSec = 45;
    const ac = audioCtx;

    if (audioBlob && ac) {
      try {
        const arrayBuf = await audioBlob.arrayBuffer();
        const audioBuf = await ac.decodeAudioData(arrayBuf);
        totalSec = Math.min(audioBuf.duration + 1.5, 120);

        const dest   = ac.createMediaStreamDestination();
        const source = ac.createBufferSource();
        source.buffer = audioBuf;
        source.connect(dest);

        const stream = canvas.captureStream(FPS);
        for (const trk of dest.stream.getAudioTracks()) stream.addTrack(trk);

        const rec = buildRecorder(stream);
        if (!rec) { ac.close(); cleanup(loadedClips); reject(new Error("MediaRecorder unavailable")); return; }

        const chunks: BlobPart[] = [];
        rec.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
        rec.onstop = () => {
          ac.close().catch(() => {});
          cleanup(loadedClips);
          resolve(new Blob(chunks, { type: rec.mimeType }));
        };
        rec.onerror = (e) => { ac.close().catch(() => {}); cleanup(loadedClips); reject(e); };

        rec.start(200);
        const t0 = ac.currentTime;
        source.start(t0);
        let prevSec = 0;

        const tick = () => {
          const sec = ac.currentTime - t0;
          const dt  = Math.max(0, sec - prevSec); prevSec = sec;
          if (sec >= totalSec) { rec.stop(); onProgress?.(100); return; }
          onProgress?.(Math.min(99, Math.round(sec / totalSec * 100)));
          drawFrame(ctx, sec, dt, particles, sequencer, script, style, scriptData, totalSec, phraseTimestamps);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return;
      } catch (e) {
        console.error("[VIRALOS] Audio pipeline error:", e);
        ac.close().catch(() => {});
      }
    }

    // Silent fallback
    const stream = canvas.captureStream(FPS);
    const rec    = buildRecorder(stream);
    if (!rec) { cleanup(loadedClips); reject(new Error("MediaRecorder unavailable")); return; }

    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
    rec.onstop = () => { cleanup(loadedClips); resolve(new Blob(chunks, { type: rec.mimeType })); };
    rec.onerror = (e) => { cleanup(loadedClips); reject(e); };

    const silentTotal = 45;
    rec.start(200);
    const t0 = performance.now();
    let prevSec = 0;

    const tick = () => {
      const sec = (performance.now() - t0) / 1000;
      const dt  = Math.max(0, sec - prevSec); prevSec = sec;
      if (sec >= silentTotal) { rec.stop(); onProgress?.(100); return; }
      onProgress?.(Math.min(99, Math.round(sec / silentTotal * 100)));
      drawFrame(ctx, sec, dt, particles, sequencer, script, style, scriptData, silentTotal, phraseTimestamps);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
