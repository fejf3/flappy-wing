/**
 * Complete, 100% self-contained single-file HTML5 version of the 2013 Flappy Bird clone.
 * Can be downloaded as a standalone .html file or copied to clipboard.
 */

export const STANDALONE_FLAPPY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>FLAPPY WING (Pixel-Perfect Retro Edition)</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    html, body {
      width: 100%;
      height: 100%;
      background-color: #12151a;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      font-family: monospace;
    }
    .cabinet {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
      padding: 12px;
    }
    canvas {
      width: auto;
      height: min(94vh, calc(94vw * (512 / 288)));
      aspect-ratio: 288 / 512;
      image-rendering: -moz-crisp-edges;
      image-rendering: -webkit-crisp-edges;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      border: 4px solid #2a2f3a;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.75);
      cursor: pointer;
      background-color: #70c5ce;
      touch-action: manipulation;
    }
  </style>
</head>
<body>
  <div class="cabinet">
    <canvas id="gameCanvas" width="288" height="512"></canvas>
  </div>

  <script>
    (function () {
      "use strict";

      // ============================================================================
      // 1. WEB AUDIO API PROCEDURAL RETRO SOUND SYNTHESIZER (5 ORIGINAL SOUNDS)
      // ============================================================================
      class SoundSynthesizer {
        constructor() {
          this.ctx = null;
        }

        ensureContext() {
          if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
          }
          if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume().catch(() => {});
          }
          return this.ctx;
        }

        // Flap: Short white-noise + upward frequency sweep "whoosh"
        playFlap() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const duration = 0.095;
          const bufferSize = Math.floor(ctx.sampleRate * duration);
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
          }

          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;

          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.Q.setValueAtTime(2.2, now);
          filter.frequency.setValueAtTime(380, now);
          filter.frequency.exponentialRampToValueAtTime(1350, now + duration);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.18, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.005, now + duration);

          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          noise.start(now);
          noise.stop(now + duration);

          const osc = ctx.createOscillator();
          const oscGain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(210, now);
          osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);
          oscGain.gain.setValueAtTime(0.14, now);
          oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
          osc.connect(oscGain);
          oscGain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.085);
        }

        // Score/Point: Classic two-tone high-pitched coin/ding sound (B5 to E6)
        playScore() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = "square";
          osc.frequency.setValueAtTime(987.77, now);        // B5
          osc.frequency.setValueAtTime(1318.51, now + 0.075); // E6

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(3600, now);

          gain.gain.setValueAtTime(0.16, now);
          gain.gain.setValueAtTime(0.18, now + 0.075);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.39);
        }

        // Hit: Low-frequency thud/punch noise on collision
        playHit() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;

          const osc = ctx.createOscillator();
          const oscGain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.exponentialRampToValueAtTime(32, now + 0.13);
          oscGain.gain.setValueAtTime(0.32, now);
          oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          osc.connect(oscGain);
          oscGain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.14);

          const duration = 0.11;
          const bufferSize = Math.floor(ctx.sampleRate * duration);
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.8);
          }

          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(950, now);
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.35, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.005, now + duration);

          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          noise.start(now);
          noise.stop(now + duration);
        }

        // Die: Falling pitch slide when the bird drops after hitting a pipe
        playDie() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(640, now);
          osc.frequency.exponentialRampToValueAtTime(115, now + 0.34);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        }

        // Swoosh: UI transition sound when the scoreboard appears
        playSwoosh() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const duration = 0.18;
          const bufferSize = Math.floor(ctx.sampleRate * duration);
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
          }

          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.Q.setValueAtTime(1.6, now);
          filter.frequency.setValueAtTime(260, now);
          filter.frequency.exponentialRampToValueAtTime(1100, now + duration * 0.55);
          filter.frequency.exponentialRampToValueAtTime(340, now + duration);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.005, now + duration);

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          noise.start(now);
          noise.stop(now + duration);
        }
      }

      const sound = new SoundSynthesizer();

      // ============================================================================
      // 2. OFFSCREEN PROCEDURAL PIXEL-ART SPRITE GENERATOR
      // ============================================================================
      function makeOffscreen(w, h) {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const cx = c.getContext("2d");
        cx.imageSmoothingEnabled = false;
        return [c, cx];
      }

      function createBirdFrame(wingState) {
        const [c, cx] = makeOffscreen(34, 24);
        const palette = {
          K: "#543847",
          Y: "#f8e71c",
          G: "#e5c100",
          O: "#f5a623",
          W: "#ffffff",
          C: "#f7f2d7",
          R: "#f75a1b",
          D: "#d03b0d"
        };
        const baseRows = [
          "......KKKKKK.....",
          "....KKYYYYGWKK...",
          "...KYYYYYYKWWWK..",
          "..KYYYYYYYKWWKWWK",
          ".KYYYYYYYYKWWKWWK",
          ".KYYYYYYYYYKWWWWK",
          ".KYYYYYYYYYYKKKKK",
          ".KYYYYYYYYYKRRRRK",
          "..KOOOOOOOOKKKKKK",
          "...KOOOOOOOOKDDDK",
          "....KKOOOOOOKKKKK",
          "......KKKKKK....."
        ];
        const wings = {
          0: [
            ".................",
            ".................",
            "....KKKKK........",
            "...KWWWWWK.......",
            "..KWWWWWWWK......",
            "..KCCCCCCCK......",
            "...KKKKKKK.......",
            ".................",
            ".................",
            ".................",
            ".................",
            "................."
          ],
          1: [
            ".................",
            ".................",
            ".................",
            ".................",
            "...KKKKKKK.......",
            "..KWWWWWWWK......",
            "..KCCCCCCCK......",
            "...KKKKKKK.......",
            ".................",
            ".................",
            ".................",
            "................."
          ],
          2: [
            ".................",
            ".................",
            ".................",
            ".................",
            ".................",
            "...KKKKKKK.......",
            "..KWWWWWWWK......",
            "..KCCCCCCCK......",
            "...KKKKKKK.......",
            ".................",
            ".................",
            "................."
          ]
        };
        const ov = wings[wingState];
        for (let y = 0; y < 12; y++) {
          for (let x = 0; x < 17; x++) {
            const ch = ov[y][x] !== "." ? ov[y][x] : baseRows[y][x];
            if (ch !== "." && palette[ch]) {
              cx.fillStyle = palette[ch];
              cx.fillRect(x * 2, y * 2, 2, 2);
            }
          }
        }
        return c;
      }

      function createBackground() {
        const [c, cx] = makeOffscreen(288, 400);
        cx.fillStyle = "#70c5ce";
        cx.fillRect(0, 0, 288, 400);

        const puffs = [
          [16, 310, 22], [44, 300, 28], [76, 312, 20],
          [108, 306, 24], [142, 296, 30], [176, 308, 22],
          [208, 302, 26], [242, 298, 28], [274, 310, 22]
        ];
        for (const [px, py, r] of puffs) {
          cx.fillStyle = "#d5eef2";
          cx.fillRect(px - r, py - r + 4, r * 2, r * 2);
          cx.fillStyle = "#eff9fb";
          cx.fillRect(px - r, py - r, r * 2, r * 2 - 4);
        }
        cx.fillStyle = "#eff9fb";
        cx.fillRect(0, 312, 288, 55);
        cx.fillStyle = "#d5eef2";
        cx.fillRect(0, 336, 288, 35);

        const buildings = [
          { x: 4, w: 32, h: 74, f: false },
          { x: 30, w: 28, h: 56, f: true },
          { x: 56, w: 38, h: 88, f: false },
          { x: 88, w: 26, h: 64, f: true },
          { x: 112, w: 34, h: 78, f: false },
          { x: 142, w: 30, h: 52, f: true },
          { x: 170, w: 40, h: 92, f: false },
          { x: 204, w: 28, h: 68, f: true },
          { x: 230, w: 34, h: 80, f: false },
          { x: 260, w: 28, h: 60, f: true }
        ];
        for (const b of buildings) {
          const by = 374 - b.h;
          cx.fillStyle = "#65b082";
          cx.fillRect(b.x - 2, by - 2, b.w + 4, b.h + 4);
          cx.fillStyle = b.f ? "#85cc9f" : "#a8e0b8";
          cx.fillRect(b.x, by, b.w, b.h);
          cx.fillStyle = "#d8f5df";
          for (let wy = by + 6; wy < 360; wy += 10) {
            for (let wx = b.x + 4; wx < b.x + b.w - 6; wx += 8) {
              cx.fillRect(wx, wy, 4, 6);
            }
          }
        }

        for (let bx = -8; bx < 300; bx += 24) {
          const bh = 26 + ((bx * 7) % 12);
          const by = 400 - bh;
          cx.fillStyle = "#40a850";
          cx.fillRect(bx - 2, by - 2, 28, bh + 2);
          cx.fillStyle = "#5ee270";
          cx.fillRect(bx, by, 24, bh);
          cx.fillStyle = "#85f293";
          cx.fillRect(bx + 2, by + 2, 20, 6);
        }
        return c;
      }

      function createGround() {
        const [c, cx] = makeOffscreen(336, 112);
        cx.fillStyle = "#543847";
        cx.fillRect(0, 0, 336, 2);
        cx.fillStyle = "#d6f589";
        cx.fillRect(0, 2, 336, 2);
        cx.fillStyle = "#73bf2e";
        cx.fillRect(0, 4, 336, 14);
        for (let x = -24; x < 360; x += 24) {
          cx.fillStyle = "#9ce659";
          for (let i = 0; i < 14; i += 2) cx.fillRect(x + 12 - i, 4 + i, 10, 2);
          cx.fillStyle = "#558c22";
          for (let i = 0; i < 14; i += 2) cx.fillRect(x + 22 - i, 4 + i, 4, 2);
        }
        cx.fillStyle = "#543847";
        cx.fillRect(0, 18, 336, 2);
        cx.fillStyle = "#d2aa4e";
        cx.fillRect(0, 20, 336, 4);
        cx.fillStyle = "#ded895";
        cx.fillRect(0, 24, 336, 88);
        cx.fillStyle = "#d0c878";
        for (let x = 0; x < 336; x += 24) {
          cx.fillRect(x + 4, 32, 6, 4);
          cx.fillRect(x + 16, 44, 4, 4);
          cx.fillRect(x + 8, 62, 8, 4);
          cx.fillRect(x + 18, 78, 4, 6);
          cx.fillRect(x + 2, 94, 6, 4);
        }
        return c;
      }

      function createMedal(type) {
        const [c, cx] = makeOffscreen(44, 44);
        const schemes = {
          bronze: { light: "#f4a259", dark: "#9e4710", center: "#b85b18" },
          silver: { light: "#f0f5f7", dark: "#7a888e", center: "#98a6ac" },
          gold: { light: "#fff078", dark: "#b37c00", center: "#d89b00" },
          platinum: { light: "#ffffff", dark: "#88b3c8", center: "#bce0f0" }
        };
        const sc = schemes[type];
        for (let y = 0; y < 44; y += 2) {
          for (let x = 0; x < 44; x += 2) {
            const dx = x + 1 - 22;
            const dy = y + 1 - 22;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= 20) {
              cx.fillStyle = dist > 18 ? "#543847" : dist > 14 ? (dx + dy < 0 ? sc.light : sc.dark) : dist > 12.5 ? sc.dark : sc.center;
              cx.fillRect(x, y, 2, 2);
            }
          }
        }
        cx.fillStyle = sc.light;
        cx.fillRect(20, 12, 4, 20);
        cx.fillRect(12, 20, 20, 4);
        cx.fillRect(16, 16, 12, 12);
        return c;
      }

      const bgSprite = createBackground();
      const groundSprite = createGround();
      const birdSprites = [createBirdFrame(0), createBirdFrame(1), createBirdFrame(2)];
      const medalSprites = {
        bronze: createMedal("bronze"),
        silver: createMedal("silver"),
        gold: createMedal("gold"),
        platinum: createMedal("platinum")
      };

      const FONT = {
        "0": ["11111","11011","11011","11011","11011","11011","11111"],
        "1": ["00110","01110","00110","00110","00110","00110","01111"],
        "2": ["11111","00011","00011","11111","11000","11000","11111"],
        "3": ["11111","00011","00011","01111","00011","00011","11111"],
        "4": ["11011","11011","11011","11111","00011","00011","00011"],
        "5": ["11111","11000","11000","11111","00011","00011","11111"],
        "6": ["11111","11000","11000","11111","11011","11011","11111"],
        "7": ["11111","11011","00011","00011","00011","00011","00011"],
        "8": ["11111","11011","11011","11111","11011","11011","11111"],
        "9": ["11111","11011","11011","11111","00011","00011","11111"],
        "A": ["01110","11011","11011","11111","11011","11011","11011"],
        "B": ["11110","11011","11011","11110","11011","11011","11110"],
        "C": ["01111","11000","11000","11000","11000","11000","01111"],
        "D": ["11110","11011","11011","11011","11011","11011","11110"],
        "E": ["11111","11000","11000","11110","11000","11000","11111"],
        "F": ["11111","11000","11000","11110","11000","11000","11000"],
        "G": ["01111","11000","11000","11011","11011","11011","01111"],
        "I": ["11111","00100","00100","00100","00100","00100","11111"],
        "K": ["11011","11010","11100","11100","11010","11011","11011"],
        "L": ["11000","11000","11000","11000","11000","11000","11111"],
        "M": ["11011","11111","11111","11011","11011","11011","11011"],
        "N": ["11011","11111","11111","11111","11011","11011","11011"],
        "O": ["01110","11011","11011","11011","11011","11011","01110"],
        "P": ["11110","11011","11011","11110","11000","11000","11000"],
        "R": ["11110","11011","11011","11110","11010","11011","11011"],
        "S": ["01111","11000","11000","01110","00011","00011","11110"],
        "T": ["11111","00100","00100","00100","00100","00100","00100"],
        "V": ["11011","11011","11011","11011","11011","01110","00100"],
        "W": ["11011","11011","11011","11011","11111","11111","11011"],
        "Y": ["11011","11011","11011","01110","00100","00100","00100"],
        "!": ["00100","00100","00100","00100","00100","00000","00100"],
        " ": ["00000","00000","00000","00000","00000","00000","00000"]
      };

      function drawPixelText(ctx, text, x, y, scale, fill, outline, align, highlight) {
        const str = String(text).toUpperCase();
        const cw = 5 * scale;
        const sp = scale;
        const totalW = str.length * cw + Math.max(0, str.length - 1) * sp;
        let sx = Math.round(x);
        if (align === "center") sx = Math.round(x - totalW / 2);
        else if (align === "right") sx = Math.round(x - totalW);
        const sy = Math.round(y);

        ctx.fillStyle = outline || "#000000";
        for (let i = 0; i < str.length; i++) {
          const g = FONT[str[i]] || FONT[" "];
          const gx = sx + i * (cw + sp);
          for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 5; c++) {
              if (g[r][c] === "1") {
                const px = gx + c * scale;
                const py = sy + r * scale;
                ctx.fillRect(px - scale, py, scale, scale);
                ctx.fillRect(px + scale, py, scale, scale);
                ctx.fillRect(px, py - scale, scale, scale);
                ctx.fillRect(px, py + scale, scale, scale);
                ctx.fillRect(px - scale, py - scale, scale, scale);
                ctx.fillRect(px + scale, py - scale, scale, scale);
                ctx.fillRect(px - scale, py + scale, scale, scale);
                ctx.fillRect(px + scale, py + scale, scale, scale);
                ctx.fillRect(px, py + scale * 1.5, scale, scale);
              }
            }
          }
        }

        for (let i = 0; i < str.length; i++) {
          const g = FONT[str[i]] || FONT[" "];
          const gx = sx + i * (cw + sp);
          for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 5; c++) {
              if (g[r][c] === "1") {
                ctx.fillStyle = highlight && r < 3 ? highlight : fill;
                ctx.fillRect(gx + c * scale, sy + r * scale, scale, scale);
              }
            }
          }
        }
      }

      function drawPipe(ctx, x, y, w, h, isTop) {
        if (h <= 0) return;
        const rx = Math.round(x);
        const ry = Math.round(y);
        const lipH = Math.min(24, h);
        const drawTube = (tx, ty, tw, th) => {
          if (th <= 0) return;
          ctx.fillStyle = "#543847";
          ctx.fillRect(tx, ty, tw, th);
          const ix = tx + 2, iw = tw - 4;
          ctx.fillStyle = "#73bf2e";
          ctx.fillRect(ix, ty, iw, th);
          ctx.fillStyle = "#9ce659";
          ctx.fillRect(ix + 2, ty, 8, th);
          ctx.fillStyle = "#c8f786";
          ctx.fillRect(ix + 4, ty, 4, th);
          ctx.fillStyle = "#73bf2e";
          ctx.fillRect(ix + 12, ty, 2, th);
          ctx.fillStyle = "#9ce659";
          ctx.fillRect(ix + 14, ty, 2, th);
          ctx.fillStyle = "#558c22";
          ctx.fillRect(ix + iw - 12, ty, 12, th);
          ctx.fillStyle = "#3e6b15";
          ctx.fillRect(ix + iw - 6, ty, 4, th);
        };
        if (isTop) {
          const shaftH = Math.max(0, h - lipH);
          drawTube(rx + 2, ry, w - 4, shaftH);
          drawTube(rx, ry + shaftH, w, lipH);
          ctx.fillStyle = "#543847";
          ctx.fillRect(rx, ry + shaftH, w, 2);
          ctx.fillRect(rx, ry + h - 2, w, 2);
        } else {
          const shaftH = Math.max(0, h - lipH);
          drawTube(rx, ry, w, lipH);
          ctx.fillStyle = "#543847";
          ctx.fillRect(rx, ry, w, 2);
          ctx.fillRect(rx, ry + lipH - 2, w, 2);
          drawTube(rx + 2, ry + lipH, w - 4, shaftH);
        }
      }

      // ============================================================================
      // 3. EXACT 2013 FLAPPY BIRD PHYSICS & 4-STATE MACHINE
      // ============================================================================
      const canvas = document.getElementById("gameCanvas");
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;

      const GRAVITY = 0.25;
      const FLAP_VELOCITY = -4.6;
      const TERMINAL_VELOCITY = 10;
      const PIPE_SPEED = 2;
      const BG_SPEED = 0.5;
      const PIPE_WIDTH = 52;
      const PIPE_GAP = 100;
      const PIPE_SPAWN_FRAMES = 90;
      const GROUND_Y = 400; // 512 - 112

      let state = "GET_READY"; // GET_READY | PLAYING | DYING | GAME_OVER
      let frameCount = 0;
      let bgScroll = 0;
      let groundScroll = 0;
      let score = 0;
      let bestScore = parseInt(localStorage.getItem("flappy_best_score_2013") || "0", 10) || 0;
      let isNewBest = false;
      let flashFrames = 0;
      let boardY = 520;
      let displayScore = 0;
      let gameOverTicks = 0;

      const bird = {
        x: 84,
        y: 244,
        vy: 0,
        rotation: 0, // degrees: -25 to +90
        width: 34,
        height: 24,
        flapHoldFrames: 0
      };

      let pipes = [];
      let pipeTimer = 0;

      function resetToGetReady() {
        state = "GET_READY";
        score = 0;
        isNewBest = false;
        pipes = [];
        pipeTimer = 0;
        bird.x = 84;
        bird.y = 244;
        bird.vy = 0;
        bird.rotation = 0;
        bird.flapHoldFrames = 0;
        flashFrames = 0;
      }

      function triggerFlap() {
        if (state === "GET_READY") {
          state = "PLAYING";
          bird.vy = FLAP_VELOCITY;
          bird.rotation = -25;
          bird.flapHoldFrames = 14;
          pipeTimer = 20;
          sound.playFlap();
        } else if (state === "PLAYING") {
          bird.vy = FLAP_VELOCITY;
          bird.rotation = -25;
          bird.flapHoldFrames = 14;
          sound.playFlap();
        } else if (state === "GAME_OVER" && gameOverTicks > 24) {
          sound.playSwoosh();
          resetToGetReady();
        }
      }

      function triggerDeath(hitPipeMidAir) {
        if (state !== "PLAYING") return;
        state = "DYING";
        flashFrames = 2;
        sound.playHit();
        if (hitPipeMidAir) {
          setTimeout(() => sound.playDie(), 110);
        }
      }

      function enterGameOver() {
        state = "GAME_OVER";
        boardY = 520;
        displayScore = 0;
        gameOverTicks = 0;
        if (score > bestScore) {
          bestScore = score;
          isNewBest = true;
          localStorage.setItem("flappy_best_score_2013", String(bestScore));
        }
        sound.playSwoosh();
      }

      function updateFixed60FPS() {
        frameCount++;

        if (state === "GET_READY") {
          bgScroll = (bgScroll + BG_SPEED) % 288;
          groundScroll = (groundScroll + PIPE_SPEED) % 24;
          bird.y = 244 + Math.sin(frameCount * 0.12) * 5;
          bird.rotation = 0;
        } else if (state === "PLAYING") {
          bgScroll = (bgScroll + BG_SPEED) % 288;
          groundScroll = (groundScroll + PIPE_SPEED) % 24;

          // Bird physics
          bird.vy = Math.min(TERMINAL_VELOCITY, bird.vy + GRAVITY);
          bird.y += bird.vy;

          if (bird.y < 0) {
            bird.y = 0;
          }

          // Bird rotation mechanics (-25 deg upward tilt held briefly, then clockwise to +90 deg)
          if (bird.vy < 0 || bird.flapHoldFrames > 0) {
            if (bird.flapHoldFrames > 0) bird.flapHoldFrames--;
            bird.rotation = Math.max(-25, bird.rotation - 6);
          } else {
            const rotStep = bird.vy > 3.2 ? 4.8 : 2.8;
            bird.rotation = Math.min(90, bird.rotation + rotStep);
          }

          // Spawn pipes every 90 frames
          pipeTimer++;
          if (pipeTimer >= PIPE_SPAWN_FRAMES) {
            pipeTimer = 0;
            // Safe bounds: min 50px from top and min 50px from ground (400 - 50 - 100 = 250)
            const minTop = 50;
            const maxTop = GROUND_Y - 50 - PIPE_GAP; // 250
            const topHeight = Math.floor(minTop + Math.random() * (maxTop - minTop + 1));
            pipes.push({
              x: 292,
              topHeight,
              passed: false
            });
          }

          // Forgiving hitbox: 2px smaller on all sides than 34x24 visual sprite -> 30x20
          const hbLeft = bird.x - bird.width / 2 + 2;
          const hbRight = bird.x + bird.width / 2 - 2;
          const hbTop = bird.y - bird.height / 2 + 2;
          const hbBottom = bird.y + bird.height / 2 - 2;

          for (let i = pipes.length - 1; i >= 0; i--) {
            const p = pipes[i];
            p.x -= PIPE_SPEED;

            if (!p.passed && p.x + PIPE_WIDTH / 2 < bird.x) {
              p.passed = true;
              score++;
              sound.playScore();
            }

            if (hbRight > p.x && hbLeft < p.x + PIPE_WIDTH) {
              if (hbTop < p.topHeight || hbBottom > p.topHeight + PIPE_GAP) {
                triggerDeath(true);
                break;
              }
            }

            if (p.x < -PIPE_WIDTH - 10) {
              pipes.splice(i, 1);
            }
          }

          // Ground collision
          if (hbBottom >= GROUND_Y) {
            bird.y = GROUND_Y - bird.height / 2;
            bird.rotation = 90;
            triggerDeath(false);
          }
        } else if (state === "DYING") {
          if (flashFrames > 0) flashFrames--;

          bird.vy = Math.min(TERMINAL_VELOCITY, bird.vy + GRAVITY);
          bird.y += bird.vy;
          bird.rotation = Math.min(90, bird.rotation + 6);

          if (bird.y + bird.height / 2 >= GROUND_Y) {
            bird.y = GROUND_Y - bird.height / 2;
            bird.rotation = 90;
            enterGameOver();
          }
        } else if (state === "GAME_OVER") {
          gameOverTicks++;
          if (boardY > 180) {
            boardY = Math.max(180, boardY - 22);
          } else if (displayScore < score && gameOverTicks % 2 === 0) {
            displayScore = Math.min(score, displayScore + Math.max(1, Math.ceil(score / 25)));
          }
        }
      }

      function render() {
        ctx.clearRect(0, 0, 288, 512);

        // 1. Parallax Background
        const bx = -Math.floor(bgScroll);
        ctx.drawImage(bgSprite, bx, 0);
        ctx.drawImage(bgSprite, bx + 288, 0);

        // 2. Pipes
        for (const p of pipes) {
          drawPipe(ctx, p.x, 0, PIPE_WIDTH, p.topHeight, true);
          const bottomY = p.topHeight + PIPE_GAP;
          drawPipe(ctx, p.x, bottomY, PIPE_WIDTH, GROUND_Y - bottomY, false);
        }

        // 3. Ground Strip
        ctx.drawImage(groundSprite, -Math.floor(groundScroll), GROUND_Y);

        // 4. Bird Sprite with Rotation
        const wingCycle = [0, 1, 2, 1];
        const wingIndex = (state === "DYING" || state === "GAME_OVER")
          ? 1
          : wingCycle[Math.floor(frameCount / 5) % 4];

        ctx.save();
        ctx.translate(Math.round(bird.x), Math.round(bird.y));
        ctx.rotate((bird.rotation * Math.PI) / 180);
        ctx.drawImage(birdSprites[wingIndex], -bird.width / 2, -bird.height / 2);
        ctx.restore();

        // 5. State-Specific UI Overlays
        if (state === "GET_READY") {
          drawPixelText(ctx, "FLAPPY WING", 144, 68, 3, "#ffffff", "#543847", "center", "#f8e71c");
          drawPixelText(ctx, "GET READY!", 144, 136, 3, "#85f293", "#543847", "center", "#ffffff");
          drawPixelText(ctx, "TAP OR SPACE", 144, 312, 2, "#ffffff", "#543847", "center", "#f8e71c");
        } else if (state === "PLAYING" || state === "DYING") {
          drawPixelText(ctx, String(score), 144, 42, 4, "#ffffff", "#000000", "center");
        } else if (state === "GAME_OVER") {
          drawPixelText(ctx, "GAME OVER", 144, 118, 3, "#f75a1b", "#543847", "center", "#f8e71c");

          const bxPanel = 31;
          const byPanel = Math.round(boardY);
          const bwPanel = 226;
          const bhPanel = 116;

          ctx.fillStyle = "#543847";
          ctx.fillRect(bxPanel - 2, byPanel - 2, bwPanel + 4, bhPanel + 4);
          ctx.fillStyle = "#ded895";
          ctx.fillRect(bxPanel, byPanel, bwPanel, bhPanel);
          ctx.fillStyle = "#f7f2d7";
          ctx.fillRect(bxPanel + 2, byPanel + 2, bwPanel - 4, 2);
          ctx.fillStyle = "#c9be74";
          ctx.fillRect(bxPanel + 2, byPanel + bhPanel - 4, bwPanel - 4, 2);

          drawPixelText(ctx, "MEDAL", bxPanel + 26, byPanel + 16, 1.5, "#d97324", "#543847", "left");
          drawPixelText(ctx, "SCORE", bxPanel + bwPanel - 20, byPanel + 16, 1.5, "#d97324", "#543847", "right");
          drawPixelText(ctx, String(displayScore), bxPanel + bwPanel - 20, byPanel + 32, 2.5, "#ffffff", "#543847", "right");
          drawPixelText(ctx, "BEST", bxPanel + bwPanel - 20, byPanel + 62, 1.5, "#d97324", "#543847", "right");
          drawPixelText(ctx, String(bestScore), bxPanel + bwPanel - 20, byPanel + 78, 2.5, "#ffffff", "#543847", "right");

          if (isNewBest) {
            ctx.fillStyle = "#e03c00";
            ctx.fillRect(bxPanel + 128, byPanel + 60, 32, 14);
            drawPixelText(ctx, "NEW", bxPanel + 144, byPanel + 63, 1, "#ffffff", "#e03c00", "center");
          }

          // Medal slot recess
          ctx.fillStyle = "#c4ba70";
          ctx.fillRect(bxPanel + 24, byPanel + 36, 48, 48);
          let medal = null;
          if (score >= 40) medal = medalSprites.platinum;
          else if (score >= 30) medal = medalSprites.gold;
          else if (score >= 20) medal = medalSprites.silver;
          else if (score >= 10) medal = medalSprites.bronze;
          if (medal) {
            ctx.drawImage(medal, bxPanel + 26, byPanel + 38);
          }

          if (boardY <= 180) {
            const btnX = 92, btnY = 324, btnW = 104, btnH = 36;
            ctx.fillStyle = "#543847";
            ctx.fillRect(btnX - 2, btnY - 2, btnW + 4, btnH + 4);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(btnX, btnY, btnW, btnH);
            ctx.fillStyle = "#e0601b";
            ctx.fillRect(btnX + 3, btnY + 3, btnW - 6, btnH - 6);
            drawPixelText(ctx, "PLAY", 144, btnY + 11, 2, "#ffffff", "#543847", "center");
          }
        }

        // 2-Frame Solid White Collision Flash
        if (flashFrames > 0) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, 288, 512);
        }
      }

      // ============================================================================
      // 4. FIXED 60 FPS TIMESTEP ACCUMULATOR LOOP
      // ============================================================================
      const FIXED_STEP = 1000 / 60;
      let lastTimestamp = performance.now();
      let accumulator = 0;

      function gameLoop(now) {
        let delta = now - lastTimestamp;
        lastTimestamp = now;
        if (delta > 100) delta = 100;
        accumulator += delta;

        while (accumulator >= FIXED_STEP) {
          updateFixed60FPS();
          accumulator -= FIXED_STEP;
        }
        render();
        requestAnimationFrame(gameLoop);
      }

      window.addEventListener("keydown", (e) => {
        if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
          e.preventDefault();
          triggerFlap();
        }
      });
      canvas.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        triggerFlap();
      });

      requestAnimationFrame(gameLoop);
    })();
  </script>
</body>
</html>`;
