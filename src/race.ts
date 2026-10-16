import Phaser from 'phaser';
import { RaceScene, type CarMarker, type StageShape } from './scenes/RaceScene';

export interface StageView {
  render(stage: StageShape, cars: CarMarker[], caption: string): void;
  destroy(): void;
}

export function createStageView(parent: HTMLElement): StageView {
  const scene = new RaceScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent,
    backgroundColor: '#1b1f24',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [scene],
  });

  return {
    render(stage, cars, caption) {
      if (scene.ready) {
        scene.draw(stage, cars, caption);
      }
    },
    destroy() {
      game.destroy(true);
    },
  };
}
