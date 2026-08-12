import Phaser from 'phaser';
import {
  CASTLES,
  completedNodeCount,
  hasContent,
  isCastleUnlocked,
  themeColorNumber,
} from '../data/castleData';
import { CATEGORIES } from '../data/categories';
import { EVT_TOAST, GameEvents } from '../systems/events';
import { SaveManager } from '../systems/SaveManager';
import { ensureTintedTexture } from '../systems/Tints';

const CARD_W = 210;
const CARD_H = 300;
const CARD_GAP = 30;
const STRIP_Y = 330;

/**
 * The world map: 15 themed castles in roadmap order on a horizontally
 * scrolling strip. Locked castles are dim with a padlock; a castle unlocks
 * when the previous castle's Enchanted Sword is earned.
 */
export class CastleSelectScene extends Phaser.Scene {
  constructor() {
    super('CastleSelect');
  }

  create(): void {
    const { width, height } = this.scale;
    const worldWidth =
      CARD_GAP + CASTLES.length * (CARD_W + CARD_GAP) + CARD_GAP;

    this.drawBackdrop(Math.max(worldWidth, width), height);

    this.add
      .text(width / 2, 40, 'THE FIFTEEN CASTLES', {
        fontFamily: 'monospace',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.add
      .text(width / 2, 72, 'Earn each castle\'s Enchanted Sword to unlock the next', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    CASTLES.forEach((_castle, i) => {
      this.makeCard(i, CARD_GAP + CARD_W / 2 + i * (CARD_W + CARD_GAP));
    });

    this.cameras.main.setBounds(0, 0, worldWidth, height);

    // Scroll: drag, wheel, or arrow keys.
    let dragStartX = 0;
    let camStartX = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragStartX = p.x;
      camStartX = this.cameras.main.scrollX;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        this.cameras.main.scrollX = camStartX - (p.x - dragStartX);
      }
    });
    this.input.on(
      'wheel',
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        this.cameras.main.scrollX += dy * 0.8;
      },
    );
    const cursors = this.input.keyboard!.createCursorKeys();
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      if (cursors.left.isDown) this.cameras.main.scrollX -= 8;
      if (cursors.right.isDown) this.cameras.main.scrollX += 8;
    });

    this.input.keyboard!.on('keydown-ESC', (e: KeyboardEvent) => {
      if (!e.repeat) this.scene.switch('Overworld');
    });
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      this.input.keyboard!.resetKeys();
      this.scene.restart(); // re-render lock/progress state after a run
    });

    this.add
      .text(20, height - 18, '< Back (Esc)   Drag or arrows to scroll', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#aaaaaa',
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.switch('Overworld'));

    this.scene.bringToTop('HUD');
  }

  private makeCard(index: number, cx: number): void {
    const castle = CASTLES[index];
    const color = themeColorNumber(castle);
    const unlocked = isCastleUnlocked(index);
    const built = hasContent(castle);
    const categoryName =
      CATEGORIES.find((c) => c.id === castle.id)?.name ?? castle.id;

    const container = this.add.container(cx, STRIP_Y);

    const card = this.add
      .rectangle(0, 0, CARD_W, CARD_H, 0x191925, 0.95)
      .setStrokeStyle(3, unlocked ? color : 0x555566);
    container.add(card);

    const banner = this.add.rectangle(0, -CARD_H / 2 + 22, CARD_W, 44, color, unlocked ? 0.85 : 0.25);
    container.add(banner);
    container.add(
      this.add
        .text(0, -CARD_H / 2 + 22, `CASTLE ${index + 1}`, {
          fontFamily: 'monospace',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5),
    );

    // Castle art: the grey castle sprite recolored to the theme.
    const texKey = unlocked
      ? ensureTintedTexture(this, 'castle_grey', color)
      : 'castle_grey';
    const art = this.add.image(0, -30, texKey);
    art.setScale(120 / art.height);
    if (!unlocked) art.setTint(0x333340).setAlpha(0.8);
    container.add(art);

    container.add(
      this.add
        .text(0, 48, castle.name, {
          fontFamily: 'monospace',
          fontSize: '14px',
          fontStyle: 'bold',
          color: unlocked ? '#ffffff' : '#777788',
          align: 'center',
          wordWrap: { width: CARD_W - 20 },
        })
        .setOrigin(0.5, 0),
    );
    container.add(
      this.add
        .text(0, 92, categoryName, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: unlocked ? '#ffd700' : '#666677',
          align: 'center',
          wordWrap: { width: CARD_W - 20 },
        })
        .setOrigin(0.5, 0),
    );

    if (unlocked) {
      const done = completedNodeCount(castle.id);
      const hasSword = SaveManager.data.enchantedSwords.includes(castle.id);
      container.add(
        this.add
          .text(0, CARD_H / 2 - 24, hasSword ? 'SWORD EARNED' : `${done}/10 nodes`, {
            fontFamily: 'monospace',
            fontSize: '13px',
            fontStyle: 'bold',
            color: hasSword ? '#4ade80' : '#cccccc',
          })
          .setOrigin(0.5),
      );
      if (hasSword) {
        const sword = this.add.image(CARD_W / 2 - 22, CARD_H / 2 - 46, 'blue_glowing_sword');
        sword.setScale(34 / sword.height);
        container.add(sword);
      }
    } else {
      // padlock
      const lock = this.add.graphics();
      lock.fillStyle(0xccccdd, 1);
      lock.fillRoundedRect(-16, -6, 32, 26, 4);
      lock.lineStyle(5, 0xccccdd, 1);
      lock.strokeCircle(0, -12, 11);
      lock.fillStyle(0x191925, 1);
      lock.fillCircle(0, 4, 4);
      container.add(lock);
      container.add(
        this.add
          .text(0, CARD_H / 2 - 24, 'LOCKED', {
            fontFamily: 'monospace',
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#777788',
          })
          .setOrigin(0.5),
      );
    }

    card.setInteractive({ useHandCursor: unlocked });
    card.on('pointerover', () => {
      if (unlocked) container.setScale(1.04);
    });
    card.on('pointerout', () => container.setScale(1));
    card.on('pointerup', (p: Phaser.Input.Pointer) => {
      // ignore drags: only treat as a click if the pointer barely moved
      if (Math.abs(p.x - p.downX) > 8) return;
      if (!unlocked) {
        GameEvents.emit(
          EVT_TOAST,
          `Locked — earn the ${CASTLES[index - 1].name} sword first!`,
        );
        return;
      }
      if (!built) {
        GameEvents.emit(
          EVT_TOAST,
          `${castle.name} is under construction — its trials arrive in a later phase!`,
        );
        return;
      }
      this.scene.start('CastleMap', { castleId: castle.id });
    });
  }

  private drawBackdrop(width: number, height: number): void {
    const g = this.add.graphics();
    // night sky gradient bands
    const bands = [0x0d0d1d, 0x111126, 0x15152e, 0x191936];
    bands.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillRect(0, (height / bands.length) * i, width, height / bands.length + 1);
    });
    // stars
    g.fillStyle(0xffffff, 0.8);
    const rng = new Phaser.Math.RandomDataGenerator(['castle-map']);
    for (let i = 0; i < 120; i++) {
      g.fillRect(rng.between(0, width), rng.between(0, height - 200), 2, 2);
    }
    // rolling ground
    g.fillStyle(0x1d2b1d, 1);
    g.fillRect(0, height - 140, width, 140);
    g.fillStyle(0x24361f, 1);
    for (let x = 0; x < width; x += 90) {
      g.fillEllipse(x, height - 140, 130, 46);
    }
  }
}
