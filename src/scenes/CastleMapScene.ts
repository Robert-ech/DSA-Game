import Phaser from 'phaser';
import {
  CASTLES,
  castleByCategory,
  resolveMapTexture,
  themeColorNumber,
  type CastleDef,
} from '../data/castleData';
import { getProblems } from '../data/problems';
import { SaveManager } from '../systems/SaveManager';
import { ensureTintedTexture } from '../systems/Tints';

const NODE_RADIUS = 22;

/**
 * Inside a castle: the Mario-style level path. 10 nodes on stone pads —
 * completed show a flag, the current one pulses, locked ones are dim. Node 10
 * is the castle door with the boss dragon perched above it. Node positions
 * come from castles.json so they're easy to tweak by hand.
 */
/** The castle_map art's pixel size; the drawn fallback uses the same virtual space. */
const MAP_IMAGE_W = 1376;
const MAP_IMAGE_H = 768;

export class CastleMapScene extends Phaser.Scene {
  private castle!: CastleDef;
  /** Node positions projected from image space onto the current canvas. */
  private nodeXY: { x: number; y: number }[] = [];
  /** This castle's resolved map texture (themed art, or castle_map.png tinted); undefined = drawn fallback. */
  private mapTexKey?: string;

  constructor() {
    super('CastleMap');
  }

  init(data: { castleId?: string }): void {
    this.castle = castleByCategory(data.castleId ?? 'arrays-hashing') ?? CASTLES[0];
  }

  create(): void {
    const color = themeColorNumber(this.castle);
    this.mapTexKey = resolveMapTexture(this, this.castle);
    this.projectNodes();
    this.drawBackground(color);

    const { width } = this.scale;
    this.add
      .text(width / 2, 34, this.castle.name.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 62, this.castle.theme, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const progress = SaveManager.data.castleProgress[this.castle.id] ?? [];
    const currentIndex = progress.findIndex((done) => !done);
    const current = currentIndex === -1 ? (progress.length >= 10 ? -1 : progress.length) : currentIndex;

    // Every real map (the original art, or a themed one) already draws its
    // own boss/castle; only the fully-programmatic fallback needs one added.
    if (!this.mapTexKey) {
      const bossPos = this.nodeXY[9];
      const bossKey =
        this.castle.id === 'arrays-hashing'
          ? 'dragon_base'
          : ensureTintedTexture(this, 'dragon_base', color);
      const boss = this.add.image(bossPos.x, bossPos.y - 92, bossKey);
      boss.setScale(110 / boss.height);
      this.tweens.add({
        targets: boss,
        y: boss.y - 8,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.nodeXY.forEach((pos, i) => {
      this.makeNode(i, pos.x, pos.y, progress[i] === true, i === current, color);
    });

    this.input.keyboard!.on('keydown-ESC', (e: KeyboardEvent) => {
      if (!e.repeat) this.scene.start('CastleSelect');
    });
    this.add
      .text(20, this.scale.height - 18, '< World Map (Esc)', {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#2d2d3a',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('CastleSelect'));

    this.scene.bringToTop('HUD');
  }

  /**
   * Each castle's nodePositions live in its own map image's pixel space so
   * they can be tweaked against that art directly. Project them through the
   * same cover-fit transform the background uses, so they track the pads at
   * any canvas size.
   */
  private projectNodes(): void {
    const { width, height } = this.scale;
    let iw = MAP_IMAGE_W;
    let ih = MAP_IMAGE_H;
    if (this.mapTexKey) {
      const src = this.textures.get(this.mapTexKey).getSourceImage();
      iw = src.width;
      ih = src.height;
    }
    const s = Math.max(width / iw, height / ih);
    const ox = (width - iw * s) / 2;
    const oy = (height - ih * s) / 2;
    this.nodeXY = this.castle.nodePositions.map((p) => ({
      x: ox + p.x * s,
      y: oy + p.y * s,
    }));
  }

  private makeNode(
    index: number,
    x: number,
    y: number,
    completed: boolean,
    isCurrent: boolean,
    themeColor: number,
  ): void {
    const isBoss = index === 9;
    const locked = !completed && !isCurrent;

    const g = this.add.graphics();
    const base = completed ? 0x2e7d32 : isCurrent ? themeColor : 0x3a3a48;
    // stone pad
    g.fillStyle(0x22222e, 1);
    g.fillEllipse(x, y + 6, NODE_RADIUS * 2.4, NODE_RADIUS * 1.1);
    g.fillStyle(base, locked ? 0.55 : 1);
    g.fillCircle(x, y, NODE_RADIUS);
    g.lineStyle(3, locked ? 0x555566 : 0xffffff, locked ? 0.5 : 0.9);
    g.strokeCircle(x, y, NODE_RADIUS);

    const label = this.add
      .text(x, y, `${index + 1}`, {
        fontFamily: 'monospace',
        fontSize: isBoss ? '18px' : '16px',
        fontStyle: 'bold',
        color: locked ? '#888899' : '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    if (completed) {
      // little victory flag
      const flag = this.add.graphics();
      flag.lineStyle(3, 0xdddddd, 1);
      flag.lineBetween(x + 14, y - 40, x + 14, y - 12);
      flag.fillStyle(0x4ade80, 1);
      flag.fillTriangle(x + 14, y - 40, x + 14, y - 26, x + 34, y - 33);
    }

    if (isCurrent) {
      const ring = this.add.circle(x, y, NODE_RADIUS + 6).setStrokeStyle(3, 0xffd700, 1);
      this.tweens.add({
        targets: ring,
        scale: 1.25,
        alpha: 0.2,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    if (isBoss) {
      this.add
        .text(x, y + NODE_RADIUS + 16, 'BOSS', {
          fontFamily: 'monospace',
          fontSize: '13px',
          fontStyle: 'bold',
          color: locked ? '#888899' : '#ff5555',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
    }

    if (!locked) {
      const hit = this.add
        .circle(x, y, NODE_RADIUS + 8, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => label.setScale(1.2));
      hit.on('pointerout', () => label.setScale(1));
      hit.on('pointerdown', () => {
        const problems = getProblems(this.castle.id);
        if (!problems[index]) return;
        this.scene.start('Battle', { castleId: this.castle.id, nodeIndex: index });
      });
    }
  }

  /**
   * This castle's own themed map art if one exists, drawn as-is; otherwise
   * castle_map.png hue-tinted per theme; otherwise a fully drawn 8-bit map:
   * grass field, winding path through the node pads, castle at the end.
   */
  private drawBackground(color: number): void {
    const { width, height } = this.scale;
    if (this.mapTexKey) {
      const img = this.add.image(width / 2, height / 2, this.mapTexKey);
      img.setScale(Math.max(width / img.width, height / img.height));
      return;
    }

    const g = this.add.graphics();
    // grass in theme-shaded checker
    for (let y = 0; y < height; y += 32) {
      for (let x = 0; x < width; x += 32) {
        g.fillStyle(((x + y) / 32) % 2 === 0 ? 0x274427 : 0x223c22, 1);
        g.fillRect(x, y, 32, 32);
      }
    }
    // winding dirt path connecting the nodes
    g.lineStyle(26, 0x8a6d4a, 1);
    for (let i = 0; i < this.nodeXY.length - 1; i++) {
      const a = this.nodeXY[i];
      const b = this.nodeXY[i + 1];
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    g.lineStyle(18, 0xa3855c, 1);
    for (let i = 0; i < this.nodeXY.length - 1; i++) {
      const a = this.nodeXY[i];
      const b = this.nodeXY[i + 1];
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    // castle silhouette behind the boss node
    const bossPos = this.nodeXY[9];
    const castle = this.add.image(bossPos.x, bossPos.y - 24, 'castle_grey');
    castle.setScale(210 / castle.height).setOrigin(0.5, 1);
    castle.setTint(Phaser.Display.Color.IntegerToColor(color).lighten(20).color);
    castle.setAlpha(0.9);
  }
}
