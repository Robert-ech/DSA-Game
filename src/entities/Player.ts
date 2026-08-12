import Phaser from 'phaser';
import type { InputController } from '../systems/InputController';
import { SaveManager } from '../systems/SaveManager';

type Facing = 'front' | 'back' | 'left' | 'right';

const TARGET_HEIGHT = 48; // on-screen sprite height in world pixels
const BODY_WIDTH = 24; // collision box, world pixels (feet area)
const BODY_HEIGHT = 14;
const SPEED = 220;
const BOB_PIXELS = 2;
const ROCK_DEGREES = 2.5;
const BOB_PERIOD_MS = 320;

/**
 * The player: one static frame per direction, animated while walking with a
 * small vertical bob plus a slight rock (the 8-bit walk cycle). Source PNGs
 * are large, so each texture swap rescales to TARGET_HEIGHT and rebuilds the
 * physics body in unscaled texture pixels.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private facing: Facing = 'front';
  private bobTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, resolveTextureKey(scene, 'front'));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.applyScaleAndBody();
    this.setCollideWorldBounds(true);
  }

  update(input: InputController, delta: number): void {
    let vx = input.moveX * SPEED;
    let vy = input.moveY * SPEED;
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    this.setVelocity(vx, vy);

    if (vx < 0) this.facing = 'left';
    else if (vx > 0) this.facing = 'right';
    else if (vy < 0) this.facing = 'back';
    else if (vy > 0) this.facing = 'front';

    this.syncTexture();

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      this.bobTime += delta;
      const phase = (this.bobTime / BOB_PERIOD_MS) * Math.PI * 2;
      const bobTexels = (Math.sin(phase) * BOB_PIXELS) / this.scaleY;
      this.setDisplayOrigin(this.width / 2, this.height / 2 + bobTexels);
      this.setAngle(Math.sin(phase) * ROCK_DEGREES);
    } else {
      this.bobTime = 0;
      this.setDisplayOrigin(this.width / 2, this.height / 2);
      this.setAngle(0);
    }

    this.setDepth(this.y + TARGET_HEIGHT / 2);
  }

  /** Re-resolve the texture (skin changes, sword earned, direction turns). */
  syncTexture(): void {
    const key = resolveTextureKey(this.scene, this.facing);
    if (this.texture.key !== key) {
      this.setTexture(key);
      this.applyScaleAndBody();
    }
  }

  private applyScaleAndBody(): void {
    const scale = TARGET_HEIGHT / this.height;
    this.setScale(scale);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const bw = BODY_WIDTH / scale;
    const bh = BODY_HEIGHT / scale;
    body.setSize(bw, bh);
    body.setOffset((this.width - bw) / 2, this.height - bh);
  }
}

/**
 * Texture key for the equipped skin facing a direction, honoring the
 * sword-wielding front/back frames once a sword is owned, and falling back to
 * the default player frames if a skin's file isn't loaded.
 */
function resolveTextureKey(scene: Phaser.Scene, facing: Facing): string {
  const prefix = SaveManager.data.equippedSkin;
  if (SaveManager.hasAnySword() && (facing === 'front' || facing === 'back')) {
    const swordKey = `${prefix}_sword_${facing}`;
    if (scene.textures.exists(swordKey)) return swordKey;
  }
  const key = `${prefix}_${facing}`;
  if (scene.textures.exists(key)) return key;
  return `player_${facing}`;
}
