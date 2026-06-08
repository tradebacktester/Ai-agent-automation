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

export interface PhraseTimestamp {
  phrase: string;
  startSec: number;
  endSec: number;
  isHook: boolean;
  isCTA: boolean;
}

const FPS = 30;
const W = 540;
const H = 960;

function easeOut(t: number) {
  return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
}

function easeInOut(t: number) {
  t = Math.min(Math.max(t, 0), 1);
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Particle System ────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; r: number;
  vx: number; vy: number; va: number;
  alpha: number; color: string; type: string;
}

function spawnParticles(style: string, count: number): Particle[] {
  const configs: Record<string, { colors: string[]; type: string }> = {
    dark_motivation: { colors: ["#FF2222", "#FF6600", "#FF4444", "#CC0000", "#FF8800"], type: "spark" },
    luxury_cinematic: { colors: ["#FFD700", "#FFC200", "#FFE066", "#B8960C", "#FFFACD"], type: "orb" },
    documentary:      { colors: ["#D4A574", "#C8956A", "#E8C9A0", "#A0784A", "#F0D8B4"], type: "dust" },
    anime_edit:       { colors: ["#00FFFF", "#8800FF", "#FF00FF", "#0088FF", "#FFFFFF"], type: "energy" },
  };
  const cfg = configs[style] ?? configs["dark_motivation"];
  const ps: Particle[] = [];
  for (let i = 0; i < count; i++) {
    ps.push({
      x: Math.random() * W,
      y: H + Math.random() * H,
      r: Math.random() * 2.5 + 0.5,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -(Math.random() * 3 + 1),
      va: (Math.random() - 0.5) * 0.02,
      alpha: Math.random() * 0.7 + 0.3,
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
      type: cfg.type,
    });
  }
  return ps;
}

function tickParticles(ps: Particle[], dt: number) {
  for (const p of ps) {
    p.x += p.vx * dt * FPS;
    p.y += p.vy * dt * FPS;
    p.alpha += p.va;
    if (p.y < -20 || p.alpha <= 0) {
      p.x = Math.random() * W;
      p.y = H + 10;
      p.alpha = Math.random() * 0.6 + 0.2;
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[]) {
  for (const p of ps) {
    ctx.save();
    ctx.globalAlpha = Math.min(Math.max(p.alpha, 0), 1);
    if (p.type === "orb") {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, p.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "energy") {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ─── Animated Backgrounds ────────────────────────────────────────────────────

function drawDarkMotivationBg(ctx: CanvasRenderingContext2D, sec: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#000000");
  bg.addColorStop(0.4, "#0A0000");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const pulse = 0.5 + Math.sin(sec * 1.5) * 0.15;
  const glow = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.7 * pulse);
  glow.addColorStop(0, "rgba(180,20,20,0.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function drawLuxuryCinematicBg(ctx: CanvasRenderingContext2D, sec: number) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#030510");
  bg.addColorStop(0.5, "#06071A");
  bg.addColorStop(1, "#020308");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const sweep = (sec * 0.04) % 1;
  const g = ctx.createLinearGradient(W * sweep - W * 0.3, 0, W * sweep + W * 0.3, H * 0.3);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.5, "rgba(200,160,0,0.09)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawDocumentaryBg(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0D0A08");
  bg.addColorStop(0.5, "#13100C");
  bg.addColorStop(1, "#0A0806");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
}

function drawAnimeEditBg(ctx: CanvasRenderingContext2D, sec: number) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.4;
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const angle = ((i / 24) * Math.PI * 2) + sec * 0.1;
    const spread = 0.04;
    const dist = 40 + Math.sin(sec * 3 + i) * 10;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle - spread) * dist, cy + Math.sin(angle - spread) * dist);
    ctx.lineTo(cx + Math.cos(angle) * W, cy + Math.sin(angle) * W * 2);
    ctx.lineTo(cx + Math.cos(angle + spread) * dist, cy + Math.sin(angle + spread) * dist);
    ctx.closePath();
    const alpha = 0.03 + Math.sin(sec * 2 + i * 0.5) * 0.01;
    ctx.fillStyle = i % 3 === 0 ? `rgba(0,200,255,${alpha})` : `rgba(150,0,255,${alpha})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawAnimatedBg(ctx: CanvasRenderingContext2D, sec: number, style: string) {
  switch (style) {
    case "luxury_cinematic": drawLuxuryCinematicBg(ctx, sec); break;
    case "documentary":      drawDocumentaryBg(ctx); break;
    case "anime_edit":       drawAnimeEditBg(ctx, sec); break;
    default:                 drawDarkMotivationBg(ctx, sec);
  }
}

// ─── Overlays ────────────────────────────────────────────────────────────────

function drawVignette(ctx: CanvasRenderingContext2D) {
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.6, "rgba(0,0,0,0.25)");
  vig.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function drawFilmGrain(ctx: CanvasRenderingContext2D, sec: number, strength: number) {
  const imgData = ctx.createImageData(W, H);
  const seed = Math.floor(sec * 60);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = ((i * 1103515245 + seed * 12345) & 0x7fffffff) % 255;
    const v = n * strength;
    imgData.data[i] = v;
    imgData.data[i + 1] = v;
    imgData.data[i + 2] = v;
    imgData.data[i + 3] = 22;
  }
  ctx.putImageData(imgData, 0, 0);
}

// ─── Text ────────────────────────────────────────────────────────────────────

function buildPhrases(text: string, maxWords: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const phrases: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    phrases.push(words.slice(i, i + maxWords).join(" "));
  }
  return phrases;
}

function buildScript(script: VideoScript) {
  const hookPhrases = buildPhrases(script.hook, 3);
  const bodyPhrases = buildPhrases(script.body, 4);
  const ctaPhrases  = buildPhrases(script.cta, 3);
  return {
    phrases: [...hookPhrases, ...bodyPhrases, ...ctaPhrases],
    hookEnd: hookPhrases.length,
    bodyEnd: hookPhrases.length + bodyPhrases.length,
  };
}

const ACCENT_COLORS: Record<string, string> = {
  dark_motivation: "#FF3333",
  luxury_cinematic: "#FFD700",
  documentary: "#E8C9A0",
  anime_edit: "#00FFFF",
};

function drawCaption(
  ctx: CanvasRenderingContext2D,
  phrase: string,
  progress: number,    // 0..1 within phrase lifetime
  style: string,
  isHook: boolean,
  isCTA: boolean,
) {
  const appear = easeOut(Math.min(progress * 6, 1));
  const fade   = progress > 0.8 ? 1 - easeInOut((progress - 0.8) / 0.2) : 1;
  const alpha  = appear * fade;
  if (alpha < 0.02) return;

  const accent  = ACCENT_COLORS[style] ?? "#4F8DFF";
  const fontSize = isHook ? 52 : isCTA ? 40 : 46;
  const fontStr  = `900 ${fontSize}px system-ui,-apple-system,sans-serif`;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Pop-in scale
  const scale = 0.88 + easeOut(Math.min(progress * 7, 1)) * 0.12;
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H / 2);

  ctx.font = fontStr;
  ctx.textAlign = "center";

  // Word wrap
  const words = phrase.split(" ");
  const maxW = W - 72;
  const lineH = fontSize * 1.28;
  const lines: string[][] = [[]];
  for (const word of words) {
    const candidate = [...lines[lines.length - 1], word];
    if (ctx.measureText(candidate.join(" ")).width > maxW && lines[lines.length - 1].length > 0) {
      lines.push([word]);
    } else {
      lines[lines.length - 1] = candidate;
    }
  }

  const totalH = lines.length * lineH;
  const baseY  = H * 0.64 - totalH / 2 + fontSize * 0.82;

  lines.forEach((lineWords, li) => {
    const lineY = baseY + li * lineH;
    const widths = lineWords.map((w) => ctx.measureText(w + " ").width);
    let curX = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;

    lineWords.forEach((word, wi) => {
      const isAccent = (li + wi) % 3 === 0;
      ctx.fillStyle    = isAccent ? accent : "#FFFFFF";
      ctx.shadowColor  = isAccent ? accent : "rgba(0,0,0,0.9)";
      ctx.shadowBlur   = isAccent ? 22 : 12;
      ctx.fillText(word, curX + widths[wi] / 2 - ctx.measureText(" ").width / 2, lineY);
      curX += widths[wi];
    });
  });

  ctx.restore();
}

// ─── Clip Loading ─────────────────────────────────────────────────────────────

interface LoadedClip { el: HTMLVideoElement; duration: number }

async function loadClip(url: string, container: HTMLElement): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const vid = document.createElement("video");
    // Do NOT set crossOrigin — proxy URL is same-origin so no CORS needed.
    // Setting crossOrigin="anonymous" with credentials:true on the server causes browsers to reject the response.
    vid.muted       = true;
    vid.playsInline = true;
    vid.preload     = "auto";
    vid.loop        = false;
    // Keep element in DOM so Chrome actually buffers it
    vid.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
    container.appendChild(vid);

    let resolved = false;
    const done = (result: HTMLVideoElement | null) => {
      if (!resolved) { resolved = true; resolve(result); }
    };

    const timeout = setTimeout(() => done(null), 18000);

    vid.addEventListener("canplay", () => {
      clearTimeout(timeout);
      done(vid);
    }, { once: true });

    vid.addEventListener("error", () => {
      clearTimeout(timeout);
      done(null);
    }, { once: true });

    vid.src = url;
    vid.load();
  });
}

// ─── Clip Sequencer ──────────────────────────────────────────────────────────

// Uses audio context time so the sequencer is locked to the actual audio clock
function buildSequencer(clips: LoadedClip[]) {
  // Pre-compute clip time windows
  const windows: { start: number; end: number; el: HTMLVideoElement }[] = [];
  let t = 0;
  for (const c of clips) {
    windows.push({ start: t, end: t + c.duration, el: c.el });
    t += c.duration;
  }
  const totalClipTime = t;

  function getCurrentEl(sec: number): HTMLVideoElement | null {
    if (windows.length === 0) return null;
    // Loop clips if video is longer than total clip time
    const looped = totalClipTime > 0 ? sec % totalClipTime : 0;
    return windows.find((w) => looped >= w.start && looped < w.end)?.el
      ?? windows[windows.length - 1]?.el
      ?? null;
  }

  // Kick off playback — relies on DOM-mounted elements
  let currentIdx = -1;
  function advanceClip(idx: number) {
    const i = idx % clips.length;
    if (i === currentIdx) return;
    currentIdx = i;
    // Pause previous
    clips.forEach((c, ci) => { if (ci !== i) { c.el.pause(); c.el.currentTime = 0; } });
    const { el, duration } = clips[i];
    el.currentTime = 0;
    el.play().catch(() => {});
    setTimeout(() => advanceClip(idx + 1), Math.max((duration - 0.3) * 1000, 500));
  }

  if (clips.length > 0) advanceClip(0);

  return { getCurrentEl };
}

// ─── Frame Renderer ───────────────────────────────────────────────────────────

function drawFrame(
  ctx: CanvasRenderingContext2D,
  sec: number,
  dt: number,
  particles: Particle[],
  sequencer: ReturnType<typeof buildSequencer>,
  script: VideoScript,
  style: string,
  scriptData: ReturnType<typeof buildScript>,
  totalSeconds: number,
  phraseTimestamps?: PhraseTimestamp[],
) {
  // ── 1. Background ──
  const clipEl = sequencer.getCurrentEl(sec);
  // readyState >= 2 means the browser has data for the current frame — enough to draw.
  // Do NOT check !paused: play() is async and the video may briefly report paused=true
  // right after play() is called, causing frames to be skipped.
  const hasClip = clipEl !== null && clipEl.readyState >= 2 && clipEl.videoWidth > 0;

  if (hasClip && clipEl) {
    // Draw stock footage full-cover
    const vw = clipEl.videoWidth;
    const vh = clipEl.videoHeight;
    const scale = Math.max(W / vw, H / vh);
    const sw = vw * scale, sh = vh * scale;
    ctx.drawImage(clipEl, (W - sw) / 2, (H - sh) / 2, sw, sh);

    // Cinematic color grade over footage
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.5;
    const gradeColors: Record<string, string> = {
      dark_motivation: "rgba(0,0,0,1)",
      luxury_cinematic: "rgba(5,3,15,1)",
      documentary: "rgba(10,6,2,1)",
      anime_edit: "rgba(0,0,10,1)",
    };
    ctx.fillStyle = gradeColors[style] ?? "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Style tint
    const tints: Record<string, string> = {
      dark_motivation: "rgba(50,0,0,0.18)",
      luxury_cinematic: "rgba(8,6,0,0.12)",
      documentary: "rgba(20,12,0,0.10)",
      anime_edit: "rgba(0,5,25,0.20)",
    };
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = tints[style] ?? "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else {
    // Animated canvas fallback
    drawAnimatedBg(ctx, sec, style);
    tickParticles(particles, dt);
    drawParticles(ctx, particles);
  }

  // ── 2. Vignette ──
  drawVignette(ctx);

  // ── 3. Film grain ──
  if (style === "documentary" || style === "dark_motivation") {
    drawFilmGrain(ctx, sec, style === "documentary" ? 0.065 : 0.038);
  }

  // ── 4. Captions — use real ElevenLabs timestamps when available ──
  if (phraseTimestamps && phraseTimestamps.length > 0) {
    const current = phraseTimestamps.find((pt) => sec >= pt.startSec && sec < pt.endSec);
    if (current) {
      const dur = current.endSec - current.startSec;
      const progress = dur > 0 ? (sec - current.startSec) / dur : 0;
      drawCaption(ctx, current.phrase, Math.min(progress, 0.98), style, current.isHook, current.isCTA);
    }
  } else {
    // Fallback: evenly distribute across 92% of duration
    const { phrases, hookEnd, bodyEnd } = scriptData;
    if (phrases.length > 0 && sec < totalSeconds * 0.92) {
      const secPerPhrase = (totalSeconds * 0.92) / phrases.length;
      const idx      = Math.min(Math.floor(sec / secPerPhrase), phrases.length - 1);
      const progress = (sec % secPerPhrase) / secPerPhrase;
      drawCaption(ctx, phrases[idx], progress, style, idx < hookEnd, idx >= bodyEnd);
    }
  }

  // ── 5. Lower-third title bar ──
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, H - 58, W, 58);
  ctx.globalAlpha = 0.92;
  ctx.font = "bold 17px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(script.title.toUpperCase().slice(0, 36), W / 2, H - 28);
  ctx.restore();

  // ── 6. Watermark ──
  ctx.save();
  ctx.font = "bold 13px system-ui,sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.textAlign = "right";
  ctx.fillText("VIRALOS AI", W - 16, 28);
  ctx.restore();

  // ── 7. Transition flash at hook/CTA boundaries ──
  for (const moment of [totalSeconds * 0.15, totalSeconds * 0.82]) {
    const dist = Math.abs(sec - moment);
    if (dist < 0.22) {
      ctx.save();
      ctx.globalAlpha = (1 - dist / 0.22) * 0.38;
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
      try { return new MediaRecorder(stream, { mimeType: t, videoBitsPerSecond: 5_000_000 }); } catch {}
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
  const style = script.videoStyle ?? "dark_motivation";
  const scriptData = buildScript(script);
  const particles = spawnParticles(style, 120);

  // Hidden container so video elements are mounted in DOM (required for playback in Chrome)
  const clipContainer = document.createElement("div");
  clipContainer.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(clipContainer);

  // Load clips in parallel — each gets mounted into the hidden container
  const loadedClips: LoadedClip[] = [];
  if (brollClips && brollClips.length > 0) {
    const results = await Promise.all(
      brollClips.map(async (clip) => {
        const el = await loadClip(clip.url, clipContainer);
        return el ? { el, duration: Math.min(clip.duration, 14) } : null;
      }),
    );
    for (const r of results) { if (r) loadedClips.push(r); }
  }

  const sequencer = buildSequencer(loadedClips);

  return new Promise(async (resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      document.body.removeChild(clipContainer);
      reject(new Error("Canvas 2D unavailable"));
      return;
    }

    const cleanup = () => {
      try { document.body.removeChild(clipContainer); } catch {}
    };

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
          cleanup();
          reject(new Error("MediaRecorder unsupported"));
          return;
        }

        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          audioCtx.close().catch(() => {});
          cleanup();
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        };
        recorder.onerror = (e) => { audioCtx.close().catch(() => {}); cleanup(); reject(e); };

        recorder.start(200);

        // Record EXACT moment audio starts — use this as ground truth for all timing
        const t0 = audioCtx.currentTime;
        audioSource.start(t0);
        let lastSec = -1;
        let lastRafTime = performance.now();

        const tick = () => {
          // sec = real audio playback position — PERFECT sync with voice
          const sec = audioCtx.currentTime - t0;
          const dt = Math.max(0, sec - lastSec);
          lastSec = sec;

          if (sec >= totalSeconds) {
            recorder.stop();
            onProgress?.(100);
            return;
          }

          onProgress?.(Math.min(99, Math.round((sec / totalSeconds) * 100)));
          drawFrame(ctx, sec, dt, particles, sequencer, script, style, scriptData, totalSeconds, phraseTimestamps);
          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
        return;
      } catch (e) {
        console.warn("Audio path failed, falling back to silent:", e);
      }
    }

    // ── Silent fallback (no audio blob) ──
    const silentSec = 45;
    const stream    = canvas.captureStream(FPS);
    const recorder  = buildRecorder(stream);
    if (!recorder) { cleanup(); reject(new Error("MediaRecorder unsupported")); return; }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
    recorder.onstop = () => { cleanup(); resolve(new Blob(chunks, { type: recorder.mimeType })); };
    recorder.onerror = (e) => { cleanup(); reject(e); };

    recorder.start(200);
    const t0 = performance.now();
    let lastSec = -1;

    const tick = () => {
      const sec = (performance.now() - t0) / 1000;
      const dt = Math.max(0, sec - lastSec);
      lastSec = sec;

      if (sec >= silentSec) {
        recorder.stop();
        onProgress?.(100);
        return;
      }

      onProgress?.(Math.min(99, Math.round((sec / silentSec) * 100)));
      drawFrame(ctx, sec, dt, particles, sequencer, script, style, scriptData, silentSec, phraseTimestamps);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}
