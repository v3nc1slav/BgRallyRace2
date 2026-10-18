import type Phaser from 'phaser';
import { random } from './random';

export type Weather = 'dry' | 'rain' | 'snow';

interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
}

export class Precipitation {
  private drops: Particle[] = [];
  private flakes: Particle[] = [];
  private readonly width: number;
  private readonly height: number;
  private readonly top: number;

  constructor(width: number, height: number, top: number) {
    this.width = width;
    this.height = height;
    this.top = top;
    const rnd = random(4242);
    for (let i = 0; i < 220; i++) {
      this.drops.push({ x: rnd() * width, y: top + rnd() * (height - top), speed: 700 + rnd() * 400, size: 10 + rnd() * 10, phase: 0 });
    }
    for (let i = 0; i < 160; i++) {
      this.flakes.push({ x: rnd() * width, y: top + rnd() * (height - top), speed: 40 + rnd() * 70, size: 1.2 + rnd() * 2, phase: rnd() * Math.PI * 2 });
    }
  }

  draw(g: Phaser.GameObjects.Graphics, weather: Weather, dt: number) {
    g.clear();
    const span = this.height - this.top;

    if (weather === 'rain') {
      g.fillStyle(0xc8d4e0, 0.07);
      g.fillRect(0, this.top, this.width, span);
      g.lineStyle(1.2, 0xc9dcef, 0.45);
      for (const drop of this.drops) {
        drop.y += drop.speed * dt;
        drop.x -= drop.speed * dt * 0.25;
        if (drop.y > this.height) {
          drop.y = this.top;
          drop.x = Math.random() * (this.width + 100);
        }
        g.lineBetween(drop.x, drop.y, drop.x + drop.size * 0.25, drop.y - drop.size);
      }
    } else if (weather === 'snow') {
      g.fillStyle(0xffffff, 0.06);
      g.fillRect(0, this.top, this.width, span);
      g.fillStyle(0xffffff, 0.9);
      for (const flake of this.flakes) {
        flake.phase += dt * 1.5;
        flake.y += flake.speed * dt;
        flake.x += Math.sin(flake.phase) * 18 * dt;
        if (flake.y > this.height) {
          flake.y = this.top;
          flake.x = Math.random() * this.width;
        }
        g.fillCircle(flake.x, flake.y, flake.size);
      }
    }
  }
}

interface Puff {
  x: number;
  y: number;
  age: number;
  size: number;
}

export class Dust {
  private puffs: Puff[] = [];

  add(x: number, y: number) {
    if (this.puffs.length < 260) {
      this.puffs.push({ x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4, age: 0, size: 3 + Math.random() * 2 });
    }
  }

  clear() {
    this.puffs = [];
  }

  draw(g: Phaser.GameObjects.Graphics, color: number, dt: number) {
    g.clear();
    this.puffs = this.puffs.filter((puff) => (puff.age += dt) < 1.4);
    for (const puff of this.puffs) {
      const life = puff.age / 1.4;
      g.fillStyle(color, 0.32 * (1 - life));
      g.fillCircle(puff.x, puff.y, puff.size + life * 9);
    }
  }
}

const SUNSET = [17.2, 17.9, 18.5, 19.9, 20.5, 20.9, 20.9, 20.4, 19.6, 18.7, 17.1, 16.8];
const SUNRISE = [7.6, 7.2, 6.5, 6.6, 6.0, 5.8, 5.9, 6.3, 6.9, 7.5, 7.1, 7.6];

export function darkness(startIso: string, offsetSeconds: number) {
  const date = new Date(new Date(startIso).getTime() + offsetSeconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }
  const hour = date.getHours() + date.getMinutes() / 60;
  const sunset = SUNSET[date.getMonth()];
  const sunrise = SUNRISE[date.getMonth()];
  if (hour >= sunrise + 0.5 && hour <= sunset - 0.25) {
    return 0;
  }
  if (hour > sunset - 0.25 && hour < sunset + 0.75) {
    return (hour - (sunset - 0.25)) / 1;
  }
  if (hour > sunrise - 0.5 && hour < sunrise + 0.5) {
    return 1 - (hour - (sunrise - 0.5));
  }
  return 1;
}
