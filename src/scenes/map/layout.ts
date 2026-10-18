import Phaser from 'phaser';
import { random } from './random';

export type ZoneType = 'forest' | 'meadow' | 'field' | 'water' | 'village';
export type PoiType = 'bridge' | 'jump' | 'spectators';

export interface StageRoute {
  aspect: number;
  points: [number, number][];
  labels: { name: string; x: number; y: number }[];
  zones?: { type: ZoneType; points: [number, number][] }[];
  rivers?: { points: [number, number][] }[];
  pois?: { type: PoiType; x: number; y: number }[];
}

export interface StageShape {
  id: number;
  seq: number;
  name: string;
  length_km: number;
  turns: number;
  surface: string;
  difficulty: number;
  route?: StageRoute | null;
}

export interface Layout {
  traced: boolean;
  points: Phaser.Math.Vector2[];
  labels: { name: string; x: number; y: number }[];
  zones: { type: ZoneType; points: Phaser.Math.Vector2[] }[];
  rivers: Phaser.Math.Vector2[][];
  pois: { type: PoiType; x: number; y: number }[];
}

export const HEADER = 100;

export function generatedLayout(stage: StageShape, width: number, height: number): Layout {
  const rnd = random(stage.id * 7919 + stage.turns * 31);
  const count = Math.max(8, Math.min(36, Math.round(stage.turns / 2)));
  const sharpness = 0.35 + stage.difficulty * 0.07;

  let angle = (rnd() - 0.5) * 0.6;
  let x = 0;
  let y = 0;
  const raw = [{ x, y }];
  for (let i = 0; i < count; i++) {
    angle = Phaser.Math.Clamp(angle + (rnd() - 0.5) * sharpness * 2, -1.25, 1.25);
    x += Math.cos(angle);
    y += Math.sin(angle);
    raw.push({ x, y });
  }

  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const scale = Math.min((width - 160) / spanX, (height - HEADER - 100) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = HEADER + 20 + (height - HEADER - 80 - spanY * scale) / 2;
  const points = raw.map((p) => new Phaser.Math.Vector2(offsetX + (p.x - minX) * scale, offsetY + (p.y - minY) * scale));

  const river: Phaser.Math.Vector2[] = [];
  let riverX = width * (0.25 + rnd() * 0.5);
  for (let ry = HEADER; ry <= height + 20; ry += 40) {
    river.push(new Phaser.Math.Vector2(riverX, ry));
    riverX += (rnd() - 0.5) * 70;
  }

  const pois: Layout['pois'] = [];
  for (let i = 0; i < 3; i++) {
    const point = points[1 + Math.floor(rnd() * (points.length - 2))];
    pois.push({ type: 'spectators', x: point.x, y: point.y });
  }

  return { traced: false, points, labels: [], zones: [], rivers: [river], pois };
}

export function tracedLayout(route: StageRoute, width: number, height: number): Layout {
  const areaWidth = width - 80;
  const areaHeight = height - HEADER - 30;
  let w = areaWidth;
  let h = w / route.aspect;
  if (h > areaHeight) {
    h = areaHeight;
    w = h * route.aspect;
  }
  const offsetX = (width - w) / 2;
  const offsetY = HEADER + 10 + (areaHeight - h) / 2;
  const map = ([x, y]: [number, number]) => new Phaser.Math.Vector2(offsetX + x * w, offsetY + y * h);

  return {
    traced: true,
    points: route.points.map(map),
    labels: route.labels.map((label) => ({ name: label.name, x: offsetX + label.x * w, y: offsetY + label.y * h })),
    zones: (route.zones ?? []).map((zone) => ({ type: zone.type, points: zone.points.map(map) })),
    rivers: (route.rivers ?? []).map((river) => river.points.map(map)),
    pois: (route.pois ?? []).map((poi) => ({ type: poi.type, x: offsetX + poi.x * w, y: offsetY + poi.y * h })),
  };
}
