import Phaser from 'phaser';
import { CATEGORIES } from '../data/categories';
import {
  EVT_SAVE_CHANGED,
  EVT_TOAST,
  GameEvents,
} from '../systems/events';
import { SaveManager } from '../systems/SaveManager';

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '16px',
  fontStyle: 'bold',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 4,
};

/**
 * Always-on overlay: coins, equipped skin, enchanted sword count, infinity
 * sword count, and (eventually) the MASTER title. Also renders toasts.
 */
export class HUDScene extends Phaser.Scene {
  private coinText!: Phaser.GameObjects.Text;
  private skinText!: Phaser.GameObjects.Text;
  private swordText!: Phaser.GameObjects.Text;
  private infinityText!: Phaser.GameObjects.Text;
  private masterText!: Phaser.GameObjects.Text;
  private toast?: Phaser.GameObjects.Text;

  constructor() {
    super('HUD');
  }

  create(): void {
    this.add
      .rectangle(8, 8, 120, 92, 0x000000, 0.45)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffffff, 0.2);

    const coinIcon = this.add.image(24, 24, 'coin');
    coinIcon.setScale(28 / coinIcon.height);
    this.coinText = this.add.text(44, 15, '0', { ...TEXT_STYLE, color: '#ffd700' });

    const swordIcon = this.add.image(24, 58, 'blue_glowing_sword');
    swordIcon.setScale(28 / swordIcon.height);
    this.swordText = this.add.text(44, 49, `0/${CATEGORIES.length}`, TEXT_STYLE);

    this.infinityText = this.add.text(44, 78, '∞ 0/5', {
      ...TEXT_STYLE,
      color: '#c084fc',
    });

    const width = this.scale.width;
    this.skinText = this.add
      .text(width - 16, 15, '', TEXT_STYLE)
      .setOrigin(1, 0);
    this.masterText = this.add
      .text(width - 16, 44, 'MASTER', {
        ...TEXT_STYLE,
        color: '#ffd700',
        fontSize: '18px',
      })
      .setOrigin(1, 0)
      .setVisible(false);

    const refresh = () => this.refresh();
    const toast = (msg: string) => this.showToast(msg);
    GameEvents.on(EVT_SAVE_CHANGED, refresh);
    GameEvents.on(EVT_TOAST, toast);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameEvents.off(EVT_SAVE_CHANGED, refresh);
      GameEvents.off(EVT_TOAST, toast);
    });

    this.refresh();
  }

  private refresh(): void {
    const d = SaveManager.data;
    this.coinText.setText(`${d.coins}`);
    this.swordText.setText(`${d.enchantedSwords.length}/${CATEGORIES.length}`);
    this.infinityText.setText(`∞ ${d.infinitySwords.length}/5`);
    this.skinText.setText(`Skin: ${d.equippedSkin}`);
    this.masterText.setVisible(d.masterTitle);
  }

  private showToast(message: string): void {
    this.toast?.destroy();
    this.toast = this.add
      .text(this.scale.width / 2, this.scale.height - 60, message, {
        ...TEXT_STYLE,
        fontSize: '15px',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: this.toast,
      alpha: 0,
      delay: 2200,
      duration: 400,
      onComplete: () => this.toast?.destroy(),
    });
  }
}
