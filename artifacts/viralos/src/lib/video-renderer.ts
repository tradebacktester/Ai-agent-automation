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

// ─── Easing ──────────────────────────────────────────────────────────────────
function easeOut(t: number) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3); }
function easeInOut(t: number) {
  t = Math.min(Math.max(t, 0), 1);
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Particle System ─────────────────────────────────────────────────────────
interface Particle { x: number; y: number; r: number; vx: number; vy: number; va: number; alpha: number; color: string; type: string; }

const STYLE_PARTICLES: Record<string, { colors: string[]; type: string }> = {
  dark_motivation: { colors: ["#FF2222","#FF6600","#FF4444","#CC0000","#FF8800"], type: "spark" },
  luxury_cinematic: { colors: ["#FFD700","#FFC200","#FFE066","#B8960C","#FFFACD"], type: "orb" },
  documentary:      { colors: ["#D4A574","#C8956A","#E8C9A0","#A0784A","#F0D8B4"], type: "dust" },
  anime_edit:       { colors: ["#00FFFF","#8800FF","#FF00FF","#0088FF","#FFFFFF"], type: "energy" },
};

function spawnParticles(style: string, count: number): Particle[] {
  const cfg = STYLE_PARTICLES[style] ?? STYLE_PARTICLES["dark_motivation"];
  return Array.from({ length: count }, () => ({
    x: Math.random() * W, y: H + Math.random() * H,
    r: Math.random() * 2.5 + 0.5,
    vx: (Math.random() - 0.5) * 1.2, vy: -(Math.random() * 3 + 1),
    va: (Math.random() - 0.5) * 0.02,
    alpha: Math.random() * 0.7 + 0.3,
    color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
    type: cfg.type,
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
    if (p.type === "orb") {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, p.color); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === "energy") {
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// ─── Animated Backgrounds ────────────────────────────────────────────────────
function drawAnimatedBg(ctx: CanvasRenderingContext2D, sec: number, style: string) {
  switch (style) {
    case "luxury_cinematic": {
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#030510"); bg.addColorStop(0.5, "#06071A"); bg.addColorStop(1, "#020308");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const sweep = (sec * 0.04) % 1;
      const g = ctx.createLinearGradient(W * sweep - W * 0.3, 0, W * sweep + W * 0.3, H * 0.3);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(200,160,0,0.09)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      break;
    }
    case "documentary": {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0D0A08"); bg.addColorStop(0.5, "#13100C"); bg.addColorStop(1, "#0A0806");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      break;
    }
    case "anime_edit": {
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.4;
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 + sec * 0.1;
        const spread = 0.04;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle - spread) * 40, cy + Math.sin(angle - spread) * 40);
        ctx.lineTo(cx + Math.cos(angle) * W, cy + Math.sin(angle) * W * 2);
        ctx.lineTo(cx + Math.cos(angle + spread) * 40, cy + Math.sin(angle + spread) * 40);
        ctx.closePath();
        ctx.fillStyle = i % 3 === 0 ? `rgba(0,200,255,0.03)` : `rgba(150,0,255,0.03)`;
        ctx.fill();
      }
      break;
    }
    default: {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#000000"); bg.addColorStop(0.4, "#0A0000"); bg.addColorStop(1, "#000000");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const pulse = 0.5 + Math.sin(sec * 1.5) * 0.15;
      const glow = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.7 * pulse);
      glow.addColorStop(0, "rgba(180,20,20,0.18)"); glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    }
  }
}

// ─── Overlays ────────────────────────────────────────────────────────────────
function drawVignette(ctx: CanvasRenderingContext2D) {
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.6, "rgba(0,0,0,0.25)");
  vig.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

function drawFilmGrain(ctx: CanvasRenderingContext2D, sec: number, strength: number) {
  const imgData = ctx.createImageData(W, H);
  const seed = Math.floor(sec * 60);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = ((i * 1103515245 + seed * 12345) & 0x7fffffff) % 255;
    const v = n * strength;
    imgData.data[i] = v; imgData.data[i + 1] = v; imgData.data[i + 2] = v; imgData.data[i + 3] = 20;
  }
  ctx.putImageData(imgData, 0, 0);
}

// ─── Script Parsing ───────────────────────────────────────────────────────────
function buildScript(script: VideoScript) {
  const split = (text: string, n: number) => {
    const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const phrases: string[] = [];
    for (let i = 0; i < words.length; i += n) phrases.push(words.slice(i, i + n).join(" "));
    return phrases;
  };
  const hookPhrases = split(script.hook, 3);
  const bodyPhrases = split(script.body, 3);
  const ctaPhrases  = split(script.cta, 3);
  return { phrases: [...hookPhrases, ...bodyPhrases, ...ctaPhrases], hookEnd: hookPhrases.length, bodyEnd: hookPhrases.length + bodyPhrases.length };
}

// ─── Karaoke Captions (viral word-by-word style) ──────────────────────────────
const ACCENT_COLORS: Record<string, string> = {
  dark_motivation: "#FF3333",
  luxury_cinematic: "#FFD700",
  documentary: "#F5DEB3",
  anime_edit: "#00FFFF",
};

function drawKaraokeCaption(
  ctx: CanvasRenderingContext2D,
  phrase: PhraseTimestamp,
  sec: number,
  style: string,
) {
  const phraseAge = sec - phrase.startSec;
  if (phraseAge < 0) return;
  const appear = easeOut(Math.min(phraseAge * 8, 1));
  if (appear < 0.02) return;

  const accent    = ACCENT_COLORS[style] ?? "#FF3333";
  const fontSize  = phrase.isHook ? 62 : phrase.isCTA ? 48 : 54;
  const fontStr   = `900 italic ${fontSize}px system-ui,-apple-system,sans-serif`;

  ctx.save();
  ctx.font = fontStr;
  ctx.globalAlpha = appear;

  // Build word list with timestamps
  const rawWords = phrase.words
    ?? phrase.phrase.split(" ").filter(Boolean).map((w, i, arr) => {
        const dur = (phrase.endSec - phrase.startSec) / arr.length;
        return { word: w, startSec: phrase.startSec + i * dur, endSec: phrase.startSec + (i + 1) * dur };
      });

  const maxW  = W - 72;
  const lineH = fontSize * 1.38;

  // Word-wrap into lines
  const lines: typeof rawWords[0][][] = [[]];
  let lineWidth = 0;
  for (const w of rawWords) {
    const ww = ctx.measureText(w.word + " ").width;
    if (lineWidth + ww > maxW && lines[lines.length - 1].length > 0) {
      lines.push([w]); lineWidth = ww;
    } else {
      lines[lines.length - 1].push(w); lineWidth += ww;
    }
  }

  const totalTextH = lines.length * lineH;
  const baseY = H * 0.63 - totalTextH / 2;

  lines.forEach((line, li) => {
    const lw = line.reduce((s, w) => s + ctx.measureText(w.word + " ").width, 0);
    let x = (W - lw) / 2;
    const y = baseY + li * lineH + fontSize;

    line.forEach((wt) => {
      const ww = ctx.measureText(wt.word + " ").width;
      const isActive = sec >= wt.startSec && sec < wt.endSec;
      const isPast   = sec >= wt.endSec;

      if (isActive) {
        const t  = (sec - wt.startSec) / Math.max(wt.endSec - wt.startSec, 0.001);
        const pop = 1 + Math.sin(t * Math.PI) * 0.12;
        ctx.save();
        ctx.translate(x + ww / 2, y);
        ctx.scale(pop, pop);
        ctx.translate(-(x + ww / 2), -y);
        // Bold stroke for legibility over footage
        ctx.strokeStyle  = "rgba(0,0,0,0.95)";
        ctx.lineWidth    = 10;
        ctx.lineJoin     = "round";
        ctx.strokeText(wt.word, x, y);
        ctx.shadowColor  = accent;
        ctx.shadowBlur   = 28;
        ctx.fillStyle    = accent;
        ctx.fillText(wt.word, x, y);
        ctx.restore();
      } else if (isPast) {
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth   = 8;
        ctx.lineJoin    = "round";
        ctx.strokeText(wt.word, x, y);
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = "#FFFFFF";
        ctx.fillText(wt.word, x, y);
      } else {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = appear * 0.35;
        ctx.fillStyle = "#AAAAAA";
        ctx.fillText(wt.word, x, y);
        ctx.globalAlpha = prevAlpha;
      }
      x += ww;
    });
  });

  ctx.restore();
}

// ─── Clip Loading: fetch → blob URL (bypasses all canvas security checks) ────
interface LoadedClip { el: HTMLVideoElement; duration: number; blobUrl: string; }

async function loadClip(
  url: string,
  container: HTMLElement,
  onProgress?: (msg: string) => void,
): Promise<LoadedClip | null> {
  try {
    onProgress?.(`Fetching clip…`);
    const res = await fetch(url);
    if (!res.ok) { console.warn("Clip fetch failed:", res.status, url); return null; }

    const blob    = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    onProgress?.("Clip fetched, loading into video element…");

    return new Promise((resolve) => {
      const vid = document.createElement("video");
      vid.muted        = true;
      vid.playsInline  = true;
      vid.preload      = "auto";
      vid.loop         = true;
      vid.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
      container.appendChild(vid);

      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (ok) {
          resolve({ el: vid, duration: vid.duration > 0 ? Math.min(vid.duration, 14) : 10, blobUrl });
        } else {
          URL.revokeObjectURL(blobUrl);
          container.removeChild(vid);
          resolve(null);
        }
      };

      const timer = setTimeout(() => { console.warn("Clip element timeout"); finish(false); }, 20000);

      vid.addEventListener("canplay",  () => finish(true), { once: true });
      vid.addEventListener("error",    (e) => { console.error("Video element error:", e); finish(false); }, { once: true });

      vid.src = blobUrl;
      vid.load();
    });
  } catch (e) {
    console.error("loadClip error:", e);
    return null;
  }
}

// ─── Clip Sequencer ───────────────────────────────────────────────────────────
interface Sequencer { getCurrentEl(sec: number): HTMLVideoElement | null; }

function buildSequencer(clips: LoadedClip[]): Sequencer {
  if (!clips.length) return { getCurrentEl: () => null };

  let t = 0;
  const windows = clips.map(({ el, duration }) => {
    const w = { start: t, end: t + duration, el };
    t += duration;
    return w;
  });
  const totalDuration = t;

  // All clips play simultaneously in a loop — just draw whichever is current
  for (const { el } of clips) {
    el.play().catch((e) => console.warn("Clip play failed:", e));
  }

  return {
    getCurrentEl(sec: number): HTMLVideoElement | null {
      if (!windows.length) return null;
      const looped = totalDuration > 0 ? sec % totalDuration : 0;
      return windows.find(w => looped >= w.start && looped < w.end)?.el
        ?? windows[windows.length - 1].el
        ?? null;
    },
  };
}

// ─── Frame Renderer ───────────────────────────────────────────────────────────
function drawFrame(
  ctx: CanvasRenderingContext2D,
  sec: number,
  dt: number,
  particles: Particle[],
  sequencer: Sequencer,
  script: VideoScript,
  style: string,
  scriptData: ReturnType<typeof buildScript>,
  totalSeconds: number,
  phraseTimestamps?: PhraseTimestamp[],
) {
  // ── 1. Background ──
  const clipEl = sequencer.getCurrentEl(sec);
  let clipDrawn = false;

  if (clipEl && clipEl.videoWidth > 0 && clipEl.videoHeight > 0) {
    try {
      const vw = clipEl.videoWidth;
      const vh = clipEl.videoHeight;
      // Ken Burns: gentle zoom 1.0→1.07 over 12s cycles
      const zoom  = 1.0 + ((sec % 12) / 12) * 0.07;
      const scale = Math.max(W / vw, H / vh) * zoom;
      const sw = vw * scale;
      const sh = vh * scale;
      ctx.drawImage(clipEl, (W - sw) / 2, (H - sh) / 2, sw, sh);
      clipDrawn = true;
    } catch (e) {
      console.warn("ctx.drawImage failed:", e);
    }
  }

  if (!clipDrawn) {
    drawAnimatedBg(ctx, sec, style);
    tickParticles(particles, dt);
    drawParticles(ctx, particles);
  }

  // ── 2. Cinematic grade over footage ──
  if (clipDrawn) {
    const grades: Record<string, string> = {
      dark_motivation:  "rgba(0,0,0,0.52)",
      luxury_cinematic: "rgba(5,3,15,0.44)",
      documentary:      "rgba(12,7,2,0.32)",
      anime_edit:       "rgba(0,0,18,0.48)",
    };
    ctx.fillStyle = grades[style] ?? "rgba(0,0,0,0.50)";
    ctx.fillRect(0, 0, W, H);
  }

  // ── 3. Vignette ──
  drawVignette(ctx);

  // ── 4. Film grain ──
  if (style === "documentary" || style === "dark_motivation") {
    drawFilmGrain(ctx, sec, style === "documentary" ? 0.062 : 0.04);
  }

  // ── 5. Karaoke captions ──
  if (phraseTimestamps && phraseTimestamps.length > 0) {
    const current = phraseTimestamps.find(pt => sec >= pt.startSec && sec < pt.endSec + 0.08);
    if (current) drawKaraokeCaption(ctx, current, sec, style);
  } else {
    const { phrases, hookEnd, bodyEnd } = scriptData;
    if (phrases.length > 0 && sec < totalSeconds * 0.92) {
      const phrasesSec  = totalSeconds * 0.92;
      const phaseDur    = phrasesSec / phrases.length;
      const idx         = Math.min(Math.floor(sec / phaseDur), phrases.length - 1);
      const phraseStart = idx * phaseDur;
      const fakePt: PhraseTimestamp = {
        phrase: phrases[idx],
        startSec: phraseStart,
        endSec: phraseStart + phaseDur,
        isHook: idx < hookEnd,
        isCTA: idx >= bodyEnd,
      };
      drawKaraokeCaption(ctx, fakePt, sec, style);
    }
  }

  // ── 6. Lower-third title bar ──
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, H - 62, W, 62);
  ctx.globalAlpha = 0.95;
  ctx.font = "700 17px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 10;
  ctx.fillText(script.title.toUpperCase().slice(0, 34), W / 2, H - 22);
  ctx.restore();

  // ── 7. Watermark ──
  ctx.save();
  ctx.font = "bold 13px system-ui,sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.11)";
  ctx.textAlign = "right";
  ctx.fillText("VIRALOS AI", W - 16, 28);
  ctx.restore();

  // ── 8. Section flash ──
  for (const moment of [totalSeconds * 0.15, totalSeconds * 0.82]) {
    const dist = Math.abs(sec - moment);
    if (dist < 0.18) {
      ctx.save();
      ctx.globalAlpha = (1 - dist / 0.18) * 0.32;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

// ─── Recorder Helper ─────────────────────────────────────────────────────────
function buildRecorder(stream: MediaStream): MediaRecorder | null {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      try { return new MediaRecorder(stream, { mimeType: t, videoBitsPerSecond: 6_000_000 }); } catch {}
    }
  }
  try { return new MediaRecorder(stream); } catch { return null; }
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export async function generateVideo(
  script: VideoScript,
  onProgress?: (pct: number) => void,
  audioBlob?: Blob,
  brollClips?: BrollClip[],
  phraseTimestamps?: PhraseTimestamp[],
): Promise<Blob> {
  const style      = script.videoStyle ?? "dark_motivation";
  const scriptData = buildScript(script);
  const particles  = spawnParticles(style, 120);

  // ── DOM container for video elements (required by Chrome for playback) ──
  const clipContainer = document.createElement("div");
  clipContainer.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(clipContainer);

  const revokeAll = (clips: LoadedClip[]) => {
    for (const c of clips) {
      try { URL.revokeObjectURL(c.blobUrl); } catch {}
    }
  };
  const cleanup = (clips: LoadedClip[]) => {
    revokeAll(clips);
    try { document.body.removeChild(clipContainer); } catch {}
  };

  // ── Load all clips as blob URLs in parallel ──
  // This is the definitive fix: blob:// URLs are always origin-safe for canvas.
  const loadedClips: LoadedClip[] = [];
  if (brollClips && brollClips.length > 0) {
    onProgress?.(-1);
    const results = await Promise.all(
      brollClips.map((clip) => loadClip(clip.url, clipContainer)),
    );
    for (const r of results) { if (r) loadedClips.push(r); }
    console.log(`Loaded ${loadedClips.length}/${brollClips.length} clips`);
  }

  const sequencer = buildSequencer(loadedClips);

  return new Promise(async (resolve, reject) => {
    const canvas  = document.createElement("canvas");
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) { cleanup(loadedClips); reject(new Error("Canvas unavailable")); return; }

    let totalSeconds = 45;

    if (audioBlob) {
      try {
        const audioCtx    = new AudioContext();
        const arrayBuf    = await audioBlob.arrayBuffer();
        const audioBuf    = await audioCtx.decodeAudioData(arrayBuf);
        totalSeconds      = Math.min(audioBuf.duration + 1.5, 120);

        const dest        = audioCtx.createMediaStreamDestination();
        const audioSource = audioCtx.createBufferSource();
        audioSource.buffer = audioBuf;
        audioSource.connect(dest);

        const canvasStream = canvas.captureStream(FPS);
        for (const track of dest.stream.getAudioTracks()) canvasStream.addTrack(track);

        const recorder = buildRecorder(canvasStream);
        if (!recorder) {
          audioCtx.close();
          cleanup(loadedClips);
          reject(new Error("MediaRecorder unsupported"));
          return;
        }

        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          audioCtx.close().catch(() => {});
          cleanup(loadedClips);
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        };
        recorder.onerror = (e) => { audioCtx.close().catch(() => {}); cleanup(loadedClips); reject(e); };

        recorder.start(200);
        // t0 = audio context time at the exact moment audio starts — ground-truth clock
        const t0 = audioCtx.currentTime;
        audioSource.start(t0);
        let lastSec = 0;

        const tick = () => {
          const sec = audioCtx.currentTime - t0;
          const dt  = Math.max(0, sec - lastSec);
          lastSec   = sec;
          if (sec >= totalSeconds) { recorder.stop(); onProgress?.(100); return; }
          onProgress?.(Math.min(99, Math.round((sec / totalSeconds) * 100)));
          drawFrame(ctx, sec, dt, particles, sequencer, script, style, scriptData, totalSeconds, phraseTimestamps);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return;
      } catch (e) {
        console.warn("Audio path failed, silent fallback:", e);
      }
    }

    // ── Silent fallback ──
    const stream   = canvas.captureStream(FPS);
    const recorder = buildRecorder(stream);
    if (!recorder) { cleanup(loadedClips); reject(new Error("MediaRecorder unsupported")); return; }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
    recorder.onstop = () => { cleanup(loadedClips); resolve(new Blob(chunks, { type: recorder.mimeType })); };
    recorder.onerror = (e) => { cleanup(loadedClips); reject(e); };

    const silentSec = 45;
    recorder.start(200);
    const t0 = performance.now();
    let lastSec = 0;

    const tick = () => {
      const sec = (performance.now() - t0) / 1000;
      const dt  = Math.max(0, sec - lastSec);
      lastSec   = sec;
      if (sec >= silentSec) { recorder.stop(); onProgress?.(100); return; }
      onProgress?.(Math.min(99, Math.round((sec / silentSec) * 100)));
      drawFrame(ctx, sec, dt, particles, sequencer, script, style, scriptData, silentSec, phraseTimestamps);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
