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

// ─── Constants ───────────────────────────────────────────────────────────────
const FPS = 30;
const W   = 540;
const H   = 960;

// Pre-built font strings — avoids repeated string concat in hot path
const FONT_HOOK = `900 60px system-ui,-apple-system,sans-serif`;
const FONT_BODY = `900 52px system-ui,-apple-system,sans-serif`;
const FONT_CTA  = `900 46px system-ui,-apple-system,sans-serif`;
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

function spawnParticles(style: string, count: number): Particle[] {
  const colors = STYLE_COLORS[style] ?? STYLE_COLORS["dark_motivation"];
  return Array.from({ length: Math.min(count, 30) }, () => ({
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
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + sec * 0.1;
        ctx.beginPath();
        ctx.moveTo(W/2 + Math.cos(a - 0.04) * 40, H*0.4 + Math.sin(a - 0.04) * 40);
        ctx.lineTo(W/2 + Math.cos(a) * W, H*0.4 + Math.sin(a) * W * 2);
        ctx.lineTo(W/2 + Math.cos(a + 0.04) * 40, H*0.4 + Math.sin(a + 0.04) * 40);
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

// Cached vignette — created once per video session (same canvas context)
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

  // Build word list with fallback timing if words[] not provided
  const rawWords: WordTimestamp[] = pt.words?.length
    ? pt.words
    : pt.phrase.split(" ").filter(Boolean).map((w, i, arr) => {
        const dur = (pt.endSec - pt.startSec) / arr.length;
        return { word: w, startSec: pt.startSec + i * dur, endSec: pt.startSec + (i + 1) * dur };
      });

  // Word-wrap
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
        const pop = 1 + Math.sin(t * Math.PI) * 0.1;
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
        ctx.fillStyle = "#BBBBBB"; ctx.fillText(wt.word, x, y);
        ctx.restore();
      }
      x += ww;
    });
  });
  ctx.restore();
}

// ─── Clip loading — fetch → blob URL (origin-safe for canvas) ────────────────
interface LoadedClip { el: HTMLVideoElement; duration: number; blobUrl: string; }

async function loadClip(url: string, container: HTMLElement): Promise<LoadedClip | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) { console.warn("Clip fetch failed:", res.status); return null; }
    const blob    = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const vid = document.createElement("video");
      vid.muted       = true;
      vid.playsInline = true;
      vid.preload     = "auto";
      vid.loop        = true;
      // Use real dimensions — Chrome skips full-res decoding for 1×1px elements
      vid.style.cssText = "position:absolute;left:0;top:0;width:540px;height:960px;pointer-events:none;";
      container.appendChild(vid);

      let done = false;
      const finish = (ok: boolean) => {
        if (done) return; done = true;
        clearTimeout(timer);
        if (ok) {
          resolve({ el: vid, duration: Math.min(isFinite(vid.duration) ? vid.duration : 10, 14), blobUrl });
        } else {
          URL.revokeObjectURL(blobUrl);
          try { container.removeChild(vid); } catch {}
          resolve(null);
        }
      };

      const timer = setTimeout(() => { console.warn("Clip load timeout"); finish(false); }, 20000);
      vid.addEventListener("loadeddata", () => finish(true), { once: true });
      vid.addEventListener("error",      () => finish(false), { once: true });
      vid.src = blobUrl;
      vid.load();
    });
  } catch (e) {
    console.error("loadClip error:", e);
    return null;
  }
}

// ─── Sequencer — all clips loop; draw whichever matches elapsed time ──────────
interface Sequencer { getCurrentEl(sec: number): HTMLVideoElement | null; }

function buildSequencer(clips: LoadedClip[]): Sequencer {
  if (!clips.length) return { getCurrentEl: () => null };

  let t = 0;
  const windows = clips.map(({ el, duration }) => {
    const w = { start: t, end: t + duration, el };
    t += duration;
    return w;
  });
  const total = t;

  // Start all clips playing now (muted, looping)
  for (const { el } of clips) {
    el.play().catch((e) => console.warn("Clip play:", e));
  }

  return {
    getCurrentEl(sec: number) {
      if (!total) return null;
      const looped = sec % total;
      return windows.find(w => looped >= w.start && looped < w.end)?.el
        ?? windows[windows.length - 1].el;
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
  // 1. Background: real footage or animated fallback
  const clipEl = sequencer.getCurrentEl(sec);
  let clipDrawn = false;

  if (clipEl && clipEl.videoWidth > 0 && clipEl.videoHeight > 0) {
    try {
      // Ken Burns: gentle 1.0→1.06 zoom per 12-second cycle
      const zoom  = 1.0 + ((sec % 12) / 12) * 0.06;
      const scale = Math.max(W / clipEl.videoWidth, H / clipEl.videoHeight) * zoom;
      const sw = clipEl.videoWidth  * scale;
      const sh = clipEl.videoHeight * scale;
      ctx.drawImage(clipEl, (W - sw) / 2, (H - sh) / 2, sw, sh);
      clipDrawn = true;
    } catch (e) {
      console.warn("drawImage failed:", e);
    }
  }

  if (!clipDrawn) {
    drawAnimatedBg(ctx, sec, style);
    tickParticles(particles, dt);
    drawParticles(ctx, particles);
  }

  // 2. Cinematic darkening over footage
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

  // 3. Vignette (cached gradient)
  drawVignette(ctx);

  // 4. Karaoke captions
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

  // 5. Lower-third
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, H - 60, W, 60);
  ctx.font = FONT_LOWER;
  ctx.textAlign = "center";
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(script.title.toUpperCase().slice(0, 34), W / 2, H - 21);
  ctx.restore();

  // 6. Watermark
  ctx.save();
  ctx.font = FONT_MARK;
  ctx.fillStyle = "rgba(255,255,255,0.11)";
  ctx.textAlign = "right";
  ctx.shadowBlur = 0;
  ctx.fillText("VIRALOS AI", W - 16, 26);
  ctx.restore();

  // 7. Section flash
  for (const moment of [totalSec * 0.15, totalSec * 0.82]) {
    const dist = Math.abs(sec - moment);
    if (dist < 0.18) {
      ctx.save(); ctx.globalAlpha = (1 - dist / 0.18) * 0.28;
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }
}

// ─── Recorder ────────────────────────────────────────────────────────────────
function buildRecorder(stream: MediaStream): MediaRecorder | null {
  const types = ["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      try { return new MediaRecorder(stream, { mimeType: t, videoBitsPerSecond: 6_000_000 }); } catch {}
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
): Promise<Blob> {
  const style      = script.videoStyle ?? "dark_motivation";
  const scriptData = buildScript(script);
  const particles  = spawnParticles(style, 100);

  // ── Step 1: Create & resume AudioContext NOW (synchronous, before any await)
  // Chrome's user activation expires after async operations. Creating the
  // AudioContext first ensures it's not left in "suspended" state.
  let audioCtx: AudioContext | null = null;
  if (audioBlob) {
    try {
      audioCtx = new AudioContext();
      // resume() is synchronous in Chrome when called within user activation
      audioCtx.resume().catch(() => {});
    } catch (e) {
      console.warn("AudioContext pre-creation failed:", e);
    }
  }

  // ── Step 2: DOM container — use real pixel dimensions (540×960)
  // Chrome skips full-res frame decoding for elements with tiny CSS size.
  // Positioning off-screen at left:-3000px keeps it invisible.
  const clipContainer = document.createElement("div");
  clipContainer.style.cssText =
    "position:fixed;left:-3000px;top:0;width:540px;height:960px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(clipContainer);

  const cleanup = (clips: LoadedClip[]) => {
    for (const c of clips) { try { URL.revokeObjectURL(c.blobUrl); } catch {} }
    try { document.body.removeChild(clipContainer); } catch {}
    // Reset vignette cache for next video
    _vigCtx = null; _vigGrad = null;
  };

  // ── Step 3: Load all clips as blobs (bypasses canvas CORS checks)
  const loadedClips: LoadedClip[] = [];
  if (brollClips?.length) {
    onProgress?.(-1);
    const results = await Promise.all(brollClips.map(c => loadClip(c.url, clipContainer)));
    for (const r of results) { if (r) loadedClips.push(r); }
    console.log(`[VIRALOS] Loaded ${loadedClips.length}/${brollClips.length} clips`);
  }

  const sequencer = buildSequencer(loadedClips);

  // ── Step 4: Canvas + MediaRecorder
  return new Promise(async (resolve, reject) => {
    const canvas  = document.createElement("canvas");
    canvas.width  = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) { cleanup(loadedClips); reject(new Error("Canvas 2D unavailable")); return; }

    let totalSec = 45;
    const ac = audioCtx; // captured from closure — already created and resumed

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
        // t0 = audio clock at start — all timing derived from this
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

    // ── Silent fallback ──
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
