import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { OverworldScene } from './scenes/OverworldScene';
import { PauseScene } from './scenes/PauseScene';
import { HUDScene } from './ui/HUDScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 640,
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
  scene: [BootScene, OverworldScene, HUDScene, PauseScene],
});

// Debug/automation handle (used by the smoke test to probe scene state).
(window as unknown as { __game: Phaser.Game }).__game = game;
