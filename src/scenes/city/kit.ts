import type { Painter } from './draw';
import { iso, shade, type Box, type Vec } from './iso';

export type BuildingKey = 'hall' | 'mall' | 'bank' | 'police' | 'jobs' | 'sponsors' | 'bar' | 'shop' | 'market' | 'garage' | 'track' | 'black';

export interface Sign {
  text: string;
  at: Vec;
  size: number;
  color: string;
}

export interface Foot {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BuildingDef {
  key: BuildingKey;
  box: Box;
  foot: Foot;
  top: number;
  draw(p: Painter): void;
  signs(): Sign[];
}

export const GLASS = 0x34495e;

export function columns(p: Painter, x: number, y: number, count: number, step: number, z0: number, z1: number, color: number) {
  for (let i = 0; i < count; i++) {
    p.box({ x: x + i * step, y, w: 0.12, d: 0.12, z: z0, h: z1 - z0 }, color, color, false);
  }
}

export function steps(p: Painter, x: number, y: number, w: number, color: number) {
  p.box({ x, y, w, d: 0.75, h: 2.5 }, shade(color, 0.92));
  p.box({ x: x + 0.08, y, w: w - 0.16, d: 0.55, h: 5 }, color);
}

export function ribs(p: Painter, b: Box, color: number, step = 0.14) {
  for (let u = step; u < b.w - 0.02; u += step) {
    p.left(b, u, u + 0.025, 0, b.h, color, 0.45);
  }
  for (let v = step; v < b.d - 0.02; v += step) {
    p.right(b, v, v + 0.025, 0, b.h, color, 0.45);
  }
}

export function tyres(p: Painter, gx: number, gy: number, count: number) {
  for (let i = 0; i < count; i++) {
    p.disc(gx, gy, 0.15, 0x1c1d20, i * 3.2);
    p.disc(gx, gy, 0.15, 0x2c2e33, i * 3.2 + 3);
    p.disc(gx, gy, 0.07, 0x111214, i * 3.2 + 3);
  }
}

export function umbrella(p: Painter, gx: number, gy: number, color: number) {
  p.disc(gx + 0.05, gy + 0.05, 0.28, 0x000000, 0, 0.15);
  p.disc(gx, gy, 0.16, 0x8a5a36, 6);
  const foot = iso(gx, gy);
  p.line(foot, iso(gx, gy, 15), 0x5b5f66, 1.2);
  p.disc(gx, gy, 0.32, color, 15);
  p.disc(gx, gy, 0.14, 0xffffff, 15.5, 0.6);
}

export function banner(p: Painter, gx: number, gy: number, color: number) {
  const foot = iso(gx, gy);
  const top = iso(gx, gy, 34);
  p.line(foot, top, 0xc9ced6, 1.4);
  p.rect(top.x + 1, top.y + 2, 7, 16, color);
}

export function residential(p: Painter, b: Box, color: number, awning?: number) {
  p.box(b, color, shade(color, 0.85));
  const floors: number[] = [];
  for (let z = 12; z < b.h - 6; z += 11) {
    floors.push(z);
  }
  p.windows(b, floors, 6, 0.18, 0.2, 0x3d4a5a);
  if (awning) {
    p.left(b, 0.15, b.w - 0.15, 1, 7, 0x2d3a48);
    p.left(b, 0.1, b.w - 0.1, 7, 9.5, awning);
  }
  p.box({ x: b.x + b.w * 0.55, y: b.y + b.d * 0.2, w: Math.min(0.5, b.w * 0.3), d: Math.min(0.45, b.d * 0.3), z: b.h, h: 6 }, shade(color, 0.9));
}

export function footOf(b: Box, front = 0): Foot {
  return { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.d + front };
}
