import Phaser from 'phaser';
import { SKINS, skinFramesComplete, type SkinDef } from '../data/skinData';
import { EVT_TOAST, GameEvents } from '../systems/events';
import { SaveManager } from '../systems/SaveManager';

const CARD_W = 250;
const CARD_H = 240;
const GAP_X = 40;
const GAP_Y = 40;
const COLS = 3;

/**
 * The Skin Shop: a grid of skin cards. Buy with DSA gold, then equip;
 * equipping swaps the overworld/battle sprites instantly (the Player entity
 * re-resolves its texture from the save every frame). Skins without all four
 * direction frames on disk show a "coming soon" ribbon and can't be bought.
 * The Master Skin is never for sale.
 */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create(): void {
    const { width, height } = this.scale;
    this.drawInterior();

    this.add
      .text(width / 2, 40, 'SKIN SHOP', {
        fontFamily: 'monospace',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 70, 'Exchange DSA Gold for a new look', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const rows = Math.ceil(SKINS.length / COLS);
    const gridW = COLS * CARD_W + (COLS - 1) * GAP_X;
    const gridH = rows * CARD_H + (rows - 1) * GAP_Y;
    const left = (width - gridW) / 2 + CARD_W / 2;
    const top = Math.max(100, (height - gridH) / 2) + CARD_H / 2 + 10;
    SKINS.forEach((skin, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      this.makeCard(skin, left + col * (CARD_W + GAP_X), top + row * (CARD_H + GAP_Y));
    });

    this.input.keyboard!.on('keydown-ESC', (e: KeyboardEvent) => {
      if (!e.repeat) this.scene.switch('Overworld');
    });
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      this.input.keyboard!.resetKeys();
      this.scene.restart(); // refresh owned/equipped/coin states
    });

    this.add
      .text(20, height - 18, '< Leave Shop (Esc)', {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#2d2d3a',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.switch('Overworld'));

    this.scene.bringToTop('HUD');
  }

  private makeCard(skin: SkinDef, cx: number, cy: number): void {
    const save = SaveManager.data;
    const owned = save.ownedSkins.includes(skin.id);
    const equipped = save.equippedSkin === skin.id;
    const complete = skinFramesComplete(this, skin);
    const buyable = !skin.masterOnly && complete && !owned;

    const container = this.add.container(cx, cy);
    const card = this.add
      .rectangle(0, 0, CARD_W, CARD_H, 0x191925, 0.96)
      .setStrokeStyle(3, equipped ? 0xffd700 : skin.masterOnly ? 0x8b5cf6 : 0x44445a);
    container.add(card);

    // preview: the front frame, or a mystery silhouette
    const frontKey = `${skin.prefix}_front`;
    if (this.textures.exists(frontKey)) {
      const img = this.add.image(0, -55, frontKey);
      img.setScale(90 / img.height);
      if (skin.masterOnly && !save.masterTitle) img.setTint(0x221133);
      container.add(img);
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x0d0d16, 1);
      g.fillRoundedRect(-32, -100, 64, 90, 6);
      container.add(g);
      container.add(
        this.add
          .text(0, -55, '?', {
            fontFamily: 'monospace',
            fontSize: '44px',
            fontStyle: 'bold',
            color: '#44445a',
          })
          .setOrigin(0.5),
      );
    }

    container.add(
      this.add
        .text(0, 8, skin.name, {
          fontFamily: 'monospace',
          fontSize: '17px',
          fontStyle: 'bold',
          color: skin.masterOnly ? '#c084fc' : '#ffffff',
        })
        .setOrigin(0.5),
    );

    // price line (with coin icon) for buyable skins
    if (!skin.masterOnly && skin.price > 0 && !owned) {
      const coin = this.add.image(-24, 36, 'coin');
      coin.setScale(20 / coin.height);
      container.add(coin);
      container.add(
        this.add
          .text(-8, 36, `${skin.price}`, {
            fontFamily: 'monospace',
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#ffd700',
          })
          .setOrigin(0, 0.5),
      );
    }

    // action row
    if (skin.masterOnly && !save.masterTitle) {
      container.add(
        this.add
          .text(0, 78, 'Legends say only a true\nMaster may wear this.', {
            fontFamily: 'monospace',
            fontSize: '12px',
            fontStyle: 'italic',
            color: '#8b7bb8',
            align: 'center',
          })
          .setOrigin(0.5),
      );
    } else if (!complete) {
      const ribbon = this.add.rectangle(0, 70, CARD_W, 30, 0x8b5cf6, 0.9);
      container.add(ribbon);
      container.add(
        this.add
          .text(0, 70, 'COMING SOON', {
            fontFamily: 'monospace',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffffff',
          })
          .setOrigin(0.5),
      );
    } else if (equipped) {
      this.addButton(container, 'EQUIPPED ✓', 0x1e7d32, () => {
        if (skin.id !== 'player') {
          SaveManager.equipSkin('player');
          GameEvents.emit(EVT_TOAST, 'Back to the classic look.');
          this.scene.restart();
        }
      });
    } else if (owned) {
      this.addButton(container, 'EQUIP', 0x2d5a8a, () => {
        SaveManager.equipSkin(skin.id);
        GameEvents.emit(EVT_TOAST, `${skin.name} equipped!`);
        this.scene.restart();
      });
    } else if (buyable) {
      this.addButton(container, `BUY`, 0xa02c2c, () => {
        if (!SaveManager.spendCoins(skin.price)) {
          GameEvents.emit(
            EVT_TOAST,
            `Not enough gold — ${skin.name} costs ${skin.price}.`,
          );
          return;
        }
        SaveManager.unlockSkin(skin.id);
        SaveManager.equipSkin(skin.id);
        GameEvents.emit(EVT_TOAST, `${skin.name} is yours — equipped!`);
        this.scene.restart();
      });
    }
  }

  private addButton(
    container: Phaser.GameObjects.Container,
    label: string,
    color: number,
    onClick: () => void,
  ): void {
    const btn = this.add
      .text(0, 78, ` ${label} `, {
        fontFamily: 'monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setAlpha(0.85));
    btn.on('pointerout', () => btn.setAlpha(1));
    btn.on('pointerdown', onClick);
    container.add(btn);
  }

  private drawInterior(): void {
    const { width, height } = this.scale;
    const g = this.add.graphics();
    // warm wooden shop interior
    g.fillStyle(0x2a1f33, 1);
    g.fillRect(0, 0, width, 92);
    for (let y = 92; y < height; y += 32) {
      for (let x = 0; x < width; x += 32) {
        g.fillStyle(((x + y) / 32) % 2 === 0 ? 0x53402c : 0x483724, 1);
        g.fillRect(x, y, 32, 32);
      }
    }
    // shelf line + lanterns
    g.fillStyle(0xffd700, 1);
    for (const tx of [60, width - 60]) {
      g.fillCircle(tx, 46, 8);
      g.fillStyle(0xff9f43, 1);
      g.fillCircle(tx, 46, 12);
      g.fillStyle(0xffd700, 1);
    }
  }
}
