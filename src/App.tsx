import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Download,
  Copy,
  Check,
  RotateCcw,
  Eye,
  Sun,
  Moon,
  Play,
  Pause,
  Settings,
  Palette,
  Home,
  Share2,
  Smartphone,
  Music,
  Vibrate,
  X,
  Trophy,
  Sliders,
  Award,
  Coins,
  Target,
  RefreshCw,
  Shield,
  Zap,
  Globe,
  Lock,
} from 'lucide-react';
import { FlappySoundEngine } from './soundEngine';
import {
  buildSpriteAtlas,
  drawPixelPipe,
  drawPixelText,
  drawPixelCoin,
  drawPixelPowerUp,
  SpriteAtlas,
  BIRD_SKINS,
  BirdSkinId,
  StageThemeId,
} from './pixelSprites';
import { STANDALONE_FLAPPY_HTML } from './standaloneHtml';
import { usePWAInstall } from './usePWAInstall';
import {
  DailyChallengeState,
  DAILY_CHALLENGE_POOL,
  loadDailyChallengeState,
  saveDailyChallengeState,
  getActiveChallengeTemplate,
  recordDailyChallengeEvent,
  claimDailyChallengeReward,
  activateNextBonusChallenge,
} from './dailyChallenges';
import {
  SHOP_BIRDS,
  ACHIEVEMENTS_LIST,
  PowerUpType,
  PlayerProfileState,
  loadPlayerProfile,
  savePlayerProfile,
} from './achievementsAndShop';

type GameState = 'MAIN_MENU' | 'GET_READY' | 'PLAYING' | 'DYING' | 'GAME_OVER';
type ActiveModal =
  | 'none'
  | 'settings'
  | 'skins'
  | 'achievements'
  | 'leaderboard'
  | 'ios_install';
type ActiveTab = 'arcade' | 'leaderboard' | 'physics' | 'audio' | 'source';
export type DifficultyLevel = 'easy' | 'normal' | 'hard';
export type StageModeOption = 'auto' | StageThemeId;

interface DifficultyConfig {
  id: DifficultyLevel;
  labelAr: string;
  labelEn: string;
  descAr: string;
  pipeGap: number;
  pipeSpeed: number;
  spawnInterval: number;
}

const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    id: 'easy',
    labelAr: 'سهل',
    labelEn: 'Easy',
    descAr: 'أنابيب متباعدة وسرعة أبطأ',
    pipeGap: 122,
    pipeSpeed: 1.65,
    spawnInterval: 110,
  },
  normal: {
    id: 'normal',
    labelAr: 'عادي',
    labelEn: 'Normal',
    descAr: 'الفيزياء الأصلية المتوازنة',
    pipeGap: 100,
    pipeSpeed: 2.0,
    spawnInterval: 90,
  },
  hard: {
    id: 'hard',
    labelAr: 'صعب',
    labelEn: 'Hard',
    descAr: 'أنابيب متقاربة وسرعة عالية',
    pipeGap: 84,
    pipeSpeed: 2.5,
    spawnInterval: 72,
  },
};

interface PipePair {
  x: number;
  baseTopHeight: number;
  topHeight: number;
  passed: boolean;
  oscillates: boolean;
  phase: number;
}

interface InGameCoin {
  x: number;
  y: number;
  collected: boolean;
}

interface InGamePowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  collected: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  difficulty: DifficultyLevel;
  skin: string;
  stageReached: number;
  createdAt: string;
}

interface TelemetrySnapshot {
  state: GameState;
  score: number;
  bestScore: number;
  isNewBest: boolean;
  stageNumber: number;
  stageNameAr: string;
  activeShield: boolean;
  magnetFrames: number;
  slowMoFrames: number;
  birdY: number;
  birdVy: number;
  birdRotation: number;
  activePipes: number;
  fps: number;
}

const CANVAS_WIDTH = 288;
const CANVAS_HEIGHT = 512;
const GROUND_HEIGHT = 112;
const GROUND_Y = CANVAS_HEIGHT - GROUND_HEIGHT; // 400
const GRAVITY = 0.25;
const FLAP_VELOCITY = -4.6;
const TERMINAL_VELOCITY = 10.0;
const BG_PARALLAX_SPEED = 0.5;
const PIPE_WIDTH = 52;
const HITBOX_INSET = 2;

const BEST_SCORE_STORAGE_KEY = 'flappy_best_score_2013';
const SETTINGS_STORAGE_KEY = 'flappy_settings_v3';
const LOCAL_LEADERBOARD_CACHE_KEY = 'flappy_leaderboard_cache_v1';

const PILOT_CALLSIGNS = [
  'Falcon-01',
  'SkyAce-77',
  'WingPro-99',
  'DesertHawk',
  'StarPilot',
  'CyberEagle',
  'GoldGlider',
  'NovaWing',
];

interface SavedSettings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  difficulty: DifficultyLevel;
  skin: BirdSkinId;
  stageMode: StageModeOption;
}

function loadSavedSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sfxEnabled: parsed.sfxEnabled ?? true,
        musicEnabled: parsed.musicEnabled ?? false,
        hapticsEnabled: parsed.hapticsEnabled ?? true,
        difficulty: ['easy', 'normal', 'hard'].includes(parsed.difficulty)
          ? parsed.difficulty
          : 'normal',
        skin: ['classic', 'crimson', 'azure', 'gold', 'emerald', 'phoenix'].includes(parsed.skin)
          ? parsed.skin
          : 'classic',
        stageMode: ['auto', 'day', 'sunset', 'night', 'cosmos'].includes(parsed.stageMode)
          ? parsed.stageMode
          : 'auto',
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    sfxEnabled: true,
    musicEnabled: false,
    hapticsEnabled: true,
    difficulty: 'normal',
    skin: 'classic',
    stageMode: 'auto',
  };
}

function resolveStageFromScore(
  score: number,
  stageMode: StageModeOption
): { stageNum: number; theme: StageThemeId; nameAr: string; nameEn: string } {
  if (stageMode !== 'auto') {
    const map: Record<StageThemeId, { stageNum: number; nameAr: string; nameEn: string }> = {
      day: { stageNum: 1, nameAr: 'النهار المشرق', nameEn: 'Sunny Meadow' },
      sunset: { stageNum: 2, nameAr: 'الغروب الذهبي', nameEn: 'Golden Sunset' },
      night: { stageNum: 3, nameAr: 'ليل النجوم', nameEn: 'Starlight Night' },
      cosmos: { stageNum: 4, nameAr: 'الفضاء السيبراني', nameEn: 'Cyber Cosmos' },
    };
    return { theme: stageMode, ...map[stageMode] };
  }
  if (score >= 35) {
    return { stageNum: 4, theme: 'cosmos', nameAr: 'المرحلة 4: الفضاء السيبراني', nameEn: 'Stage 4: Cyber Cosmos' };
  }
  if (score >= 20) {
    return { stageNum: 3, theme: 'night', nameAr: 'المرحلة 3: ليل النجوم', nameEn: 'Stage 3: Starlight Night' };
  }
  if (score >= 10) {
    return { stageNum: 2, theme: 'sunset', nameAr: 'المرحلة 2: الغروب الذهبي', nameEn: 'Stage 2: Golden Sunset' };
  }
  return { stageNum: 1, theme: 'day', nameAr: 'المرحلة 1: النهار المشرق', nameEn: 'Stage 1: Sunny Meadow' };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundRef = useRef<FlappySoundEngine>(new FlappySoundEngine());
  const atlasRef = useRef<SpriteAtlas | null>(null);

  const initialSettings = useRef<SavedSettings>(loadSavedSettings());

  const [activeTab, setActiveTab] = useState<ActiveTab>('arcade');
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [sfxEnabled, setSfxEnabled] = useState<boolean>(initialSettings.current.sfxEnabled);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(initialSettings.current.musicEnabled);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(initialSettings.current.hapticsEnabled);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(initialSettings.current.difficulty);
  const [selectedSkin, setSelectedSkin] = useState<BirdSkinId>(initialSettings.current.skin);
  const [stageMode, setStageMode] = useState<StageModeOption>(initialSettings.current.stageMode);

  const [dailyState, setDailyState] = useState<DailyChallengeState>(() =>
    loadDailyChallengeState()
  );
  const dailyStateRef = useRef<DailyChallengeState>(dailyState);

  const [profile, setProfile] = useState<PlayerProfileState>(() => loadPlayerProfile());
  const profileRef = useRef<PlayerProfileState>(profile);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_LEADERBOARD_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  });
  const [isSubmittingScore, setIsSubmittingScore] = useState<boolean>(false);

  useEffect(() => {
    dailyStateRef.current = dailyState;
  }, [dailyState]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const [showHitboxes, setShowHitboxes] = useState<boolean>(false);
  const [copiedSource, setCopiedSource] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [skinPreviews, setSkinPreviews] = useState<Record<BirdSkinId, string>>(
    {} as Record<BirdSkinId, string>
  );

  const { isInstallable, isInstalled, isIOS, isOnline, install } = usePWAInstall();

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(() => {
    let initialBest = 0;
    try {
      initialBest = parseInt(localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10) || 0;
    } catch {
      initialBest = 0;
    }
    return {
      state: 'MAIN_MENU',
      score: 0,
      bestScore: initialBest,
      isNewBest: false,
      stageNumber: 1,
      stageNameAr: 'المرحلة 1: النهار المشرق',
      activeShield: false,
      magnetFrames: 0,
      slowMoFrames: 0,
      birdY: 148,
      birdVy: 0,
      birdRotation: 0,
      activePipes: 0,
      fps: 60,
    };
  });

  const showToastMessage = useCallback((msg: string) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(null), 3000);
  }, []);

  // Fetch global leaderboard from backend (with offline cache fallback)
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.entries)) {
          setLeaderboard(data.entries);
          localStorage.setItem(LOCAL_LEADERBOARD_CACHE_KEY, JSON.stringify(data.entries));
        }
      }
    } catch {
      // Offline mode uses cached leaderboard seamlessly
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const submitScoreToLeaderboard = useCallback(
    async (scoreToSubmit: number, diff: DifficultyLevel, skinUsed: BirdSkinId) => {
      if (scoreToSubmit < 1) return;
      setIsSubmittingScore(true);
      const stageReached = resolveStageFromScore(scoreToSubmit, 'auto').stageNum;
      try {
        const res = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerName: profileRef.current.playerName,
            score: scoreToSubmit,
            difficulty: diff,
            skin: skinUsed,
            stageReached,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.entries)) {
            setLeaderboard(data.entries);
            localStorage.setItem(LOCAL_LEADERBOARD_CACHE_KEY, JSON.stringify(data.entries));
          }
        }
      } catch {
        // Offline fallback: insert into local cache
        setLeaderboard((prev) => {
          const updated = [
            ...prev.filter(
              (e) =>
                e.playerName.toLowerCase() !==
                profileRef.current.playerName.toLowerCase()
            ),
            {
              id: 'local-' + Date.now(),
              playerName: profileRef.current.playerName,
              score: scoreToSubmit,
              difficulty: diff,
              skin: skinUsed,
              stageReached,
              createdAt: new Date().toISOString(),
            },
          ]
            .sort((a, b) => b.score - a.score)
            .slice(0, 25);
          try {
            localStorage.setItem(LOCAL_LEADERBOARD_CACHE_KEY, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
      } finally {
        setIsSubmittingScore(false);
      }
    },
    []
  );

  // Helper to award coins & unlock achievements
  const addCoinsToWallet = useCallback((amount: number) => {
    if (amount <= 0) return;
    const nextDaily: DailyChallengeState = {
      ...dailyStateRef.current,
      coins: dailyStateRef.current.coins + amount,
    };
    dailyStateRef.current = nextDaily;
    saveDailyChallengeState(nextDaily);
    setDailyState(nextDaily);
  }, []);

  const checkAndUnlockAchievements = useCallback(
    (
      runScore: number,
      diff: DifficultyLevel,
      prof: PlayerProfileState
    ) => {
      const unlocked = new Set(prof.unlockedAchievements);
      const newlyUnlockedIds: string[] = [];

      const tryUnlock = (id: string, condition: boolean) => {
        if (condition && !unlocked.has(id)) {
          unlocked.add(id);
          newlyUnlockedIds.push(id);
        }
      };

      tryUnlock('first_score_5', runScore >= 5);
      tryUnlock('bronze_medal_10', runScore >= 10);
      tryUnlock('silver_medal_20', runScore >= 20);
      tryUnlock('gold_medal_30', runScore >= 30);
      tryUnlock('coin_collector_25', prof.totalCoinsCollectedInFlight >= 25);
      tryUnlock('powerup_master_5', prof.totalPowerUpsCollected >= 5);
      tryUnlock('hard_mode_10', diff === 'hard' && runScore >= 10);
      tryUnlock('skin_collector_3', prof.unlockedSkins.length >= 3);

      if (newlyUnlockedIds.length > 0) {
        let bonusCoins = 0;
        const titles: string[] = [];
        for (const id of newlyUnlockedIds) {
          const def = ACHIEVEMENTS_LIST.find((a) => a.id === id);
          if (def) {
            bonusCoins += def.rewardCoins;
            titles.push(def.titleAr);
          }
        }
        const nextProf: PlayerProfileState = {
          ...prof,
          unlockedAchievements: Array.from(unlocked),
        };
        profileRef.current = nextProf;
        savePlayerProfile(nextProf);
        setProfile(nextProf);

        if (bonusCoins > 0) {
          addCoinsToWallet(bonusCoins);
        }
        soundRef.current.playPowerUp();
        showToastMessage(
          `إنجاز جديد: ${titles.join(' ، ')} (+${bonusCoins} عملة!)`
        );
      }
    },
    [addCoinsToWallet, showToastMessage]
  );

  // Record flap or score events into the Daily Challenge system
  const handleDailyEvent = useCallback(
    (eventType: 'flap' | 'score_point', currentRunScore: number, diff: DifficultyLevel) => {
      const [updated, justCompleted] = recordDailyChallengeEvent(
        dailyStateRef.current,
        eventType,
        currentRunScore,
        diff
      );
      if (updated !== dailyStateRef.current) {
        dailyStateRef.current = updated;
        setDailyState(updated);
      }
      if (justCompleted) {
        const tpl = getActiveChallengeTemplate(updated);
        soundRef.current.playPowerUp();
        soundRef.current.triggerHaptic([35, 30, 65]);
        showToastMessage(
          `اكتمل تحدي اليوم! (${tpl.titleAr}) — استلم +${tpl.rewardCoins} عملة`
        );
      }
    },
    [showToastMessage]
  );

  const handleClaimDailyReward = useCallback(() => {
    const prev = dailyStateRef.current;
    if (!prev.completed || prev.claimed) return;
    const tpl = getActiveChallengeTemplate(prev);
    const updated = claimDailyChallengeReward(prev);
    dailyStateRef.current = updated;
    setDailyState(updated);
    soundRef.current.playPowerUp();
    soundRef.current.triggerHaptic([40, 30, 80]);
    showToastMessage(`تم استلام +${tpl.rewardCoins} عملة و${tpl.badgeNameAr}!`);
  }, [showToastMessage]);

  const handleNextBonusChallenge = useCallback(() => {
    soundRef.current.playClick();
    const updated = activateNextBonusChallenge(dailyStateRef.current);
    dailyStateRef.current = updated;
    setDailyState(updated);
  }, []);

  const handleSelectOrBuyBird = (birdItem: (typeof SHOP_BIRDS)[number]) => {
    const isUnlocked = profile.unlockedSkins.includes(birdItem.id);
    if (isUnlocked) {
      soundRef.current.playScore();
      setSelectedSkin(birdItem.id);
      return;
    }

    if (dailyState.coins < birdItem.priceCoins) {
      soundRef.current.playHit();
      showToastMessage(
        `تحتاج إلى ${birdItem.priceCoins - dailyState.coins} عملة إضافية لشراء ${birdItem.nameAr}`
      );
      return;
    }

    // Deduct coins & unlock bird character
    const nextDaily: DailyChallengeState = {
      ...dailyStateRef.current,
      coins: dailyStateRef.current.coins - birdItem.priceCoins,
    };
    dailyStateRef.current = nextDaily;
    saveDailyChallengeState(nextDaily);
    setDailyState(nextDaily);

    const nextProfile: PlayerProfileState = {
      ...profileRef.current,
      unlockedSkins: [...profileRef.current.unlockedSkins, birdItem.id],
    };
    profileRef.current = nextProfile;
    savePlayerProfile(nextProfile);
    setProfile(nextProfile);
    setSelectedSkin(birdItem.id);

    soundRef.current.playPowerUp();
    showToastMessage(`تم شراء وفتح ${birdItem.nameAr} بنجاح!`);
    checkAndUnlockAchievements(gameRef.current.score, difficulty, nextProfile);
  };

  const handleCyclePilotName = () => {
    soundRef.current.playClick();
    const currentIdx = PILOT_CALLSIGNS.indexOf(profile.playerName);
    const nextName =
      PILOT_CALLSIGNS[(currentIdx + 1) % PILOT_CALLSIGNS.length] ||
      'Falcon-' + Math.floor(10 + Math.random() * 89);
    const nextProf = { ...profileRef.current, playerName: nextName };
    profileRef.current = nextProf;
    savePlayerProfile(nextProf);
    setProfile(nextProf);
  };

  // Persist user settings to localStorage and sync with sound engine
  useEffect(() => {
    soundRef.current.sfxEnabled = sfxEnabled;
    soundRef.current.hapticsEnabled = hapticsEnabled;
    soundRef.current.syncMusicState(musicEnabled && !isPaused);

    try {
      const toSave: SavedSettings = {
        sfxEnabled,
        musicEnabled,
        hapticsEnabled,
        difficulty,
        skin: selectedSkin,
        stageMode,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignore
    }
  }, [sfxEnabled, musicEnabled, hapticsEnabled, difficulty, selectedSkin, stageMode, isPaused]);

  // Mobile Lifecycle & Visibility Handling:
  // Automatically pause gameplay & stop audio when app goes to background or loses visibility
  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      if (document.visibilityState === 'hidden') {
        soundRef.current.stopMusicLoop();
        if (
          gameRef.current.state === 'PLAYING' ||
          gameRef.current.state === 'GET_READY'
        ) {
          setIsPaused(true);
        }
      } else if (
        document.visibilityState === 'visible' &&
        musicEnabled &&
        !runtimeConfigRef.current.isPaused
      ) {
        soundRef.current.startMusicLoop();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    window.addEventListener('blur', handleVisibilityOrBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
      window.removeEventListener('blur', handleVisibilityOrBlur);
      soundRef.current.stopMusicLoop();
    };
  }, [musicEnabled]);

  // Mutable ref mirrors for the 60FPS loop
  const runtimeConfigRef = useRef({
    showHitboxes: false,
    stageMode: initialSettings.current.stageMode,
    skin: initialSettings.current.skin,
    difficulty: initialSettings.current.difficulty,
    isPaused: false,
    activeModal: 'none' as ActiveModal,
  });

  useEffect(() => {
    runtimeConfigRef.current = {
      showHitboxes,
      stageMode,
      skin: selectedSkin,
      difficulty,
      isPaused,
      activeModal,
    };
  }, [showHitboxes, stageMode, selectedSkin, difficulty, isPaused, activeModal]);

  // Mutable game engine state inside ref for zero-GC 60FPS fixed timestep loop
  const gameRef = useRef({
    state: 'MAIN_MENU' as GameState,
    frameCount: 0,
    bgScroll: 0,
    groundScroll: 0,
    score: 0,
    bestScore: (() => {
      try {
        return parseInt(localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10) || 0;
      } catch {
        return 0;
      }
    })(),
    isNewBest: false,
    flashFrames: 0,
    shakeFrames: 0,
    boardY: 520,
    displayScore: 0,
    gameOverFrames: 0,
    lastAnnouncedStage: 1,
    activeShield: false,
    magnetFrames: 0,
    slowMoFrames: 0,
    bird: {
      x: 84,
      y: 148,
      vy: 0,
      rotation: 0,
      width: 34,
      height: 24,
      flapHoldFrames: 0,
    },
    pipes: [] as PipePair[],
    coins: [] as InGameCoin[],
    powerUps: [] as InGamePowerUp[],
    particles: [] as Particle[],
    popups: [] as FloatingPopup[],
    pipeSpawnCounter: 0,
  });

  const spawnParticles = useCallback(
    (x: number, y: number, count: number, colors: string[], speedMultiplier = 1) => {
      const g = gameRef.current;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.8 + Math.random() * 2.2) * speedMultiplier;
        g.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.5,
          size: Math.random() > 0.5 ? 4 : 2,
          color: colors[i % colors.length],
          life: 0,
          maxLife: 16 + Math.floor(Math.random() * 14),
        });
      }
      if (g.particles.length > 80) {
        g.particles.splice(0, g.particles.length - 80);
      }
    },
    []
  );

  const spawnPopup = useCallback((x: number, y: number, text: string, color: string) => {
    const g = gameRef.current;
    g.popups.push({ x, y, text, color, life: 36 });
  }, []);

  const syncTelemetryImmediate = useCallback(() => {
    const g = gameRef.current;
    const stg = resolveStageFromScore(g.score, runtimeConfigRef.current.stageMode);
    setTelemetry({
      state: g.state,
      score: g.score,
      bestScore: g.bestScore,
      isNewBest: g.isNewBest,
      stageNumber: stg.stageNum,
      stageNameAr: stg.nameAr,
      activeShield: g.activeShield,
      magnetFrames: g.magnetFrames,
      slowMoFrames: g.slowMoFrames,
      birdY: g.bird.y,
      birdVy: g.bird.vy,
      birdRotation: g.bird.rotation,
      activePipes: g.pipes.length,
      fps: 60,
    });
  }, []);

  const startNewGameSession = useCallback(() => {
    const g = gameRef.current;
    soundRef.current.playClick();
    soundRef.current.playSwoosh();
    if (musicEnabled) {
      soundRef.current.startMusicLoop();
    }
    setActiveModal('none');
    setIsPaused(false);
    g.state = 'GET_READY';
    g.score = 0;
    g.isNewBest = false;
    g.flashFrames = 0;
    g.shakeFrames = 0;
    g.lastAnnouncedStage = 1;
    g.activeShield = false;
    g.magnetFrames = 0;
    g.slowMoFrames = 0;
    g.pipes = [];
    g.coins = [];
    g.powerUps = [];
    g.particles = [];
    g.popups = [];
    g.pipeSpawnCounter = 0;
    g.bird.x = 84;
    g.bird.y = 244;
    g.bird.vy = 0;
    g.bird.rotation = 0;
    g.bird.flapHoldFrames = 0;
    syncTelemetryImmediate();
  }, [musicEnabled, syncTelemetryImmediate]);

  const goToMainMenu = useCallback(() => {
    const g = gameRef.current;
    soundRef.current.playClick();
    soundRef.current.playSwoosh();
    setActiveModal('none');
    setIsPaused(false);
    g.state = 'MAIN_MENU';
    g.score = 0;
    g.isNewBest = false;
    g.flashFrames = 0;
    g.shakeFrames = 0;
    g.activeShield = false;
    g.magnetFrames = 0;
    g.slowMoFrames = 0;
    g.pipes = [];
    g.coins = [];
    g.powerUps = [];
    g.particles = [];
    g.popups = [];
    g.pipeSpawnCounter = 0;
    g.bird.x = 144;
    g.bird.y = 148;
    g.bird.vy = 0;
    g.bird.rotation = 0;
    g.bird.flapHoldFrames = 0;
    syncTelemetryImmediate();
  }, [syncTelemetryImmediate]);

  const handleFlapAction = useCallback(() => {
    const g = gameRef.current;
    const cfg = runtimeConfigRef.current;
    if (cfg.isPaused || cfg.activeModal !== 'none') return;

    const sound = soundRef.current;

    if (g.state === 'GET_READY') {
      g.state = 'PLAYING';
      g.bird.vy = FLAP_VELOCITY;
      g.bird.rotation = -25;
      g.bird.flapHoldFrames = 14;
      g.pipeSpawnCounter = 20;
      sound.playFlap();
      sound.triggerHaptic(12);
      spawnParticles(g.bird.x - 10, g.bird.y + 4, 6, ['#ffffff', '#fef08a', '#bae6fd'], 0.85);
      if (musicEnabled) sound.startMusicLoop();
      handleDailyEvent('flap', g.score, cfg.difficulty);
      syncTelemetryImmediate();
    } else if (g.state === 'PLAYING') {
      g.bird.vy = FLAP_VELOCITY;
      g.bird.rotation = -25;
      g.bird.flapHoldFrames = 14;
      sound.playFlap();
      sound.triggerHaptic(12);
      spawnParticles(g.bird.x - 10, g.bird.y + 4, 5, ['#ffffff', '#fef08a', '#bae6fd'], 0.8);
      handleDailyEvent('flap', g.score, cfg.difficulty);
    }
  }, [musicEnabled, handleDailyEvent, spawnParticles, syncTelemetryImmediate]);

  const handleTogglePause = useCallback(() => {
    const g = gameRef.current;
    if (g.state !== 'PLAYING' && g.state !== 'GET_READY') return;
    soundRef.current.playClick();
    setIsPaused((prev) => !prev);
  }, []);

  const handleShareScore = async () => {
    const g = gameRef.current;
    soundRef.current.playClick();
    const diffLabel = DIFFICULTY_CONFIGS[difficulty].labelAr;
    const shareText = `حققت ${g.score} نقطة في لعبة FLAPPY WING (مستوى ${diffLabel} · أفضل نتيجة: ${g.bestScore})! هل يمكنك تحطيم رقمي؟`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FLAPPY WING',
          text: shareText,
          url: window.location.href,
        });
        return;
      } catch {
        // fallback
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      showToastMessage('تم نسخ النتيجة للحافظة لمشاركتها!');
    } catch {
      showToastMessage(shareText);
    }
  };

  const handleResetHighScore = () => {
    soundRef.current.playClick();
    try {
      localStorage.removeItem(BEST_SCORE_STORAGE_KEY);
    } catch {
      // ignore
    }
    gameRef.current.bestScore = 0;
    gameRef.current.isNewBest = false;
    setTelemetry((prev) => ({ ...prev, bestScore: 0, isNewBest: false }));
  };

  const handleCopyStandalone = async () => {
    try {
      await navigator.clipboard.writeText(STANDALONE_FLAPPY_HTML);
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadStandalone = () => {
    const blob = new Blob([STANDALONE_FLAPPY_HTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flappy-wing-pixel-perfect.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Global keyboard listener (Spacebar / UpArrow / W / Escape for Pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        handleTogglePause();
        return;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        const g = gameRef.current;
        if (runtimeConfigRef.current.activeModal !== 'none' || runtimeConfigRef.current.isPaused) {
          return;
        }
        if (g.state === 'MAIN_MENU') {
          startNewGameSession();
        } else if (g.state === 'GAME_OVER' && g.gameOverFrames >= 20) {
          startNewGameSession();
        } else {
          handleFlapAction();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleFlapAction, handleTogglePause, startNewGameSession]);

  // Main 60 FPS Fixed-Timestep Game Loop & Procedural Canvas Renderer
  useEffect(() => {
    if (!atlasRef.current) {
      atlasRef.current = buildSpriteAtlas();
      const previews: Record<BirdSkinId, string> = {} as Record<BirdSkinId, string>;
      for (const s of BIRD_SKINS) {
        previews[s.id] = atlasRef.current.birdSkins[s.id][1].toDataURL();
      }
      setSkinPreviews(previews);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const FIXED_TIMESTEP_MS = 1000 / 60;
    let lastTime = performance.now();
    let accumulator = 0;
    let rafId = 0;
    let telemetryCounter = 0;

    const triggerCollisionDeath = (hitPipeMidAir: boolean) => {
      const g = gameRef.current;
      if (g.state !== 'PLAYING') return;
      g.state = 'DYING';
      g.flashFrames = 2;
      g.shakeFrames = 10;
      spawnParticles(
        g.bird.x,
        g.bird.y,
        18,
        ['#f8e71c', '#f75a1b', '#ffffff', '#ef4444'],
        1.6
      );
      soundRef.current.playHit();
      if (hitPipeMidAir) {
        setTimeout(() => {
          soundRef.current.playDie();
        }, 110);
      }
      syncTelemetryImmediate();
    };

    const enterGameOverState = () => {
      const g = gameRef.current;
      const cfg = runtimeConfigRef.current;
      g.state = 'GAME_OVER';
      g.boardY = 520;
      g.displayScore = 0;
      g.gameOverFrames = 0;

      if (g.score > g.bestScore) {
        g.bestScore = g.score;
        g.isNewBest = true;
        try {
          localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(g.bestScore));
        } catch {
          // ignore
        }
      }

      // Update games played & check achievements
      const nextProf: PlayerProfileState = {
        ...profileRef.current,
        totalGamesPlayed: profileRef.current.totalGamesPlayed + 1,
      };
      profileRef.current = nextProf;
      savePlayerProfile(nextProf);
      setProfile(nextProf);

      checkAndUnlockAchievements(g.score, cfg.difficulty, nextProf);
      if (g.score > 0) {
        submitScoreToLeaderboard(g.score, cfg.difficulty, cfg.skin);
      }

      soundRef.current.playSwoosh();
      syncTelemetryImmediate();
    };

    const updatePhysicsTick = () => {
      const g = gameRef.current;
      const cfg = runtimeConfigRef.current;
      const diffSpec = DIFFICULTY_CONFIGS[cfg.difficulty];

      if (cfg.isPaused) {
        return;
      }

      g.frameCount++;
      if (g.shakeFrames > 0) g.shakeFrames--;

      // Update Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const pt = g.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.08;
        pt.life++;
        if (pt.life >= pt.maxLife) {
          g.particles.splice(i, 1);
        }
      }

      // Update Floating Text Popups
      for (let i = g.popups.length - 1; i >= 0; i--) {
        const pop = g.popups[i];
        pop.y -= 0.7;
        pop.life--;
        if (pop.life <= 0) {
          g.popups.splice(i, 1);
        }
      }

      if (g.state === 'MAIN_MENU') {
        g.bgScroll = (g.bgScroll + BG_PARALLAX_SPEED) % CANVAS_WIDTH;
        g.groundScroll = (g.groundScroll + diffSpec.pipeSpeed) % 24;
        g.bird.x = 144;
        g.bird.y = 148 + Math.sin(g.frameCount * 0.1) * 5;
        g.bird.vy = 0;
        g.bird.rotation = 0;
      } else if (g.state === 'GET_READY') {
        g.bgScroll = (g.bgScroll + BG_PARALLAX_SPEED) % CANVAS_WIDTH;
        g.groundScroll = (g.groundScroll + diffSpec.pipeSpeed) % 24;
        g.bird.x = 84;
        g.bird.y = 244 + Math.sin(g.frameCount * 0.12) * 5;
        g.bird.vy = 0;
        g.bird.rotation = 0;
      } else if (g.state === 'PLAYING') {
        // Active Power-Up Timers
        if (g.magnetFrames > 0) g.magnetFrames--;
        if (g.slowMoFrames > 0) g.slowMoFrames--;

        const stageInfo = resolveStageFromScore(g.score, cfg.stageMode);
        if (stageInfo.stageNum > g.lastAnnouncedStage) {
          g.lastAnnouncedStage = stageInfo.stageNum;
          spawnPopup(144, 110, `STAGE ${stageInfo.stageNum}!`, '#fde047');
          soundRef.current.playPowerUp();
        }

        // Progressive stage speed multiplier (+4% per stage above 1, or -30% when Slow-Mo active)
        const stageSpeedMult = 1 + (stageInfo.stageNum - 1) * 0.04;
        const slowMoMult = g.slowMoFrames > 0 ? 0.7 : 1.0;
        const effectivePipeSpeed = diffSpec.pipeSpeed * stageSpeedMult * slowMoMult;

        g.bgScroll = (g.bgScroll + BG_PARALLAX_SPEED * slowMoMult) % CANVAS_WIDTH;
        g.groundScroll = (g.groundScroll + effectivePipeSpeed) % 24;

        g.bird.vy = Math.min(TERMINAL_VELOCITY, g.bird.vy + GRAVITY);
        g.bird.y += g.bird.vy;

        if (g.bird.y < 0) {
          g.bird.y = 0;
        }

        if (g.bird.vy < 0 || g.bird.flapHoldFrames > 0) {
          if (g.bird.flapHoldFrames > 0) g.bird.flapHoldFrames--;
          g.bird.rotation = Math.max(-25, g.bird.rotation - 7.5);
        } else {
          const angularSpeed = g.bird.vy > 3.2 ? 4.8 : 2.6;
          g.bird.rotation = Math.min(90, g.bird.rotation + angularSpeed);
        }

        // Spawn Pipes, Coins & Power-Ups
        g.pipeSpawnCounter++;
        if (g.pipeSpawnCounter >= diffSpec.spawnInterval) {
          g.pipeSpawnCounter = 0;
          const minTopHeight = 50;
          const maxTopHeight = GROUND_Y - 50 - diffSpec.pipeGap;
          const baseTopHeight = Math.floor(
            minTopHeight + Math.random() * (maxTopHeight - minTopHeight + 1)
          );
          // In Stage 3+ (score >= 20), 40% of pipes gently oscillate vertically!
          const oscillates = stageInfo.stageNum >= 3 && Math.random() < 0.45;
          const spawnX = CANVAS_WIDTH + 6;

          g.pipes.push({
            x: spawnX,
            baseTopHeight,
            topHeight: baseTopHeight,
            passed: false,
            oscillates,
            phase: Math.random() * Math.PI * 2,
          });

          // 65% chance to spawn a collectible Gold Wing Coin inside the pipe gap
          if (Math.random() < 0.65) {
            g.coins.push({
              x: spawnX + PIPE_WIDTH / 2,
              y: baseTopHeight + diffSpec.pipeGap / 2,
              collected: false,
            });
          } else if (Math.random() < 0.35) {
            // Spawn a Power-Up orb between pipes
            const types: PowerUpType[] = ['shield', 'magnet', 'slowmo'];
            const chosenType = types[Math.floor(Math.random() * types.length)];
            g.powerUps.push({
              x: spawnX + PIPE_WIDTH + 42,
              y: 110 + Math.random() * 170,
              type: chosenType,
              collected: false,
            });
          }
        }

        const hbLeft = g.bird.x - g.bird.width / 2 + HITBOX_INSET;
        const hbRight = g.bird.x + g.bird.width / 2 - HITBOX_INSET;
        const hbTop = g.bird.y - g.bird.height / 2 + HITBOX_INSET;
        const hbBottom = g.bird.y + g.bird.height / 2 - HITBOX_INSET;

        // Update Coins & Magnet Attraction
        for (let i = g.coins.length - 1; i >= 0; i--) {
          const c = g.coins[i];
          c.x -= effectivePipeSpeed;

          if (g.magnetFrames > 0 && !c.collected) {
            const dx = g.bird.x - c.x;
            const dy = g.bird.y - c.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 130 && dist > 1) {
              c.x += (dx / dist) * 4.2;
              c.y += (dy / dist) * 4.2;
            }
          }

          if (
            !c.collected &&
            Math.abs(c.x - g.bird.x) < 20 &&
            Math.abs(c.y - g.bird.y) < 18
          ) {
            c.collected = true;
            addCoinsToWallet(3);
            const nextProf: PlayerProfileState = {
              ...profileRef.current,
              totalCoinsCollectedInFlight:
                profileRef.current.totalCoinsCollectedInFlight + 1,
            };
            profileRef.current = nextProf;
            savePlayerProfile(nextProf);
            setProfile(nextProf);

            soundRef.current.playScore();
            spawnParticles(c.x, c.y, 8, ['#facc15', '#fef08a', '#ffffff'], 1.1);
            spawnPopup(c.x, c.y - 8, '+3', '#facc15');
          }

          if (c.collected || c.x < -24) {
            g.coins.splice(i, 1);
          }
        }

        // Update Power-Ups
        for (let i = g.powerUps.length - 1; i >= 0; i--) {
          const pu = g.powerUps[i];
          pu.x -= effectivePipeSpeed;

          if (
            !pu.collected &&
            Math.abs(pu.x - g.bird.x) < 22 &&
            Math.abs(pu.y - g.bird.y) < 20
          ) {
            pu.collected = true;
            soundRef.current.playPowerUp();
            if (pu.type === 'shield') {
              g.activeShield = true;
              spawnPopup(pu.x, pu.y - 10, 'SHIELD!', '#38bdf8');
              spawnParticles(pu.x, pu.y, 12, ['#38bdf8', '#e0f2fe', '#ffffff'], 1.2);
            } else if (pu.type === 'magnet') {
              g.magnetFrames = 480; // 8 seconds
              spawnPopup(pu.x, pu.y - 10, 'MAGNET!', '#ef4444');
              spawnParticles(pu.x, pu.y, 12, ['#ef4444', '#fca5a5', '#ffffff'], 1.2);
            } else if (pu.type === 'slowmo') {
              g.slowMoFrames = 360; // 6 seconds
              spawnPopup(pu.x, pu.y - 10, 'SLOW MO!', '#a855f7');
              spawnParticles(pu.x, pu.y, 12, ['#a855f7', '#e9d5ff', '#ffffff'], 1.2);
            }

            const nextProf: PlayerProfileState = {
              ...profileRef.current,
              totalPowerUpsCollected: profileRef.current.totalPowerUpsCollected + 1,
            };
            profileRef.current = nextProf;
            savePlayerProfile(nextProf);
            setProfile(nextProf);
          }

          if (pu.collected || pu.x < -24) {
            g.powerUps.splice(i, 1);
          }
        }

        // Move Pipes & Check Collisions
        for (let i = g.pipes.length - 1; i >= 0; i--) {
          const p = g.pipes[i];
          p.x -= effectivePipeSpeed;

          if (p.oscillates) {
            p.topHeight = Math.round(
              p.baseTopHeight + Math.sin(g.frameCount * 0.045 + p.phase) * 20
            );
          }

          if (!p.passed && p.x + PIPE_WIDTH / 2 < g.bird.x) {
            p.passed = true;
            g.score++;
            addCoinsToWallet(1);
            soundRef.current.playScore();
            soundRef.current.triggerHaptic(18);
            spawnParticles(g.bird.x, g.bird.y - 12, 7, ['#85f293', '#ffffff', '#f8e71c'], 1.0);
            spawnPopup(g.bird.x, g.bird.y - 16, '+1', '#ffffff');
            handleDailyEvent('score_point', g.score, cfg.difficulty);
            checkAndUnlockAchievements(g.score, cfg.difficulty, profileRef.current);
          }

          if (hbRight > p.x && hbLeft < p.x + PIPE_WIDTH) {
            const hitTopPipe = hbTop < p.topHeight;
            const hitBottomPipe = hbBottom > p.topHeight + diffSpec.pipeGap;
            if (hitTopPipe || hitBottomPipe) {
              // If Shield Power-Up is active, absorb the pipe collision!
              if (g.activeShield) {
                g.activeShield = false;
                g.shakeFrames = 6;
                soundRef.current.playShieldBreak();
                spawnParticles(
                  g.bird.x + 10,
                  g.bird.y,
                  16,
                  ['#38bdf8', '#ffffff', '#7dd3fc'],
                  1.5
                );
                spawnPopup(g.bird.x, g.bird.y - 14, 'SAVED!', '#38bdf8');
                // Remove the pipe that was hit so the bird continues safely
                g.pipes.splice(i, 1);
                continue;
              } else {
                triggerCollisionDeath(true);
                break;
              }
            }
          }

          if (p.x < -PIPE_WIDTH - 12) {
            g.pipes.splice(i, 1);
          }
        }

        if (hbBottom >= GROUND_Y) {
          if (g.activeShield) {
            // Bounce up off the ground once if shielded!
            g.activeShield = false;
            g.bird.y = GROUND_Y - g.bird.height / 2 - 4;
            g.bird.vy = FLAP_VELOCITY;
            g.bird.rotation = -25;
            soundRef.current.playShieldBreak();
            spawnPopup(g.bird.x, g.bird.y - 14, 'SAVED!', '#38bdf8');
          } else {
            g.bird.y = GROUND_Y - g.bird.height / 2;
            g.bird.rotation = 90;
            triggerCollisionDeath(false);
          }
        }
      } else if (g.state === 'DYING') {
        if (g.flashFrames > 0) {
          g.flashFrames--;
        }

        g.bird.vy = Math.min(TERMINAL_VELOCITY, g.bird.vy + GRAVITY);
        g.bird.y += g.bird.vy;
        g.bird.rotation = Math.min(90, g.bird.rotation + 6);

        if (g.bird.y + g.bird.height / 2 >= GROUND_Y) {
          g.bird.y = GROUND_Y - g.bird.height / 2;
          g.bird.rotation = 90;
          enterGameOverState();
        }
      } else if (g.state === 'GAME_OVER') {
        g.gameOverFrames++;
        if (g.boardY > 176) {
          g.boardY = Math.max(176, g.boardY - 24);
        } else if (g.displayScore < g.score && g.gameOverFrames % 2 === 0) {
          const step = Math.max(1, Math.ceil(g.score / 24));
          g.displayScore = Math.min(g.score, g.displayScore + step);
        }
      }

      telemetryCounter++;
      if (telemetryCounter % 4 === 0) {
        const stg = resolveStageFromScore(g.score, cfg.stageMode);
        setTelemetry({
          state: g.state,
          score: g.score,
          bestScore: g.bestScore,
          isNewBest: g.isNewBest,
          stageNumber: stg.stageNum,
          stageNameAr: stg.nameAr,
          activeShield: g.activeShield,
          magnetFrames: g.magnetFrames,
          slowMoFrames: g.slowMoFrames,
          birdY: g.bird.y,
          birdVy: g.bird.vy,
          birdRotation: g.bird.rotation,
          activePipes: g.pipes.length,
          fps: 60,
        });
      }
    };

    const renderFrame = () => {
      const g = gameRef.current;
      const atlas = atlasRef.current!;
      const {
        showHitboxes: drawDebug,
        stageMode: stgMode,
        skin,
        difficulty: diffKey,
      } = runtimeConfigRef.current;
      const diffSpec = DIFFICULTY_CONFIGS[diffKey];
      const stageInfo = resolveStageFromScore(g.score, stgMode);

      ctx.save();
      if (g.shakeFrames > 0) {
        const sx = (Math.random() - 0.5) * 6;
        const sy = (Math.random() - 0.5) * 6;
        ctx.translate(Math.round(sx), Math.round(sy));
      }

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. Dynamic Stage Parallax Background
      const bgImg = atlas.backgrounds[stageInfo.theme] || atlas.backgrounds.day;
      const bgOffset = -Math.floor(g.bgScroll);
      ctx.drawImage(bgImg, bgOffset, 0);
      ctx.drawImage(bgImg, bgOffset + CANVAS_WIDTH, 0);

      // 2. Pipes
      for (const p of g.pipes) {
        drawPixelPipe(ctx, p.x, 0, PIPE_WIDTH, p.topHeight, true);
        const bottomPipeY = p.topHeight + diffSpec.pipeGap;
        const bottomPipeH = GROUND_Y - bottomPipeY;
        drawPixelPipe(ctx, p.x, bottomPipeY, PIPE_WIDTH, bottomPipeH, false);

        if (drawDebug) {
          ctx.strokeStyle = '#ff2a55';
          ctx.lineWidth = 1;
          ctx.strokeRect(Math.round(p.x) + 0.5, 0.5, PIPE_WIDTH - 1, p.topHeight - 1);
          ctx.strokeRect(
            Math.round(p.x) + 0.5,
            bottomPipeY + 0.5,
            PIPE_WIDTH - 1,
            bottomPipeH - 1
          );
        }
      }

      // 3. Collectible Gold Coins & Power-Ups
      for (const c of g.coins) {
        if (!c.collected) {
          drawPixelCoin(ctx, c.x, c.y, g.frameCount);
        }
      }

      for (const pu of g.powerUps) {
        if (!pu.collected) {
          drawPixelPowerUp(ctx, pu.x, pu.y, pu.type, g.frameCount);
        }
      }

      // 4. Looping Ground Strip
      ctx.drawImage(atlas.groundStrip, -Math.floor(g.groundScroll), GROUND_Y);

      // 5. Visual Particles
      for (const pt of g.particles) {
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
      }

      // 6. Bird Sprite + Active Shield / Power-Up Aura
      const wingCycle = [0, 1, 2, 1] as const;
      const wingFrameIdx =
        g.state === 'DYING' || g.state === 'GAME_OVER'
          ? 1
          : wingCycle[Math.floor(g.frameCount / 5) % 4];

      const birdFrames = atlas.birdSkins[skin] || atlas.birdSkins.classic;

      ctx.save();
      ctx.translate(Math.round(g.bird.x), Math.round(g.bird.y));

      // Draw protective pixel shield bubble if active
      if (g.activeShield) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 21 + Math.sin(g.frameCount * 0.2) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.rotate((g.bird.rotation * Math.PI) / 180);
      ctx.drawImage(birdFrames[wingFrameIdx], -g.bird.width / 2, -g.bird.height / 2);
      ctx.restore();

      if (drawDebug) {
        ctx.strokeStyle = '#f8e71c';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          Math.round(g.bird.x - g.bird.width / 2) + 0.5,
          Math.round(g.bird.y - g.bird.height / 2) + 0.5,
          g.bird.width - 1,
          g.bird.height - 1
        );
        ctx.strokeStyle = '#00ffcc';
        ctx.strokeRect(
          Math.round(g.bird.x - g.bird.width / 2 + HITBOX_INSET) + 0.5,
          Math.round(g.bird.y - g.bird.height / 2 + HITBOX_INSET) + 0.5,
          g.bird.width - HITBOX_INSET * 2 - 1,
          g.bird.height - HITBOX_INSET * 2 - 1
        );
      }

      // 7. Floating Text Popups (+1, +3, SHIELD!, STAGE 2!)
      for (const pop of g.popups) {
        drawPixelText(ctx, pop.text, pop.x, pop.y, 1.5, pop.color, '#000000', 'center');
      }

      // 8. Canvas HUD Overlays for GET_READY and PLAYING
      if (g.state === 'GET_READY') {
        drawPixelText(
          ctx,
          'GET READY!',
          144,
          112,
          3,
          '#85f293',
          '#543847',
          'center',
          '#ffffff'
        );

        const tapCenterX = 158;
        const tapCenterY = 266;

        ctx.fillStyle = '#543847';
        ctx.fillRect(tapCenterX - 58, tapCenterY - 14, 38, 18);
        ctx.fillStyle = '#e03c00';
        ctx.fillRect(tapCenterX - 56, tapCenterY - 12, 34, 14);
        drawPixelText(ctx, 'TAP', tapCenterX - 39, tapCenterY - 9, 1, '#ffffff', '#543847', 'center');

        ctx.fillStyle = '#543847';
        ctx.fillRect(tapCenterX + 20, tapCenterY - 14, 38, 18);
        ctx.fillStyle = '#e03c00';
        ctx.fillRect(tapCenterX + 22, tapCenterY - 12, 34, 14);
        drawPixelText(ctx, 'TAP', tapCenterX + 39, tapCenterY - 9, 1, '#ffffff', '#543847', 'center');

        ctx.fillStyle = '#543847';
        ctx.fillRect(tapCenterX - 8, tapCenterY - 8, 16, 26);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tapCenterX - 6, tapCenterY - 6, 12, 22);
        ctx.fillStyle = '#ded895';
        ctx.fillRect(tapCenterX - 2, tapCenterY - 14, 4, 10);

        drawPixelText(
          ctx,
          'TAP TO FLY',
          144,
          324,
          2,
          '#ffffff',
          '#543847',
          'center',
          '#f8e71c'
        );
      } else if (g.state === 'PLAYING' || g.state === 'DYING') {
        drawPixelText(
          ctx,
          String(g.score),
          144,
          38,
          4,
          '#ffffff',
          '#000000',
          'center'
        );

        // Stage & Active Power-Ups HUD indicator under live score
        drawPixelText(
          ctx,
          `STAGE ${stageInfo.stageNum}`,
          144,
          76,
          1,
          '#f8e71c',
          '#000000',
          'center'
        );
      }

      // 9. 2-Frame Solid White Flash on Collision
      if (g.flashFrames > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      ctx.restore();
    };

    const loop = (now: number) => {
      let delta = now - lastTime;
      lastTime = now;
      if (delta > 100) delta = 100;

      accumulator += delta;
      while (accumulator >= FIXED_TIMESTEP_MS) {
        updatePhysicsTick();
        accumulator -= FIXED_TIMESTEP_MS;
      }

      renderFrame();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [
    addCoinsToWallet,
    checkAndUnlockAchievements,
    handleDailyEvent,
    spawnParticles,
    spawnPopup,
    submitScoreToLeaderboard,
    syncTelemetryImmediate,
  ]);

  const currentMedalInfo =
    telemetry.score >= 40
      ? { nameAr: 'بلاتينية', nameEn: 'Platinum', color: 'from-cyan-200 to-sky-400 text-slate-950' }
      : telemetry.score >= 30
      ? { nameAr: 'ذهبية', nameEn: 'Gold', color: 'from-amber-300 to-yellow-500 text-slate-950' }
      : telemetry.score >= 20
      ? { nameAr: 'فضية', nameEn: 'Silver', color: 'from-slate-200 to-slate-400 text-slate-950' }
      : telemetry.score >= 10
      ? { nameAr: 'برونزية', nameEn: 'Bronze', color: 'from-amber-600 to-orange-700 text-white' }
      : null;

  const activeSkinMeta = BIRD_SKINS.find((s) => s.id === selectedSkin) || BIRD_SKINS[0];
  const activeDiffMeta = DIFFICULTY_CONFIGS[difficulty];
  const activeChallenge = getActiveChallengeTemplate(dailyState);
  const challengeProgressPercent = Math.min(
    100,
    Math.round((dailyState.progress / activeChallenge.target) * 100)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none pt-safe pb-safe">
      {/* Top Bar following strict 3-zone contract */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-6 py-3 border-b border-slate-800/80 bg-slate-950/95 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            goToMainMenu();
          }}
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          FLAPPY WING
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab('arcade')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'arcade' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Arcade Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'leaderboard' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Leaderboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('physics')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'physics' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Mobile & Capacitor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'audio' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Web Audio Synth
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('source')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'source' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Single-File HTML5
          </button>
        </nav>

        {/* Zone 3: 1 primary action (PWA Install if available, or Export Single HTML) */}
        <div className="flex items-center shrink-0">
          {!isInstalled && isInstallable ? (
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تثبيت التطبيق (PWA)</span>
            </button>
          ) : !isInstalled && isIOS ? (
            <button
              type="button"
              onClick={() => setActiveModal('ios_install')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تثبيت على آيفون</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDownloadStandalone}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Single HTML</span>
            </button>
          )}
        </div>
      </header>

      {/* Offline Banner if network disconnects */}
      {!isOnline && (
        <div className="bg-amber-500/95 text-slate-950 text-xs font-semibold text-center py-1.5 px-4">
          وضع عدم الاتصال (Offline Mode) — اللعبة وجميع المراحل والمتجر تعمل محلياً بالكامل
        </div>
      )}

      {/* Feedback Toast */}
      {shareToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-xl">
          {shareToast}
        </div>
      )}

      {/* Main 1440px-centered Responsive Mobile + Desktop Workspace */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-2 sm:px-6 py-3 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left/Center Column: Mobile-First 9:16 Portrait Game Viewport */}
        <section className="lg:col-span-5 flex flex-col items-center w-full">
          <div className="relative p-2 sm:p-3 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
            {/* Inner Viewport Wrapper matching 9:16 (288x512) portrait aspect ratio */}
            <div className="relative w-[min(92vw,372px)] sm:w-[374px] md:w-[390px] aspect-[288/512] rounded-2xl overflow-hidden shadow-inner">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleFlapAction();
                }}
                className="pixelated-canvas block w-full h-full cursor-pointer select-none touch-none"
                aria-label="FLAPPY WING Mobile Game Canvas"
              />

              {/* ===================================================================
                  TOP CORNER FLOATING CONTROLS & POWER-UP STATUS DURING GAMEPLAY
                 =================================================================== */}
              {(telemetry.state === 'PLAYING' || telemetry.state === 'GET_READY') &&
                activeModal === 'none' && (
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={handleTogglePause}
                      aria-label="إيقاف مؤقت / Pause"
                      className="pointer-events-auto min-w-[44px] min-h-[44px] rounded-xl bg-slate-950/50 hover:bg-slate-950/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer"
                    >
                      <Pause className="w-5 h-5" />
                    </button>

                    {/* Active Power-Up Badges in Top Bar */}
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                      {telemetry.activeShield && (
                        <span className="px-2 py-1 rounded-lg bg-sky-500/80 text-slate-950 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" />
                          <span>درع</span>
                        </span>
                      )}
                      {telemetry.magnetFrames > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-rose-500/85 text-white">
                          مغناطيس {Math.ceil(telemetry.magnetFrames / 60)}s
                        </span>
                      )}
                      {telemetry.slowMoFrames > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-purple-500/85 text-white">
                          تبطيء {Math.ceil(telemetry.slowMoFrames / 60)}s
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        soundRef.current.playClick();
                        setSfxEnabled((v) => !v);
                      }}
                      aria-label="كتم الصوت / Toggle SFX"
                      className="pointer-events-auto min-w-[44px] min-h-[44px] rounded-xl bg-slate-950/50 hover:bg-slate-950/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer"
                    >
                      {sfxEnabled ? (
                        <Volume2 className="w-5 h-5 text-amber-300" />
                      ) : (
                        <VolumeX className="w-5 h-5 text-rose-400" />
                      )}
                    </button>
                  </div>
                )}

              {/* ===================================================================
                  1. MAIN MENU OVERLAY (شاشة البداية الجذابة + المهام اليومية)
                 =================================================================== */}
              {telemetry.state === 'MAIN_MENU' && activeModal === 'none' && (
                <div
                  dir="rtl"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-5 bg-gradient-to-b from-slate-950/65 via-slate-950/20 to-slate-950/92"
                >
                  {/* Top Bar inside Main Menu: Best Score, Coins, Achievements */}
                  <div className="flex items-center justify-between text-xs font-semibold text-white bg-slate-950/70 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/15 font-mono tabular-nums">
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('leaderboard');
                      }}
                      className="hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      الأفضل: {telemetry.bestScore}
                    </button>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('skins');
                      }}
                      className="text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
                    >
                      العملات: {dailyState.coins}
                    </button>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('achievements');
                      }}
                      className="text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer"
                    >
                      الإنجازات: {profile.unlockedAchievements.length}/{ACHIEVEMENTS_LIST.length}
                    </button>
                  </div>

                  {/* Center Title Lockup */}
                  <div className="text-center mt-1">
                    <h2 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.85)]">
                      FLAPPY WING
                    </h2>
                    <p className="text-xs text-slate-200 mt-0.5 drop-shadow">
                      {activeSkinMeta.nameAr} · المستوى: {activeDiffMeta.labelAr}
                    </p>
                  </div>

                  {/* Daily Challenge Widget */}
                  <div className="bg-slate-900/90 backdrop-blur-md border border-white/15 rounded-2xl p-3 shadow-xl flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                        <Target className="w-3.5 h-3.5 shrink-0" />
                        <span>تحدي اليوم · Daily Challenge</span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-emerald-300 font-semibold">
                        +{activeChallenge.rewardCoins} عملة
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-100 leading-snug">
                      {activeChallenge.titleAr}
                    </div>

                    <div className="flex items-center gap-2.5 mt-0.5">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-transform duration-150 origin-right"
                          style={{
                            transform: `scaleX(${challengeProgressPercent / 100})`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums font-bold text-slate-200 shrink-0">
                        {dailyState.progress}/{activeChallenge.target}
                      </span>
                    </div>

                    {dailyState.completed && !dailyState.claimed && (
                      <button
                        type="button"
                        onClick={handleClaimDailyReward}
                        className="mt-1 w-full min-h-[40px] rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <Award className="w-4 h-4" />
                        <span>استلام المكافأة (+{activeChallenge.rewardCoins} عملة)</span>
                      </button>
                    )}

                    {dailyState.claimed && (
                      <div className="mt-0.5 flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                        <span className="text-[11px] text-emerald-400 font-semibold">
                          تم إنجاز التحدي واستلام الوسام
                        </span>
                        <button
                          type="button"
                          onClick={handleNextBonusChallenge}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>تحدي إضافي</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Thumb-Zone Navigation & Action Buttons */}
                  <div className="flex flex-col gap-2 w-full">
                    {/* Prominent PLAY Button */}
                    <button
                      type="button"
                      onClick={startNewGameSession}
                      className="w-full min-h-[52px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-amber-950/40 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-slate-950" />
                      <span>ابدأ اللعب · PLAY</span>
                    </button>

                    {/* 4-Button Grid for Shop/Skins, Achievements, Leaderboard, Settings */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          soundRef.current.playClick();
                          setActiveModal('skins');
                        }}
                        className="min-h-[46px] rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs border border-white/15 backdrop-blur-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <Palette className="w-4 h-4 text-amber-400" />
                        <span>متجر الطيور</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundRef.current.playClick();
                          setActiveModal('achievements');
                        }}
                        className="min-h-[46px] rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs border border-white/15 backdrop-blur-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <Trophy className="w-4 h-4 text-emerald-400" />
                        <span>الإنجازات</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundRef.current.playClick();
                          fetchLeaderboard();
                          setActiveModal('leaderboard');
                        }}
                        className="min-h-[46px] rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs border border-white/15 backdrop-blur-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <Globe className="w-4 h-4 text-purple-400" />
                        <span>الترتيب والأفضل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundRef.current.playClick();
                          setActiveModal('settings');
                        }}
                        className="min-h-[46px] rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs border border-white/15 backdrop-blur-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-sky-400" />
                        <span>الإعدادات</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================================
                  2. PAUSE MENU MODAL (قائمة الإيقاف المؤقت)
                 =================================================================== */}
              {isPaused && (
                <div
                  dir="rtl"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-30 flex items-center justify-center p-5 bg-slate-950/75 backdrop-blur-md"
                >
                  <div className="w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
                    <div className="text-center pb-2 border-b border-slate-800">
                      <h3 className="text-lg font-bold text-white">إيقاف مؤقت (Paused)</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        النتيجة: {telemetry.score} · {telemetry.stageNameAr}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setIsPaused(false);
                      }}
                      className="w-full min-h-[48px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>متابعة اللعب (Resume)</span>
                    </button>

                    <button
                      type="button"
                      onClick={startNewGameSession}
                      className="w-full min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-emerald-400" />
                      <span>إعادة المحاولة (Restart)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('settings');
                      }}
                      className="w-full min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-sky-400" />
                      <span>الإعدادات (Settings)</span>
                    </button>

                    <button
                      type="button"
                      onClick={goToMainMenu}
                      className="w-full min-h-[48px] rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-semibold text-sm border border-slate-800 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <Home className="w-4 h-4" />
                      <span>القائمة الرئيسية (Home)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ===================================================================
                  3. GAME OVER MODAL (شاشة نهاية اللعبة الاحترافية)
                 =================================================================== */}
              {telemetry.state === 'GAME_OVER' && activeModal === 'none' && (
                <div
                  dir="rtl"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-20 flex flex-col justify-between p-5 bg-gradient-to-b from-slate-950/75 via-slate-950/60 to-slate-950/92 backdrop-blur-[2px]"
                >
                  <div className="text-center pt-1">
                    <h2 className="text-2xl font-extrabold text-amber-400 tracking-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]">
                      انتهت الجولة · GAME OVER
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {telemetry.stageNameAr} · رصيد العملات: {dailyState.coins}
                    </p>
                  </div>

                  {/* Classic Scoreboard Card */}
                  <div className="my-auto bg-[#ded895] text-[#543847] border-4 border-[#543847] rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div className="flex flex-col gap-3">
                        <div>
                          <div className="text-xs font-extrabold uppercase tracking-wider text-[#b85b18]">
                            النتيجة (SCORE)
                          </div>
                          <div className="text-3xl font-black font-mono tabular-nums text-[#543847] leading-none mt-1">
                            {telemetry.score}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#c4ba70]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-[#b85b18]">
                              الأفضل (BEST)
                            </span>
                            {telemetry.isNewBest && (
                              <span className="bg-red-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                                جديد NEW
                              </span>
                            )}
                          </div>
                          <div className="text-2xl font-black font-mono tabular-nums text-[#543847] leading-none mt-1">
                            {telemetry.bestScore}
                          </div>
                        </div>
                      </div>

                      {/* Medal Award */}
                      <div className="flex flex-col items-center justify-center bg-[#c9be74] border-2 border-[#b5ab60] rounded-xl p-3 min-h-[104px]">
                        <span className="text-[11px] font-extrabold text-[#7a591b] mb-1.5">
                          الميدالية (MEDAL)
                        </span>
                        {currentMedalInfo ? (
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-11 h-11 rounded-full bg-gradient-to-br ${currentMedalInfo.color} border-2 border-[#543847] flex items-center justify-center shadow-md`}
                            >
                              <Trophy className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-[#543847] mt-1">
                              {currentMedalInfo.nameAr}
                            </span>
                          </div>
                        ) : (
                          <div className="text-center text-[11px] text-[#7a6f3a] font-medium">
                            10 نقاط لنيل البرونزية
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Daily Challenge Quick Status inside Game Over */}
                    <div className="pt-2 border-t border-[#c4ba70] flex items-center justify-between text-xs">
                      <span className="font-bold text-[#543847] truncate">
                        تحدي اليوم: {dailyState.progress}/{activeChallenge.target}
                      </span>
                      {dailyState.completed && !dailyState.claimed ? (
                        <button
                          type="button"
                          onClick={handleClaimDailyReward}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                        >
                          استلام +{activeChallenge.rewardCoins} عملة
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-[#7a591b]">
                          {dailyState.claimed ? 'مكتمل ومُستلم' : activeChallenge.titleAr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Thumb-Zone Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={startNewGameSession}
                      className="w-full min-h-[50px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <RotateCcw className="w-5 h-5" />
                      <span>إعادة المحاولة · Play Again</span>
                    </button>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={handleShareScore}
                        className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs border border-white/15 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>مشاركة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundRef.current.playClick();
                          setActiveModal('skins');
                        }}
                        className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs border border-white/15 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <Palette className="w-3.5 h-3.5 text-amber-400" />
                        <span>المتجر</span>
                      </button>

                      <button
                        type="button"
                        onClick={goToMainMenu}
                        className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs border border-white/15 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <Home className="w-3.5 h-3.5 text-sky-400" />
                        <span>الرئيسية</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================================
                  4. SETTINGS MODAL (شاشة الإعدادات والمراحل والصعوبة)
                 =================================================================== */}
              {activeModal === 'settings' && (
                <div
                  dir="rtl"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-40 flex flex-col justify-between p-4 bg-slate-950/95 backdrop-blur-md overflow-y-auto"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <h3 className="text-base font-bold text-white">
                        الإعدادات (Settings)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('none');
                      }}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 my-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !sfxEnabled;
                        setSfxEnabled(next);
                        if (next) soundRef.current.playScore();
                      }}
                      className="w-full min-h-[48px] px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-right">
                        <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-100">
                            المؤثرات الصوتية (SFX)
                          </div>
                          <div className="text-[10px] text-slate-400">
                            أصوات القفز والنقاط والقدرات
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          sfxEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {sfxEnabled ? 'مفعّل' : 'مغلق'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setMusicEnabled((v) => !v);
                      }}
                      className="w-full min-h-[48px] px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-right">
                        <Music className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-100">
                            موسيقى الخلفية (8-Bit Music)
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ألحان أركيد تفاعلية أثناء اللعب
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          musicEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {musicEnabled ? 'مفعّل' : 'مغلق'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const next = !hapticsEnabled;
                        setHapticsEnabled(next);
                        soundRef.current.hapticsEnabled = next;
                        if (next) soundRef.current.triggerHaptic(50);
                        soundRef.current.playClick();
                      }}
                      className="w-full min-h-[48px] px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-right">
                        <Vibrate className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-100">
                            الاهتزاز (Haptics)
                          </div>
                          <div className="text-[10px] text-slate-400">
                            اهتزاز الهاتف عند الاصطدام والنقاط
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          hapticsEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {hapticsEnabled ? 'مفعّل' : 'مغلق'}
                      </span>
                    </button>

                    {/* Difficulty Selection */}
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                      <div className="text-xs font-bold text-slate-200 mb-1.5">
                        مستوى الصعوبة (Difficulty)
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['easy', 'normal', 'hard'] as DifficultyLevel[]).map((lvl) => {
                          const d = DIFFICULTY_CONFIGS[lvl];
                          const active = difficulty === lvl;
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => {
                                soundRef.current.playClick();
                                setDifficulty(lvl);
                              }}
                              className={`min-h-[40px] py-1.5 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                active
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
                              }`}
                            >
                              {d.labelAr} ({d.labelEn})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Stage / Biome Progression Selection */}
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                      <div className="text-xs font-bold text-slate-200 mb-1.5">
                        نظام المراحل والخلفيات (Stages & Biomes)
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {(
                          [
                            { id: 'auto', label: 'تلقائي' },
                            { id: 'day', label: 'نهار' },
                            { id: 'sunset', label: 'غروب' },
                            { id: 'night', label: 'ليل' },
                            { id: 'cosmos', label: 'فضاء' },
                          ] as { id: StageModeOption; label: string }[]
                        ).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              soundRef.current.playClick();
                              setStageMode(st.id);
                            }}
                            className={`min-h-[38px] rounded-lg text-[11px] font-bold border cursor-pointer ${
                              stageMode === st.id
                                ? 'bg-sky-400 text-slate-950 border-sky-300'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundRef.current.playClick();
                      setActiveModal('none');
                    }}
                    className="w-full min-h-[46px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
                  >
                    حفظ والعودة
                  </button>
                </div>
              )}

              {/* ===================================================================
                  5. CHARACTER SHOP & SKINS MODAL (متجر شراء الشخصيات بالعملات)
                 =================================================================== */}
              {activeModal === 'skins' && (
                <div
                  dir="rtl"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-40 flex flex-col justify-between p-4 bg-slate-950/95 backdrop-blur-md overflow-y-auto"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        متجر الطيور (Character Shop)
                      </h3>
                      <p className="text-xs text-amber-300 font-mono">
                        رصيدك الحالي: {dailyState.coins} عملة
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('none');
                      }}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 my-2.5 overflow-y-auto pr-0.5">
                    {SHOP_BIRDS.map((item) => {
                      const isUnlocked = profile.unlockedSkins.includes(item.id);
                      const isSelected = selectedSkin === item.id;
                      const canAfford = dailyState.coins >= item.priceCoins;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectOrBuyBird(item)}
                          className={`w-full min-h-[54px] px-3 py-2 rounded-2xl border flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-400/15 border-amber-400 text-white'
                              : isUnlocked
                              ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800/70'
                              : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-9 rounded-xl bg-[#70c5ce] border border-slate-700 flex items-center justify-center shrink-0">
                              {skinPreviews[item.id] && (
                                <img
                                  src={skinPreviews[item.id]}
                                  alt={item.nameEn}
                                  referrerPolicy="no-referrer"
                                  className="pixelated-canvas w-8 h-6"
                                />
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold text-slate-100">
                                {item.nameAr}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {item.descAr}
                              </div>
                            </div>
                          </div>

                          {isSelected ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 shrink-0">
                              مُجهّز
                            </span>
                          ) : isUnlocked ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-300 shrink-0">
                              اختيار
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                                canAfford
                                  ? 'bg-emerald-400 text-slate-950'
                                  : 'bg-slate-800 text-amber-300'
                              }`}
                            >
                              <Lock className="w-3 h-3" />
                              <span>{item.priceCoins} عملة</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundRef.current.playClick();
                      setActiveModal('none');
                    }}
                    className="w-full min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
                  >
                    العودة للقائمة
                  </button>
                </div>
              )}

              {/* ===================================================================
                  6. ACHIEVEMENTS MODAL (شاشة الإنجازات والمكافآت)
                 =================================================================== */}
              {activeModal === 'achievements' && (
                <div
                  dir="rtl"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-40 flex flex-col justify-between p-4 bg-slate-950/95 backdrop-blur-md overflow-y-auto"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        الإنجازات والمكافآت (Achievements)
                      </h3>
                      <p className="text-xs text-emerald-300 font-mono">
                        مكتمل: {profile.unlockedAchievements.length} من {ACHIEVEMENTS_LIST.length}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('none');
                      }}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 my-2.5 overflow-y-auto pr-0.5">
                    {ACHIEVEMENTS_LIST.map((ach) => {
                      const unlocked = profile.unlockedAchievements.includes(ach.id);
                      return (
                        <div
                          key={ach.id}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                            unlocked
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                              : 'bg-slate-900/70 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 text-right">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                unlocked
                                  ? 'bg-emerald-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              <Trophy className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-100">
                                {ach.titleAr}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {ach.descAr}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-1 rounded-lg shrink-0 ${
                              unlocked
                                ? 'bg-emerald-400/20 text-emerald-300'
                                : 'bg-slate-800 text-amber-300'
                            }`}
                          >
                            {unlocked ? 'مكتمل ✓' : `+${ach.rewardCoins} عملة`}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundRef.current.playClick();
                      setActiveModal('none');
                    }}
                    className="w-full min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
                  >
                    العودة
                  </button>
                </div>
              )}

              {/* ===================================================================
                  7. BEST SCORE & GLOBAL LEADERBOARD MODAL (شاشة أفضل نتيجة والترتيب العالمي)
                 =================================================================== */}
              {activeModal === 'leaderboard' && (
                <div
                  dir="rtl"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-40 flex flex-col justify-between p-4 bg-slate-950/95 backdrop-blur-md overflow-y-auto"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        أفضل نتيجة ولوحة الترتيب
                      </h3>
                      <p className="text-xs text-slate-400">
                        أفضل نتيجة لك: <strong className="text-amber-300">{telemetry.bestScore}</strong> · لقبك:{' '}
                        <button
                          type="button"
                          onClick={handleCyclePilotName}
                          className="text-sky-300 underline cursor-pointer"
                        >
                          {profile.playerName} (تغيير)
                        </button>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('none');
                      }}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 my-2.5 overflow-y-auto pr-0.5 font-mono tabular-nums">
                    {leaderboard.slice(0, 8).map((entry, idx) => (
                      <div
                        key={entry.id}
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs ${
                          idx === 0
                            ? 'bg-amber-400/15 border-amber-400/50 text-amber-200'
                            : 'bg-slate-900 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center font-bold text-slate-400">
                            #{idx + 1}
                          </span>
                          <span className="font-bold">{entry.playerName}</span>
                          <span className="text-[10px] text-slate-400">
                            Stage {entry.stageReached}
                          </span>
                        </div>
                        <span className="font-extrabold text-sm text-emerald-400">
                          {entry.score}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSubmittingScore || telemetry.bestScore < 1}
                      onClick={() =>
                        submitScoreToLeaderboard(
                          telemetry.bestScore,
                          difficulty,
                          selectedSkin
                        )
                      }
                      className="flex-1 min-h-[44px] rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      {isSubmittingScore ? 'جاري التحديث...' : 'رفع أفضل نتيجة للترتيب'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('none');
                      }}
                      className="px-4 min-h-[44px] rounded-xl bg-slate-800 text-slate-200 font-bold text-xs cursor-pointer"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              )}

              {/* ===================================================================
                  8. iOS SAFARI INSTALL GUIDE MODAL
                 =================================================================== */}
              {activeModal === 'ios_install' && (
                <div
                  dir="rtl"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-40 flex items-center justify-center p-5 bg-slate-950/90 backdrop-blur-md"
                >
                  <div className="w-full bg-slate-900 border border-slate-700 rounded-3xl p-5 text-right flex flex-col gap-3">
                    <h3 className="text-base font-bold text-white">
                      تثبيت اللعبة على iPhone / iPad
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      1. اضغط على زر <strong>المشاركة (Share)</strong> في شريط متصفح Safari.<br />
                      2. اختر <strong>الإضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong> لتعمل اللعبة بملء الشاشة.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveModal('none')}
                      className="w-full min-h-[44px] rounded-xl bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      حسناً، فهمت
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Unboxed clean metadata strip under canvas */}
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
            <span>9:16 Portrait (288×512)</span>
            <span aria-hidden="true">·</span>
            <span>{telemetry.stageNameAr}</span>
            <span aria-hidden="true">·</span>
            <span>Capacitor Android & iOS Ready</span>
          </div>
        </section>

        {/* Right Column: Interactive Studio, Shop, Achievements, Leaderboard & Capacitor Build Guide */}
        <section className="lg:col-span-7 flex flex-col gap-6 w-full">
          {/* Quick Control Bar */}
          <div className="p-5 sm:p-6 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-100">
                  FLAPPY WING — Mobile & Capacitor Arcade Edition
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  4 Dynamic Stages · In-Game Power-Ups & Coins · Character Shop · Achievements · Capacitor Android & iOS
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundRef.current.playClick();
                    setActiveModal('skins');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5 text-amber-400" />
                  <span>Shop ({profile.unlockedSkins.length}/{SHOP_BIRDS.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundRef.current.playClick();
                    setActiveModal('achievements');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Achievements ({profile.unlockedAchievements.length}/{ACHIEVEMENTS_LIST.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowHitboxes((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showHitboxes
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showHitboxes ? 'Hitbox: On' : 'Hitbox'}</span>
                </button>
              </div>
            </div>

            {/* Live Score, Best Score, Wing Coins & Stage Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono tabular-nums">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Live Score</span>
                <span className="text-lg font-bold text-slate-100 mt-0.5">
                  {telemetry.score}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Best Score</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-bold text-emerald-400">
                    {telemetry.bestScore}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetHighScore}
                    title="Reset Best Score"
                    className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Wing Coins</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-lg font-bold text-amber-400">
                  <Coins className="w-4 h-4" />
                  <span>{dailyState.coins}</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Current Stage</span>
                <span className="text-sm font-bold text-sky-400 mt-1">
                  Stage {telemetry.stageNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Tab Bar */}
          <div className="flex md:hidden items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            {(['arcade', 'leaderboard', 'physics', 'audio', 'source'] as ActiveTab[]).map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-2 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === tab
                      ? 'bg-slate-800 text-amber-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              )
            )}
          </div>

          {/* Tab Content Area */}
          {activeTab === 'arcade' && (
            <div className="p-5 sm:p-6 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-6">
              {/* Daily Challenge Panel */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-slate-100">
                      Daily Challenge · تحدي اليوم ({dailyState.dateKey})
                    </h2>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-amber-300">
                    Reward: +{activeChallenge.rewardCoins} Wing Coins · {activeChallenge.badgeNameEn}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {activeChallenge.titleEn}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {activeChallenge.titleAr}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-mono tabular-nums font-bold text-slate-200">
                      {dailyState.progress} / {activeChallenge.target}
                    </span>
                    {dailyState.completed && !dailyState.claimed ? (
                      <button
                        type="button"
                        onClick={handleClaimDailyReward}
                        className="px-3.5 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Claim +{activeChallenge.rewardCoins} Coins
                      </button>
                    ) : dailyState.claimed ? (
                      <button
                        type="button"
                        onClick={handleNextBonusChallenge}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Next Bonus Goal</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-transform duration-150 origin-left"
                    style={{
                      transform: `scaleX(${challengeProgressPercent / 100})`,
                    }}
                  />
                </div>
              </div>

              {/* Character Shop Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-100">
                    متجر الشخصيات بالعملات · Bird Character Shop
                  </h2>
                  <span className="text-xs text-amber-300 font-mono">
                    {dailyState.coins} Wing Coins Available
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {SHOP_BIRDS.map((item) => {
                    const isUnlocked = profile.unlockedSkins.includes(item.id);
                    const active = selectedSkin === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectOrBuyBird(item)}
                        className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-amber-400/15 border-amber-400 text-slate-100'
                            : isUnlocked
                            ? 'bg-slate-900/70 border-slate-800 text-slate-200 hover:border-slate-700'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-11 h-9 rounded-lg bg-[#70c5ce] border border-slate-700 flex items-center justify-center shrink-0">
                          {skinPreviews[item.id] && (
                            <img
                              src={skinPreviews[item.id]}
                              alt={item.nameEn}
                              referrerPolicy="no-referrer"
                              className="pixelated-canvas w-8 h-6"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-100 truncate">
                            {item.nameAr}
                          </div>
                          <div className="text-[11px] font-mono text-amber-400 mt-0.5">
                            {active
                              ? 'Equipped'
                              : isUnlocked
                              ? 'Unlocked'
                              : `${item.priceCoins} Coins`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Power-Ups & Stages Legend */}
              <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                    <Shield className="w-3.5 h-3.5" />
                    <span>الدرع الواقي · Shield Orb</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    يحميك من اصطدام كامل بأنبوب أو بالأرض لمرة واحدة.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span>مغناطيس العملات · Magnet</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    يجذب العملات الذهبية تلقائياً نحو الطائر لمدة 8 ثوانٍ.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
                    <Sun className="w-3.5 h-3.5" />
                    <span>تبطيء الزمن · Slow-Mo</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    يبطئ سرعة الأنابيب بنسبة 30% لمدة 6 ثوانٍ للعبور الآمن.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    لوحة الترتيب العالمية · Global Server Leaderboard
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connected to secure Express API (`/api/leaderboard`) with automatic offline caching.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCyclePilotName}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300 border border-slate-700 cursor-pointer"
                  >
                    Pilot: {profile.playerName}
                  </button>
                  <button
                    type="button"
                    onClick={fetchLeaderboard}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-800/80 font-mono tabular-nums text-xs">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="py-2.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-bold text-slate-400">#{idx + 1}</span>
                      <span className="font-semibold text-slate-100">
                        {entry.playerName}
                      </span>
                      <span className="text-slate-400 capitalize">
                        {entry.difficulty} · Stage {entry.stageReached}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">
                      {entry.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'physics' && (
            <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-4">
              <h2 className="text-base font-semibold text-slate-100">
                Capacitor Android & iOS Build Guide + Mobile Architecture
              </h2>
              <div className="divide-y divide-slate-800/80 text-sm">
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">App ID / Bundle Identifier</span>
                  <span className="font-mono text-xs text-amber-400">
                    com.flappywing.arcade (configurable in capacitor.config.ts)
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Native Platforms Generated</span>
                  <span className="font-mono text-xs text-emerald-400">
                    /android (Android Studio) · /ios (Xcode) · /dist (Web PWA)
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Build & Sync Command</span>
                  <span className="font-mono text-xs text-slate-200">
                    npm run build && npx cap sync
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Open in Android Studio / Xcode</span>
                  <span className="font-mono text-xs text-slate-200">
                    npm run cap:android · npm run cap:ios
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Background Lifecycle Protection</span>
                  <span className="font-mono text-xs text-slate-200">
                    Auto-Pause & Audio Suspend on visibilitychange / blur
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Web Audio API 8-Bit SFX & Chiptune Synthesizer
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    100% procedural synthesis without external audio files.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMusicEnabled((v) => !v)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    musicEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>{musicEnabled ? '8-Bit Music: Playing' : 'Play 8-Bit Music'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                {[
                  {
                    label: 'Flap (Whoosh)',
                    desc: 'Bandpass white-noise burst + 210→520Hz triangle sweep',
                    play: () => soundRef.current.playFlap(),
                  },
                  {
                    label: 'Score / Coin (B5→E6)',
                    desc: 'Two-tone square chime stepping B5 to E6',
                    play: () => soundRef.current.playScore(),
                  },
                  {
                    label: 'Power-Up Collected',
                    desc: 'Ascending 4-note 8-bit arpeggio (C5→E5→G5→C6)',
                    play: () => soundRef.current.playPowerUp(),
                  },
                  {
                    label: 'Shield Deflection',
                    desc: 'Protective sawtooth energy deflection + haptic pulse',
                    play: () => soundRef.current.playShieldBreak(),
                  },
                  {
                    label: 'Hit + Haptic Vibration',
                    desc: '150→32Hz sawtooth drop + noise burst + navigator.vibrate',
                    play: () => soundRef.current.playHit(),
                  },
                  {
                    label: 'Die (Falling Pitch Slide)',
                    desc: '640→115Hz downward triangle pitch slide over 350ms',
                    play: () => soundRef.current.playDie(),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.play}
                    className="p-3.5 text-left rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 transition-colors flex items-start justify-between gap-3 cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-100">
                        {item.label}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
                    </div>
                    <Play className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'source' && (
            <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Self-Contained Single-File HTML5 Source
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Complete standalone HTML, CSS, and JS in one file with zero external dependencies.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyStandalone}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedSource ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied HTML</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Full Code</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadStandalone}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .html</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto max-h-[340px] leading-relaxed select-all">
                <code>{STANDALONE_FLAPPY_HTML}</code>
              </pre>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
