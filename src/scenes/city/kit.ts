import type { Painter } from './draw';
import { iso, shade, type Box, type Vec } from './iso';

export type BuildingKey = 'hall' | 'mall' | 'bank' | 'police' | 'jobs' | 'sponsors' | 'bar' | 'shop' | 'market' | 'garage' | 'track' | 'black' | 'own';

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
  noPlate?: boolean;
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
    p.glow(p.left(b, 0.15, b.w - 0.15, 1, 7, 0x2d3a48), 1, true);
    p.left(b, 0.1, b.w - 0.1, 7, 9.5, awning);
  }
  p.box({ x: b.x + b.w * 0.55, y: b.y + b.d * 0.2, w: Math.min(0.5, b.w * 0.3), d: Math.min(0.45, b.d * 0.3), z: b.h, h: 6 }, shade(color, 0.9));
}

export function footOf(b: Box, front = 0): Foot {
  return { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.d + front };
}

export function house(p: Painter, b: Box, wall: number, roof: number) {
  const z = b.h;
  const e = 0.08;
  const mid = b.y + b.d / 2;
  const ridge = z + Math.min(b.w, b.d) * 9;
  p.box(b, wall, shade(wall, 0.9));
  p.left(b, b.w * 0.42, b.w * 0.42 + 0.22, 0, 9, 0x6b4a2f);
  p.glow(p.left(b, 0.15, 0.4, 4.5, 9.5, 0x9cc3db));
  p.glow(p.left(b, b.w - 0.4, b.w - 0.15, 4.5, 9.5, 0x9cc3db));
  p.glow(p.right(b, b.d * 0.35, b.d * 0.35 + 0.28, 4.5, 9.5, 0x9cc3db), 0.8);
  p.poly([iso(b.x - e, b.y - e, z), iso(b.x + b.w + e, b.y - e, z), iso(b.x + b.w + e, mid, ridge), iso(b.x - e, mid, ridge)], shade(roof, 0.7));
  p.poly([iso(b.x + b.w, b.y + b.d, z), iso(b.x + b.w, b.y, z), iso(b.x + b.w, mid, ridge)], shade(wall, 0.74));
  p.box({ x: b.x + b.w * 0.72, y: b.y + b.d * 0.22, w: 0.14, d: 0.14, z, h: ridge - z + 3 }, 0x8a5a46);
  const front = [iso(b.x - e, b.y + b.d + e, z), iso(b.x + b.w + e, b.y + b.d + e, z), iso(b.x + b.w + e, mid, ridge), iso(b.x - e, mid, ridge)];
  p.poly(front, roof);
  p.edge(front, 0.35);
}

export function workshop(p: Painter, b: Box, color: number, accent: number) {
  p.box(b, color, shade(color, 0.82));
  ribs(p, b, shade(color, 0.7));
  const doors = b.w >= 1.8 ? [0.2, 1.05] : [0.3];
  for (const u of doors) {
    p.left(b, u, u + 0.7, 0, 11, 0xa9b4c0);
    for (let z = 1.5; z < 11; z += 1.6) {
      p.left(b, u, u + 0.7, z, z + 0.35, 0x7f8a96);
    }
  }
  p.left(b, 0, b.w, b.h - 4.5, b.h - 1, accent);
  p.right(b, 0, b.d, b.h - 4.5, b.h - 1, accent);
  p.box({ x: b.x + b.w * 0.6, y: b.y + b.d * 0.3, w: 0.3, d: 0.3, z: b.h, h: 4 }, 0x8a9099);
}

export function playground(p: Painter, x: number, y: number) {
  p.tile(x, y, x + 2, y + 1.6, 0xe6d3a3);
  p.edge([iso(x, y), iso(x + 2, y), iso(x + 2, y + 1.6), iso(x, y + 1.6)], 0.25);
  p.box({ x: x + 0.25, y: y + 0.25, w: 0.3, d: 0.3, h: 14 }, 0xe63946);
  p.poly([iso(x + 0.55, y + 0.3, 13), iso(x + 0.55, y + 0.52, 13), iso(x + 1.35, y + 0.52, 1), iso(x + 1.35, y + 0.3, 1)], 0xf4d35e);
  for (const u of [x + 0.35, x + 1.45]) {
    p.line(iso(u, y + 1.05), iso(u, y + 1.25, 16), 0x5b5f66, 1.6);
    p.line(iso(u, y + 1.45), iso(u, y + 1.25, 16), 0x5b5f66, 1.6);
  }
  p.line(iso(x + 0.35, y + 1.25, 16), iso(x + 1.45, y + 1.25, 16), 0x5b5f66, 2);
  for (const u of [x + 0.7, x + 1.1]) {
    p.line(iso(u, y + 1.25, 16), iso(u, y + 1.25, 5), 0x9aa1ad, 1);
    p.box({ x: u - 0.08, y: y + 1.2, w: 0.16, d: 0.1, z: 4, h: 1 }, 0x2a6fdb);
  }
  p.box({ x: x + 1.6, y: y + 0.55, w: 0.1, d: 0.1, h: 3 }, 0x6b4a2f);
  p.box({ x: x + 1.25, y: y + 0.57, w: 0.8, d: 0.07, z: 3, h: 1.4 }, 0x4caf50);
}

export function duck(p: Painter, gx: number, gy: number, mallard: boolean) {
  const at = iso(gx, gy);
  p.ellipse(at.x, at.y + 1, 7, 2.5, 0xffffff, 0.25);
  p.ellipse(at.x, at.y - 1.5, 4.5, 2.6, mallard ? 0x8b6b4a : 0xf4f4f4);
  p.circle(at.x + 3.2, at.y - 4, 1.9, mallard ? 0x2f7a3a : 0xffffff);
  p.rect(at.x + 4.8, at.y - 4.4, 2, 1, 0xf28c28);
}
