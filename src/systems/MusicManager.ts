import type Phaser from 'phaser';

type Track = 'idle' | 'ominous' | 'boss-intro' | 'boss-battle' | null;

const KEY = {
  idle: 'idle_music',
  ominous: 'ominous_roar',
  bossIntro: 'large_dragon_roar',
  bossBattle: 'boss_battle',
} as const;

/**
 * Single source of truth for background music/roars so only one track is
 * ever audible: every play call stops whatever's currently playing first.
 * Overworld loops the calm theme; a regular dragon node loops one ominous
 * roar for the whole fight; the castle boss (node 10 of any castle) gets a
 * one-shot roar sting that chains into the boss battle loop once it ends.
 */
class MusicManagerImpl {
  private current?: Phaser.Sound.BaseSound;
  private track: Track = null;

  playOverworld(scene: Phaser.Scene): void {
    if (this.track === 'idle') return; // already looping, don't restart it
    this.stopAll(scene);
    this.track = 'idle';
    this.current = this.safePlay(scene, KEY.idle, true, 0.5);
  }

  playBattle(scene: Phaser.Scene, isBoss: boolean): void {
    this.stopAll(scene, 300); // short fade so the overworld loop doesn't cut hard
    if (!isBoss) {
      this.track = 'ominous';
      this.current = this.safePlay(scene, KEY.ominous, true, 0.6);
      return;
    }

    this.track = 'boss-intro';
    const intro = this.safePlay(scene, KEY.bossIntro, false, 0.7);
    this.current = intro;
    intro?.once('complete', () => {
      // If the player already fled (stopAll ran) before the sting finished,
      // don't resurrect it into the boss loop.
      if (this.current !== intro) return;
      intro.destroy();
      this.track = 'boss-battle';
      this.current = this.safePlay(scene, KEY.bossBattle, true, 0.6);
    });
  }

  /** A missing/failed-to-load track must never break a scene transition. */
  private safePlay(
    scene: Phaser.Scene,
    key: string,
    loop: boolean,
    volume: number,
  ): Phaser.Sound.BaseSound | undefined {
    if (!scene.cache.audio.exists(key)) return undefined;
    try {
      const sound = scene.sound.add(key, { loop, volume });
      sound.play();
      return sound;
    } catch (err) {
      console.warn(`[MusicManager] Could not play "${key}":`, err);
      return undefined;
    }
  }

  /** Stops and releases whatever's currently playing (instant, or faded). */
  stopAll(scene: Phaser.Scene, fadeMs = 0): void {
    const sound = this.current;
    if (!sound) return;
    this.current = undefined;
    this.track = null;
    if (fadeMs <= 0) {
      sound.stop();
      sound.destroy();
      return;
    }
    scene.tweens.add({
      targets: sound,
      volume: 0,
      duration: fadeMs,
      onComplete: () => {
        sound.stop();
        sound.destroy();
      },
    });
  }
}

export const MusicManager = new MusicManagerImpl();
