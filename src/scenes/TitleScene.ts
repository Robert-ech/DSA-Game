import Phaser from 'phaser';
import { CloudSave, EVT_AUTH_CHANGED } from '../systems/CloudSave';
import { EVT_TOAST, GameEvents } from '../systems/events';
import { openEmailSignInForm } from '../ui/EmailSignInForm';

/**
 * Title / sign-in screen. Play jumps straight in (guest, local save);
 * signing in with GitHub or an email magic link turns on cloud sync.
 * The whole auth block hides itself when cloud save isn't configured.
 */
export class TitleScene extends Phaser.Scene {
  private emailForm?: { destroy(): void };
  private authUi: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;

    this.drawBackdrop();

    this.add
      .text(width / 2, height * 0.22, 'DSA QUEST', {
        fontFamily: 'monospace',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.22 + 52, 'Slay dragons with data structures', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#c9c9dd',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const dragon = this.add.image(width / 2, height * 0.47, 'dragon_base');
    dragon.setScale(150 / dragon.height);
    this.tweens.add({
      targets: dragon,
      y: dragon.y - 10,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.makeButton(width / 2, height * 0.68, '▶  PLAY', 0x1e7d32, () =>
      this.scene.start('Overworld'),
    );

    const refreshAuthUi = () => this.buildAuthUi();
    this.buildAuthUi();
    GameEvents.on(EVT_AUTH_CHANGED, refreshAuthUi);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameEvents.off(EVT_AUTH_CHANGED, refreshAuthUi);
      this.emailForm?.destroy();
    });

    this.input.keyboard!.on('keydown-ENTER', () =>
      this.scene.start('Overworld'),
    );
  }

  /** The sign-in block below Play; rebuilt whenever auth state changes. */
  private buildAuthUi(): void {
    this.authUi.forEach((o) => o.destroy());
    this.authUi = [];
    if (!CloudSave.isConfigured) return;

    const { width, height } = this.scale;
    const y = height * 0.68 + 58;

    if (CloudSave.isSignedIn) {
      this.authUi.push(
        this.add
          .text(width / 2, y, `☁ Signed in as ${CloudSave.userEmail} — progress syncs online`, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#4ade80',
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5),
        this.makeButton(width / 2, y + 40, 'Sign out', 0x3a3a48, () => {
          void CloudSave.signOut().then(() =>
            GameEvents.emit(EVT_TOAST, 'Signed out — progress stays on this device.'),
          );
        }, '13px'),
      );
      return;
    }

    this.authUi.push(
      this.add
        .text(width / 2, y - 14, 'Sign in to save your progress across devices:', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#aaaacc',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5),
      this.makeButton(width / 2 - 105, y + 26, ' Sign in with GitHub', 0x24292f, () => {
        void CloudSave.signInWithGitHub().then((err) => {
          if (err) GameEvents.emit(EVT_TOAST, `GitHub sign-in failed: ${err}`);
        });
      }, '14px'),
      this.makeButton(width / 2 + 105, y + 26, 'Sign in with Email', 0x2d5a8a, () => {
        if (!this.emailForm) this.emailForm = openEmailSignInForm(this);
      }, '14px'),
      this.add
        .text(width / 2, y + 62, 'or just press PLAY — progress stays on this device', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#777788',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5),
    );
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
    fontSize = '20px',
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, ` ${label} `, {
        fontFamily: 'monospace',
        fontSize,
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setAlpha(0.85));
    btn.on('pointerout', () => btn.setAlpha(1));
    btn.on('pointerdown', onClick);
    return btn;
  }

  private drawBackdrop(): void {
    const { width, height } = this.scale;
    const g = this.add.graphics();
    const bands = [0x0b0b16, 0x0e0e1d, 0x121224, 0x16162b];
    bands.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillRect(0, (height / bands.length) * i, width, height / bands.length + 1);
    });
    g.fillStyle(0xffffff, 0.7);
    const rng = new Phaser.Math.RandomDataGenerator(['title']);
    for (let i = 0; i < 90; i++) {
      g.fillRect(rng.between(0, width), rng.between(0, height * 0.8), 2, 2);
    }
  }
}
