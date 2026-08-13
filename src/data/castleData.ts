import Phaser from 'phaser';
import castlesJson from './castles.json';
import { SaveManager } from '../systems/SaveManager';
import { ensureTintedTexture } from '../systems/Tints';
import { getProblems } from './problems';

export interface CastleDef {
  id: string; // category id
  name: string;
  theme: string;
  themeColor: string; // hex string like "#c0392b"
  /** Texture key of this castle's own themed map art, if one has been drawn yet. */
  mapKey?: string;
  /** Node pixel coordinates in mapKey's (or the fallback castle_map's) image space. */
  nodePositions: { x: number; y: number }[];
}

interface CastlesFile {
  castles: CastleDef[];
}

const FILE = castlesJson as CastlesFile;

export const CASTLES: CastleDef[] = FILE.castles;

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

/**
 * The background texture to draw for a castle's map: its own themed art
 * as-is if one has been drawn (mapKey), otherwise the generic castle_map.png
 * hue-tinted to the castle's theme color — same recolor trick as the
 * dragons/swords. Undefined means neither exists; the scene draws a fully
 * programmatic fallback instead.
 */
export function resolveMapTexture(
  scene: Phaser.Scene,
  castle: CastleDef,
): string | undefined {
  if (castle.mapKey && scene.textures.exists(castle.mapKey)) {
    return castle.mapKey;
  }
  if (scene.textures.exists('castle_map')) {
    return ensureTintedTexture(scene, 'castle_map', themeColorNumber(castle));
  }
  return undefined;
}
