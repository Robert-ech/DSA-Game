import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { InputController } from '../systems/InputController';
import { EVT_TOAST, GameEvents } from '../systems/events';

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 960;
const BORDER = 40; // invisible collision inset so the player stays off the tree line
const INTERACT_RANGE = 70; // distance beyond a building's footprint that counts as adjacent

interface BuildingDef {
  key: string;
  name: string;
  x: number; // footprint center
  baselineY: number; // where the building meets the ground
  height: number; // on-screen height
  comingIn: string; // phase whose scene this door will open into
}

const BUILDINGS: BuildingDef[] = [
  { key: 'castle_grey', name: 'Castle Gate', x: 640, baselineY: 330, height: 280, comingIn: 'Phase 3' },
  { key: 'training_hut', name: 'Training Hut', x: 210, baselineY: 540, height: 170, comingIn: 'Phase 2' },
  { key: 'store_coins', name: 'Skin Shop', x: 620, baselineY: 850, height: 170, comingIn: 'Phase 4' },
  { key: 'castle_master_purple', name: 'Master Tower', x: 1080, baselineY: 540, height: 260, comingIn: 'Phase 6' },
];

interface PlacedBuilding {
  def: BuildingDef;
  image: Phaser.GameObjects.Image;
  prompt: Phaser.GameObjects.Text;
  footprintHalfWidth: number;
}

export class OverworldScene extends Phaser.Scene {
  private player!: Player;
  private inputCtl!: InputController;
  private buildings: PlacedBuilding[] = [];

  constructor() {
    super('Overworld');
  }

  create(): void {
    const bg = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'grass_area');
    const cover = Math.max(WORLD_WIDTH / bg.width, WORLD_HEIGHT / bg.height);
    bg.setScale(cover).setDepth(0);

    this.physics.world.setBounds(
      BORDER,
      BORDER,
      WORLD_WIDTH - BORDER * 2,
      WORLD_HEIGHT - BORDER * 2,
    );

    const colliders = this.physics.add.staticGroup();
    this.buildings = BUILDINGS.map((def) => this.placeBuilding(def, colliders));

    this.player = new Player(this, WORLD_WIDTH / 2, 620);
    this.physics.add.collider(this.player, colliders);
    this.inputCtl = new InputController(this);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.startFollow(this.player, true, 0.15, 0.15);

    this.scene.launch('HUD');

    // Event-driven so a quick tap can't slip between polled frames.
    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.pause();
      this.scene.launch('Pause');
    });
    this.input.keyboard!.on('keydown-E', () => {
      const nearest = this.nearestAdjacentBuilding();
      if (nearest) {
        GameEvents.emit(
          EVT_TOAST,
          `The ${nearest.def.name} is under construction — opens in ${nearest.def.comingIn}!`,
        );
      }
    });

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      // Keys can get stuck "down" while the pause overlay eats keyup events.
      this.input.keyboard!.resetKeys();
    });
  }

  private placeBuilding(
    def: BuildingDef,
    colliders: Phaser.Physics.Arcade.StaticGroup,
  ): PlacedBuilding {
    const image = this.add.image(def.x, def.baselineY, def.key).setOrigin(0.5, 1);
    image.setScale(def.height / image.height);
    image.setDepth(def.baselineY);

    // Solid footprint: a strip along the building's base. The player can walk
    // behind the upper part of the sprite, which reads correctly top-down.
    const footW = image.displayWidth * 0.72;
    const footH = Math.min(56, def.height * 0.3);
    const foot = this.add
      .rectangle(def.x, def.baselineY - footH / 2, footW, footH)
      .setVisible(false);
    colliders.add(foot);

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    };
    this.add
      .text(def.x, def.baselineY - def.height - 14, def.name, labelStyle)
      .setOrigin(0.5)
      .setDepth(5000);

    const prompt = this.add
      .text(def.x, def.baselineY + 16, 'Press E to enter', {
        ...labelStyle,
        fontSize: '13px',
        color: '#ffd700',
      })
      .setOrigin(0.5)
      .setDepth(5000)
      .setVisible(false);

    return { def, image, prompt, footprintHalfWidth: footW / 2 };
  }

  update(_time: number, delta: number): void {
    this.player.update(this.inputCtl, delta);

    const nearest = this.nearestAdjacentBuilding();
    for (const b of this.buildings) {
      b.prompt.setVisible(b === nearest);
    }
  }

  private nearestAdjacentBuilding(): PlacedBuilding | null {
    let best: PlacedBuilding | null = null;
    let bestDist = Infinity;
    for (const b of this.buildings) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        b.def.x,
        b.def.baselineY,
      );
      const range = b.footprintHalfWidth + INTERACT_RANGE;
      if (dist < range && dist < bestDist) {
        best = b;
        bestDist = dist;
      }
    }
    return best;
  }
}
