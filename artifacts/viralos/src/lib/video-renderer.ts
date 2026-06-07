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

// ─── Particle System ────────────────────────────────────────────────

interface Particle {
  x: number; y: number; r: number;
  vx: number; vy: number; va: number;
  alpha: number; color: string; type: string;
}

function spawnParticles(style: string, count: number): Particle[] {
  const ps: Particle[] = [];
  const configs: Record<string, { colors: string[]; type: string }> = {
    dark_motivation: { colors: ["#FF2222", "#FF6600", "#FF4444", "#CC0000", "#FF8800"], type: "spark" },
    luxury_cinematic: { colors: ["#FFD700", "#FFC200", "#FFE066", "#B8960C", "#FFFACD"], type: "orb" },
    documentary:      { colors: ["#D4A574", "#C8956A", "#E8C9A0", "#A0784A", "#F0D8B4"], type: "dust" },
    anime_edit:       { colors: ["#00FFFF", "#8800FF", "#FF00FF", "#0088FF", "#FFFFFF"], type: "energy" },
  };
  const cfg = configs[style] ?? configs["dark_motivation"];

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

function updateParticles(ps: Particle[], dt: number): Particle[] {
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
  return ps;
}

function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[], style: string) {
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

// ─── Animated Backgrounds ────────────────────────────────────────────

function drawDarkMotivationBg(ctx: CanvasRenderingContext2D, sec: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#000000");
  bg.addColorStop(0.4, "#0A0000");
  bg.addColorStop(0.7, "#050000");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const pulse = 0.5 + Math.sin(sec * 1.5) * 0.15;
  const glow = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.7 * pulse);
  glow.addColorStop(0, "rgba(180,20,20,0.18)");
  glow.addColorStop(0.5, "rgba(100,5,5,0.07)");
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
  const goldGlow = ctx.createLinearGradient(W * sweep - W * 0.3, 0, W * sweep + W * 0.3, H * 0.3);
  goldGlow.addColorStop(0, "rgba(0,0,0,0)");
  goldGlow.addColorStop(0.4, "rgba(180,140,0,0.06)");
  goldGlow.addColorStop(0.6, "rgba(200,160,0,0.09)");
  goldGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = goldGlow;
  ctx.fillRect(0, 0, W, H);
}

function drawDocumentaryBg(ctx: CanvasRenderingContext2D, sec: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0D0A08");
  bg.addColorStop(0.5, "#13100C");
  bg.addColorStop(1, "#0A0806");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const warm = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.9);
  warm.addColorStop(0, "rgba(80,55,30,0.12)");
  warm.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
}

function drawAnimeEditBg(ctx: CanvasRenderingContext2D, sec: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#000000");
  bg.addColorStop(0.5, "#03001A");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H * 0.4;
  const numLines = 24;
  const rotOffset = sec * 0.1;
  ctx.save();
  for (let i = 0; i < numLines; i++) {
    const angle = ((i / numLines) * Math.PI * 2) + rotOffset;
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

  const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, 150 + Math.sin(sec * 2) * 20);
  aura.addColorStop(0, "rgba(100,0,255,0.18)");
  aura.addColorStop(0.5, "rgba(0,100,255,0.06)");
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, W, H);
}

function drawAnimatedBackground(ctx: CanvasRenderingContext2D, sec: number, style: string) {
  switch (style) {
    case "luxury_cinematic": drawLuxuryCinematicBg(ctx, sec); break;
    case "documentary":      drawDocumentaryBg(ctx, sec); break;
    case "anime_edit":       drawAnimeEditBg(ctx, sec); break;
    default:                 drawDarkMotivationBg(ctx, sec);
  }
}

// ─── Cinematic Overlays ──────────────────────────────────────────────

function drawVignette(ctx: CanvasRenderingContext2D) {
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.6, "rgba(0,0,0,0.2)");
  vig.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function drawFilmGrain(ctx: CanvasRenderingContext2D, sec: number, strength = 0.04) {
  const imgData = ctx.createImageData(W, H);
  const seed = Math.floor(sec * FPS);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = ((i * 1103515245 + seed * 12345) & 0x7fffffff) % 255;
    const v = n * strength;
    imgData.data[i] = v; imgData.data[i + 1] = v; imgData.data[i + 2] = v;
    imgData.data[i + 3] = 18;
  }
  ctx.putImageData(imgData, 0, 0);
}

// ─── Word-by-Word Text Animation ─────────────────────────────────────

function buildPhrases(text: string, maxWords = 3): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const phrases: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    phrases.push(words.slice(i, i + maxWords).join(" "));
  }
  return phrases;
}

function buildScript(script: VideoScript): { phrases: string[]; hookEnd: number; bodyEnd: number } {
  const hookPhrases = buildPhrases(script.hook, 3);
  const bodyPhrases = buildPhrases(script.body, 4);
  const ctaPhrases = buildPhrases(script.cta, 3);
  const phrases = [...hookPhrases, ...bodyPhrases, ...ctaPhrases];
  return {
    phrases,
    hookEnd: hookPhrases.length,
    bodyEnd: hookPhrases.length + bodyPhrases.length,
  };
}

function getAccentColor(style: string): string {
  return { dark_motivation: "#FF3333", luxury_cinematic: "#FFD700", documentary: "#E8C9A0", anime_edit: "#00FFFF" }[style] ?? "#4F8DFF";
}

function drawPhraseText(
  ctx: CanvasRenderingContext2D,
  phrase: string,
  progress: number,
  style: string,
  isHook: boolean,
  isCTA: boolean,
) {
  const appear = easeOut(Math.min(progress * 5, 1));
  const fade = progress > 0.75 ? 1 - easeInOut((progress - 0.75) / 0.25) : 1;
  const alpha = appear * fade;
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const fontSize = isHook ? 68 : isCTA ? 52 : 58;
  const fontWeight = "900";
  ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";

  const scale = 0.85 + easeOut(Math.min(progress * 6, 1)) * 0.15;
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H / 2);

  const words = phrase.split(" ");
  const accentColor = getAccentColor(style);
  const lineH = fontSize * 1.25;
  const maxW = W - 80;

  let lines: string[][] = [[]];
  for (const word of words) {
    const candidate = [...lines[lines.length - 1], word];
    ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(candidate.join(" ")).width > maxW && lines[lines.length - 1].length > 0) {
      lines.push([word]);
    } else {
      lines[lines.length - 1] = candidate;
    }
  }

  const totalH = lines.length * lineH;
  const baseY = H / 2 - totalH / 2 + fontSize * 0.8;

  lines.forEach((lineWords, lineIdx) => {
    const lineY = baseY + lineIdx * lineH;

    ctx.shadowColor = accentColor;
    ctx.shadowBlur = isHook ? 30 : 15;

    const wordWidths = lineWords.map((w) => ctx.measureText(w + " ").width);
    let curX = W / 2 - wordWidths.reduce((a, b) => a + b, 0) / 2;

    lineWords.forEach((word, wi) => {
      const isAccent = (lineIdx + wi) % 3 === 0;
      ctx.fillStyle = isAccent ? accentColor : "#FFFFFF";
      ctx.shadowColor = isAccent ? accentColor : "rgba(0,0,0,0.8)";
      ctx.shadowBlur = isAccent ? 20 : 10;
      ctx.fillText(word, curX + wordWidths[wi] / 2 - ctx.measureText(" ").width / 2, lineY);
      curX += wordWidths[wi];
    });
  });

  ctx.restore();
}

// ─── Video Clip Compositor ───────────────────────────────────────────

async function loadVideoElement(url: string): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const vid = document.createElement("video");
    vid.crossOrigin = "anonymous";
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = "auto";

    const timeout = setTimeout(() => resolve(null), 12000);

    vid.addEventListener("canplay", () => {
      clearTimeout(timeout);
      resolve(vid);
    }, { once: true });

    vid.addEventListener("error", () => {
      clearTimeout(timeout);
      resolve(null);
    }, { once: true });

    vid.src = url;
    vid.load();
  });
}

function drawVideoToCanvas(ctx: CanvasRenderingContext2D, vid: HTMLVideoElement) {
  if (vid.readyState < 2) return;
  const vw = vid.videoWidth || W;
  const vh = vid.videoHeight || H;

  const scale = Math.max(W / vw, H / vh);
  const sw = vw * scale;
  const sh = vh * scale;
  const sx = (W - sw) / 2;
  const sy = (H - sh) / 2;

  ctx.drawImage(vid, sx, sy, sw, sh);
}

// ─── Main Generator ───────────────────────────────────────────────────

export async function generateVideo(
  script: VideoScript,
  onProgress?: (pct: number) => void,
  audioBlob?: Blob,
  brollClips?: BrollClip[],
  phraseTimestamps?: PhraseTimestamp[],
): Promise<Blob> {
  const style = script.videoStyle ?? "dark_motivation";

  const loadedClips: { el: HTMLVideoElement; duration: number }[] = [];
  if (brollClips && brollClips.length > 0) {
    const loadResults = await Promise.all(
      brollClips.map(async (clip) => {
        const el = await loadVideoElement(clip.url);
        return el ? { el, duration: Math.min(clip.duration, 15) } : null;
      })
    );
    for (const r of loadResults) {
      if (r) loadedClips.push(r);
    }
  }

  const scriptData = buildScript(script);
  const particles = spawnParticles(style, 120);

  return new Promise(async (resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("Canvas unavailable")); return; }

    let totalSeconds = 45;

    if (audioBlob) {
      try {
        const audioCtx = new AudioContext();
        const arrayBuf = await audioBlob.arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
        totalSeconds = Math.min(audioBuf.duration + 1.5, 120);

        const dest = audioCtx.createMediaStreamDestination();
        const audioSource = audioCtx.createBufferSource();
        audioSource.buffer = audioBuf;
        audioSource.connect(dest);

        const canvasStream = canvas.captureStream(FPS);
        for (const track of dest.stream.getAudioTracks()) {
          canvasStream.addTrack(track);
        }

        const recorder = buildRecorder(canvasStream);
        if (!recorder) { audioCtx.close(); reject(new Error("MediaRecorder unsupported")); return; }

        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
        recorder.onstop = () => { audioCtx.close(); resolve(new Blob(chunks, { type: recorder.mimeType })); };
        recorder.onerror = (e) => { audioCtx.close(); reject(e); };

        startClipPlaylist(loadedClips);
        recorder.start(250);
        audioSource.start(0);

        runFrameLoop(ctx, 0, totalSeconds, particles, loadedClips, script, style, scriptData, recorder, onProgress, phraseTimestamps);
        return;
      } catch (e) {
        console.warn("Audio setup failed, silent fallback:", e);
      }
    }

    const stream = canvas.captureStream(FPS);
    const recorder = buildRecorder(stream);
    if (!recorder) { reject(new Error("MediaRecorder unsupported")); return; }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = (e) => reject(e);

    startClipPlaylist(loadedClips);
    recorder.start(250);
    runFrameLoop(ctx, 0, 45, particles, loadedClips, script, style, scriptData, recorder, onProgress, phraseTimestamps);
  });
}

function buildRecorder(stream: MediaStream): MediaRecorder | null {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      try { return new MediaRecorder(stream, { mimeType: t, videoBitsPerSecond: 4_000_000 }); } catch {}
    }
  }
  try { return new MediaRecorder(stream); } catch { return null; }
}

function startClipPlaylist(clips: { el: HTMLVideoElement; duration: number }[]) {
  if (clips.length === 0) return;
  let idx = 0;

  const playNext = () => {
    if (idx >= clips.length) idx = 0;
    const { el, duration } = clips[idx];
    el.currentTime = 0;
    el.play().catch(() => {});
    setTimeout(() => { idx++; playNext(); }, Math.max(duration * 1000 - 200, 500));
  };

  playNext();
}

function getCurrentClip(clips: { el: HTMLVideoElement; duration: number }[], sec: number): HTMLVideoElement | null {
  let elapsed = 0;
  for (const clip of clips) {
    if (sec < elapsed + clip.duration) return clip.el;
    elapsed += clip.duration;
  }
  if (clips.length > 0) return clips[clips.length - 1].el;
  return null;
}

function runFrameLoop(
  ctx: CanvasRenderingContext2D,
  frame: number,
  totalSeconds: number,
  particles: Particle[],
  clips: { el: HTMLVideoElement; duration: number }[],
  script: VideoScript,
  style: string,
  scriptData: ReturnType<typeof buildScript>,
  recorder: MediaRecorder,
  onProgress?: (pct: number) => void,
  phraseTimestamps?: PhraseTimestamp[],
) {
  const totalFrames = Math.round(FPS * totalSeconds);
  const dt = 1 / FPS;

  const tick = () => {
    if (frame >= totalFrames) {
      recorder.stop();
      onProgress?.(100);
      return;
    }

    const sec = frame / FPS;
    onProgress?.(Math.round((frame / totalFrames) * 100));

    // ── Background ──
    const clipEl = getCurrentClip(clips, sec);
    if (clipEl && clipEl.readyState >= 2) {
      drawVideoToCanvas(ctx, clipEl);

      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.55;
      const styleColor: Record<string, string> = {
        dark_motivation: "rgba(0,0,0,1)",
        luxury_cinematic: "rgba(5,3,15,1)",
        documentary: "rgba(10,6,2,1)",
        anime_edit: "rgba(0,0,10,1)",
      };
      ctx.fillStyle = styleColor[style] ?? "rgba(0,0,0,1)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      const tints: Record<string, string> = {
        dark_motivation: "rgba(60,0,0,0.15)",
        luxury_cinematic: "rgba(10,8,2,0.12)",
        documentary: "rgba(20,12,0,0.10)",
        anime_edit: "rgba(0,5,25,0.18)",
      };
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = tints[style] ?? "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else {
      drawAnimatedBackground(ctx, sec, style);
      updateParticles(particles, dt);
      drawParticles(ctx, particles, style);
    }

    // ── Vignette ──
    drawVignette(ctx);

    if (style === "documentary" || style === "dark_motivation") {
      drawFilmGrain(ctx, sec, style === "documentary" ? 0.06 : 0.035);
    }

    // ── Captions: use real timestamps if available, otherwise even distribution ──
    if (phraseTimestamps && phraseTimestamps.length > 0) {
      const current = phraseTimestamps.find(
        (pt) => sec >= pt.startSec && sec < pt.endSec,
      );
      if (current) {
        const duration = current.endSec - current.startSec;
        const phraseProgress = duration > 0 ? (sec - current.startSec) / duration : 0;
        drawPhraseText(ctx, current.phrase, Math.min(phraseProgress, 0.99), style, current.isHook, current.isCTA);
      }
    } else {
      const phrases = scriptData.phrases;
      if (phrases.length > 0) {
        const textDuration = totalSeconds * 0.92;
        const secPerPhrase = textDuration / phrases.length;
        const phraseIdx = Math.min(Math.floor(sec / secPerPhrase), phrases.length - 1);
        const phraseProgress = (sec % secPerPhrase) / secPerPhrase;
        const phrase = phrases[phraseIdx];
        const isHook = phraseIdx < scriptData.hookEnd;
        const isCTA = phraseIdx >= scriptData.bodyEnd;

        if (sec < textDuration) {
          drawPhraseText(ctx, phrase, phraseProgress, style, isHook, isCTA);
        }
      }
    }

    // ── Bottom caption bar ──
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, H - 56, W, 56);
    ctx.globalAlpha = 0.9;
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(script.title.toUpperCase().slice(0, 36), W / 2, H - 30);
    ctx.restore();

    // ── Watermark ──
    ctx.save();
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.textAlign = "right";
    ctx.fillText("VIRALOS AI", W - 18, 30);
    ctx.restore();

    // ── Scene transition flashes ──
    const hookEndSec = totalSeconds * 0.15;
    const bodyEndSec = totalSeconds * 0.82;
    for (const moment of [hookEndSec, bodyEndSec]) {
      const dist = Math.abs(sec - moment);
      if (dist < 0.25) {
        ctx.save();
        ctx.globalAlpha = (1 - dist / 0.25) * 0.35;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    frame++;
    setTimeout(tick, 1000 / FPS);
  };

  tick();
}
