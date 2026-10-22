import Phaser from 'phaser';
import { CityScene, type CityPlace } from './scenes/CityScene';

export interface CityView {
  resize(): void;
  setPerks(text: string): void;
  zoomBy(factor: number): void;
  reset(): void;
  destroy(): void;
}

export function createCityView(parent: HTMLElement, name: string, places: CityPlace[], onSelect: (to: string) => void): CityView {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const size = () => [Math.max(1, Math.round(parent.clientWidth * ratio)), Math.max(1, Math.round(parent.clientHeight * ratio))];
  const scene = new CityScene(name, places, onSelect, ratio);
  const [width, height] = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width,
    height,
    parent,
    backgroundColor: '#1a1f27',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { touch: { capture: false } },
    scene: [scene],
  });

  return {
    resize() {
      const [w, h] = size();
      if (w !== game.scale.width || h !== game.scale.height) {
        game.scale.resize(w, h);
      }
    },
    setPerks(text) {
      scene.setPerks(text);
    },
    zoomBy(factor) {
      if (scene.ready) {
        scene.zoomCenter(factor);
      }
    },
    reset() {
      if (scene.ready) {
        scene.reset();
      }
    },
    destroy() {
      game.destroy(true);
    },
  };
}
