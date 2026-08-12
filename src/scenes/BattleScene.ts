import Phaser from 'phaser';
import {
  castleByCategory,
  themeColorNumber,
  type CastleDef,
} from '../data/castleData';
import { getProblems, type Problem } from '../data/problems';
import { EVT_TOAST, GameEvents } from '../systems/events';
import { SaveManager } from '../systems/SaveManager';
import { EVT_PYODIDE_READY, TestRunner } from '../systems/TestRunner';
import { ensureTintedTexture } from '../systems/Tints';
import { BattleOverlay } from '../ui/BattleOverlay';

const NODE_COINS = 25;
const BOSS_COINS = 100;
const HINT_COST = 5;
const BOSS_TIME_MS = 10 * 60 * 1000;

/**
 * One coding battle: left half is the 8-bit fight (player vs dragon with an
 * HP bar), right half is the Monaco overlay. Each newly passed hidden test
 * fires an attack and chips the dragon's HP; all tests green defeats it.
 * Node 10 is the boss: same fight plus a 10-minute countdown — expiry means
 * the dragon wins.
 */
export class BattleScene extends Phaser.Scene {
  private castle!: CastleDef;
  private nodeIndex = 0;
  private problem!: Problem;

  private dragon!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private hpBar!: Phaser.GameObjects.Graphics;
  private timerText?: Phaser.GameObjects.Text;
  private overlay?: BattleOverlay;

  private maxPassed = 0;
  private finished = false;
  private hintShown = false;
  private bossDeadline = 0;
  private get isBoss(): boolean {
    return this.nodeIndex === 9;
  }
  private get halfW(): number {
    return this.scale.width / 2;
  }

  constructor() {
    super('Battle');
  }

  init(data: { castleId?: string; nodeIndex?: number }): void {
    this.castle = castleByCategory(data.castleId ?? 'arrays-hashing')!;
    this.nodeIndex = data.nodeIndex ?? 0;
    this.problem = getProblems(this.castle.id)[this.nodeIndex];
    this.maxPassed = 0;
    this.finished = false;
    this.hintShown = false;
    this.dragonNameDrawn = false; // fields survive scene.start(), reset here
  }

  create(): void {
    // Monaco needs real typing: drop Phaser's global key captures so WASD,
    // space and arrows reach the editor instead of being preventDefault-ed.
    this.game.input.keyboard?.clearCaptures();

    this.drawArena();
    this.spawnFighters();
    this.drawHpBar();

    // below the HUD panel (top-left) so the two never overlap
    this.add
      .text(20, 112, `${this.castle.name} — Node ${this.nodeIndex + 1}${this.isBoss ? ' (BOSS)' : ''}`, {
        fontFamily: 'monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setDepth(50);

    if (this.isBoss) {
      this.bossDeadline = this.time.now + BOSS_TIME_MS;
      this.timerText = this.add
        .text(this.halfW / 2, 74, '10:00', {
          fontFamily: 'monospace',
          fontSize: '32px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(50);
    }

    this.overlay = new BattleOverlay(this, this.problem, {
      onRun: (code) => void this.runAttack(code),
      onHint: () => this.buyHint(),
      onLeave: () => this.leave(),
    });
    if (!TestRunner.isReady) {
      this.overlay.setAttackEnabled(false);
      this.overlay.setStatus('Summoning the Python spirits...');
      TestRunner.warmUp();
      const onReady = () => {
        this.overlay?.setAttackEnabled(true);
        this.overlay?.setStatus('The spirits are ready. ATTACK when your code is!');
      };
      GameEvents.once(EVT_PYODIDE_READY, onReady);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        GameEvents.off(EVT_PYODIDE_READY, onReady),
      );
    }

    this.input.keyboard!.on('keydown-ESC', (e: KeyboardEvent) => {
      // Esc inside Monaco dismisses autocomplete — only flee when the
      // editor isn't focused.
      if (!e.repeat && !this.overlay?.containsFocus()) this.leave();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
    });

    this.scene.bringToTop('HUD');
  }

  update(): void {
    if (this.timerText && !this.finished) {
      const left = Math.max(0, this.bossDeadline - this.time.now);
      const totalSec = Math.ceil(left / 1000);
      const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');
      this.timerText.setText(`${mm}:${ss}`);
      if (totalSec <= 60) {
        this.timerText.setColor('#ff4444');
        this.timerText.setScale(1 + 0.08 * Math.abs(Math.sin(this.time.now * 0.006)));
      }
      if (left <= 0) this.bossTimeUp();
    }
  }

  // ---------------------------------------------------------------- combat

  private async runAttack(code: string): Promise<void> {
    if (this.finished || !this.overlay) return;
    this.overlay.setRunning(true);
    const outcome = await TestRunner.run(this.problem, code);
    if (this.finished || !this.overlay) return;
    this.overlay.setRunning(false);
    this.overlay.showResults(outcome);

    const passed = outcome.results.filter((r) => r.pass).length;
    const newHits = passed - this.maxPassed;
    if (newHits > 0) {
      this.maxPassed = passed;
      for (let i = 0; i < newHits; i++) {
        this.time.delayedCall(i * 260, () => this.playAttackHit());
      }
      this.time.delayedCall(newHits * 260, () => this.redrawHp());
    }
    if (outcome.allPassed) {
      this.time.delayedCall(newHits * 260 + 350, () => this.victory());
    }
  }

  private playAttackHit(): void {
    if (this.finished) return;
    this.tweens.add({
      targets: this.playerSprite,
      x: this.playerSprite.x + 26,
      duration: 110,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });
    this.time.delayedCall(110, () => {
      if (this.finished) return;
      this.dragon.setTintFill(0xffffff);
      this.cameras.main.shake(90, 0.004);
      this.time.delayedCall(90, () => this.dragon.clearTint());
      this.tweens.add({
        targets: this.dragon,
        x: this.dragon.x + 10,
        duration: 70,
        yoyo: true,
      });
    });
  }

  private victory(): void {
    if (this.finished) return;
    this.finished = true;
    this.overlay?.setReadOnly(true);

    const alreadyDone =
      SaveManager.data.castleProgress[this.castle.id]?.[this.nodeIndex] === true;
    SaveManager.markNodeComplete(this.castle.id, this.nodeIndex);

    // defeated sprite for a beat, then the reward panel
    this.dragon.setTexture(this.defeatedTextureKey());
    this.dragon.setScale((this.isBoss ? 170 : this.nodeIndex >= 3 ? 150 : 120) / this.dragon.height);
    this.tweens.add({ targets: this.dragon, alpha: 0.85, angle: 6, duration: 400 });

    if (this.isBoss) {
      if (!alreadyDone || !SaveManager.data.enchantedSwords.includes(this.castle.id)) {
        SaveManager.addCoins(BOSS_COINS);
        SaveManager.awardEnchantedSword(this.castle.id);
      }
      this.time.delayedCall(900, () => this.playSwordCutscene());
    } else {
      if (!alreadyDone) SaveManager.addCoins(NODE_COINS);
      this.time.delayedCall(900, () =>
        this.showEndPanel(
          'NODE CLEARED!',
          alreadyDone ? 'Already conquered — no extra gold.' : `+${NODE_COINS} DSA Gold`,
          0x1e7d32,
        ),
      );
    }
  }

  /** Boss victory cutscene: the themed Enchanted Sword rises with sparkles. */
  private playSwordCutscene(): void {
    const { width, height } = this.scale;
    const color = themeColorNumber(this.castle);
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(90);

    const swordKey = ensureTintedTexture(this, 'blue_glowing_sword', color);
    const sword = this.add
      .image(width / 2, height / 2 + 180, swordKey)
      .setDepth(92)
      .setAlpha(0);
    sword.setScale(200 / sword.height);
    this.tweens.add({
      targets: sword,
      y: height / 2 - 20,
      alpha: 1,
      duration: 1200,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: sword,
      angle: { from: -4, to: 4 },
      duration: 900,
      delay: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const sparkles = this.add.particles(width / 2, height / 2 - 20, '__WHITE', {
      speed: { min: 30, max: 120 },
      scale: { start: 3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 900,
      quantity: 2,
      tint: [0xffd700, color, 0xffffff],
    });
    sparkles.setDepth(91);

    this.add
      .text(width / 2, height / 2 - 170, 'ENCHANTED SWORD EARNED!', {
        fontFamily: 'monospace',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(92);
    this.add
      .text(
        width / 2,
        height / 2 - 130,
        `The ${this.castle.theme} blade is yours. +${BOSS_COINS} gold — the next castle awaits!`,
        {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5)
      .setDepth(92);

    this.addContinueButton(height / 2 + 170);
  }

  private showEndPanel(title: string, subtitle: string, color: number): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setDepth(90);
    this.add
      .rectangle(width / 2, height / 2, 460, 220, 0x191925, 0.97)
      .setStrokeStyle(4, color)
      .setDepth(91);
    this.add
      .text(width / 2, height / 2 - 55, title, {
        fontFamily: 'monospace',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(92);
    this.add
      .text(width / 2, height / 2 - 10, subtitle, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffd700',
      })
      .setOrigin(0.5)
      .setDepth(92);
    this.addContinueButton(height / 2 + 60);
  }

  private addContinueButton(y: number): void {
    const btn = this.add
      .text(this.scale.width / 2, y, '▶ Continue', {
        fontFamily: 'monospace',
        fontSize: '19px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#2d2d3a',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(93)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setBackgroundColor('#44445a'));
    btn.on('pointerout', () => btn.setBackgroundColor('#2d2d3a'));
    btn.on('pointerdown', () => this.leave());
  }

  /** Timer hit zero: the boss wins. Attempt resets on re-entry. */
  private bossTimeUp(): void {
    if (this.finished) return;
    this.finished = true;
    this.overlay?.setReadOnly(true);

    const attackKey =
      this.castle.id === 'arrays-hashing'
        ? 'dragon_attack'
        : ensureTintedTexture(this, 'dragon_attack', themeColorNumber(this.castle));
    this.dragon.setTexture(attackKey);
    this.dragon.setScale(180 / this.dragon.height);

    this.tweens.add({
      targets: this.dragon,
      x: this.playerSprite.x + 60,
      y: this.playerSprite.y - 20,
      duration: 500,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cameras.main.shake(400, 0.012);
        const flash = this.add
          .rectangle(this.halfW / 2, this.scale.height / 2, this.halfW, this.scale.height, 0xff0000, 0.45)
          .setDepth(80);
        this.tweens.add({ targets: flash, alpha: 0, duration: 600 });
        this.tweens.add({ targets: this.playerSprite, alpha: 0.3, angle: -80, duration: 400 });
      },
    });

    this.time.delayedCall(1100, () => {
      const banner = this.add
        .text(this.scale.width / 2, this.scale.height / 2 - 40, 'DEFEATED', {
          fontFamily: 'monospace',
          fontSize: '52px',
          fontStyle: 'bold',
          color: '#ff3333',
          stroke: '#000000',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(95)
        .setScale(3)
        .setAlpha(0);
      this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 300, ease: 'Cubic.easeIn' });
      this.add
        .text(this.scale.width / 2, this.scale.height / 2 + 10, 'The dragon guards its hoard another day...', {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(95);
      this.time.delayedCall(2200, () => this.leave());
    });
  }

  private buyHint(): void {
    if (this.hintShown) return;
    if (this.isBoss) {
      GameEvents.emit(EVT_TOAST, 'No hints against the boss — face it with your own wits!');
      return;
    }
    if (!SaveManager.spendCoins(HINT_COST)) {
      GameEvents.emit(EVT_TOAST, `Hints cost ${HINT_COST} coins — earn more at the Training Hut!`);
      return;
    }
    this.hintShown = true;
    this.overlay?.showHint(this.problem.hint);
  }

  private leave(): void {
    this.scene.start('CastleMap', { castleId: this.castle.id });
  }

  // ---------------------------------------------------------------- visuals

  private drawArena(): void {
    const { height } = this.scale;
    const w = this.halfW;
    const color = themeColorNumber(this.castle);
    const g = this.add.graphics();
    // dark battle backdrop with a themed floor
    g.fillStyle(0x0e0e18, 1);
    g.fillRect(0, 0, w, height);
    g.fillStyle(0x14141f, 1);
    for (let i = 0; i < 40; i++) {
      const rng = new Phaser.Math.RandomDataGenerator([`arena-${this.castle.id}`, `${i}`]);
      g.fillRect(rng.between(0, w), rng.between(0, height - 220), 2, 2);
    }
    const floor = Phaser.Display.Color.IntegerToColor(color).darken(55).color;
    g.fillStyle(floor, 1);
    g.fillRect(0, height - 170, w, 170);
    g.fillStyle(Phaser.Display.Color.IntegerToColor(color).darken(40).color, 1);
    for (let x = 0; x < w; x += 64) {
      g.fillRect(x, height - 170, 32, 8);
    }
    // divider under the overlay edge
    g.fillStyle(0x8b7bb8, 1);
    g.fillRect(w - 2, 0, 2, height);
  }

  private dragonTextureKey(): string {
    const base = this.isBoss
      ? 'dragon_base'
      : this.nodeIndex >= 3
        ? 'ice_dragon_medium'
        : 'ice_dragon_small';
    // Fire boss stays untinted in castle 1; everything else takes the theme.
    if (this.isBoss && this.castle.id === 'arrays-hashing') return base;
    return ensureTintedTexture(this, base, themeColorNumber(this.castle));
  }

  private defeatedTextureKey(): string {
    const base = this.isBoss
      ? 'fire_dragon_boss_defeated'
      : this.nodeIndex >= 3
        ? 'ice_dragon_medium_defeated'
        : 'ice_dragon_small_defeated';
    if (this.isBoss && this.castle.id === 'arrays-hashing') return base;
    return ensureTintedTexture(this, base, themeColorNumber(this.castle));
  }

  private spawnFighters(): void {
    const { height } = this.scale;

    this.dragon = this.add.image(this.halfW - 130, height - 260, this.dragonTextureKey());
    this.dragon.setScale((this.isBoss ? 170 : this.nodeIndex >= 3 ? 150 : 120) / this.dragon.height);
    this.tweens.add({
      targets: this.dragon,
      y: this.dragon.y - 10,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // sword-wielding frame the moment the player owns any sword
    const skin = SaveManager.data.equippedSkin;
    let key = `${skin}_front`;
    if (SaveManager.hasAnySword() && this.textures.exists(`${skin}_sword_front`)) {
      key = `${skin}_sword_front`;
    } else if (!this.textures.exists(key)) {
      key = SaveManager.hasAnySword() ? 'player_sword_front' : 'player_front';
    }
    this.playerSprite = this.add.image(120, height - 230, key);
    this.playerSprite.setScale(110 / this.playerSprite.height);
    this.tweens.add({
      targets: this.playerSprite,
      y: this.playerSprite.y - 5,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawHpBar(): void {
    this.hpBar = this.add.graphics().setDepth(40);
    this.redrawHp();
  }

  private redrawHp(): void {
    const total = this.problem.testCases.length;
    const remaining = Math.max(0, total - this.maxPassed);
    const x = this.halfW - 250;
    const y = 120;
    const w = 220;
    const g = this.hpBar;
    g.clear();
    g.fillStyle(0x000000, 0.6);
    g.fillRect(x - 4, y - 4, w + 8, 26);
    g.fillStyle(0x3a3a48, 1);
    g.fillRect(x, y, w, 18);
    const frac = remaining / total;
    g.fillStyle(frac > 0.5 ? 0x4ade80 : frac > 0.25 ? 0xffd700 : 0xff5555, 1);
    g.fillRect(x, y, w * frac, 18);
    // segment ticks, one per hidden test
    g.lineStyle(2, 0x0e0e18, 1);
    for (let i = 1; i < total; i++) {
      g.lineBetween(x + (w / total) * i, y, x + (w / total) * i, y + 18);
    }
    if (!this.dragonNameDrawn) {
      this.dragonNameDrawn = true;
      this.add
        .text(x + w / 2, y - 18, this.isBoss ? 'CASTLE BOSS' : 'DRAGON', {
          fontFamily: 'monospace',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(40);
    }
  }
  private dragonNameDrawn = false;
}
