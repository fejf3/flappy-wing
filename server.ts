import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  difficulty: 'easy' | 'normal' | 'hard';
  skin: string;
  stageReached: number;
  createdAt: string;
}

const LEADERBOARD_FILE = path.join(__dirname, '.leaderboard-store.json');

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    playerName: 'Falcon-99',
    score: 48,
    difficulty: 'hard',
    skin: 'phoenix',
    stageReached: 4,
    createdAt: '2026-11-01T12:00:00.000Z',
  },
  {
    id: 'seed-2',
    playerName: 'SkyMaster',
    score: 36,
    difficulty: 'normal',
    skin: 'gold',
    stageReached: 4,
    createdAt: '2026-11-02T15:30:00.000Z',
  },
  {
    id: 'seed-3',
    playerName: 'RetroPilot',
    score: 27,
    difficulty: 'normal',
    skin: 'crimson',
    stageReached: 3,
    createdAt: '2026-11-03T18:10:00.000Z',
  },
  {
    id: 'seed-4',
    playerName: 'CyberWing',
    score: 19,
    difficulty: 'hard',
    skin: 'emerald',
    stageReached: 2,
    createdAt: '2026-11-04T09:45:00.000Z',
  },
  {
    id: 'seed-5',
    playerName: 'Noor-KSA',
    score: 14,
    difficulty: 'normal',
    skin: 'azure',
    stageReached: 2,
    createdAt: '2026-11-05T20:15:00.000Z',
  },
];

function readLeaderboard(): LeaderboardEntry[] {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore read errors
  }
  return [...SEED_LEADERBOARD];
}

function writeLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch {
    // ignore write errors in read-only environments
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '16kb' }));

  // GET /api/leaderboard - Retrieve top 25 verified global scores
  app.get('/api/leaderboard', (_req, res) => {
    const entries = readLeaderboard()
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
    res.json({ entries });
  });

  // POST /api/leaderboard - Submit & validate a player's score
  app.post('/api/leaderboard', (req, res) => {
    const { playerName, score, difficulty, skin, stageReached } = req.body || {};

    const cleanName =
      typeof playerName === 'string' && playerName.trim().length > 0
        ? playerName
            .trim()
            .replace(/[<>]/g, '')
            .slice(0, 16)
        : 'Pilot';

    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 1 || numericScore > 999) {
      res.status(400).json({ error: 'Invalid score value' });
      return;
    }

    const validDiff = ['easy', 'normal', 'hard'].includes(difficulty) ? difficulty : 'normal';
    const validSkin =
      typeof skin === 'string' && skin.length <= 16 ? skin : 'classic';
    const validStage = Math.max(1, Math.min(4, Number(stageReached) || 1));

    const current = readLeaderboard();

    // Update existing player record if their new score is higher, or insert new entry
    const existingIdx = current.findIndex(
      (e) => e.playerName.toLowerCase() === cleanName.toLowerCase()
    );

    if (existingIdx >= 0) {
      if (numericScore > current[existingIdx].score) {
        current[existingIdx] = {
          ...current[existingIdx],
          score: Math.floor(numericScore),
          difficulty: validDiff,
          skin: validSkin,
          stageReached: validStage,
          createdAt: new Date().toISOString(),
        };
      }
    } else {
      current.push({
        id: 'lb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        playerName: cleanName,
        score: Math.floor(numericScore),
        difficulty: validDiff,
        skin: validSkin,
        stageReached: validStage,
        createdAt: new Date().toISOString(),
      });
    }

    const sorted = current.sort((a, b) => b.score - a.score).slice(0, 50);
    writeLeaderboard(sorted);

    res.json({ entries: sorted.slice(0, 25) });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FLAPPY WING Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
