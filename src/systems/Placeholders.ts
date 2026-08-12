import Phaser from 'phaser';

/**
 * Draws an 8-bit style checkerboard placeholder texture for an asset that
 * failed to load, so a missing PNG never crashes the game.
 */
export function makePlaceholderTexture(
  scene: Phaser.Scene,
  key: string,
  width = 32,
  height = 48,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x2d2d3a, 1);
  g.fillRect(0, 0, width, height);
  const cell = 8;
  g.fillStyle(0xd946ef, 1);
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      if (((x / cell) + (y / cell)) % 2 === 0) {
        g.fillRect(x, y, cell, cell);
      }
    }
  }
  g.lineStyle(2, 0xffffff, 1);
  g.strokeRect(1, 1, width - 2, height - 2);
  g.generateTexture(key, width, height);
  g.destroy();
}
