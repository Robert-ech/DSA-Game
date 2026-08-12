import Phaser from 'phaser';
import { makePlaceholderTexture } from '../systems/Placeholders';
import { TestRunner } from '../systems/TestRunner';

/**
 * Every provided asset, keyed by texture key. Files that don't exist yet
 * (future skins, chests, wizard_talk...) are NOT listed here; code that wants
 * them checks textures.exists() and falls back per the design doc.
 */
const IMAGE_MANIFEST: Record<string, string> = {
  // characters
  player_front: 'assets/characters/player_front.png',
  player_back: 'assets/characters/player_back.png',
  player_left: 'assets/characters/player_left.png',
  player_right: 'assets/characters/player_right.png',
  player_sword_front: 'assets/characters/player_sword_front.png',
  player_sword_back: 'assets/characters/player_sword_back.png',
  wizard_front: 'assets/characters/wizard_front.png',
  morty_front: 'assets/characters/morty_front.png',
  // enemies
  ice_dragon_small: 'assets/enemies/ice_dragon_small.png',
  ice_dragon_small_defeated: 'assets/enemies/ice_dragon_small_defeated.png',
  ice_dragon_medium: 'assets/enemies/ice_dragon_medium.png',
  ice_dragon_medium_defeated: 'assets/enemies/ice_dragon_medium_defeated.png',
  dragon_base: 'assets/enemies/dragon_base.png',
  dragon_attack: 'assets/enemies/dragon_attack.png',
  fire_dragon_boss_defeated: 'assets/enemies/fire_dragon_boss_defeated.png',
  shadow_knight: 'assets/enemies/shadow_knight.png',
  // items
  coin: 'assets/items/coin.png',
  blue_glowing_sword: 'assets/items/blue_glowing_sword.png',
  // buildings
  castle_grey: 'assets/buildings/castle_grey.png',
  training_hut: 'assets/buildings/training_hut.png',
  store_coins: 'assets/buildings/store_coins.png',
  castle_master_purple: 'assets/buildings/castle_master_purple.png',
  // backgrounds
  grass_area: 'assets/backgrounds/grass_area.png',
  castle_map: 'assets/backgrounds/castle_map_png.png',
};

/**
 * Keys whose consumers draw their own full-scene fallback when the file is
 * missing — a checkerboard placeholder would be worse than nothing here.
 */
const SKIP_PLACEHOLDER = new Set(['castle_map']);

export class BootScene extends Phaser.Scene {
  private failedKeys = new Set<string>();

  constructor() {
    super('Boot');
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2 - 30, 'DSA QUEST', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffd700',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 10, 'Loading...', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const barBg = this.add
      .rectangle(width / 2, height / 2 + 50, 320, 18, 0x2d2d3a)
      .setOrigin(0.5);
    const bar = this.add
      .rectangle(width / 2 - 158, height / 2 + 50, 1, 12, 0xffd700)
      .setOrigin(0, 0.5);

    this.load.on('progress', (value: number) => {
      bar.width = Math.max(1, 316 * value);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.failedKeys.add(file.key);
    });
    this.load.on('complete', () => {
      label.setText('DSA QUEST');
      barBg.destroy();
    });

    for (const [key, path] of Object.entries(IMAGE_MANIFEST)) {
      this.load.image(key, path);
    }
  }

  create(): void {
    for (const key of Object.keys(IMAGE_MANIFEST)) {
      if (this.failedKeys.has(key) || !this.textures.exists(key)) {
        console.warn(
          `[Assets] "${key}" (${IMAGE_MANIFEST[key]}) failed to load — using a generated placeholder.`,
        );
        if (!SKIP_PLACEHOLDER.has(key)) makePlaceholderTexture(this, key);
      }
    }
    // Summon the Python spirits now (async) so the first battle is warm.
    TestRunner.warmUp();
    this.scene.start('Overworld');
  }
}
