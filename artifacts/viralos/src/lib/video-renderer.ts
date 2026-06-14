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

// ─── Constants ────────────────────────────────────────────────────────────────
const FPS           = 24;
const FRAME_MS      = 1000 / FPS;          // ms between frames  ≈ 41.67ms
const W             = 540;
const H             = 960;
const MAX_CLIPS     = 10;
const CLIP_CAP_SEC  = 3;                   // viral pacing: cut every 2-3s max
const XFADE_SECS    = 0.15;               // snappier crossfade for short clips

// Pre-built font strings — Anton/Montserrat ExtraBold for viral one-word captions
const FONT_CAPTION_LG = `900 82px "Anton","Montserrat",Impact,system-ui,sans-serif`;
const FONT_CAPTION_MD = `900 74px "Anton","Montserrat",Impact,system-ui,sans-serif`;
const FONT_HOOK  = `900 72px "Montserrat",Impact,system-ui,-apple-system,sans-serif`;
const FONT_BODY  = `800 60px "Montserrat",Impact,system-ui,-apple-system,sans-serif`;
const FONT_CTA   = `800 54px "Montserrat",Impact,system-ui,-apple-system,sans-serif`;
const FONT_LOWER = `700 17px system-ui,sans-serif`;
const FONT_MARK  = `bold 13px system-ui,sans-serif`;

// ─── Easing ───────────────────────────────────────────────────────────────────
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

// ─── Particles ────────────────────────────────────────────────────────────────
interface Particle { x:number; y:number; r:number; vx:number; vy:number; va:number; alpha:number; color:string; }

const STYLE_COLORS: Record<string, string[]> = {
  dark_motivation:  ["#FF2222","#FF6600","#FF4444","#CC0000","#FF8800"],
  luxury_cinematic: ["#FFD700","#FFC200","#FFE066","#B8960C","#FFFACD"],
  documentary:      ["#D4A574","#C8956A","#E8C9A0","#A0784A","#F0D8B4"],
  anime_edit:       ["#00FFFF","#8800FF","#FF00FF","#0088FF","#FFFFFF"],
};

function spawnParticles(style: string): Particle[] {
  const colors = STYLE_COLORS[style] ?? STYLE_COLORS["dark_motivation"];
  return Array.from({ length: 18 }, () => ({
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
    if (p.y < -20 || p.alpha <= 0) { p.x = Math.random() * W; p.y = H + 10; p.alpha = 0.3 + Math.random() * 0.5; }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[]) {
  ctx.save();
  for (const p of ps) {
    const a = Math.min(Math.max(p.alpha, 0), 1);
    if (a < 0.02) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
  }
  ctx.restore();
}

// ─── Animated backgrounds ─────────────────────────────────────────────────────
function drawAnimatedBg(ctx: CanvasRenderingContext2D, sec: number, style: string) {
  switch (style) {
    case "luxury_cinematic": {
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#030510"); bg.addColorStop(0.5, "#06071A"); bg.addColorStop(1, "#020308");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      break;
    }
    case "documentary":
      ctx.fillStyle = "#0D0A08"; ctx.fillRect(0, 0, W, H);
      break;
    case "anime_edit": {
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.2832 + sec * 0.1;
        ctx.beginPath(); ctx.moveTo(W/2, H*0.4);
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

// ─── FIX 3: Pre-baked static overlay (vignette + lower-third + watermark) ────
// Rendered ONCE to OffscreenCanvas, then drawn as a single drawImage per frame.
function buildStaticOverlay(title: string): OffscreenCanvas {
  const oc  = new OffscreenCanvas(W, H);
  const ctx = oc.getContext("2d")!;

  // Vignette
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.86);
  vg.addColorStop(0,    "rgba(0,0,0,0)");
  vg.addColorStop(0.55, "rgba(0,0,0,0.22)");
  vg.addColorStop(1,    "rgba(0,0,0,0.88)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Lower-third bar
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, H - 60, W, 60);
  ctx.font = FONT_LOWER;
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(title.toUpperCase().slice(0, 34), W / 2, H - 21);

  // Watermark
  ctx.font = FONT_MARK;
  ctx.fillStyle = "rgba(255,255,255,0.11)";
  ctx.textAlign = "right";
  ctx.fillText("VIRALOS AI", W - 16, 26);

  return oc;
}

// ─── Script ───────────────────────────────────────────────────────────────────
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

// ─── FIX 2: Caption layout cache ─────────────────────────────────────────────
// Word positions are computed once per phrase and reused every frame.
// Accent = highlighted (active) word color — viral spec uses #FF3B30 red
const ACCENT: Record<string, string> = {
  dark_motivation: "#FF3B30",
  luxury_cinematic:"#FFD700",
  documentary:     "#F5C842",
  anime_edit:      "#00FFFF",
};

interface WordLayout {
  wt: WordTimestamp;
  x: number;
  y: number;
  width: number;
}

interface CaptionLayout {
  key: string;
  font: string;
  fs: number;
  lines: WordLayout[][];
  totalH: number;
  baseY: number;
  lh: number;
  accent: string;
}

// One cached layout per session — only rebuilt when the phrase changes
let _captionCache: CaptionLayout | null = null;

// Viral one-word tracking: counts transitions to alternate yellow/white
let _lastActiveWordKey = "";
let _wordCount = 0;

function getLayout(
  ctx: CanvasRenderingContext2D,
  pt: PhraseTimestamp,
  style: string,
): CaptionLayout {
  const key = pt.phrase + pt.startSec;
  if (_captionCache?.key === key) return _captionCache;

  const font   = pt.isHook ? FONT_HOOK : pt.isCTA ? FONT_CTA : FONT_BODY;
  const fs     = pt.isHook ? 72        : pt.isCTA ? 54        : 60;
  const accent = ACCENT[style] ?? "#FF3333";
  ctx.font = font;
  ctx.textAlign = "left";

  const rawWords: WordTimestamp[] = pt.words?.length
    ? pt.words
    : pt.phrase.split(" ").filter(Boolean).map((w, i, arr) => {
        const dur = (pt.endSec - pt.startSec) / arr.length;
        return { word: w, startSec: pt.startSec + i * dur, endSec: pt.startSec + (i + 1) * dur };
      });

  const maxW = W - 64;
  const lh   = fs * 1.4;

  // Build lines with cached x-positions
  const rawLines: WordTimestamp[][] = [[]];
  let lineW = 0;
  const widths = new Map<WordTimestamp, number>();
  for (const wt of rawWords) {
    const ww = ctx.measureText(wt.word + " ").width;
    widths.set(wt, ww);
    if (lineW + ww > maxW && rawLines[rawLines.length - 1].length > 0) {
      rawLines.push([wt]); lineW = ww;
    } else {
      rawLines[rawLines.length - 1].push(wt); lineW += ww;
    }
  }

  const totalH = rawLines.length * lh;
  const baseY  = H * 0.63 - totalH / 2;

  const lines: WordLayout[][] = rawLines.map((line, li) => {
    const rowW = line.reduce((s, wt) => s + (widths.get(wt) ?? 0), 0);
    let x = (W - rowW) / 2;
    const y = baseY + li * lh + fs;
    return line.map((wt) => {
      const width = widths.get(wt) ?? 0;
      const layout: WordLayout = { wt, x, y, width };
      x += width;
      return layout;
    });
  });

  _captionCache = { key, font, fs, lines, totalH, baseY, lh, accent };
  return _captionCache;
}

// ─── Viral one-word caption renderer ─────────────────────────────────────────
// One word at a time, centered, yellow+white alternating, bounce scale animation.
// Font: Anton/Montserrat ExtraBold. Drop shadow: black 3px blur.
function drawKaraoke(ctx: CanvasRenderingContext2D, pt: PhraseTimestamp, sec: number, _style: string) {
  const age = sec - pt.startSec;
  if (age < 0) return;

  // Build per-word timeline (use server timestamps when available)
  const rawWords: WordTimestamp[] = pt.words?.length
    ? pt.words
    : pt.phrase.split(" ").filter(Boolean).map((w, i, arr) => {
        const dur = (pt.endSec - pt.startSec) / arr.length;
        return { word: w, startSec: pt.startSec + i * dur, endSec: pt.startSec + (i + 1) * dur };
      });

  // Find active word at this timestamp
  let activeWord: WordTimestamp | null = null;
  let activeIdx = -1;
  for (let i = 0; i < rawWords.length; i++) {
    if (sec >= rawWords[i].startSec && sec < rawWords[i].endSec) {
      activeWord = rawWords[i];
      activeIdx  = i;
      break;
    }
  }
  if (!activeWord || activeIdx < 0) return;

  // Count word transitions to alternate yellow / white
  const wordKey = `${pt.startSec}_${activeIdx}`;
  if (wordKey !== _lastActiveWordKey) {
    _lastActiveWordKey = wordKey;
    _wordCount++;
  }

  // Appear ease-in from phrase start
  const appear = easeOut(Math.min(age * 12, 1));
  if (appear < 0.02) return;

  // Bounce: scale peaks at the midpoint of each word's duration
  const t   = (sec - activeWord.startSec) / Math.max(activeWord.endSec - activeWord.startSec, 0.001);
  const pop = 1 + Math.sin(t * Math.PI) * 0.07;

  // Alternating yellow (#FFE033) / white (#FFFFFF)
  const fillColor = _wordCount % 2 === 0 ? "#FFE033" : "#FFFFFF";
  const fs = pt.isHook ? 82 : 76;

  const word = activeWord.word.toUpperCase();
  const x = W / 2;
  const y = H * 0.66;

  ctx.save();
  ctx.globalAlpha = appear;
  ctx.font = `900 ${fs}px "Anton","Montserrat",Impact,system-ui,sans-serif`;
  ctx.textAlign = "center";

  // Bounce transform — scale from word center
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.translate(-x, -y);

  // Black drop shadow (3px blur per spec)
  ctx.shadowColor   = "#000000";
  ctx.shadowBlur    = 3;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Thick black stroke for legibility over any background
  ctx.strokeStyle = "#000000";
  ctx.lineWidth   = 6;
  ctx.lineJoin    = "round";
  ctx.strokeText(word, x, y);

  // Colored fill (shadow already applied)
  ctx.shadowBlur = 0;
  ctx.fillStyle  = fillColor;
  ctx.fillText(word, x, y);

  ctx.restore();
}

// ─── Hook overlay: big Impact text on frame 1, before voice starts (0–2s) ─────
function drawHookOverlay(ctx: CanvasRenderingContext2D, hookText: string, sec: number) {
  if (sec >= 2.0) return;

  // Fade-in 0–0.25 s, hold 0.25–1.5 s, fade-out 1.5–2.0 s
  let alpha = 1;
  if (sec < 0.25)     alpha = sec / 0.25;
  else if (sec > 1.5) alpha = 1 - (sec - 1.5) / 0.5;
  if (alpha <= 0.02) return;

  const text = hookText.toUpperCase();
  const fs   = 68;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font        = `900 ${fs}px Impact,"Arial Black",sans-serif`;
  ctx.textAlign   = "center";

  // Word-wrap to fit canvas width
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 60 && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineH  = fs * 1.28;
  const totalH = lines.length * lineH;
  const startY = H * 0.22 - totalH / 2 + fs;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineH;
    // Black drop shadow
    ctx.shadowColor   = "#000000";
    ctx.shadowBlur    = 3;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    // Thick black stroke
    ctx.strokeStyle = "#000000";
    ctx.lineWidth   = 8;
    ctx.lineJoin    = "round";
    ctx.strokeText(lines[i], W / 2, y);
    // White fill
    ctx.shadowBlur = 0;
    ctx.fillStyle  = "#FFFFFF";
    ctx.fillText(lines[i], W / 2, y);
  }
  ctx.restore();
}

// ─── FIX 5: O(1) phrase lookup — advance index, never scan backward ───────────
let _phraseIdx = 0;

function getCurrentPhrase(
  pts: PhraseTimestamp[],
  sec: number,
): PhraseTimestamp | null {
  if (!pts.length) return null;
  // Fast-forward if needed
  while (_phraseIdx < pts.length - 1 && sec >= pts[_phraseIdx].endSec + 0.05) {
    _phraseIdx++;
  }
  // Rewind if needed (seek backward)
  while (_phraseIdx > 0 && sec < pts[_phraseIdx].startSec) {
    _phraseIdx--;
  }
  const pt = pts[_phraseIdx];
  if (sec >= pt.startSec && sec < pt.endSec + 0.1) return pt;
  return null;
}

// ─── FIX 4: Clip with cached scale ────────────────────────────────────────────
interface LoadedClip {
  el: HTMLVideoElement;
  duration: number;
  blobUrl: string;
  baseScale: number;         // Math.max(W/vw, H/vh) — computed once at load
}

async function loadClipStream(url: string, container: HTMLElement): Promise<LoadedClip | null> {
  return new Promise((resolve) => {
    const vid = document.createElement("video");
    vid.muted       = true;
    vid.playsInline = true;
    vid.preload     = "auto";
    vid.loop        = false;
    vid.crossOrigin = "anonymous";
    vid.style.cssText =
      "position:absolute;left:0;top:0;width:540px;height:960px;pointer-events:none;opacity:0;";
    container.appendChild(vid);

    let done = false;
    const finish = (ok: boolean) => {
      if (done) return; done = true;
      clearTimeout(timer);
      if (ok) {
        const dur = isFinite(vid.duration) && vid.duration > 0
          ? Math.min(vid.duration, CLIP_CAP_SEC) : CLIP_CAP_SEC;
        const vw = vid.videoWidth  || W;
        const vh = vid.videoHeight || H;
        const baseScale = Math.max(W / vw, H / vh);    // FIX 4: cached once
        resolve({ el: vid, duration: dur, blobUrl: "", baseScale });
      } else {
        try { container.removeChild(vid); } catch {}
        resolve(null);
      }
    };

    const timer = setTimeout(() => finish(false), 12000);
    vid.addEventListener("loadeddata", () => finish(true), { once: true });
    vid.addEventListener("error",      () => finish(false), { once: true });
    vid.src = url;
    vid.load();
  });
}

// ─── FIX 6: Sequencer with crossfade ─────────────────────────────────────────
interface BlendResult {
  primary: LoadedClip | null;
  secondary: LoadedClip | null;
  alpha: number;
  primaryLocalSec: number;   // time elapsed within current clip window (for Ken Burns)
  primaryDuration: number;   // duration of current clip window
}
interface Sequencer {
  getBlend(sec: number): BlendResult;
  totalClips: number;
}

function buildSequencer(clips: LoadedClip[]): Sequencer {
  if (!clips.length) return {
    getBlend: () => ({ primary: null, secondary: null, alpha: 1, primaryLocalSec: 0, primaryDuration: 3 }),
    totalClips: 0,
  };

  let t = 0;
  const windows = clips.map((clip) => {
    const dur = Math.min(clip.duration, CLIP_CAP_SEC);
    const w = { start: t, end: t + dur, clip };
    t += dur;
    return w;
  });
  const total = t;

  let activeIdx = -1;
  let xfadeStart = -99;          // when the current crossfade started

  const switchTo = (idx: number) => {
    if (idx === activeIdx) return;
    if (activeIdx >= 0) {
      try { clips[activeIdx].el.pause(); } catch {}
    }
    activeIdx = idx;
    xfadeStart = -99;            // reset — will be set on next call
    const el = clips[idx].el;
    try { el.currentTime = 0; el.play().catch(() => {}); } catch {}
  };

  switchTo(0);

  return {
    totalClips: clips.length,
    getBlend(sec: number) {
      if (!total) return { primary: null, secondary: null, alpha: 1, primaryLocalSec: 0, primaryDuration: CLIP_CAP_SEC };
      const looped = sec % total;
      let idx = windows.findIndex(w => looped >= w.start && looped < w.end);
      if (idx < 0) idx = windows.length - 1;

      // Detect a clip switch and record the crossfade start time
      if (idx !== activeIdx) {
        // Pre-start next clip slightly so it's playing when we crossfade
        try {
          if (clips[idx].el.paused) {
            clips[idx].el.currentTime = 0;
            clips[idx].el.play().catch(() => {});
          }
        } catch {}
        if (xfadeStart < 0) xfadeStart = sec;
      }

      const xfadeProgress = xfadeStart > 0
        ? Math.min((sec - xfadeStart) / XFADE_SECS, 1) : 0;

      const clipLocalSec = (ai: number) => Math.max(looped - windows[ai].start, 0);
      const clipDur      = (ai: number) => windows[ai].end - windows[ai].start;

      if (xfadeProgress >= 1) {
        // Crossfade complete — fully commit to new clip
        if (activeIdx !== idx) switchTo(idx);
        xfadeStart = -99;
        return { primary: clips[activeIdx], secondary: null, alpha: 1, primaryLocalSec: clipLocalSec(activeIdx), primaryDuration: clipDur(activeIdx) };
      }

      // During crossfade: primary = old, secondary = new
      if (xfadeProgress > 0) {
        return {
          primary:   activeIdx >= 0 ? clips[activeIdx] : null,
          secondary: clips[idx],
          alpha: xfadeProgress,
          primaryLocalSec: activeIdx >= 0 ? clipLocalSec(activeIdx) : 0,
          primaryDuration: activeIdx >= 0 ? clipDur(activeIdx) : CLIP_CAP_SEC,
        };
      }

      // Normal — no crossfade
      switchTo(idx);
      return { primary: clips[activeIdx], secondary: null, alpha: 1, primaryLocalSec: clipLocalSec(activeIdx), primaryDuration: clipDur(activeIdx) };
    },
  };
}

// ─── Frame draw ───────────────────────────────────────────────────────────────
const OVERLAYS: Record<string, string> = {
  dark_motivation:  "rgba(0,0,0,0.42)",
  luxury_cinematic: "rgba(5,3,15,0.38)",
  documentary:      "rgba(10,5,2,0.28)",
  anime_edit:       "rgba(0,0,16,0.44)",
};

function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: LoadedClip,
  localSec: number,    // time elapsed within this clip's window (0 → clipDuration)
  clipDuration: number,
  alpha: number,
  style: string,
) {
  const el = clip.el;
  if (!el || el.readyState < 2 || !el.videoWidth) return false;
  try {
    // Ken Burns: smooth zoom-in from 1.0 → 1.08 over each clip's full duration
    const progress = Math.min(localSec / Math.max(clipDuration, 0.001), 1);
    const zoom  = 1 + progress * 0.08;
    const scale = clip.baseScale * zoom;
    const sw = el.videoWidth  * scale;
    const sh = el.videoHeight * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(el, (W - sw) / 2, (H - sh) / 2, sw, sh);
    ctx.restore();
    return true;
  } catch { return false; }
}

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
  overlay: OffscreenCanvas,      // FIX 3: pre-baked static overlay
  phraseTimestamps?: PhraseTimestamp[],
) {
  const { primary, secondary, alpha, primaryLocalSec, primaryDuration } = sequencer.getBlend(sec);
  let clipDrawn = false;

  if (primary) {
    const drawn = drawClip(ctx, primary, primaryLocalSec, primaryDuration, secondary ? 1 - alpha : 1, style);
    if (drawn) {
      clipDrawn = true;
      // Crossfade: draw next clip on top with increasing alpha (secondary starts at local 0)
      if (secondary && alpha > 0) {
        drawClip(ctx, secondary, 0, primaryDuration, alpha, style);
      }
    }
  }

  if (!clipDrawn) {
    drawAnimatedBg(ctx, sec, style);
    tickParticles(particles, dt);
    drawParticles(ctx, particles);
  }

  // Cinematic grade over footage
  if (clipDrawn) {
    ctx.fillStyle = OVERLAYS[style] ?? "rgba(0,0,0,0.40)";
    ctx.fillRect(0, 0, W, H);
  }

  // Pre-baked static overlay (vignette + lower-third + watermark)
  ctx.drawImage(overlay, 0, 0);

  // Viral captions (one word at a time, yellow/white alternating)
  if (phraseTimestamps?.length) {
    const current = getCurrentPhrase(phraseTimestamps, sec);
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

  // Hook overlay: bold white Impact text in first 2 seconds, before voice kicks in
  drawHookOverlay(ctx, script.hook, sec);

  // Flash on scene transitions (2 moments)
  for (const moment of [totalSec * 0.15, totalSec * 0.82]) {
    const dist = Math.abs(sec - moment);
    if (dist < 0.18) {
      ctx.save();
      ctx.globalAlpha = (1 - dist / 0.18) * 0.22;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

// ─── Recorder ─────────────────────────────────────────────────────────────────
function buildRecorder(stream: MediaStream): MediaRecorder | null {
  // FIX 7: Higher bitrate — 8Mbps for better output quality
  const types = ["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      try { return new MediaRecorder(stream, { mimeType: t, videoBitsPerSecond: 8_000_000 }); } catch {}
    }
  }
  try { return new MediaRecorder(stream); } catch { return null; }
}

// ─── Main entry point ──────────────────────────────────────────────────────────
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

  // FIX 3: Build static overlay once
  const staticOverlay = buildStaticOverlay(script.title);

  // Reset per-render state
  _captionCache       = null;
  _phraseIdx          = 0;
  _lastActiveWordKey  = "";
  _wordCount          = 0;

  let audioCtx: AudioContext | null = null;
  if (audioBlob) {
    try {
      audioCtx = new AudioContext();
      audioCtx.resume().catch(() => {});
    } catch (e) { console.warn("AudioContext pre-creation failed:", e); }
  }

  const clipContainer = document.createElement("div");
  clipContainer.style.cssText =
    "position:fixed;left:-3000px;top:0;width:540px;height:960px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(clipContainer);

  const cleanup = (clips: LoadedClip[]) => {
    for (const c of clips) { try { c.el.pause(); c.el.src = ""; } catch {} }
    try { document.body.removeChild(clipContainer); } catch {}
  };

  // FIX 8: Load all clips simultaneously (was batches-of-3 — now all at once)
  const loadedClips: LoadedClip[] = [];
  if (brollClips?.length) {
    onProgress?.(-1);
    const unique = brollClips
      .filter((c, i, a) => a.findIndex(x => x.url === c.url) === i)
      .slice(0, MAX_CLIPS);

    const results = await Promise.all(unique.map(c => loadClipStream(c.url, clipContainer)));
    for (const r of results) { if (r) loadedClips.push(r); }
    console.log(`[VIRALOS] Loaded ${loadedClips.length}/${unique.length} clips`);
  }

  const sequencer = buildSequencer(loadedClips);

  onMetadata?.({
    clipsRequested: brollClips?.length ?? 0,
    clipsLoaded:    loadedClips.length,
    clipDurations:  loadedClips.map(c => c.duration),
    totalDuration:  loadedClips.reduce((s, c) => s + c.duration, 0),
    fps: FPS, style,
    captionPhrases: phraseTimestamps?.length ?? scriptData.phrases.length,
  });

  return new Promise(async (resolve, reject) => {
    const canvas  = document.createElement("canvas");
    canvas.width  = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: false, alpha: false });
    if (!ctx) { cleanup(loadedClips); reject(new Error("Canvas 2D unavailable")); return; }

    let totalSec  = 45;
    const ac      = audioCtx;

    // ─── FIX 1: Frame throttle ──────────────────────────────────────────────
    // requestAnimationFrame fires at 60-120fps but MediaRecorder only captures
    // at FPS (24). We only call drawFrame when enough wall-clock time has passed.
    let lastDrawMs = -FRAME_MS;
    const shouldDraw = () => {
      const now = performance.now();
      if (now - lastDrawMs >= FRAME_MS * 0.92) {
        lastDrawMs = now;
        return true;
      }
      return false;
    };

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
        rec.onstop = () => { ac.close().catch(() => {}); cleanup(loadedClips); resolve(new Blob(chunks, { type: rec.mimeType })); };
        rec.onerror = (e) => { ac.close().catch(() => {}); cleanup(loadedClips); reject(e); };

        rec.start(200);
        const t0 = ac.currentTime;
        source.start(t0);

        // Background music: fetch from Pixabay via backend proxy, mix at 15% volume
        (async () => {
          try {
            const musicRes = await fetch("/api/clips/music?q=cinematic+background");
            if (!musicRes.ok) return;
            const musicData = await musicRes.json() as { tracks?: Array<{ url: string }> };
            const musicUrl = musicData.tracks?.[0]?.url;
            if (!musicUrl) return;
            const musicArrayBuf = await fetch(musicUrl).then(r => r.arrayBuffer());
            const musicAudioBuf = await ac.decodeAudioData(musicArrayBuf);
            const musicSrc = ac.createBufferSource();
            musicSrc.buffer = musicAudioBuf;
            musicSrc.loop   = true;
            const musicGain = ac.createGain();
            musicGain.gain.value = 0.15;      // 15% volume under voice
            musicSrc.connect(musicGain);
            musicGain.connect(dest);
            musicSrc.start(ac.currentTime);
          } catch (e) {
            console.warn("[VIRALOS] Background music skipped:", e);
          }
        })();

        let prevSec = 0;

        const tick = () => {
          const sec = ac.currentTime - t0;
          if (sec >= totalSec) { rec.stop(); onProgress?.(100); return; }
          onProgress?.(Math.min(99, Math.round(sec / totalSec * 100)));
          // FIX 1: only draw when it's time for a new frame
          if (shouldDraw()) {
            const dt = Math.max(0, sec - prevSec); prevSec = sec;
            drawFrame(ctx, sec, dt, particles, sequencer, script, style, scriptData, totalSec, staticOverlay, phraseTimestamps);
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return;
      } catch (e) {
        console.error("[VIRALOS] Audio pipeline error:", e);
        ac.close().catch(() => {});
      }
    }

    // ── Silent fallback ───────────────────────────────────────────────────────
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
      if (sec >= silentTotal) { rec.stop(); onProgress?.(100); return; }
      onProgress?.(Math.min(99, Math.round(sec / silentTotal * 100)));
      if (shouldDraw()) {
        const dt = Math.max(0, sec - prevSec); prevSec = sec;
        drawFrame(ctx, sec, dt, particles, sequencer, script, style, scriptData, silentTotal, staticOverlay, phraseTimestamps);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
