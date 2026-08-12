import castlesJson from './castles.json';
import { SaveManager } from '../systems/SaveManager';
import { getProblems } from './problems';

export interface CastleDef {
  id: string; // category id
  name: string;
  theme: string;
  themeColor: string; // hex string like "#c0392b"
}

interface CastlesFile {
  /** Screen coordinates of the 10 level nodes on the castle map (shared by all castles). */
  nodePositions: { x: number; y: number }[];
  castles: CastleDef[];
}

const FILE = castlesJson as CastlesFile;

export const CASTLES: CastleDef[] = FILE.castles;
export const NODE_POSITIONS = FILE.nodePositions;

export function castleByCategory(categoryId: string): CastleDef | undefined {
  return CASTLES.find((c) => c.id === categoryId);
}

export function themeColorNumber(castle: CastleDef): number {
  return parseInt(castle.themeColor.replace('#', ''), 16);
}

/** Castle 1 is always open; each later castle needs the previous castle's sword. */
export function isCastleUnlocked(index: number): boolean {
  if (index === 0) return true;
  const prev = CASTLES[index - 1];
  return SaveManager.data.enchantedSwords.includes(prev.id);
}

/** A castle is playable only once its 10 problems exist. */
export function hasContent(castle: CastleDef): boolean {
  return getProblems(castle.id).length >= 10;
}

export function completedNodeCount(castleId: string): number {
  const nodes = SaveManager.data.castleProgress[castleId] ?? [];
  return nodes.filter(Boolean).length;
}
