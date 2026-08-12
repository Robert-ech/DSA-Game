import Phaser from 'phaser';

/** Global event bus shared by scenes and systems. */
export const GameEvents = new Phaser.Events.EventEmitter();

export const EVT_SAVE_CHANGED = 'save-changed';
export const EVT_TOAST = 'toast';
