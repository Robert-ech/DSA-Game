import Phaser from 'phaser';
import { CloudSave, EVT_AUTH_CHANGED } from '../systems/CloudSave';
import { EVT_TOAST, GameEvents } from '../systems/events';
import { SaveManager } from '../systems/SaveManager';

/** Esc menu: resume, cloud-save sign in/out, or reset the save. */
export class PauseScene extends Phaser.Scene {
  private confirmingReset = false;
  private emailForm?: HTMLDivElement;

  constructor() {
    super('Pause');
  }

  create(): void {
    this.confirmingReset = false;
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65);
    this.add
      .text(width / 2, height / 2 - 120, 'PAUSED', {
        fontFamily: 'monospace',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const resume = this.makeButton(width / 2, height / 2 - 40, 'Resume (Esc)', () =>
      this.resumeGame(),
    );
    resume.setName('resume');

    const cloudBtn = this.makeButton(width / 2, height / 2 + 20, '', () => {
      if (!CloudSave.isConfigured) {
        GameEvents.emit(EVT_TOAST, 'Cloud save is not set up on this deployment.');
        return;
      }
      if (CloudSave.isSignedIn) {
        void CloudSave.signOut().then(() => {
          GameEvents.emit(EVT_TOAST, 'Signed out — progress stays on this device.');
        });
      } else {
        this.showEmailForm();
      }
    });
    const refreshCloudLabel = () => {
      cloudBtn.setText(
        CloudSave.isSignedIn
          ? `Cloud: ${CloudSave.userEmail} (sign out)`
          : 'Cloud Save: Sign In',
      );
    };
    refreshCloudLabel();
    GameEvents.on(EVT_AUTH_CHANGED, refreshCloudLabel);

    const reset = this.makeButton(width / 2, height / 2 + 80, 'Reset Save', () => {
      if (!this.confirmingReset) {
        this.confirmingReset = true;
        reset.setText('Are you sure? Click again').setColor('#ff5555');
        return;
      }
      SaveManager.reset();
      GameEvents.emit(EVT_TOAST, 'Save data reset.');
      this.resumeGame();
    });

    this.input.keyboard!.on('keydown-ESC', (e: KeyboardEvent) => {
      if (!e.repeat) this.resumeGame();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameEvents.off(EVT_AUTH_CHANGED, refreshCloudLabel);
      this.destroyEmailForm();
    });
  }

  /** Small DOM form (email + send) centered over the canvas. */
  private showEmailForm(): void {
    if (this.emailForm) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const form = document.createElement('div');
    form.style.cssText = `position: fixed; z-index: 20; left: ${rect.left + rect.width / 2}px; top: ${rect.top + rect.height / 2}px; transform: translate(-50%, -50%); background: #191925; border: 3px solid #8b7bb8; padding: 18px; font-family: monospace; color: #fff; display: flex; flex-direction: column; gap: 10px; width: 320px;`;

    const label = document.createElement('div');
    label.textContent = 'Enter your email — we\'ll send a sign-in link:';
    label.style.fontSize = '13px';

    const input = document.createElement('input');
    input.type = 'email';
    input.placeholder = 'you@example.com';
    input.style.cssText =
      'font-family: monospace; font-size: 14px; padding: 8px; background: #0e0e18; color: #fff; border: 2px solid #44445a;';

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 8px;';
    const send = document.createElement('button');
    send.textContent = 'Send link';
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    for (const b of [send, cancel]) {
      b.style.cssText =
        'font-family: monospace; font-size: 13px; font-weight: bold; padding: 8px 14px; cursor: pointer; border: 2px solid #000; color: #fff; background: #2d5a8a; flex: 1;';
    }
    cancel.style.background = '#3a3a48';

    send.addEventListener('click', () => {
      const email = input.value.trim();
      if (!email.includes('@')) {
        GameEvents.emit(EVT_TOAST, 'That doesn\'t look like an email.');
        return;
      }
      send.disabled = true;
      void CloudSave.signInWithEmail(email).then((err) => {
        if (err) {
          GameEvents.emit(EVT_TOAST, `Sign-in failed: ${err}`);
          send.disabled = false;
        } else {
          GameEvents.emit(EVT_TOAST, 'Magic link sent — check your email!');
          this.destroyEmailForm();
        }
      });
    });
    cancel.addEventListener('click', () => this.destroyEmailForm());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send.click();
      e.stopPropagation(); // keep typing out of the game's key handlers
    });

    row.append(send, cancel);
    form.append(label, input, row);
    document.body.appendChild(form);
    this.emailForm = form;
    input.focus();
  }

  private destroyEmailForm(): void {
    this.emailForm?.remove();
    this.emailForm = undefined;
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
