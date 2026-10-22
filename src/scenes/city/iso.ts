import Phaser from 'phaser';

export const HALF_W = 32;
export const HALF_H = 16;

export type Vec = Phaser.Math.Vector2;

export function iso(gx: number, gy: number, z = 0): Vec {
  return new Phaser.Math.Vector2((gx - gy) * HALF_W, (gx + gy) * HALF_H - z);
}

export function shade(color: number, factor: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  d: number;
  z?: number;
  h: number;
}

export function hull(box: Box, top = box.h) {
  const z = box.z ?? 0;
  return [
    iso(box.x, box.y + box.d, z),
    iso(box.x + box.w, box.y + box.d, z),
    iso(box.x + box.w, box.y, z),
    iso(box.x + box.w, box.y, z + top),
    iso(box.x, box.y, z + top),
    iso(box.x, box.y + box.d, z + top),
  ];
}
