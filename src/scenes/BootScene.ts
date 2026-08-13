import Phaser from 'phaser';
import { SKIN_DIRECTIONS, SKINS } from '../data/skinData';
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
  // (skin frames like morty_front load dynamically from skins.json below)
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
  // Per-castle themed maps (castles.json's mapKey points at these); castles
  // without one yet fall back to castle_map hue-tinted to their theme color.
  castle_map_dino: 'assets/backgrounds/castle_map_dino.png',
  castle_map_alien: 'assets/backgrounds/castle_map_alien.png',
  castle_map_ranger: 'assets/backgrounds/castle_map_ranger.png',
  castle_map_water: 'assets/backgrounds/castle_map_water.jpg',
};

/**
 * Keys whose consumers draw their own full-scene fallback when the file is
 * missing — a checkerboard placeholder would be worse than nothing here.
 */
const SKIP_PLACEHOLDER = new Set([
  'castle_map',
  'castle_map_dino',
  'castle_map_alien',
  'castle_map_ranger',
  'castle_map_water',
]);

const AUDIO_MANIFEST: Record<string, string> = {
  idle_music: 'assets/audio/idle_music.mp3',
  ominous_roar: 'assets/audio/ominous_roar.mp3',
  large_dragon_roar: 'assets/audio/large_dragon_roar.mp3',
  boss_battle: 'assets/audio/boss_battle.mp3',
};

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
    for (const [key, path] of Object.entries(AUDIO_MANIFEST)) {
      this.load.audio(key, path);
    }

    // Skin frames are data-driven off skins.json: attempt all four direction
    // frames (plus sword variants) per prefix. Missing files simply fail to
    // load — no placeholder — so skinFramesComplete() can tell truth from
    // wish; incomplete skins show as "coming soon" in the shop.
    for (const skin of SKINS) {
      const wanted = [
        ...SKIN_DIRECTIONS.map((d) => `${skin.prefix}_${d}`),
        `${skin.prefix}_sword_front`,
        `${skin.prefix}_sword_back`,
      ];
      for (const key of wanted) {
        if (!IMAGE_MANIFEST[key] && !this.textures.exists(key)) {
          this.load.image(key, `assets/characters/${key}.png`);
        }
      }
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
    for (const key of Object.keys(AUDIO_MANIFEST)) {
      if (this.failedKeys.has(key) || !this.cache.audio.exists(key)) {
        console.warn(
          `[Assets] "${key}" (${AUDIO_MANIFEST[key]}) failed to load — that track will simply stay silent.`,
        );
      }
    }
    // Summon the Python spirits now (async) so the first battle is warm.
    TestRunner.warmUp();
    // Dev shortcut: open /#map to jump straight to the castle map (useful
    // when hand-tuning nodePositions in castles.json).
    this.scene.start(window.location.hash === '#map' ? 'CastleMap' : 'Title');
  }
}
