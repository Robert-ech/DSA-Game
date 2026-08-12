import { EVT_SAVE_CHANGED, GameEvents } from './events';

export interface SaveData {
  coins: number;
  ownedSkins: string[];
  equippedSkin: string;
  /** castleId -> 10 booleans, one per level node. */
  castleProgress: Record<string, boolean[]>;
  /** Category ids whose castle boss has been beaten. */
  enchantedSwords: string[];
  /** Infinity sword colors collected in Master Mode. */
  infinitySwords: string[];
  masterTitle: boolean;
  quizStreak: number;
}

const STORAGE_KEY = 'dsa-quest-save-v1';
const NODES_PER_CASTLE = 10;
const INFINITY_SWORDS_FOR_MASTER = 5;

const DEFAULTS: SaveData = {
  coins: 0,
  ownedSkins: ['player'],
  equippedSkin: 'player',
  castleProgress: {},
  enchantedSwords: [],
  infinitySwords: [],
  masterTitle: false,
  quizStreak: 0,
};

/**
 * Owns all persistent progress. Every mutation autosaves to localStorage and
 * emits EVT_SAVE_CHANGED so the HUD (and anything else) can refresh.
 */
class SaveManagerImpl {
  data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULTS);
      return { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
    } catch (err) {
      console.warn('[SaveManager] Could not read save, starting fresh.', err);
      return structuredClone(DEFAULTS);
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    GameEvents.emit(EVT_SAVE_CHANGED, this.data);
  }

  addCoins(amount: number): void {
    this.data.coins += amount;
    this.save();
  }

  /** Returns false (and changes nothing) if the player can't afford it. */
  spendCoins(amount: number): boolean {
    if (this.data.coins < amount) return false;
    this.data.coins -= amount;
    this.save();
    return true;
  }

  unlockSkin(id: string): void {
    if (!this.data.ownedSkins.includes(id)) {
      this.data.ownedSkins.push(id);
      this.save();
    }
  }

  equipSkin(id: string): void {
    if (this.data.ownedSkins.includes(id)) {
      this.data.equippedSkin = id;
      this.save();
    }
  }

  markNodeComplete(castleId: string, nodeIndex: number): void {
    const nodes =
      this.data.castleProgress[castleId] ??
      new Array<boolean>(NODES_PER_CASTLE).fill(false);
    nodes[nodeIndex] = true;
    this.data.castleProgress[castleId] = nodes;
    this.save();
  }

  awardEnchantedSword(categoryId: string): void {
    if (!this.data.enchantedSwords.includes(categoryId)) {
      this.data.enchantedSwords.push(categoryId);
      this.save();
    }
  }

  awardInfinitySword(color: string): void {
    if (!this.data.infinitySwords.includes(color)) {
      this.data.infinitySwords.push(color);
      if (this.data.infinitySwords.length >= INFINITY_SWORDS_FOR_MASTER) {
        this.data.masterTitle = true;
      }
      this.save();
    }
  }

  setQuizStreak(streak: number): void {
    this.data.quizStreak = streak;
    this.save();
  }

  hasAnySword(): boolean {
    return this.data.enchantedSwords.length > 0;
  }

  reset(): void {
    this.data = structuredClone(DEFAULTS);
    this.save();
  }
}

export const SaveManager = new SaveManagerImpl();
