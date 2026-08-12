import Phaser from 'phaser';
import { EVT_TOAST, GameEvents } from '../systems/events';
import { SaveManager } from '../systems/SaveManager';

/** Esc menu: resume, or reset the save (two clicks to confirm). */
export class PauseScene extends Phaser.Scene {
  private confirmingReset = false;

  constructor() {
    super('Pause');
  }

  create(): void {
    this.confirmingReset = false;
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65);
    this.add
      .text(width / 2, height / 2 - 90, 'PAUSED', {
        fontFamily: 'monospace',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const resume = this.makeButton(width / 2, height / 2, 'Resume (Esc)', () =>
      this.resumeGame(),
    );
    resume.setName('resume');

    const reset = this.makeButton(width / 2, height / 2 + 60, 'Reset Save', () => {
      if (!this.confirmingReset) {
        this.confirmingReset = true;
        reset.setText('Are you sure? Click again').setColor('#ff5555');
        return;
      }
      SaveManager.reset();
      GameEvents.emit(EVT_TOAST, 'Save data reset.');
      this.resumeGame();
    });

    this.input.keyboard!.on('keydown-ESC', () => this.resumeGame());
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#2d2d3a',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setBackgroundColor('#44445a'));
    btn.on('pointerout', () => btn.setBackgroundColor('#2d2d3a'));
    btn.on('pointerdown', onClick);
    return btn;
  }

  private resumeGame(): void {
    this.scene.stop();
    this.scene.resume('Overworld');
  }
}
