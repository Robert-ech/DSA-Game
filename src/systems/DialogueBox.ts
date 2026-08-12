import Phaser from 'phaser';

const TYPE_DELAY_MS = 18;

/**
 * A speech panel with a typewriter effect. Emits 'done' when the full text is
 * visible. Call skip() to reveal instantly (e.g. on a key press mid-type).
 */
export class DialogueBox extends Phaser.GameObjects.Container {
  private textObj: Phaser.GameObjects.Text;
  private speakerObj: Phaser.GameObjects.Text;
  private fullText = '';
  private shown = 0;
  private timer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    super(scene, x, y);
    scene.add.existing(this);

    const bg = scene.add.rectangle(0, 0, width, height, 0x1a1626, 0.92).setOrigin(0);
    bg.setStrokeStyle(3, 0x8b7bb8);
    this.add(bg);

    this.speakerObj = scene.add.text(14, -12, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffd700',
      backgroundColor: '#1a1626',
      padding: { x: 8, y: 2 },
    });
    this.add(this.speakerObj);

    this.textObj = scene.add.text(16, 18, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: width - 32 },
      lineSpacing: 6,
    });
    this.add(this.textObj);
  }

  say(text: string, speaker = ''): void {
    this.timer?.remove();
    this.speakerObj.setText(speaker).setVisible(speaker.length > 0);
    this.fullText = text;
    this.shown = 0;
    this.textObj.setText('');
    this.timer = this.scene.time.addEvent({
      delay: TYPE_DELAY_MS,
      loop: true,
      callback: () => {
        this.shown++;
        this.textObj.setText(this.fullText.slice(0, this.shown));
        if (this.shown >= this.fullText.length) this.finish();
      },
    });
  }

  skip(): void {
    if (!this.timer) return;
    this.textObj.setText(this.fullText);
    this.finish();
  }

  get isTyping(): boolean {
    return this.timer !== undefined;
  }

  private finish(): void {
    this.timer?.remove();
    this.timer = undefined;
    this.emit('done');
  }
}
