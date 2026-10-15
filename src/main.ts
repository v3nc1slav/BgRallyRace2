import './style.css';
import Phaser from 'phaser';
import { RaceScene } from './scenes/RaceScene';
import { apiGet } from './api';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'app',
  backgroundColor: '#2d2d2d',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [RaceScene],
});

apiGet<{ name: string }>('')
  .then((d) => console.log('WordPress казва:', d.name))
  .catch((e) => console.warn('Няма връзка с WordPress:', e));