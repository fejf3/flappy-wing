import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Play,
  Pause,
  Settings,
  Palette,
  Home,
  Share2,
  Vibrate,
  X,
  Trophy,
  Sliders,
  Shield,
  Globe,
  Lock,
  Coins,
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
import {
  SHOP_BIRDS,
  PowerUpType,
  PlayerProfileState,
  loadPlayerProfile,
  savePlayerProfile,
} from './achievementsAndShop';

type GameState = 'MAIN_MENU' | 'GET_READY' | 'PLAYING' | 'DYING' | 'GAME_OVER';
type ActiveModal = 'none' | 'settings' | 'skins';
export type DifficultyLevel = 'easy' | 'normal' | 'hard';
export type StageModeOption = 'auto' | StageThemeId;
export type AppLanguage = 'ar' | 'en';

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

const BEST_SCORE_STORAGE_KEY = 'flappy_best_score_2013';
const SETTINGS_STORAGE_KEY = 'flappy_settings_v3';
const COINS_STORAGE_KEY = 'flappy_wing_coins_v1';
const LEGACY_DAILY_STORAGE_KEY = 'flappy_wing_daily_v1';

function loadSavedCoins(): number {
  try {
    const raw = localStorage.getItem(COINS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    // Migrate coins from previous storage if present
    const legacyRaw = localStorage.getItem(LEGACY_DAILY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (typeof legacyParsed.coins === 'number' && legacyParsed.coins >= 0) {
        localStorage.setItem(COINS_STORAGE_KEY, String(legacyParsed.coins));
        return legacyParsed.coins;
      }
    }
  } catch {
    // ignore storage errors
  }
  return 0;
}

function saveCoinsToStorage(coins: number): void {
  try {
    localStorage.setItem(COINS_STORAGE_KEY, String(Math.max(0, Math.floor(coins))));
  } catch {
    // ignore storage errors
  }
}

interface SavedSettings {
  sfxEnabled: boolean;
  hapticsEnabled: boolean;
  difficulty: DifficultyLevel;
  skin: BirdSkinId;
  stageMode: StageModeOption;
  language: AppLanguage;
}

function loadSavedSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sfxEnabled: parsed.sfxEnabled ?? true,
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
        language: parsed.language === 'en' ? 'en' : 'ar',
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    sfxEnabled: true,
    hapticsEnabled: true,
    difficulty: 'normal',
    skin: 'classic',
    stageMode: 'auto',
    language: 'ar',
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

interface TelemetrySnapshot {
  state: GameState;
  score: number;
  bestScore: number;
  isNewBest: boolean;
  stageNumber: number;
  stageNameAr: string;
  stageNameEn: string;
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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundRef = useRef<FlappySoundEngine>(new FlappySoundEngine());
  const atlasRef = useRef<SpriteAtlas | null>(null);

  const initialSettings = useRef<SavedSettings>(loadSavedSettings());

  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [sfxEnabled, setSfxEnabled] = useState<boolean>(initialSettings.current.sfxEnabled);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(initialSettings.current.hapticsEnabled);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(initialSettings.current.difficulty);
  const [selectedSkin, setSelectedSkin] = useState<BirdSkinId>(initialSettings.current.skin);
  const [stageMode, setStageMode] = useState<StageModeOption>(initialSettings.current.stageMode);
  const [language, setLanguage] = useState<AppLanguage>(initialSettings.current.language);

  const [coins, setCoins] = useState<number>(() => loadSavedCoins());
  const coinsRef = useRef<number>(coins);
  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  const [profile, setProfile] = useState<PlayerProfileState>(() => loadPlayerProfile());
  const profileRef = useRef<PlayerProfileState>(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const [showHitboxes] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [skinPreviews, setSkinPreviews] = useState<Record<BirdSkinId, string>>(
    {} as Record<BirdSkinId, string>
  );

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
      stageNameEn: 'Stage 1: Sunny Meadow',
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

  // Helper to award coins & persist in localStorage
  const addCoinsToWallet = useCallback((amount: number) => {
    if (amount <= 0) return;
    const nextCoins = coinsRef.current + amount;
    coinsRef.current = nextCoins;
    saveCoinsToStorage(nextCoins);
    setCoins(nextCoins);
  }, []);

  const handleSelectOrBuyBird = (birdItem: (typeof SHOP_BIRDS)[number]) => {
    const isUnlocked = profile.unlockedSkins.includes(birdItem.id);
    if (isUnlocked) {
      soundRef.current.playScore();
      setSelectedSkin(birdItem.id);
      return;
    }

    if (coins < birdItem.priceCoins) {
      soundRef.current.playHit();
      showToastMessage(
        language === 'ar'
          ? `تحتاج إلى ${birdItem.priceCoins - coins} عملة إضافية لشراء ${birdItem.nameAr}`
          : `You need ${birdItem.priceCoins - coins} more coins to unlock ${birdItem.nameEn}`
      );
      return;
    }

    // Deduct coins & unlock bird character in localStorage
    const nextCoins = coinsRef.current - birdItem.priceCoins;
    coinsRef.current = nextCoins;
    saveCoinsToStorage(nextCoins);
    setCoins(nextCoins);

    const nextProfile: PlayerProfileState = {
      ...profileRef.current,
      unlockedSkins: [...profileRef.current.unlockedSkins, birdItem.id],
    };
    profileRef.current = nextProfile;
    savePlayerProfile(nextProfile);
    setProfile(nextProfile);
    setSelectedSkin(birdItem.id);

    soundRef.current.playPowerUp();
    showToastMessage(
      language === 'ar'
        ? `تم شراء وتفعيل ${birdItem.nameAr} بنجاح!`
        : `Unlocked and equipped ${birdItem.nameEn}!`
    );
  };

  // Persist user settings to localStorage and sync with sound engine
  useEffect(() => {
    soundRef.current.sfxEnabled = sfxEnabled;
    soundRef.current.hapticsEnabled = hapticsEnabled;
    soundRef.current.stopMusicLoop();

    try {
      const toSave: SavedSettings = {
        sfxEnabled,
        hapticsEnabled,
        difficulty,
        skin: selectedSkin,
        stageMode,
        language,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignore
    }
  }, [sfxEnabled, hapticsEnabled, difficulty, selectedSkin, stageMode, language]);

  // Mobile Lifecycle & Visibility Handling:
  // Automatically pause gameplay when app goes to background or loses visibility
  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      if (document.visibilityState === 'hidden') {
        if (
          gameRef.current.state === 'PLAYING' ||
          gameRef.current.state === 'GET_READY'
        ) {
          setIsPaused(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    window.addEventListener('blur', handleVisibilityOrBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
      window.removeEventListener('blur', handleVisibilityOrBlur);
    };
  }, []);

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
      stageNameEn: stg.nameEn,
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
  }, [syncTelemetryImmediate]);

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
      syncTelemetryImmediate();
    } else if (g.state === 'PLAYING') {
      g.bird.vy = FLAP_VELOCITY;
      g.bird.rotation = -25;
      g.bird.flapHoldFrames = 14;
      sound.playFlap();
      sound.triggerHaptic(12);
      spawnParticles(g.bird.x - 10, g.bird.y + 4, 5, ['#ffffff', '#fef08a', '#bae6fd'], 0.8);
    }
  }, [spawnParticles, syncTelemetryImmediate]);

  const handleTogglePause = useCallback(() => {
    const g = gameRef.current;
    if (g.state !== 'PLAYING' && g.state !== 'GET_READY') return;
    soundRef.current.playClick();
    setIsPaused((prev) => !prev);
  }, []);

  const handleShareScore = async () => {
    const g = gameRef.current;
    soundRef.current.playClick();
    const diffCfg = DIFFICULTY_CONFIGS[difficulty];
    const shareText =
      language === 'ar'
        ? `حققت ${g.score} نقطة في لعبة FLAPPY WING (مستوى ${diffCfg.labelAr} · أفضل نتيجة: ${g.bestScore})! هل يمكنك تحطيم رقمي؟`
        : `I scored ${g.score} in FLAPPY WING (${diffCfg.labelEn} mode · Best: ${g.bestScore})! Can you beat my score?`;

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
      showToastMessage(
        language === 'ar'
          ? 'تم نسخ النتيجة للحافظة لمشاركتها!'
          : 'Score copied to clipboard to share!'
      );
    } catch {
      showToastMessage(shareText);
    }
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

      const nextProf: PlayerProfileState = {
        ...profileRef.current,
        totalGamesPlayed: profileRef.current.totalGamesPlayed + 1,
      };
      profileRef.current = nextProf;
      savePlayerProfile(nextProf);
      setProfile(nextProf);

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
          stageNameEn: stg.nameEn,
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
    spawnParticles,
    spawnPopup,
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

  const isAr = language === 'ar';
  const dirAttr = isAr ? 'rtl' : 'ltr';
  const stageLabel = isAr ? telemetry.stageNameAr : telemetry.stageNameEn;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center select-none pt-safe pb-safe px-2 py-2">
      {/* Feedback Toast */}
      {shareToast && (
        <div
          dir={dirAttr}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-xl"
        >
          {shareToast}
        </div>
      )}

      {/* Centered Mobile-First 9:16 Portrait Game Screen Only */}
      <main className="w-full flex flex-col items-center justify-center">
        <div className="relative p-2 sm:p-3 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
          {/* Inner Viewport Wrapper matching 9:16 (288x512) portrait aspect ratio */}
          <div className="relative w-[min(92vw,380px)] sm:w-[384px] md:w-[400px] aspect-[288/512] rounded-2xl overflow-hidden shadow-inner">
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
                    aria-label={isAr ? 'إيقاف مؤقت' : 'Pause'}
                    className="pointer-events-auto min-w-[44px] min-h-[44px] rounded-xl bg-slate-950/50 hover:bg-slate-950/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer"
                  >
                    <Pause className="w-5 h-5" />
                  </button>

                  {/* Active Power-Up Badges in Top Bar */}
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                    {telemetry.activeShield && (
                      <span className="px-2 py-1 rounded-lg bg-sky-500/80 text-slate-950 flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        <span>{isAr ? 'درع' : 'SHIELD'}</span>
                      </span>
                    )}
                    {telemetry.magnetFrames > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-rose-500/85 text-white">
                        {isAr ? 'مغناطيس' : 'MAGNET'} {Math.ceil(telemetry.magnetFrames / 60)}s
                      </span>
                    )}
                    {telemetry.slowMoFrames > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-purple-500/85 text-white">
                        {isAr ? 'تبطيء' : 'SLOW'} {Math.ceil(telemetry.slowMoFrames / 60)}s
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
                    aria-label={isAr ? 'كتم الصوت' : 'Toggle SFX'}
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
                1. START SCREEN OVERLAY (شاشة البداية النظيفة + زر المتجر المصغّر)
               =================================================================== */}
            {telemetry.state === 'MAIN_MENU' && activeModal === 'none' && (
              <div
                dir={dirAttr}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-5 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/85"
              >
                {/* Top Bar inside Start Screen: Coins, Best Score, and Compact Shop & Settings Buttons */}
                <div className="flex items-center justify-between gap-2">
                  {/* Coins & Best Score Pill */}
                  <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-950/75 backdrop-blur-md border border-white/15 text-xs font-bold font-mono tabular-nums text-white shadow-lg">
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{coins}</span>
                    </span>
                    <span className="text-slate-600" aria-hidden="true">|</span>
                    <span className="flex items-center gap-1 text-emerald-300">
                      <Trophy className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        {isAr ? `الأفضل: ${telemetry.bestScore}` : `Best: ${telemetry.bestScore}`}
                      </span>
                    </span>
                  </div>

                  {/* Compact Shop Button & Settings Button inside Start Screen */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('skins');
                      }}
                      title={isAr ? 'متجر الطيور' : 'Bird Shop'}
                      className="min-h-[40px] px-3 rounded-2xl bg-slate-950/75 hover:bg-slate-900 backdrop-blur-md border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer"
                    >
                      <Palette className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{isAr ? 'المتجر' : 'Shop'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('settings');
                      }}
                      aria-label={isAr ? 'الإعدادات' : 'Settings'}
                      title={isAr ? 'الإعدادات' : 'Settings'}
                      className="w-10 h-10 rounded-2xl bg-slate-950/75 hover:bg-slate-900 backdrop-blur-md border border-white/15 text-slate-200 flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-sky-400" />
                    </button>
                  </div>
                </div>

                {/* Center Title Lockup (above the animated bird on canvas) */}
                <div className="text-center -mt-20 pointer-events-none">
                  <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.85)]">
                    FLAPPY WING
                  </h1>
                  <p className="text-xs text-slate-200 mt-1 drop-shadow">
                    {isAr
                      ? `${activeSkinMeta.nameAr} · المستوى: ${activeDiffMeta.labelAr}`
                      : `${activeSkinMeta.nameEn} · Mode: ${activeDiffMeta.labelEn}`}
                  </p>
                </div>

                {/* Bottom Thumb-Zone PLAY Button */}
                <div className="flex flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={startNewGameSession}
                    className="w-full min-h-[54px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-amber-950/40 active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>{isAr ? 'ابدأ اللعب · PLAY' : 'PLAY GAME'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ===================================================================
                2. PAUSE MENU MODAL (قائمة الإيقاف المؤقت)
               =================================================================== */}
            {isPaused && (
              <div
                dir={dirAttr}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute inset-0 z-30 flex items-center justify-center p-5 bg-slate-950/75 backdrop-blur-md"
              >
                <div className="w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
                  <div className="text-center pb-2 border-b border-slate-800">
                    <h3 className="text-lg font-bold text-white">
                      {isAr ? 'إيقاف مؤقت' : 'Game Paused'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAr
                        ? `النتيجة: ${telemetry.score} · ${stageLabel}`
                        : `Score: ${telemetry.score} · ${stageLabel}`}
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
                    <span>{isAr ? 'متابعة اللعب' : 'Resume Game'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={startNewGameSession}
                    className="w-full min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-emerald-400" />
                    <span>{isAr ? 'إعادة المحاولة' : 'Restart'}</span>
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
                    <span>{isAr ? 'الإعدادات' : 'Settings'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={goToMainMenu}
                    className="w-full min-h-[48px] rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-semibold text-sm border border-slate-800 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <Home className="w-4 h-4" />
                    <span>{isAr ? 'القائمة الرئيسية' : 'Main Menu'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ===================================================================
                3. GAME OVER MODAL (شاشة نهاية اللعبة الاحترافية)
               =================================================================== */}
            {telemetry.state === 'GAME_OVER' && activeModal === 'none' && (
              <div
                dir={dirAttr}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute inset-0 z-20 flex flex-col justify-between p-5 bg-gradient-to-b from-slate-950/75 via-slate-950/60 to-slate-950/92 backdrop-blur-[2px]"
              >
                <div className="text-center pt-1">
                  <h2 className="text-2xl font-extrabold text-amber-400 tracking-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]">
                    {isAr ? 'انتهت الجولة' : 'GAME OVER'}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {isAr
                      ? `${stageLabel} · رصيد العملات: ${coins}`
                      : `${stageLabel} · Coins: ${coins}`}
                  </p>
                </div>

                {/* Classic Scoreboard Card */}
                <div className="my-auto bg-[#ded895] text-[#543847] border-4 border-[#543847] rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-wider text-[#b85b18]">
                          {isAr ? 'النتيجة' : 'SCORE'}
                        </div>
                        <div className="text-3xl font-black font-mono tabular-nums text-[#543847] leading-none mt-1">
                          {telemetry.score}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#c4ba70]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-[#b85b18]">
                            {isAr ? 'الأفضل' : 'BEST'}
                          </span>
                          {telemetry.isNewBest && (
                            <span className="bg-red-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                              {isAr ? 'جديد' : 'NEW'}
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
                        {isAr ? 'الميدالية' : 'MEDAL'}
                      </span>
                      {currentMedalInfo ? (
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-11 h-11 rounded-full bg-gradient-to-br ${currentMedalInfo.color} border-2 border-[#543847] flex items-center justify-center shadow-md`}
                          >
                            <Trophy className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-[#543847] mt-1">
                            {isAr ? currentMedalInfo.nameAr : currentMedalInfo.nameEn}
                          </span>
                        </div>
                      ) : (
                        <div className="text-center text-[11px] text-[#7a6f3a] font-medium">
                          {isAr ? '10 نقاط لنيل البرونزية' : '10 pts for Bronze'}
                        </div>
                      )}
                    </div>
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
                    <span>{isAr ? 'إعادة المحاولة' : 'Play Again'}</span>
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={handleShareScore}
                      className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs border border-white/15 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isAr ? 'مشاركة' : 'Share'}</span>
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
                      <span>{isAr ? 'المتجر' : 'Shop'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={goToMainMenu}
                      className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs border border-white/15 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <Home className="w-3.5 h-3.5 text-sky-400" />
                      <span>{isAr ? 'الرئيسية' : 'Home'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===================================================================
                4. SETTINGS MODAL (شاشة الإعدادات واللغة والمراحل والصعوبة - بدون خيار الموسيقى)
               =================================================================== */}
            {activeModal === 'settings' && (
              <div
                dir={dirAttr}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute inset-0 z-40 flex flex-col justify-between p-4 bg-slate-950/95 backdrop-blur-md overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <h3 className="text-base font-bold text-white">
                      {isAr ? 'الإعدادات' : 'Settings'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundRef.current.playClick();
                      setActiveModal('none');
                    }}
                    className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2 my-2">
                  {/* Language Selection: Arabic / English */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-100">
                        {isAr ? 'اللغة (Language)' : 'Language (اللغة)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 w-36">
                      <button
                        type="button"
                        onClick={() => {
                          soundRef.current.playClick();
                          setLanguage('ar');
                        }}
                        className={`min-h-[36px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          language === 'ar'
                            ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                        }`}
                      >
                        العربية
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          soundRef.current.playClick();
                          setLanguage('en');
                        }}
                        className={`min-h-[36px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          language === 'en'
                            ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                        }`}
                      >
                        English
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !sfxEnabled;
                      setSfxEnabled(next);
                      if (next) soundRef.current.playScore();
                    }}
                    className="w-full min-h-[48px] px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 text-start">
                      <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-100">
                          {isAr ? 'المؤثرات الصوتية' : 'Sound Effects (SFX)'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isAr ? 'أصوات القفز والنقاط والقدرات' : 'Flap, score, and power-up sounds'}
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
                      {sfxEnabled ? (isAr ? 'مفعّل' : 'ON') : isAr ? 'مغلق' : 'OFF'}
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
                    <div className="flex items-center gap-2.5 text-start">
                      <Vibrate className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-100">
                          {isAr ? 'الاهتزاز التفاعلي' : 'Haptic Vibration'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isAr ? 'اهتزاز الهاتف عند الاصطدام والنقاط' : 'Vibrate on score and collision'}
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
                      {hapticsEnabled ? (isAr ? 'مفعّل' : 'ON') : isAr ? 'مغلق' : 'OFF'}
                    </span>
                  </button>

                  {/* Difficulty Selection */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="text-xs font-bold text-slate-200 mb-1.5">
                      {isAr ? 'مستوى الصعوبة' : 'Difficulty Level'}
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
                            className={`min-h-[38px] py-1 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-amber-400 text-slate-950 border-amber-300'
                                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
                            }`}
                          >
                            {isAr ? d.labelAr : d.labelEn}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stage / Biome Progression Selection */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="text-xs font-bold text-slate-200 mb-1.5">
                      {isAr ? 'نظام المراحل والخلفيات' : 'Stages & Biomes'}
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {(
                        [
                          { id: 'auto', labelAr: 'تلقائي', labelEn: 'Auto' },
                          { id: 'day', labelAr: 'نهار', labelEn: 'Day' },
                          { id: 'sunset', labelAr: 'غروب', labelEn: 'Sunset' },
                          { id: 'night', labelAr: 'ليل', labelEn: 'Night' },
                          { id: 'cosmos', labelAr: 'فضاء', labelEn: 'Cosmos' },
                        ] as { id: StageModeOption; labelAr: string; labelEn: string }[]
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            soundRef.current.playClick();
                            setStageMode(st.id);
                          }}
                          className={`min-h-[36px] rounded-lg text-[11px] font-bold border cursor-pointer ${
                            stageMode === st.id
                              ? 'bg-sky-400 text-slate-950 border-sky-300'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {isAr ? st.labelAr : st.labelEn}
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
                  className="w-full min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
                >
                  {isAr ? 'حفظ والعودة' : 'Save & Back'}
                </button>
              </div>
            )}

            {/* ===================================================================
                5. CHARACTER SHOP & SKINS POPUP MODAL (نافذة المتجر المنبثقة وتغلق بزر X)
               =================================================================== */}
            {activeModal === 'skins' && (
              <div
                dir={dirAttr}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute inset-0 z-40 flex items-center justify-center p-3.5 bg-slate-950/85 backdrop-blur-md"
              >
                <div className="w-full max-h-full bg-slate-900 border border-slate-700/90 rounded-3xl p-4 shadow-2xl flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {isAr ? 'متجر الطيور' : 'Character Shop'}
                      </h3>
                      <p className="text-xs text-amber-300 font-mono flex items-center gap-1 mt-0.5">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {isAr
                            ? `رصيدك الحالي: ${coins} عملة`
                            : `Balance: ${coins} Coins`}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundRef.current.playClick();
                        setActiveModal('none');
                      }}
                      aria-label={isAr ? 'إغلاق المتجر' : 'Close Shop'}
                      className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 my-2.5 overflow-y-auto pr-0.5 max-h-[360px]">
                    {SHOP_BIRDS.map((item) => {
                      const isUnlocked = profile.unlockedSkins.includes(item.id);
                      const isSelected = selectedSkin === item.id;
                      const canAfford = coins >= item.priceCoins;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectOrBuyBird(item)}
                          className={`w-full min-h-[54px] px-3 py-2 rounded-2xl border flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-400/15 border-amber-400 text-white'
                              : isUnlocked
                              ? 'bg-slate-950/70 border-slate-800 text-slate-200 hover:bg-slate-800/70'
                              : 'bg-slate-950/40 border-slate-800/80 text-slate-300'
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
                            <div className="text-start">
                              <div className="text-xs font-bold text-slate-100">
                                {isAr ? item.nameAr : item.nameEn}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {isAr ? item.descAr : item.descEn}
                              </div>
                            </div>
                          </div>

                          {isSelected ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 shrink-0">
                              {isAr ? 'مُجهّز' : 'Equipped'}
                            </span>
                          ) : isUnlocked ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-300 shrink-0">
                              {isAr ? 'اختيار' : 'Select'}
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
                              <span>
                                {item.priceCoins} {isAr ? 'عملة' : 'Coins'}
                              </span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
