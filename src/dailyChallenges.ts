/**
 * Daily Challenges & Bonus Currency / Badges System for FLAPPY WING
 * Persists daily progress, Wing Coins currency, and unlocked badges in localStorage.
 */

import { DifficultyLevel } from './App';

export type ChallengeMetricType =
  | 'single_run_score'
  | 'cumulative_score'
  | 'cumulative_flaps'
  | 'normal_or_hard_score';

export interface DailyChallengeTemplate {
  id: string;
  titleAr: string;
  titleEn: string;
  metric: ChallengeMetricType;
  target: number;
  rewardCoins: number;
  badgeId: string;
  badgeNameAr: string;
  badgeNameEn: string;
}

export const DAILY_CHALLENGE_POOL: DailyChallengeTemplate[] = [
  {
    id: 'score_5_single',
    titleAr: 'احصل على 5 نقاط في جولة واحدة',
    titleEn: 'Score 5 points in a single run',
    metric: 'single_run_score',
    target: 5,
    rewardCoins: 50,
    badgeId: 'sky_rookie',
    badgeNameAr: 'وسام جناح السماء',
    badgeNameEn: 'Sky Wing Badge',
  },
  {
    id: 'score_12_total',
    titleAr: 'اجمع 12 نقطة في مجموع جولات اليوم',
    titleEn: 'Score 12 total points across runs today',
    metric: 'cumulative_score',
    target: 12,
    rewardCoins: 75,
    badgeId: 'pipe_navigator',
    badgeNameAr: 'وسام عابر الأنابيب',
    badgeNameEn: 'Pipe Navigator Badge',
  },
  {
    id: 'flap_40_total',
    titleAr: 'رفرف بجناحيك 40 مرة اليوم',
    titleEn: 'Flap your wings 40 times today',
    metric: 'cumulative_flaps',
    target: 40,
    rewardCoins: 60,
    badgeId: 'iron_wings',
    badgeNameAr: 'وسام الأجنحة الفولاذية',
    badgeNameEn: 'Iron Wings Badge',
  },
  {
    id: 'score_8_single',
    titleAr: 'احصل على 8 نقاط في جولة واحدة',
    titleEn: 'Score 8 points in a single run',
    metric: 'single_run_score',
    target: 8,
    rewardCoins: 90,
    badgeId: 'golden_glider',
    badgeNameAr: 'وسام المحلّق الذهبي',
    badgeNameEn: 'Golden Glider Badge',
  },
  {
    id: 'score_5_normal_hard',
    titleAr: 'احصل على 5 نقاط في المستوى العادي أو الصعب',
    titleEn: 'Score 5 points on Normal or Hard mode',
    metric: 'normal_or_hard_score',
    target: 5,
    rewardCoins: 100,
    badgeId: 'ace_pilot',
    badgeNameAr: 'وسام الطيار المحترف',
    badgeNameEn: 'Ace Pilot Badge',
  },
];

export interface DailyChallengeState {
  dateKey: string; // YYYY-MM-DD
  challengeIndex: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  coins: number;
  streak: number;
  lastClaimedDate: string | null;
  unlockedBadges: string[];
}

const DAILY_STORAGE_KEY = 'flappy_wing_daily_v1';

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDeterministicIndexForDate(dateKey: string): number {
  // Always start first-time players on index 0 ("Score 5 points in a single run")
  // or hash the date string deterministically
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) % 100000;
  }
  return hash % DAILY_CHALLENGE_POOL.length;
}

export function loadDailyChallengeState(): DailyChallengeState {
  const today = getTodayDateKey();
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyChallengeState;
      if (parsed.dateKey === today) {
        return {
          dateKey: today,
          challengeIndex:
            typeof parsed.challengeIndex === 'number'
              ? parsed.challengeIndex % DAILY_CHALLENGE_POOL.length
              : 0,
          progress: parsed.progress ?? 0,
          completed: parsed.completed ?? false,
          claimed: parsed.claimed ?? false,
          coins: parsed.coins ?? 0,
          streak: parsed.streak ?? 0,
          lastClaimedDate: parsed.lastClaimedDate ?? null,
          unlockedBadges: Array.isArray(parsed.unlockedBadges) ? parsed.unlockedBadges : [],
        };
      } else {
        // New calendar day! Roll over to today's challenge while preserving coins, badges & streak
        const nextIdx = getDeterministicIndexForDate(today);
        const freshState: DailyChallengeState = {
          dateKey: today,
          challengeIndex: nextIdx,
          progress: 0,
          completed: false,
          claimed: false,
          coins: parsed.coins ?? 0,
          streak: parsed.streak ?? 0,
          lastClaimedDate: parsed.lastClaimedDate ?? null,
          unlockedBadges: Array.isArray(parsed.unlockedBadges) ? parsed.unlockedBadges : [],
        };
        saveDailyChallengeState(freshState);
        return freshState;
      }
    }
  } catch {
    // ignore storage errors
  }

  // First time initialization: default to index 0 ("Score 5 points in a single run")
  const initialState: DailyChallengeState = {
    dateKey: today,
    challengeIndex: 0,
    progress: 0,
    completed: false,
    claimed: false,
    coins: 0,
    streak: 0,
    lastClaimedDate: null,
    unlockedBadges: [],
  };
  saveDailyChallengeState(initialState);
  return initialState;
}

export function saveDailyChallengeState(state: DailyChallengeState): void {
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function getActiveChallengeTemplate(state: DailyChallengeState): DailyChallengeTemplate {
  return (
    DAILY_CHALLENGE_POOL[state.challengeIndex % DAILY_CHALLENGE_POOL.length] ||
    DAILY_CHALLENGE_POOL[0]
  );
}

/**
 * Updates challenge progress when the player flaps or scores a point.
 * Returns [updatedState, justCompletedBoolean]
 */
export function recordDailyChallengeEvent(
  prev: DailyChallengeState,
  eventType: 'flap' | 'score_point',
  currentRunScore: number,
  difficulty: DifficultyLevel
): [DailyChallengeState, boolean] {
  if (prev.completed) {
    return [prev, false];
  }

  const template = getActiveChallengeTemplate(prev);
  let nextProgress = prev.progress;

  if (template.metric === 'single_run_score' && eventType === 'score_point') {
    nextProgress = Math.max(prev.progress, currentRunScore);
  } else if (template.metric === 'cumulative_score' && eventType === 'score_point') {
    nextProgress = prev.progress + 1;
  } else if (template.metric === 'cumulative_flaps' && eventType === 'flap') {
    nextProgress = prev.progress + 1;
  } else if (
    template.metric === 'normal_or_hard_score' &&
    eventType === 'score_point' &&
    (difficulty === 'normal' || difficulty === 'hard')
  ) {
    nextProgress = Math.max(prev.progress, currentRunScore);
  }

  const clampedProgress = Math.min(template.target, nextProgress);
  const isNowCompleted = clampedProgress >= template.target;

  if (clampedProgress === prev.progress && !isNowCompleted) {
    return [prev, false];
  }

  const nextState: DailyChallengeState = {
    ...prev,
    progress: clampedProgress,
    completed: isNowCompleted,
  };
  saveDailyChallengeState(nextState);
  return [nextState, isNowCompleted && !prev.completed];
}

/**
 * Claims the reward for a completed Daily Challenge, awarding Wing Coins & the Badge.
 */
export function claimDailyChallengeReward(prev: DailyChallengeState): DailyChallengeState {
  if (!prev.completed || prev.claimed) return prev;

  const template = getActiveChallengeTemplate(prev);
  const today = getTodayDateKey();
  const badgesSet = new Set(prev.unlockedBadges);
  badgesSet.add(template.badgeId);

  const nextStreak = prev.lastClaimedDate === today ? prev.streak : prev.streak + 1;

  const nextState: DailyChallengeState = {
    ...prev,
    claimed: true,
    coins: prev.coins + template.rewardCoins,
    streak: nextStreak,
    lastClaimedDate: today,
    unlockedBadges: Array.from(badgesSet),
  };
  saveDailyChallengeState(nextState);
  return nextState;
}

/**
 * Allows loading a bonus challenge after today's challenge has been claimed
 */
export function activateNextBonusChallenge(prev: DailyChallengeState): DailyChallengeState {
  const nextIndex = (prev.challengeIndex + 1) % DAILY_CHALLENGE_POOL.length;
  const nextState: DailyChallengeState = {
    ...prev,
    challengeIndex: nextIndex,
    progress: 0,
    completed: false,
    claimed: false,
  };
  saveDailyChallengeState(nextState);
  return nextState;
}
