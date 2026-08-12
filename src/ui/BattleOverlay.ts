import loader from '@monaco-editor/loader';
import type * as MonacoNS from 'monaco-editor';
import type Phaser from 'phaser';
import type { Problem } from '../data/problems';
import type { RunOutcome } from '../systems/TestRunner';

export interface BattleOverlayCallbacks {
  onRun: (code: string) => void;
  onHint: () => void;
  onLeave: () => void;
}

const STYLE_ID = 'dsaq-battle-style';

const CSS = `
.dsaq-battle {
  position: fixed; z-index: 10; display: flex; flex-direction: column;
  background: #14141f; border-left: 3px solid #8b7bb8; box-sizing: border-box;
  font-family: 'Consolas', 'Courier New', monospace; color: #e8e8f0;
}
.dsaq-battle * { box-sizing: border-box; }
.dsaq-head {
  padding: 10px 14px 6px; display: flex; align-items: baseline; gap: 10px;
  border-bottom: 1px solid #2d2d3a;
}
.dsaq-head .t { font-size: 17px; font-weight: bold; color: #ffd700; }
.dsaq-head .d {
  font-size: 11px; padding: 2px 8px; border-radius: 3px;
  background: #1e7d32; color: #fff; text-transform: uppercase;
}
.dsaq-statement {
  padding: 10px 14px; font-size: 12.5px; line-height: 1.5;
  max-height: 148px; overflow-y: auto; white-space: pre-wrap;
  border-bottom: 1px solid #2d2d3a; flex: 0 0 auto;
}
.dsaq-statement .ex {
  margin-top: 8px; padding: 6px 10px; background: #1c1c2a;
  border-left: 3px solid #8b7bb8; font-size: 12px;
}
.dsaq-hint {
  margin: 0 14px 8px; padding: 8px 10px; background: #2a2417;
  border-left: 3px solid #ffd700; font-size: 12px; display: none;
}
.dsaq-editor { flex: 1 1 auto; min-height: 160px; border-bottom: 1px solid #2d2d3a; }
.dsaq-buttons { display: flex; gap: 8px; padding: 8px 14px; flex: 0 0 auto; }
.dsaq-btn {
  font-family: inherit; font-size: 13px; font-weight: bold; cursor: pointer;
  padding: 8px 14px; border: 2px solid #000; color: #fff; background: #2d2d3a;
  image-rendering: pixelated;
}
.dsaq-btn:hover { filter: brightness(1.25); }
.dsaq-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
.dsaq-btn.attack { background: #a02c2c; flex: 1; }
.dsaq-btn.hint { background: #7a5c14; }
.dsaq-btn.leave { background: #3a3a48; }
.dsaq-results {
  height: 158px; overflow-y: auto; padding: 8px 14px; font-size: 12px;
  flex: 0 0 auto; background: #101018;
}
.dsaq-results .row { margin-bottom: 6px; }
.dsaq-results .ok { color: #4ade80; font-weight: bold; }
.dsaq-results .bad { color: #ff6b6b; font-weight: bold; }
.dsaq-results pre {
  margin: 4px 0 6px 14px; padding: 6px 8px; background: #1c1c2a;
  white-space: pre-wrap; word-break: break-all; color: #ffb4b4; font-size: 11.5px;
}
.dsaq-results .stdout pre { color: #9ecbff; }
.dsaq-status { color: #c084fc; font-style: italic; }
`;

/**
 * The right-half DOM overlay in battle: problem statement, Monaco (Python)
 * editor, action buttons, and the test-results panel. Tracks the Phaser
 * canvas so it stays glued to the right half of the game at any window size.
 */
export class BattleOverlay {
  private root: HTMLDivElement;
  private statementEl!: HTMLDivElement;
  private hintEl!: HTMLDivElement;
  private editorEl!: HTMLDivElement;
  private resultsEl!: HTMLDivElement;
  private attackBtn!: HTMLButtonElement;
  private hintBtn!: HTMLButtonElement;
  private editor?: MonacoNS.editor.IStandaloneCodeEditor;
  private relayout = () => this.layout();
  private destroyed = false;

  constructor(
    private scene: Phaser.Scene,
    private problem: Problem,
    private callbacks: BattleOverlayCallbacks,
  ) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    this.root = document.createElement('div');
    this.root.className = 'dsaq-battle';
    this.buildDom();
    document.body.appendChild(this.root);
    this.layout();
    window.addEventListener('resize', this.relayout);
    this.scene.scale.on('resize', this.relayout);

    void this.mountEditor();
  }

  private buildDom(): void {
    const p = this.problem;
    const head = document.createElement('div');
    head.className = 'dsaq-head';
    const title = document.createElement('span');
    title.className = 't';
    title.textContent = p.title;
    const diff = document.createElement('span');
    diff.className = 'd';
    diff.textContent = p.difficulty;
    head.append(title, diff);

    this.statementEl = document.createElement('div');
    this.statementEl.className = 'dsaq-statement';
    this.statementEl.textContent = p.statement;
    const ex = document.createElement('div');
    ex.className = 'ex';
    ex.textContent = `Example:\n  Input: ${p.examples[0]?.input ?? ''}\n  Output: ${p.examples[0]?.output ?? ''}`;
    this.statementEl.appendChild(ex);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'dsaq-hint';

    this.editorEl = document.createElement('div');
    this.editorEl.className = 'dsaq-editor';

    const buttons = document.createElement('div');
    buttons.className = 'dsaq-buttons';
    this.attackBtn = this.makeButton('attack', '⚔ ATTACK', () =>
      this.callbacks.onRun(this.getCode()),
    );
    this.hintBtn = this.makeButton('hint', '💡 Hint (5)', () => this.callbacks.onHint());
    const leaveBtn = this.makeButton('leave', 'Flee', () => this.callbacks.onLeave());
    buttons.append(this.attackBtn, this.hintBtn, leaveBtn);

    this.resultsEl = document.createElement('div');
    this.resultsEl.className = 'dsaq-results';
    this.resultsEl.innerHTML =
      '<div class="dsaq-status">Write your spell, then press ATTACK to strike with passing tests.</div>';

    this.root.append(head, this.statementEl, this.hintEl, this.editorEl, buttons, this.resultsEl);
  }

  private makeButton(
    cls: string,
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = `dsaq-btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  private async mountEditor(): Promise<void> {
    const monaco = await loader.init();
    if (this.destroyed) return;
    this.editor = monaco.editor.create(this.editorEl, {
      value: this.problem.starterCode,
      language: 'python',
      theme: 'vs-dark',
      fontSize: 13,
      tabSize: 4,
      insertSpaces: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 8 },
    });
  }

  /** Pin the overlay to the right half of the (letterboxed) game canvas. */
  private layout(): void {
    const rect = this.scene.game.canvas.getBoundingClientRect();
    this.root.style.left = `${rect.left + rect.width / 2}px`;
    this.root.style.top = `${rect.top}px`;
    this.root.style.width = `${rect.width / 2}px`;
    this.root.style.height = `${rect.height}px`;
  }

  getCode(): string {
    return this.editor?.getValue() ?? this.problem.starterCode;
  }

  /** True while the player is typing in Monaco (Esc must not leave then). */
  containsFocus(): boolean {
    return this.root.contains(document.activeElement);
  }

  setRunning(running: boolean): void {
    this.attackBtn.disabled = running;
    if (running) {
      this.resultsEl.innerHTML =
        '<div class="dsaq-status">The Python spirits weigh your code...</div>';
    }
  }

  setStatus(msg: string): void {
    this.resultsEl.innerHTML = `<div class="dsaq-status"></div>`;
    (this.resultsEl.firstChild as HTMLElement).textContent = msg;
  }

  setAttackEnabled(enabled: boolean): void {
    this.attackBtn.disabled = !enabled;
  }

  setReadOnly(readOnly: boolean): void {
    this.editor?.updateOptions({ readOnly });
    this.attackBtn.disabled = readOnly;
    this.hintBtn.disabled = readOnly;
  }

  showHint(text: string): void {
    this.hintEl.textContent = `Hint: ${text}`;
    this.hintEl.style.display = 'block';
    this.hintBtn.disabled = true;
  }

  showResults(outcome: RunOutcome): void {
    this.resultsEl.innerHTML = '';
    const add = (html: HTMLElement) => this.resultsEl.appendChild(html);

    if (outcome.setupError) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span class="bad">${outcome.timedOut ? '⏱ TIME LIMIT' : '✗ ERROR'}</span><pre></pre>`;
      row.querySelector('pre')!.textContent = outcome.setupError;
      add(row);
    }

    outcome.results.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      if (r.pass) {
        row.innerHTML = `<span class="ok">✓ Test ${i + 1} passed</span>`;
      } else {
        // LeetCode-style: the hidden input is revealed only on failure
        const pre = document.createElement('pre');
        pre.textContent = r.error
          ? `Input:    ${r.input}\n${r.error}`
          : `Input:    ${r.input}\nExpected: ${r.expected}\nActual:   ${r.actual}`;
        const label = document.createElement('span');
        label.className = 'bad';
        label.textContent = `✗ Test ${i + 1} failed`;
        row.append(label, pre);
      }
      add(row);
    });

    if (outcome.stdout) {
      const row = document.createElement('div');
      row.className = 'row stdout';
      const pre = document.createElement('pre');
      pre.textContent = outcome.stdout;
      const label = document.createElement('span');
      label.textContent = 'stdout:';
      row.append(label, pre);
      add(row);
    }
  }

  /** Collapse the panel so end-of-battle screens own the full canvas. */
  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('resize', this.relayout);
    this.scene.scale.off('resize', this.relayout);
    this.editor?.dispose();
    this.root.remove();
  }
}
