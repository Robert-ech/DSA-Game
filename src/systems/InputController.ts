import Phaser from 'phaser';

/**
 * Polled movement axes (arrow keys + WASD). One-shot actions like E/Esc are
 * handled with scene-level `keydown-*` events instead of polling, so a quick
 * tap can never slip between frames.
 */
export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW: Phaser.Input.Keyboard.Key;
  private keyA: Phaser.Input.Keyboard.Key;
  private keyS: Phaser.Input.Keyboard.Key;
  private keyD: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  get moveX(): number {
    const left = this.cursors.left.isDown || this.keyA.isDown ? -1 : 0;
    const right = this.cursors.right.isDown || this.keyD.isDown ? 1 : 0;
    return left + right;
  }

  get moveY(): number {
    const up = this.cursors.up.isDown || this.keyW.isDown ? -1 : 0;
    const down = this.cursors.down.isDown || this.keyS.isDown ? 1 : 0;
    return up + down;
  }
}
