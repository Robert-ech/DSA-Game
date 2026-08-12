import Phaser from 'phaser';
import { CATEGORIES } from '../data/categories';
import quizzes from '../data/quizzes.json';
import { DialogueBox } from '../systems/DialogueBox';
import { SaveManager } from '../systems/SaveManager';

export interface QuizQuestion {
  id: string;
  category: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

const QUESTIONS: QuizQuestion[] = quizzes;

const BASE_REWARD = 10;
const STREAK_FOR_DOUBLE = 5;
const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

type State = 'idle' | 'asking' | 'answered';

/**
 * The Training Hut interior: the wizard poses pattern-recognition questions,
 * four approaches each. Correct = +10 coins (doubled after a 5-streak),
 * wrong = explanation and a fresh question, no penalty.
 */
export class WizardTrainingScene extends Phaser.Scene {
  private wizard!: Phaser.GameObjects.Image;
  private wizardBaseY = 0;
  private dialogue!: DialogueBox;
  private choiceButtons: Phaser.GameObjects.Text[] = [];
  private streakText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private state: State = 'idle';
  private order: number[] = [];
  private cursor = 0;
  private doubleNext = false;
  /** Exposed for the automated smoke test. */
  currentQuestion?: QuizQuestion;

  constructor() {
    super('WizardTraining');
  }

  create(): void {
    this.drawInterior();

    this.wizard = this.add.image(180, 350, 'wizard_front');
    this.wizard.setScale(180 / this.wizard.height);
    this.wizardBaseY = this.wizard.y;

    this.add
      .text(this.scale.width / 2, 24, 'WIZARD TRAINING', {
        fontFamily: 'monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.streakText = this.add
      .text(this.scale.width / 2, 52, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ff9f43',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.dialogue = new DialogueBox(this, 30, 445, 900, 165);

    this.hintText = this.add
      .text(this.scale.width - 20, this.scale.height - 18, 'E: continue   Esc: leave', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#aaaaaa',
      })
      .setOrigin(1, 1);

    this.input.keyboard!.on('keydown-E', (e: KeyboardEvent) => {
      if (!e.repeat) this.advance();
    });
    // Holding Esc auto-repeats keydown: without the guard the repeat lands in
    // the Overworld right after the switch and pops the pause menu.
    this.input.keyboard!.on('keydown-ESC', (e: KeyboardEvent) => {
      if (!e.repeat) this.leave();
    });

    // Clickable exit so leaving never depends on Esc reaching the game
    // (embedded browsers sometimes swallow the key).
    const leaveBtn = this.add
      .text(20, this.scale.height - 18, '< Leave Hut', {
        fontFamily: 'monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#2d2d3a',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true });
    leaveBtn.on('pointerover', () => leaveBtn.setBackgroundColor('#44445a'));
    leaveBtn.on('pointerout', () => leaveBtn.setBackgroundColor('#2d2d3a'));
    leaveBtn.on('pointerdown', () => this.leave());
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      this.input.keyboard!.resetKeys();
      this.greet();
    });

    this.order = Phaser.Utils.Array.Shuffle([...QUESTIONS.keys()]);
    this.greet();
  }

  private greet(): void {
    this.state = 'idle';
    this.clearChoices();
    this.refreshStreakText();
    this.dialogue.say(
      'Ah, a student approaches! Answer my riddles of algorithms and earn DSA gold. Recognize the PATTERN, not the code. Press E to begin!',
      'Wizard',
    );
  }

  private advance(): void {
    if (this.dialogue.isTyping) {
      this.dialogue.skip();
      return;
    }
    if (this.state === 'idle' || this.state === 'answered') {
      this.askQuestion();
    }
  }

  private askQuestion(): void {
    if (this.cursor >= this.order.length) {
      this.cursor = 0;
      Phaser.Utils.Array.Shuffle(this.order);
    }
    const q = QUESTIONS[this.order[this.cursor++]];
    this.currentQuestion = q;
    this.state = 'asking';
    this.clearChoices();

    const catName =
      CATEGORIES.find((c) => c.id === q.category)?.name ?? q.category;
    this.dialogue.say(`[${catName}] ${q.prompt}`, 'Wizard');

    q.choices.forEach((choice, i) => {
      const btn = this.add
        .text(430, 120 + i * 78, `${CHOICE_LABELS[i]}) ${choice}`, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#ffffff',
          backgroundColor: '#2d2d3a',
          padding: { x: 12, y: 8 },
          wordWrap: { width: 460 },
        })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => {
        if (this.state === 'asking') btn.setBackgroundColor('#44445a');
      });
      btn.on('pointerout', () => {
        if (this.state === 'asking') btn.setBackgroundColor('#2d2d3a');
      });
      btn.on('pointerdown', () => this.answer(i));
      this.choiceButtons.push(btn);
    });
  }

  private answer(chosen: number): void {
    if (this.state !== 'asking' || !this.currentQuestion) return;
    const q = this.currentQuestion;
    this.state = 'answered';
    this.dialogue.skip();

    this.choiceButtons.forEach((btn, i) => {
      if (i === q.correctIndex) btn.setBackgroundColor('#1e7d32');
      else if (i === chosen) btn.setBackgroundColor('#a02c2c');
      else btn.setAlpha(0.5);
    });

    if (chosen === q.correctIndex) {
      const reward = this.doubleNext ? BASE_REWARD * 2 : BASE_REWARD;
      this.doubleNext = false;
      const streak = SaveManager.data.quizStreak + 1;
      SaveManager.addCoins(reward);
      SaveManager.setQuizStreak(streak);
      let msg = `Correct! +${reward} coins. ${q.explanation}`;
      if (streak % STREAK_FOR_DOUBLE === 0) {
        this.doubleNext = true;
        msg += ` ${STREAK_FOR_DOUBLE} in a row — your next reward is DOUBLED!`;
      }
      this.dialogue.say(msg, 'Wizard');
      this.floatReward(`+${reward}`);
    } else {
      SaveManager.setQuizStreak(0);
      this.doubleNext = false;
      this.dialogue.say(
        `Not quite. The answer was "${q.choices[q.correctIndex]}". ${q.explanation} Fear not — another riddle awaits!`,
        'Wizard',
      );
    }
    this.refreshStreakText();
    this.hintText.setText('E: next question   Esc: leave');
  }

  private floatReward(label: string): void {
    const icon = this.add.image(300, 300, 'coin');
    icon.setScale(28 / icon.height);
    const text = this.add
      .text(320, 288, label, {
        fontFamily: 'monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0, 0);
    this.tweens.add({
      targets: [icon, text],
      y: '-=60',
      alpha: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        icon.destroy();
        text.destroy();
      },
    });
  }

  private refreshStreakText(): void {
    const streak = SaveManager.data.quizStreak;
    let label = streak > 0 ? `Streak: ${streak}` : '';
    if (this.doubleNext) label += '  *NEXT REWARD x2*';
    this.streakText.setText(label);
  }

  private clearChoices(): void {
    this.choiceButtons.forEach((b) => b.destroy());
    this.choiceButtons = [];
  }

  private leave(): void {
    this.scene.switch('Overworld');
  }

  update(time: number): void {
    // Bounce while "talking" (typing), gentle sway otherwise.
    if (this.dialogue?.isTyping) {
      this.wizard.y = this.wizardBaseY - Math.abs(Math.sin(time * 0.012)) * 5;
    } else {
      this.wizard.y = this.wizardBaseY + Math.sin(time * 0.002) * 2;
    }
  }

  private drawInterior(): void {
    const { width, height } = this.scale;
    const g = this.add.graphics();

    // stone wall
    g.fillStyle(0x3b2f4f, 1);
    g.fillRect(0, 0, width, 210);
    g.lineStyle(2, 0x2c2340, 1);
    for (let y = 0; y <= 210; y += 32) {
      g.lineBetween(0, y, width, y);
      for (let x = (y / 32) % 2 === 0 ? 0 : 32; x < width; x += 64) {
        g.lineBetween(x, y, x, Math.min(y + 32, 210));
      }
    }

    // wooden floor, checkered
    for (let y = 210; y < height; y += 32) {
      for (let x = 0; x < width; x += 32) {
        g.fillStyle(((x + y) / 32) % 2 === 0 ? 0x6b4a2f : 0x5d3f27, 1);
        g.fillRect(x, y, 32, 32);
      }
    }

    // torches on the wall
    for (const tx of [80, width - 80]) {
      g.fillStyle(0x4a3a2a, 1);
      g.fillRect(tx - 4, 120, 8, 40);
      g.fillStyle(0xff9f43, 1);
      g.fillCircle(tx, 112, 10);
      g.fillStyle(0xffd700, 1);
      g.fillCircle(tx, 108, 5);
    }
  }
}
