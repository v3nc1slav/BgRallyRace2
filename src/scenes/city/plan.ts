import Phaser from 'phaser';
import { random } from '../map/random';
import { BUILDINGS, residential, type BuildingDef } from './buildings';
import { bench, car, conifer, fountain, lamp, tree, type Painter } from './draw';
import { iso, type Box, type Vec } from './iso';
import { banner, house, playground, tyres, umbrella, workshop, type Foot } from './kit';

export const LOW = -9;
export const HIGH_X = 37;
export const HIGH_Y = 31;
export const CITY = { x0: -6, y0: -6, x1: 29, y1: 23 };
export const ENTRANCE = { gx: 30.4, gy: 4.55 };

export const X_ROADS = [-1, 5, 11, 17, 23];
export const Y_ROADS = [-1, 5, 11, 17];
const ASPHALT = 0x464a51;
const SIDEWALK = 0xb9b3a7;
export const LAKE = { x: 1.25, y: 7.25, r: 0.9 };
export const RIVER: [number, number][] = [[1.0, 7.25], [0.2, 7.35], [-0.5, 7.45], [-1.5, 7.5], [-2.6, 7.9], [-3.8, 8.15], [-4.9, 7.8], [-6.0, 7.4], [-7.2, 7.7], [-8.3, 8.1], [-9.3, 8.2]];
const BRIDGE = { x0: -1, x1: 0, y0: 6.85, y1: 8.1 };

export interface Item {
  foot: Foot;
  draw(p: Painter): void;
  building?: BuildingDef;
  entrance?: boolean;
  key?: string;
  at?: Vec;
}

type BlockKind =
  | 'square' | 'park' | 'bank' | 'mall' | 'homes' | 'police' | 'sponsors' | 'barshop' | 'market' | 'garage'
  | 'houses' | 'workshops' | 'playground' | 'river';

export interface Block extends Foot {
  kind: BlockKind;
}

const KINDS: BlockKind[][] = [
  ['houses', 'workshops', 'houses', 'playground', 'houses', 'workshops'],
  ['houses', 'police', 'bank', 'sponsors', 'homes', 'houses'],
  ['river', 'park', 'square', 'mall', 'homes', 'workshops'],
  ['houses', 'barshop', 'market', 'garage', 'homes', 'playground'],
  ['workshops', 'houses', 'playground', 'workshops', 'houses', 'houses'],
];

export const BLOCKS: Block[] = KINDS.flatMap((row, r) =>
  row.map((kind, c) => ({ x0: (c - 1) * 6, y0: (r - 1) * 6, x1: (c - 1) * 6 + 5, y1: (r - 1) * 6 + 5, kind })),
);

const SURFACE: Record<BlockKind, number> = {
  square: 0xd6ccb6,
  park: 0x6fa04a,
  bank: 0x74a24c,
  mall: 0xc5bfb3,
  homes: 0x74a24c,
  police: 0x74a24c,
  sponsors: 0x74a24c,
  barshop: 0x74a24c,
  market: 0x74a24c,
  garage: 0x74a24c,
  houses: 0x7fae55,
  workshops: 0xa39d90,
  playground: 0x6fa04a,
  river: 0x6fa04a,
};

const near = (v: number, roads: number[], pad = 0) => roads.some((r) => v > r - pad && v < r + 1 + pad);
const crossing = (t: number, len: number, roads: number[]) => roads.some((c) => t + len > c - 0.1 && t < c + 1.1);
const inside = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x > x0 && x < x1 && y > y0 && y < y1;

function strip(points: [number, number][], half: number) {
  const left: Vec[] = [];
  const right: Vec[] = [];
  points.forEach(([x, y], i) => {
    const [ax, ay] = points[Math.max(0, i - 1)];
    const [bx, by] = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / length;
    const ny = (bx - ax) / length;
    const wobble = half * (1 + 0.12 * Math.sin(i * 1.7));
    left.push(iso(x + nx * wobble, y + ny * wobble));
    right.push(iso(x - nx * wobble, y - ny * wobble));
  });
  return [...left, ...right.reverse()];
}

export function drawGround(p: Painter) {
  const depth = 30;
  p.poly([iso(LOW, HIGH_Y), iso(HIGH_X, HIGH_Y), iso(HIGH_X, HIGH_Y, -depth), iso(LOW, HIGH_Y, -depth)], 0x6d5236);
  p.poly([iso(HIGH_X, HIGH_Y), iso(HIGH_X, LOW), iso(HIGH_X, LOW, -depth), iso(HIGH_X, HIGH_Y, -depth)], 0x4f3b27);
  p.tile(LOW, LOW, HIGH_X, HIGH_Y, 0x5e8e3d);

  const rnd = random(77);
  for (let i = 0; i < 420; i++) {
    const gx = LOW + rnd() * (HIGH_X - LOW);
    const gy = LOW + rnd() * (HIGH_Y - LOW);
    p.disc(gx, gy, 0.4 + rnd() * 0.8, rnd() > 0.5 ? 0x6b9c47 : 0x527f35, 0, 0.35);
  }

  for (const block of BLOCKS) {
    p.tile(block.x0, block.y0, block.x1, block.y1, SIDEWALK);
    p.edge([iso(block.x0, block.y0), iso(block.x1, block.y0), iso(block.x1, block.y1), iso(block.x0, block.y1)], 0.35, 1.5);
    const inner = { x0: block.x0 + 0.3, y0: block.y0 + 0.3, x1: block.x1 - 0.3, y1: block.y1 - 0.3 };
    p.tile(inner.x0, inner.y0, inner.x1, inner.y1, SURFACE[block.kind]);

    if (block.kind === 'square') {
      for (let t = 0.5; t < 4.4; t += 0.5) {
        p.line(iso(inner.x0 + t, inner.y0), iso(inner.x0 + t, inner.y1), 0x9c927c, 1, 0.25);
        p.line(iso(inner.x0, inner.y0 + t), iso(inner.x1, inner.y0 + t), 0x9c927c, 1, 0.25);
      }
    }
    if (block.kind === 'park' || block.kind === 'playground') {
      p.tile(inner.x0, block.y0 + 2.3, inner.x1, block.y0 + 2.7, 0xd9c79c);
      p.tile(block.x0 + 2.3, inner.y0, block.x0 + 2.7, inner.y1, 0xd9c79c);
    }
    if (block.kind === 'park') {
      p.disc(LAKE.x, LAKE.y, LAKE.r + 0.1, 0x9c9486);
      p.disc(LAKE.x, LAKE.y, LAKE.r, 0x3f8fc4);
      p.disc(LAKE.x - 0.15, LAKE.y - 0.15, 0.35, 0x6fb3e0, 0, 0.6);
    }
    if (block.kind === 'mall') {
      for (let t = inner.x0 + 0.3; t < inner.x1; t += 0.45) {
        p.line(iso(t, block.y1 - 0.75), iso(t, inner.y1), 0xffffff, 1, 0.5);
      }
    }
    if (block.kind === 'houses') {
      p.tile(block.x0 + 2.3, inner.y0, block.x0 + 2.7, inner.y1, 0xc9c1b0);
    }
  }

  p.poly(strip(RIVER, 0.5), 0x7d6e4a);
  p.poly(strip(RIVER, 0.38), 0x3f8fc4);
  p.poly(strip(RIVER, 0.14), 0x5aa8d8, 0.6);
  for (const [x, y] of RIVER.filter((_, i) => i % 2 === 0)) {
    for (const side of [-1, 1]) {
      const at = iso(x, y + side * 0.48);
      p.line(at, new Phaser.Math.Vector2(at.x + 1, at.y - 6), 0x4f8f3a, 1.4);
      p.line(at, new Phaser.Math.Vector2(at.x - 2, at.y - 5), 0x4f8f3a, 1.4);
    }
  }

  for (const r of Y_ROADS) {
    p.tile(LOW, r, HIGH_X, r + 1, ASPHALT);
  }
  for (const c of X_ROADS) {
    p.tile(c, LOW, c + 1, HIGH_Y, ASPHALT);
  }
  for (const r of Y_ROADS) {
    for (let t = LOW + 0.2; t < HIGH_X - 0.4; t += 0.8) {
      if (!crossing(t, 0.4, X_ROADS)) {
        p.line(iso(t, r + 0.5), iso(t + 0.4, r + 0.5), 0xeeeeee, 1.6, 0.8);
      }
    }
  }
  for (const c of X_ROADS) {
    for (let t = LOW + 0.2; t < HIGH_Y - 0.4; t += 0.8) {
      if (!crossing(t, 0.4, Y_ROADS) && !(c === BRIDGE.x0 && t + 0.4 > BRIDGE.y0 && t < BRIDGE.y1)) {
        p.line(iso(c + 0.5, t), iso(c + 0.5, t + 0.4), 0xeeeeee, 1.6, 0.8);
      }
    }
  }
  for (const c of X_ROADS) {
    for (const r of Y_ROADS) {
      for (let s = 0.1; s < 0.9; s += 0.16) {
        for (const [a, b] of [[c - 0.45, c - 0.12], [c + 1.12, c + 1.45]]) {
          p.tile(a, r + s, b, r + s + 0.08, 0xf2f2f2, 0, 0.85);
        }
        for (const [a, b] of [[r - 0.45, r - 0.12], [r + 1.12, r + 1.45]]) {
          p.tile(c + s, a, c + s + 0.08, b, 0xf2f2f2, 0, 0.85);
        }
      }
    }
  }

}

function point(x: number, y: number, r = 0.15): Foot {
  return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
}

function boxFoot(b: Box): Foot {
  return { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.d };
}

export function items(): Item[] {
  const rnd = random(2026);
  const list: Item[] = [];
  const add = (foot: Foot, draw: (p: Painter) => void) => list.push({ foot, draw });
  const stamp = (foot: Foot, key: string, gx: number, gy: number, draw: (p: Painter) => void) => list.push({ foot, key, at: iso(gx, gy), draw });
  const addTree = (x: number, y: number, size = 0.9 + rnd() * 0.3) => {
    const tone = Math.floor(rnd() * 3);
    const s = Math.round(size * 20) / 20;
    stamp(point(x, y), `tree:${s}:${tone}`, x, y, (p) => tree(p, 0, 0, s, tone));
  };
  const addBench = (x: number, y: number, along: 'x' | 'y') => stamp(point(x, y, 0.22), `bench:${along}`, x, y, (p) => bench(p, 0, 0, along));
  const addCar = (x: number, y: number, along: 'x' | 'y', color: number) => stamp(point(x, y, 0.28), `car:${color}:${along}`, x, y, (p) => car(p, 0, 0, along, color));
  const addTyres = (x: number, y: number, n: number) => stamp(point(x, y, 0.16), `tyres:${n}`, x, y, (p) => tyres(p, 0, 0, n));

  for (const def of BUILDINGS) {
    list.push({ foot: def.foot, draw: (p) => def.draw(p), building: def });
  }

  const colors = [0xd9b99b, 0xc9d1c0, 0xe0c9a6, 0xb8c4cf, 0xd8c3c3, 0xc7b8a1, 0xe3d5b8];
  const awnings = [0xe63946, 0x2a9d8f, 0xe9c46a, 0x457b9d];
  const walls = [0xf1e4c8, 0xe8d3b0, 0xdfe6e9, 0xf3d9c4, 0xd9e4cf, 0xece3d0];
  const roofs = [0xb5523b, 0x9a4434, 0x7a5a48, 0x6d6f73, 0xa8613c];
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const addHome = (home: Box) => {
    const color = pick(colors);
    const awning = rnd() > 0.45 ? pick(awnings) : undefined;
    add(boxFoot(home), (p) => residential(p, home, color, awning));
  };
  const addHouse = (b: Box) => {
    const wall = pick(walls);
    const roof = pick(roofs);
    add(boxFoot(b), (p) => house(p, b, wall, roof));
  };
  const homeRow = (x0: number, y0: number, slots: ('a' | 'b' | 'c')[]) => {
    const shapes = {
      a: { x: x0 + 0.45, y: y0 + 0.45, w: 1.9, d: 1.7, h: Math.round(42 + rnd() * 30) },
      b: { x: x0 + 2.75, y: y0 + 0.45, w: 1.8, d: 1.45, h: Math.round(28 + rnd() * 24) },
      c: { x: x0 + 0.45, y: y0 + 2.65, w: 1.6, d: 1.85, h: Math.round(24 + rnd() * 30) },
    };
    slots.forEach((slot) => addHome(shapes[slot]));
  };

  for (const block of BLOCKS) {
    const { x0, y0 } = block;
    switch (block.kind) {
      case 'homes':
        homeRow(x0, y0, ['a', 'b', 'c']);
        addTree(x0 + 3.2, y0 + 2.75);
        addTree(x0 + 4.2, y0 + 3.4);
        addTree(x0 + 3.0, y0 + 4.1);
        addTree(x0 + 4.25, y0 + 4.35, 0.8);
        break;
      case 'police':
        homeRow(x0, y0, ['a', 'b', 'c']);
        addTree(x0 + 4.45, y0 + 2.15, 0.8);
        break;
      case 'sponsors':
        homeRow(x0, y0, ['a', 'b', 'c']);
        [0xe63946, 0xf4d35e, 0x2a6fdb].forEach((color, i) => stamp(point(x0 + 2.55 + i * 0.75, y0 + 4.78, 0.08), `banner:${color}`, x0 + 2.55 + i * 0.75, y0 + 4.78, (p) => banner(p, 0, 0, color)));
        break;
      case 'bank':
        addTree(x0 + 3.6, y0 + 0.9);
        addTree(x0 + 4.4, y0 + 1.6);
        break;
      case 'barshop':
        addHome({ x: x0 + 0.45, y: y0 + 3.25, w: 1.9, d: 1.4, h: Math.round(30 + rnd() * 16) });
        for (const [x, color] of [[0.9, 0xe63946], [1.85, 0x2a9d8f]] as const) {
          stamp(point(x0 + x, y0 + 2.75, 0.3), `umbrella:${color}`, x0 + x, y0 + 2.75, (p) => umbrella(p, 0, 0, color));
        }
        for (const [x, y, n] of [[3.1, 2.95, 3], [3.45, 3.0, 2], [4.35, 2.9, 4]] as const) {
          addTyres(x0 + x, y0 + y, n);
        }
        addTree(x0 + 3.4, y0 + 4.0);
        addTree(x0 + 4.3, y0 + 4.2, 0.85);
        break;
      case 'market':
        addHome({ x: x0 + 0.45, y: y0 + 3.25, w: 1.9, d: 1.4, h: Math.round(28 + rnd() * 20) });
        addHome({ x: x0 + 2.75, y: y0 + 3.25, w: 1.9, d: 1.4, h: Math.round(36 + rnd() * 20) });
        break;
      case 'garage':
        homeRow(x0, y0, ['a', 'b', 'c']);
        addCar(x0 + 3.0, y0 + 4.65, 'x', 0xe63946);
        addTyres(x0 + 4.45, y0 + 4.55, 3);
        break;
      case 'houses':
        for (const [dx, dy] of [[0.55, 0.6], [2.95, 0.6], [0.55, 2.95], [2.95, 2.95]]) {
          const w = 1.25 + rnd() * 0.3;
          const d = 1.05 + rnd() * 0.25;
          addHouse({ x: x0 + dx, y: y0 + dy, w, d, h: Math.round(13 + rnd() * 5) });
          addTree(x0 + dx + w + 0.25, y0 + dy + d + 0.3, 0.75 + rnd() * 0.25);
        }
        break;
      case 'workshops':
        add(boxFoot({ x: x0 + 0.45, y: y0 + 0.45, w: 2.1, d: 1.6, h: 0 }), (p) => workshop(p, { x: x0 + 0.45, y: y0 + 0.45, w: 2.1, d: 1.6, h: 18 }, pick([0x8796a5, 0x9a8f80, 0x7d8a7a]), pick([0xf28c28, 0xe63946, 0x2a6fdb])));
        add(boxFoot({ x: x0 + 2.85, y: y0 + 0.45, w: 1.8, d: 1.5, h: 0 }), (p) => workshop(p, { x: x0 + 2.85, y: y0 + 0.45, w: 1.8, d: 1.5, h: 16 }, pick([0x8796a5, 0x9a8f80, 0xa3a7ab]), pick([0xf4d35e, 0x2a9d8f, 0xe63946])));
        addHouse({ x: x0 + 0.55, y: y0 + 3.0, w: 1.4, d: 1.15, h: 14 });
        for (const [dx, dy, along] of [[3.1, 2.75, 'x'], [3.9, 3.7, 'y'], [2.6, 4.2, 'x']] as const) {
          const color = pick([0x2a6fdb, 0xf4f4f4, 0x8e44ad, 0xb0b7bf, 0xe63946]);
          addCar(x0 + dx, y0 + dy, along, color);
        }
        addTyres(x0 + 4.45, y0 + 2.4, 4);
        add(point(x0 + 2.35, y0 + 2.4, 0.16), (p) => {
          for (const [bx, by] of [[0, 0], [0.22, 0.05], [0.1, 0.22]]) {
            p.box({ x: x0 + 2.25 + bx, y: y0 + 2.3 + by, w: 0.18, d: 0.18, h: 7 }, 0x2a6fdb);
          }
        });
        break;
      case 'playground':
        add({ x0: x0 + 0.4, y0: y0 + 2.95, x1: x0 + 2.4, y1: y0 + 4.55 }, (p) => playground(p, x0 + 0.4, y0 + 2.95));
        for (const [dx, dy] of [[0.7, 0.7], [1.6, 1.3], [0.6, 1.8], [3.3, 0.7], [4.2, 1.2], [3.5, 1.8], [3.3, 3.4], [4.3, 3.7], [3.6, 4.4], [4.4, 4.45]]) {
          addTree(x0 + dx, y0 + dy, 0.85 + rnd() * 0.35);
        }
        addBench(x0 + 1.4, y0 + 2.95 - 0.25, 'x');
        addBench(x0 + 2.95, y0 + 3.6, 'y');
        break;
      case 'river':
        add({ x0: x0 + 2.6, y0: y0 + 3.0, x1: x0 + 4.6, y1: y0 + 4.6 }, (p) => playground(p, x0 + 2.6, y0 + 3.0));
        for (const [dx, dy] of [[0.8, 0.6], [2.0, 0.7], [3.6, 0.6], [4.4, 0.9], [0.9, 3.6], [1.4, 4.4], [0.6, 4.5]]) {
          addTree(x0 + dx, y0 + dy, 0.9 + rnd() * 0.3);
        }
        addBench(x0 + 1.5, y0 + 2.9, 'x');
        addBench(x0 + 3.8, y0 + 2.75, 'x');
        break;
      default:
        break;
    }
  }

  const park = BLOCKS.find((b) => b.kind === 'park')!;
  for (const [x, y] of [[3.4, 0.8], [4.3, 1.2], [3.6, 1.7], [0.8, 3.3], [1.6, 4.2], [0.7, 4.3], [3.4, 3.3], [4.3, 3.6], [3.6, 4.3], [4.4, 4.4]]) {
    addTree(park.x0 + x, park.y0 + y, 0.95 + rnd() * 0.35);
  }
  addBench(park.x0 + 1.4, park.y0 + 2.95, 'x');
  addBench(park.x0 + 3.6, park.y0 + 2.05, 'x');
  addBench(park.x0 + 2.95, park.y0 + 1.2, 'y');
  addBench(park.x0 + 2.05, park.y0 + 3.7, 'y');

  add(point(8.5, 9.55, 0.8), (p) => fountain(p, 8.5, 9.55, 0.8));
  for (const x of [7.0, 10.0]) {
    add(point(x, 9.55, 0.35), (p) => {
      p.disc(x, 9.55, 0.36, 0x7a6a52);
      p.disc(x, 9.55, 0.3, 0x4f8f3a, 2);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const f = iso(x + Math.cos(a) * 0.17, 9.55 + Math.sin(a) * 0.17, 4);
        p.circle(f.x, f.y, 1.6, [0xe63946, 0xf4d35e, 0xffffff][k % 3]);
      }
    });
  }
  for (const x of [8.5, 7.3, 9.7]) {
    addBench(x, 10.5, 'x');
  }
  addTree(6.6, 10.4);
  addTree(10.4, 10.4);
  addTree(6.6, 8.9, 0.85);
  addTree(10.4, 8.9, 0.85);

  for (const block of BLOCKS) {
    for (const [x, y] of [[block.x0 + 0.14, block.y0 + 0.14], [block.x1 - 0.14, block.y0 + 0.14], [block.x0 + 0.14, block.y1 - 0.14], [block.x1 - 0.14, block.y1 - 0.14]]) {
      stamp(point(x, y, 0.05), 'lamp', x, y, (p) => lamp(p, 0, 0));
    }
  }

  add(BRIDGE, (p) => {
    const deck: Box = { x: BRIDGE.x0 - 0.06, y: BRIDGE.y0, w: BRIDGE.x1 - BRIDGE.x0 + 0.12, d: BRIDGE.y1 - BRIDGE.y0, h: 3 };
    p.box(deck, 0x8c8f94, ASPHALT);
    p.line(iso(BRIDGE.x0 + 0.5, BRIDGE.y0 + 0.15, 3), iso(BRIDGE.x0 + 0.5, BRIDGE.y1 - 0.15, 3), 0xeeeeee, 1.6, 0.8);
    for (const x of [deck.x, deck.x + deck.w]) {
      for (let y = BRIDGE.y0; y <= BRIDGE.y1 + 0.01; y += 0.25) {
        p.line(iso(x, y, 3), iso(x, y, 10), 0xd0d4da, 1.2);
      }
      p.line(iso(x, BRIDGE.y0, 10), iso(x, BRIDGE.y1, 10), 0xe6e9ee, 2);
    }
  });

  add(point(3.4, 5.22, 0.28), (p) => {
    car(p, 3.4, 5.22, 'x', 0xf4f4f4);
    const top = iso(3.4, 5.22, 11);
    p.circle(top.x - 2.5, top.y, 1.8, 0x2a6fdb);
    p.circle(top.x + 2.5, top.y, 1.8, 0xe63946);
  });

  const blocked = (x: number, y: number) =>
    inside(x, y, CITY.x0 - 0.4, CITY.y0 - 0.4, CITY.x1 + 0.4, CITY.y1 + 0.4) ||
    near(x, X_ROADS, 0.35) ||
    near(y, Y_ROADS, 0.35) ||
    (x < 0 && y > 6.4 && y < 9.2) ||
    inside(x, y, 0.0, 24.3, 5.1, 29.7) ||
    inside(x, y, 30.5, 5.8, 36.8, 11.4) ||
    inside(x, y, 17.3, 24.6, 19.1, 26.4) ||
    (Math.abs(x - ENTRANCE.gx) < 0.8 && Math.abs(y - ENTRANCE.gy) < 0.8);

  for (let i = 0; i < 320; i++) {
    const x = LOW + 0.4 + rnd() * (HIGH_X - LOW - 0.8);
    const y = LOW + 0.4 + rnd() * (HIGH_Y - LOW - 0.8);
    if (blocked(x, y)) {
      continue;
    }
    if (rnd() > 0.45) {
      const size = 0.95 + rnd() * 0.4;
      const s = Math.round(size * 20) / 20;
      stamp(point(x, y), `conifer:${s}`, x, y, (p) => conifer(p, 0, 0, s));
    } else {
      addTree(x, y, 1 + rnd() * 0.35);
    }
  }

  list.push({
    foot: point(ENTRANCE.gx, ENTRANCE.gy, 0.1),
    entrance: true,
    draw: (p) => {
      const foot = iso(ENTRANCE.gx, ENTRANCE.gy);
      p.line(foot, new Phaser.Math.Vector2(foot.x, foot.y - 34), 0x9aa1ad, 2);
    },
  });

  return list;
}

export function sortItems(list: Item[]) {
  const behind = (a: Foot, b: Foot) => a.x1 <= b.x0 + 0.001 || a.y1 <= b.y0 + 0.001;
  const order: Item[] = [];
  const state = new Map<Item, number>();
  const visit = (item: Item) => {
    if (state.get(item)) {
      return;
    }
    state.set(item, 1);
    for (const other of list) {
      if (other !== item && !state.get(other) && behind(other.foot, item.foot) && !behind(item.foot, other.foot)) {
        visit(other);
      }
    }
    order.push(item);
  };
  list.forEach(visit);
  return order;
}
