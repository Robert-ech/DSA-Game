import type Phaser from 'phaser';
import { CloudSave } from '../systems/CloudSave';
import { EVT_TOAST, GameEvents } from '../systems/events';

/**
 * Small centered DOM form (email + send) for magic-link sign-in. Returns a
 * handle whose destroy() removes it; callers must destroy on scene shutdown.
 */
export function openEmailSignInForm(scene: Phaser.Scene): { destroy(): void } {
  const rect = scene.game.canvas.getBoundingClientRect();
  const form = document.createElement('div');
  form.style.cssText = `position: fixed; z-index: 20; left: ${rect.left + rect.width / 2}px; top: ${rect.top + rect.height / 2}px; transform: translate(-50%, -50%); background: #191925; border: 3px solid #8b7bb8; padding: 18px; font-family: monospace; color: #fff; display: flex; flex-direction: column; gap: 10px; width: 320px;`;

  const label = document.createElement('div');
  label.textContent = "Enter your email — we'll send a sign-in link:";
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

  const handle = {
    destroy(): void {
      form.remove();
    },
  };

  send.addEventListener('click', () => {
    const email = input.value.trim();
    if (!email.includes('@')) {
      GameEvents.emit(EVT_TOAST, "That doesn't look like an email.");
      return;
    }
    send.disabled = true;
    void CloudSave.signInWithEmail(email).then((err) => {
      if (err) {
        GameEvents.emit(EVT_TOAST, `Sign-in failed: ${err}`);
        send.disabled = false;
      } else {
        GameEvents.emit(EVT_TOAST, 'Magic link sent — check your email!');
        handle.destroy();
      }
    });
  });
  cancel.addEventListener('click', () => handle.destroy());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send.click();
    e.stopPropagation(); // keep typing out of the game's key handlers
  });

  row.append(send, cancel);
  form.append(label, input, row);
  document.body.appendChild(form);
  input.focus();
  return handle;
}
