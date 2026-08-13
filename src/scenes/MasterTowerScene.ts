import Phaser from 'phaser';
import { getMasterProblems } from '../data/problems';
import { SaveManager } from '../systems/SaveManager';

const INFINITY_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
const INFINITY_HEX: Record<string, number> = {
  red: 0xff3b3b,
  orange: 0xff9f43,
  yellow: 0xffe066,
  green: 0x4ade80,
  blue: 0x4dabf7,
  purple: 0xc084fc,
};

/**
 * Master Tower interior: dark theme, no map — pick a random hard trial from
 * the pool (shuffle-bag order so nothing repeats until every problem in the
 * pool has been seen once) and fight the shadow knight. Collecting 5 of the
 * 6 Infinity Sword colors earns the Master title.
 */
export class MasterTowerScene extends Phaser.Scene {
  private order: number[] = [];
  private cursor = 0;

  constructor() {
    super('MasterTower');
  }

  create(): void {
    this.drawInterior();
    const { width, height } = this.scale;

    this.add
      .text(width / 2, 40, 'THE MASTER TOWER', {
        fontFamily: 'monospace',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#c084fc',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 74, 'Hard trials. Random order. No hints. No mercy.', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#aaaacc',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.drawInfinitySwordRow(width / 2, 150);

    if (SaveManager.data.masterTitle) {
      this.add
        .text(width / 2, 200, '★ YOU ARE THE MASTER ★', {
          fontFamily: 'monospace',
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#ffd700',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
    }

    const knight = this.add.image(width / 2, height / 2 + 40, 'shadow_knight');
    knight.setScale(220 / knight.height);
    knight.setTint(0x9b8ac4);
    this.tweens.add({
      targets: knight,
      y: knight.y - 12,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const beginBtn = this.add
      .text(width / 2, height - 90, '⚔ BEGIN TRIAL', {
        fontFamily: 'monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#5b3a8c',
        padding: { x: 22, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    beginBtn.on('pointerover', () => beginBtn.setBackgroundColor('#7048ab'));
    beginBtn.on('pointerout', () => beginBtn.setBackgroundColor('#5b3a8c'));
    beginBtn.on('pointerdown', () => this.beginTrial());

    this.add
      .text(20, height - 18, '< Leave Tower (Esc)', {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#2d2d3a',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.leave());

    this.input.keyboard!.on('keydown-ESC', (e: KeyboardEvent) => {
      if (!e.repeat) this.leave();
    });
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      this.input.keyboard!.resetKeys();
      this.scene.restart(); // re-render sword progress after a trial
    });

    this.order = Phaser.Utils.Array.Shuffle([...getMasterProblems().keys()]);
    this.cursor = 0;

    this.scene.bringToTop('HUD');
  }

  private beginTrial(): void {
    const pool = getMasterProblems();
    if (pool.length === 0) return;
    if (this.cursor >= this.order.length) {
      this.cursor = 0;
      Phaser.Utils.Array.Shuffle(this.order);
    }
    const problem = pool[this.order[this.cursor++]];
    this.scene.start('Battle', { masterProblemId: problem.id });
  }

  private leave(): void {
    this.scene.switch('Overworld');
  }

  private drawInfinitySwordRow(cx: number, y: number): void {
    const owned = SaveManager.data.infinitySwords;
    const gap = 56;
    const startX = cx - (gap * (INFINITY_COLORS.length - 1)) / 2;
    INFINITY_COLORS.forEach((color, i) => {
      const x = startX + i * gap;
      const container = this.add.container(x, y);
      const hasIt = owned.includes(color);
      const ring = this.add.circle(0, 0, 22, 0x14141f, 1).setStrokeStyle(3, INFINITY_HEX[color], hasIt ? 1 : 0.35);
      container.add(ring);
      if (hasIt) {
        const icon = this.add.image(0, 0, 'blue_glowing_sword');
        icon.setScale(30 / icon.height);
        icon.setTint(INFINITY_HEX[color]);
        container.add(icon);
      } else {
        const q = this.add
          .text(0, 0, '?', {
            fontFamily: 'monospace',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#444455',
          })
          .setOrigin(0.5);
        container.add(q);
      }
    });

    this.add
      .text(cx, y + 34, `${owned.length}/5 Infinity Swords collected`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
  }

  private drawInterior(): void {
    const { width, height } = this.scale;
    const g = this.add.graphics();
    // dark violet stone chamber
    const bands = [0x0c0a14, 0x120e1e, 0x181228, 0x1e1732];
    bands.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillRect(0, (height / bands.length) * i, width, height / bands.length + 1);
    });
    // floor
    g.fillStyle(0x0a0812, 1);
    g.fillRect(0, height - 140, width, 140);
    for (let x = 0; x < width; x += 32) {
      g.fillStyle(0x150f22, 1);
      g.fillRect(x, height - 140, 2, 140);
    }
    // floating violet motes
    const rng = new Phaser.Math.RandomDataGenerator(['master-tower']);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0x8b5cf6, rng.frac() * 0.6 + 0.1);
      g.fillCircle(rng.between(0, width), rng.between(0, height - 140), rng.between(1, 3));
    }
  }
}
