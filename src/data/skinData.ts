import Phaser from 'phaser';
import skinsJson from './skins.json';

export interface SkinDef {
  id: string;
  name: string;
  price: number;
  /** File prefix: frames live at assets/characters/{prefix}_{front|back|left|right}.png */
  prefix: string;
  /** Unbuyable — auto-unlocks with the Master title (Phase 6). */
  masterOnly?: boolean;
}

export const SKINS: SkinDef[] = skinsJson;

export const SKIN_DIRECTIONS = ['front', 'back', 'left', 'right'] as const;

/** A skin is equippable only when all four direction frames actually loaded. */
export function skinFramesComplete(
  scene: Phaser.Scene,
  skin: SkinDef,
): boolean {
  return SKIN_DIRECTIONS.every((dir) =>
    scene.textures.exists(`${skin.prefix}_${dir}`),
  );
}
