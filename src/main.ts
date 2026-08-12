import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { CastleMapScene } from './scenes/CastleMapScene';
import { CastleSelectScene } from './scenes/CastleSelectScene';
import { OverworldScene } from './scenes/OverworldScene';
import { PauseScene } from './scenes/PauseScene';
import { ShopScene } from './scenes/ShopScene';
import { WizardTrainingScene } from './scenes/WizardTrainingScene';
import { HUDScene } from './ui/HUDScene';

// Match the canvas aspect to the player's screen so wide monitors aren't
// letterboxed into a narrow strip. Height stays the design height; width is
// clamped between 3:2 (the original 960x640 — narrower would crop the castle
// map's first node) and 2:1 (the overworld art is 1280 wide, so the camera
// can't show more than a 1280px viewport).
const BASE_HEIGHT = 640;
const aspect = Phaser.Math.Clamp(
  window.innerWidth / window.innerHeight,
  3 / 2,
  2,
);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: Math.round(BASE_HEIGHT * aspect),
  height: BASE_HEIGHT,
  backgroundColor: '#10101a',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    OverworldScene,
    HUDScene,
    PauseScene,
    WizardTrainingScene,
    CastleSelectScene,
    CastleMapScene,
    BattleScene,
    ShopScene,
  ],
});

// Debug/automation handle (used by the smoke test to probe scene state).
(window as unknown as { __game: Phaser.Game }).__game = game;
