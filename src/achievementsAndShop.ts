/**
 * Shop, Unlockable Bird Characters, Achievements & Power-Ups System
 * Persisted locally in localStorage so the game works 100% offline on Web, PWA, Android & iOS.
 */

import { BirdSkinId } from './pixelSprites';

export interface ShopBirdItem {
  id: BirdSkinId;
  nameAr: string;
  nameEn: string;
  descAr: string;
  badgeText: string;
  priceCoins: number; // 0 = unlocked by default
}

export const SHOP_BIRDS: ShopBirdItem[] = [
  {
    id: 'classic',
    nameAr: 'الكلاسيكي الأصفر',
    nameEn: 'Classic Wing',
    descAr: 'الطائر الأصلي المتوازن لعام 2013',
    badgeText: 'مجاني · Default',
    priceCoins: 0,
  },
  {
    id: 'crimson',
    nameAr: 'الصقر القرمزي',
    nameEn: 'Crimson Falcon',
    descAr: 'ريش قرمزي ناري مع منقار ذهبي',
    badgeText: '100 عملة',
    priceCoins: 100,
  },
  {
    id: 'azure',
    nameAr: 'طائر السماء الجليدي',
    nameEn: 'Azure Sky',
    descAr: 'ألوان سماوية متألقة في المراحل الليلية',
    badgeText: '180 عملة',
    priceCoins: 180,
  },
  {
    id: 'emerald',
    nameAr: 'الزمرد السيبراني',
    nameEn: 'Cyber Emerald',
    descAr: 'تصميم نيون زمردي مستوحى من الأركيد',
    badgeText: '250 عملة',
    priceCoins: 250,
  },
  {
    id: 'gold',
    nameAr: 'البطل الذهبي الملكي',
    nameEn: 'Royal Gold',
    descAr: 'طائر البطولة المطلي بالذهب الخالص',
    badgeText: '350 عملة',
    priceCoins: 350,
  },
  {
    id: 'phoenix',
    nameAr: 'عنقاء اللهب الأرجواني',
    nameEn: 'Cosmic Phoenix',
    descAr: 'طائر أسطوري متوهج لمرحلة الفضاء',
    badgeText: '500 عملة',
    priceCoins: 500,
  },
];

export interface AchievementDef {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  rewardCoins: number;
  iconType: 'trophy' | 'coin' | 'shield' | 'flame' | 'star';
}

export const ACHIEVEMENTS_LIST: AchievementDef[] = [
  {
    id: 'first_score_5',
    titleAr: 'التحليق الأول',
    titleEn: 'First Flight',
    descAr: 'احصل على 5 نقاط في جولة واحدة',
    rewardCoins: 40,
    iconType: 'star',
  },
  {
    id: 'bronze_medal_10',
    titleAr: 'المحلّق البرونزي',
    titleEn: 'Bronze Glider',
    descAr: 'وصلت إلى المرحلة الثانية (10 نقاط)',
    rewardCoins: 60,
    iconType: 'trophy',
  },
  {
    id: 'silver_medal_20',
    titleAr: 'فارس النجوم الفضي',
    titleEn: 'Starlight Silver',
    descAr: 'وصلت إلى مرحلة ليل النجوم (20 نقطة)',
    rewardCoins: 100,
    iconType: 'trophy',
  },
  {
    id: 'gold_medal_30',
    titleAr: 'الأسطورة الذهبية',
    titleEn: 'Golden Legend',
    descAr: 'حطمت حاجز 30 نقطة في جولة واحدة',
    rewardCoins: 160,
    iconType: 'trophy',
  },
  {
    id: 'coin_collector_25',
    titleAr: 'صائد العملات',
    titleEn: 'Coin Hunter',
    descAr: 'اجمع 25 عملة ذهبية أثناء الطيران',
    rewardCoins: 75,
    iconType: 'coin',
  },
  {
    id: 'powerup_master_5',
    titleAr: 'خبير القدرات الخاصة',
    titleEn: 'Power-Up Master',
    descAr: 'التقط 5 عناصر مساعدة (Power-Ups) أثناء اللعب',
    rewardCoins: 80,
    iconType: 'shield',
  },
  {
    id: 'hard_mode_10',
    titleAr: 'طيار النخبة',
    titleEn: 'Ace Hardcore Pilot',
    descAr: 'سجل 10 نقاط في المستوى الصعب (Hard)',
    rewardCoins: 150,
    iconType: 'flame',
  },
  {
    id: 'skin_collector_3',
    titleAr: 'جامع الطيور',
    titleEn: 'Flock Collector',
    descAr: 'افتح 3 شخصيات طيور في المتجر',
    rewardCoins: 90,
    iconType: 'star',
  },
];

export type PowerUpType = 'shield' | 'magnet' | 'slowmo';

export interface PlayerProfileState {
  unlockedSkins: BirdSkinId[];
  unlockedAchievements: string[];
  totalCoinsCollectedInFlight: number;
  totalPowerUpsCollected: number;
  totalGamesPlayed: number;
  playerName: string;
}

const PROFILE_STORAGE_KEY = 'flappy_wing_profile_v1';

export function loadPlayerProfile(): PlayerProfileState {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const skins: BirdSkinId[] = Array.isArray(parsed.unlockedSkins)
        ? parsed.unlockedSkins
        : ['classic'];
      if (!skins.includes('classic')) skins.unshift('classic');
      return {
        unlockedSkins: skins,
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
          ? parsed.unlockedAchievements
          : [],
        totalCoinsCollectedInFlight: parsed.totalCoinsCollectedInFlight ?? 0,
        totalPowerUpsCollected: parsed.totalPowerUpsCollected ?? 0,
        totalGamesPlayed: parsed.totalGamesPlayed ?? 0,
        playerName:
          typeof parsed.playerName === 'string' && parsed.playerName.trim()
            ? parsed.playerName.trim().slice(0, 16)
            : 'Pilot-' + Math.floor(100 + Math.random() * 900),
      };
    }
  } catch {
    // ignore storage errors
  }
  const initial: PlayerProfileState = {
    unlockedSkins: ['classic'],
    unlockedAchievements: [],
    totalCoinsCollectedInFlight: 0,
    totalPowerUpsCollected: 0,
    totalGamesPlayed: 0,
    playerName: 'Pilot-' + Math.floor(100 + Math.random() * 900),
  };
  savePlayerProfile(initial);
  return initial;
}

export function savePlayerProfile(profile: PlayerProfileState): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}
