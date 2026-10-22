import Phaser from 'phaser';
import { HALF_H, HALF_W, iso, shade, type Box, type Vec } from './iso';

const INK = 0x15171c;
const ROOT2 = Math.SQRT2;

export class Painter {
  readonly g: Phaser.GameObjects.Graphics;
  light = 1;

  constructor(g: Phaser.GameObjects.Graphics) {
    this.g = g;
  }

  private c(color: number) {
    return shade(color, this.light);
  }

  poly(points: Vec[], color: number, alpha = 1) {
    this.g.fillStyle(this.c(color), alpha);
    this.g.fillPoints(points, true);
  }

  edge(points: Vec[], alpha = 0.28, width = 1) {
    this.g.lineStyle(width, INK, alpha);
    this.g.strokePoints(points, true);
  }

  line(a: Vec, b: Vec, color: number, width = 1, alpha = 1) {
    this.g.lineStyle(width, this.c(color), alpha);
    this.g.lineBetween(a.x, a.y, b.x, b.y);
  }

  circle(x: number, y: number, r: number, color: number, alpha = 1) {
    this.g.fillStyle(this.c(color), alpha);
    this.g.fillCircle(x, y, r);
  }

  ellipse(x: number, y: number, rx: number, ry: number, color: number, alpha = 1) {
    this.g.fillStyle(this.c(color), alpha);
    this.g.fillEllipse(x, y, rx * 2, ry * 2);
  }

  rect(x: number, y: number, w: number, h: number, color: number, alpha = 1) {
    this.g.fillStyle(this.c(color), alpha);
    this.g.fillRect(x, y, w, h);
  }

  tile(x0: number, y0: number, x1: number, y1: number, color: number, z = 0, alpha = 1) {
    this.poly([iso(x0, y0, z), iso(x1, y0, z), iso(x1, y1, z), iso(x0, y1, z)], color, alpha);
  }

  disc(gx: number, gy: number, r: number, color: number, z = 0, alpha = 1) {
    const p = iso(gx, gy, z);
    this.ellipse(p.x, p.y, r * HALF_W * ROOT2, r * HALF_H * ROOT2, color, alpha);
  }

  box(b: Box, color: number, top = shade(color, 1.1), outline = true) {
    const z = b.z ?? 0;
    const { x, y, w, d, h } = b;
    const left = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
    const right = [iso(x + w, y + d, z), iso(x + w, y, z), iso(x + w, y, z + h), iso(x + w, y + d, z + h)];
    const roof = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
    this.poly(left, shade(color, 0.93));
    this.poly(right, shade(color, 0.74));
    this.poly(roof, top);
    if (outline) {
      this.edge(left);
      this.edge(right);
      this.edge(roof);
    }
  }

  left(b: Box, u0: number, u1: number, z0: number, z1: number, color: number, alpha = 1) {
    const z = b.z ?? 0;
    const y = b.y + b.d;
    this.poly([iso(b.x + u0, y, z + z0), iso(b.x + u1, y, z + z0), iso(b.x + u1, y, z + z1), iso(b.x + u0, y, z + z1)], shade(color, 0.93), alpha);
  }

  right(b: Box, v0: number, v1: number, z0: number, z1: number, color: number, alpha = 1) {
    const z = b.z ?? 0;
    const x = b.x + b.w;
    const y = b.y + b.d;
    this.poly([iso(x, y - v0, z + z0), iso(x, y - v1, z + z0), iso(x, y - v1, z + z1), iso(x, y - v0, z + z1)], shade(color, 0.74), alpha);
  }

  windows(b: Box, floors: number[], height: number, width: number, gap: number, color: number, faces: ('left' | 'right')[] = ['left', 'right']) {
    for (const face of faces) {
      const span = face === 'left' ? b.w : b.d;
      const count = Math.max(1, Math.floor((span - gap) / (width + gap)));
      const margin = (span - count * width - (count - 1) * gap) / 2;
      for (const z0 of floors) {
        for (let i = 0; i < count; i++) {
          const u0 = margin + i * (width + gap);
          this[face](b, u0, u0 + width, z0, z0 + height, color);
        }
      }
    }
  }

  pediment(b: Box, u0: number, u1: number, z0: number, rise: number, color: number) {
    const z = (b.z ?? 0) + z0;
    const y = b.y + b.d;
    const mid = (u0 + u1) / 2;
    this.poly([iso(b.x + u0, y, z), iso(b.x + u1, y, z), iso(b.x + mid, y, z + rise)], shade(color, 0.96));
    this.edge([iso(b.x + u0, y, z), iso(b.x + u1, y, z), iso(b.x + mid, y, z + rise)]);
  }
}

export function tree(p: Painter, gx: number, gy: number, size = 1, tone = 0) {
  const base = iso(gx, gy);
  const s = size;
  p.ellipse(base.x + 3 * s, base.y + 1, 12 * s, 5 * s, 0x000000, 0.18);
  p.rect(base.x - 1.5 * s, base.y - 13 * s, 3 * s, 13 * s, 0x6b4a2f);
  const dark = [0x2f6b2f, 0x3b6e2a, 0x2c5f3a][tone % 3];
  const mid = [0x3f8a3a, 0x4f8a35, 0x3a7c4a][tone % 3];
  p.circle(base.x, base.y - 19 * s, 10.5 * s, dark);
  p.circle(base.x - 3 * s, base.y - 22 * s, 7.5 * s, mid);
  p.circle(base.x + 4 * s, base.y - 18 * s, 5.5 * s, mid);
  p.circle(base.x - 4.5 * s, base.y - 25 * s, 3.2 * s, 0x76b860, 0.85);
}

export function conifer(p: Painter, gx: number, gy: number, size = 1) {
  const base = iso(gx, gy);
  const s = size;
  p.ellipse(base.x + 3 * s, base.y + 1, 9 * s, 4 * s, 0x000000, 0.18);
  p.rect(base.x - 1.5 * s, base.y - 6 * s, 3 * s, 6 * s, 0x5b3e27);
  for (const [dy, w] of [[0, 9], [-8, 7], [-15, 5]] as const) {
    const y = base.y - 6 * s + dy * s;
    p.poly([new Phaser.Math.Vector2(base.x - w * s, y), new Phaser.Math.Vector2(base.x + w * s, y), new Phaser.Math.Vector2(base.x, y - 13 * s)], 0x2a5b34);
    p.poly([new Phaser.Math.Vector2(base.x - w * s, y), new Phaser.Math.Vector2(base.x, y), new Phaser.Math.Vector2(base.x, y - 13 * s)], 0x357043);
  }
}

export function lamp(p: Painter, gx: number, gy: number) {
  const base = iso(gx, gy);
  p.ellipse(base.x + 2, base.y, 4, 2, 0x000000, 0.2);
  p.line(base, new Phaser.Math.Vector2(base.x, base.y - 30), 0x30343b, 2);
  p.line(new Phaser.Math.Vector2(base.x, base.y - 30), new Phaser.Math.Vector2(base.x + 5, base.y - 32), 0x30343b, 2);
  p.circle(base.x + 6, base.y - 31, 2.4, 0xfff1c1);
}

export function bench(p: Painter, gx: number, gy: number, along: 'x' | 'y') {
  const b = along === 'x' ? { x: gx - 0.22, y: gy - 0.06, w: 0.44, d: 0.12, h: 4 } : { x: gx - 0.06, y: gy - 0.22, w: 0.12, d: 0.44, h: 4 };
  p.box(b, 0x8a5a36);
}

export function car(p: Painter, gx: number, gy: number, along: 'x' | 'y', color: number) {
  const long = 0.56;
  const wide = 0.3;
  const b = along === 'x' ? { x: gx - long / 2, y: gy - wide / 2, w: long, d: wide, h: 5 } : { x: gx - wide / 2, y: gy - long / 2, w: wide, d: long, h: 5 };
  const base = iso(gx, gy);
  p.ellipse(base.x + 2, base.y + 1, 12, 5, 0x000000, 0.22);
  p.box({ ...b, z: 1.5 }, color);
  const cabin = along === 'x'
    ? { x: b.x + 0.14, y: b.y + 0.03, w: 0.26, d: wide - 0.06, z: 6.5, h: 4 }
    : { x: b.x + 0.03, y: b.y + 0.14, w: wide - 0.06, d: 0.26, z: 6.5, h: 4 };
  p.box(cabin, 0x253041, shade(color, 1.05));
}

export function fountain(p: Painter, gx: number, gy: number, r: number) {
  p.disc(gx + 0.08, gy + 0.08, r * 1.05, 0x000000, 0, 0.15);
  p.disc(gx, gy, r, 0x9c9486, 0);
  p.disc(gx, gy, r, 0xd8d0bf, 5);
  p.disc(gx, gy, r * 0.84, 0x3f8fc4, 5);
  p.disc(gx, gy, r * 0.62, 0x5aa8d8, 5, 0.8);
  p.box({ x: gx - 0.12, y: gy - 0.12, w: 0.24, d: 0.24, h: 16 }, 0xd8d0bf);
  const top = iso(gx, gy, 18);
  p.circle(top.x, top.y - 4, 5, 0xe6f4ff, 0.75);
  p.circle(top.x - 5, top.y + 2, 3.5, 0xe6f4ff, 0.55);
  p.circle(top.x + 5, top.y + 2, 3.5, 0xe6f4ff, 0.55);
}

export function flag(p: Painter, foot: Vec, height: number) {
  const top = new Phaser.Math.Vector2(foot.x, foot.y - height);
  p.line(foot, top, 0xd0d4da, 1.5);
  const stripes = [0xffffff, 0x00966e, 0xd62612];
  stripes.forEach((color, i) => p.rect(top.x + 1, top.y + 1 + i * 4, 18, 4, color));
}

export function billboard(p: Painter, center: Vec, width: number, height: number, color: number) {
  p.line(new Phaser.Math.Vector2(center.x - width * 0.3, center.y + height / 2), new Phaser.Math.Vector2(center.x - width * 0.3, center.y + height / 2 + 10), 0x3a3f47, 2);
  p.line(new Phaser.Math.Vector2(center.x + width * 0.3, center.y + height / 2), new Phaser.Math.Vector2(center.x + width * 0.3, center.y + height / 2 + 10), 0x3a3f47, 2);
  p.rect(center.x - width / 2, center.y - height / 2, width, height, color);
  p.edge([
    new Phaser.Math.Vector2(center.x - width / 2, center.y - height / 2),
    new Phaser.Math.Vector2(center.x + width / 2, center.y - height / 2),
    new Phaser.Math.Vector2(center.x + width / 2, center.y + height / 2),
    new Phaser.Math.Vector2(center.x - width / 2, center.y + height / 2),
  ], 0.5, 1.5);
}
