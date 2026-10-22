import Phaser from 'phaser';
import { random } from '../map/random';
import { BUILDINGS, residential, type BuildingDef } from './buildings';
import { bench, car, conifer, fountain, lamp, tree, type Painter } from './draw';
import { iso, type Box } from './iso';
import { banner, tyres, umbrella, type Foot } from './kit';

export const SIZE_X = 23;
export const SIZE_Y = 17;
export const MARGIN = 3;
export const LOW = -MARGIN;
export const HIGH_X = SIZE_X + MARGIN;
export const HIGH_Y = SIZE_Y + MARGIN;
export const ENTRANCE = { gx: SIZE_X + 1.6, gy: 4.55 };

const X_ROADS = [5, 11, 17];
const Y_ROADS = [5, 11];
const ASPHALT = 0x464a51;
const SIDEWALK = 0xb9b3a7;

export interface Item {
  foot: Foot;
  draw(p: Painter): void;
  building?: BuildingDef;
  entrance?: boolean;
}

type BlockKind = 'square' | 'park' | 'bank' | 'mall' | 'homes' | 'police' | 'sponsors' | 'black' | 'barshop' | 'market' | 'garage' | 'track';

interface Block extends Foot {
  kind: BlockKind;
}

const KINDS: BlockKind[][] = [
  ['police', 'bank', 'sponsors', 'homes'],
  ['park', 'square', 'mall', 'black'],
  ['barshop', 'market', 'garage', 'track'],
];

const BLOCKS: Block[] = KINDS.flatMap((row, j) => row.map((kind, i) => ({ x0: i * 6, y0: j * 6, x1: i * 6 + 5, y1: j * 6 + 5, kind })));

const SURFACE: Record<BlockKind, number> = {
  square: 0xd6ccb6,
  park: 0x6fa04a,
  bank: 0x74a24c,
  mall: 0xc5bfb3,
  homes: 0x74a24c,
  police: 0x74a24c,
  sponsors: 0x74a24c,
  black: 0x5f5b55,
  barshop: 0x74a24c,
  market: 0x74a24c,
  garage: 0x74a24c,
  track: 0x6fa04a,
};

const near = (v: number, roads: number[], pad = 0) => roads.some((r) => v > r - pad && v < r + 1 + pad);
const crossing = (t: number, len: number, roads: number[]) => roads.some((c) => t + len > c - 0.1 && t < c + 1.1);

export function drawGround(p: Painter) {
  const depth = 30;
  p.poly([iso(LOW, HIGH_Y), iso(HIGH_X, HIGH_Y), iso(HIGH_X, HIGH_Y, -depth), iso(LOW, HIGH_Y, -depth)], 0x6d5236);
  p.poly([iso(HIGH_X, HIGH_Y), iso(HIGH_X, LOW), iso(HIGH_X, LOW, -depth), iso(HIGH_X, HIGH_Y, -depth)], 0x4f3b27);
  p.tile(LOW, LOW, HIGH_X, HIGH_Y, 0x5e8e3d);

  const rnd = random(77);
  for (let i = 0; i < 340; i++) {
    const gx = LOW + rnd() * (HIGH_X - LOW);
    const gy = LOW + rnd() * (HIGH_Y - LOW);
    p.disc(gx, gy, 0.3 + rnd() * 0.6, rnd() > 0.5 ? 0x6b9c47 : 0x527f35, 0, 0.35);
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
      if (!crossing(t, 0.4, Y_ROADS)) {
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
    if (block.kind === 'park') {
      p.tile(inner.x0, block.y0 + 2.3, inner.x1, block.y0 + 2.7, 0xd9c79c);
      p.tile(block.x0 + 2.3, inner.y0, block.x0 + 2.7, inner.y1, 0xd9c79c);
      p.disc(block.x0 + 1.25, block.y0 + 1.25, 0.8, 0x9c9486);
      p.disc(block.x0 + 1.25, block.y0 + 1.25, 0.7, 0x3f8fc4);
      p.disc(block.x0 + 1.1, block.y0 + 1.1, 0.3, 0x6fb3e0, 0, 0.6);
    }
    if (block.kind === 'mall') {
      for (let t = inner.x0 + 0.3; t < inner.x1; t += 0.45) {
        p.line(iso(t, block.y1 - 0.75), iso(t, inner.y1), 0xffffff, 1, 0.5);
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
  const addTree = (x: number, y: number, size = 0.9 + rnd() * 0.3) => {
    const tone = Math.floor(rnd() * 3);
    add(point(x, y), (p) => tree(p, x, y, size, tone));
  };

  for (const def of BUILDINGS) {
    list.push({ foot: def.foot, draw: (p) => def.draw(p), building: def });
  }

  const colors = [0xd9b99b, 0xc9d1c0, 0xe0c9a6, 0xb8c4cf, 0xd8c3c3, 0xc7b8a1, 0xe3d5b8];
  const awnings = [0xe63946, 0x2a9d8f, 0xe9c46a, 0x457b9d];
  const addHome = (home: Box) => {
    const color = colors[Math.floor(rnd() * colors.length)];
    const awning = rnd() > 0.45 ? awnings[Math.floor(rnd() * awnings.length)] : undefined;
    add(boxFoot(home), (p) => residential(p, home, color, awning));
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
        [0xe63946, 0xf4d35e, 0x2a6fdb].forEach((color, i) => add(point(x0 + 2.55 + i * 0.75, y0 + 4.78, 0.08), (p) => banner(p, x0 + 2.55 + i * 0.75, y0 + 4.78, color)));
        break;
      case 'bank':
        addTree(x0 + 3.6, y0 + 0.9);
        addTree(x0 + 4.4, y0 + 1.6);
        break;
      case 'barshop':
        addHome({ x: x0 + 0.45, y: y0 + 3.25, w: 1.9, d: 1.4, h: Math.round(30 + rnd() * 16) });
        for (const [x, color] of [[0.9, 0xe63946], [1.85, 0x2a9d8f]] as const) {
          add(point(x0 + x, y0 + 2.75, 0.3), (p) => umbrella(p, x0 + x, y0 + 2.75, color));
        }
        for (const [x, y, n] of [[3.1, 2.95, 3], [3.45, 3.0, 2], [4.35, 2.9, 4]] as const) {
          add(point(x0 + x, y0 + y, 0.16), (p) => tyres(p, x0 + x, y0 + y, n));
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
        add(point(x0 + 3.0, y0 + 4.65, 0.28), (p) => car(p, x0 + 3.0, y0 + 4.65, 'x', 0xe63946));
        add(point(x0 + 4.45, y0 + 4.55, 0.16), (p) => tyres(p, x0 + 4.45, y0 + 4.55, 3));
        break;
      default:
        break;
    }
  }

  const park = BLOCKS.find((b) => b.kind === 'park')!;
  for (const [x, y] of [[3.4, 0.8], [4.3, 1.2], [3.6, 1.7], [0.8, 3.3], [1.6, 4.2], [0.7, 4.3], [3.4, 3.3], [4.3, 3.6], [3.6, 4.3], [4.4, 4.4], [2.0, 0.7], [0.75, 2.0]]) {
    addTree(park.x0 + x, park.y0 + y, 0.95 + rnd() * 0.35);
  }
  for (const [x, y, along] of [[1.4, 2.95, 'x'], [3.6, 2.05, 'x'], [2.95, 1.2, 'y'], [2.05, 3.7, 'y']] as const) {
    add(point(park.x0 + x, park.y0 + y, 0.22), (p) => bench(p, park.x0 + x, park.y0 + y, along));
  }

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
  for (const [x, y, along] of [[8.5, 10.5, 'x'], [7.3, 10.5, 'x'], [9.7, 10.5, 'x']] as const) {
    add(point(x, y, 0.22), (p) => bench(p, x, y, along));
  }
  addTree(6.6, 10.4);
  addTree(10.4, 10.4);
  addTree(6.6, 8.9, 0.85);
  addTree(10.4, 8.9, 0.85);

  for (const block of BLOCKS) {
    for (const [x, y] of [[block.x0 + 0.14, block.y0 + 0.14], [block.x1 - 0.14, block.y0 + 0.14], [block.x0 + 0.14, block.y1 - 0.14], [block.x1 - 0.14, block.y1 - 0.14]]) {
      add(point(x, y, 0.05), (p) => lamp(p, x, y));
    }
  }

  add(point(3.4, 5.22, 0.28), (p) => {
    car(p, 3.4, 5.22, 'x', 0xf4f4f4);
    const top = iso(3.4, 5.22, 11);
    p.circle(top.x - 2.5, top.y, 1.8, 0x2a6fdb);
    p.circle(top.x + 2.5, top.y, 1.8, 0xe63946);
  });

  const carColors = [0xe63946, 0x2a6fdb, 0xf4f4f4, 0x2b2d31, 0xf2b134, 0x4caf50, 0x8e44ad, 0xb0b7bf];
  for (let i = 0; i < 18; i++) {
    const vertical = rnd() > 0.55;
    const roads = vertical ? X_ROADS : Y_ROADS;
    const road = roads[Math.floor(rnd() * roads.length)];
    const span = vertical ? HIGH_Y : HIGH_X;
    let t = LOW + 0.6 + rnd() * (span - LOW - 1.2);
    if (crossing(t - 0.3, 0.6, vertical ? Y_ROADS : X_ROADS)) {
      t += 1.6;
    }
    if (!vertical && road === 5 && Math.abs(t - 3.4) < 0.8) {
      continue;
    }
    const lane = road + (rnd() > 0.5 ? 0.22 : 0.78);
    const color = carColors[Math.floor(rnd() * carColors.length)];
    const [x, y] = vertical ? [lane, t] : [t, lane];
    add(point(x, y, 0.28), (p) => car(p, x, y, vertical ? 'y' : 'x', color));
  }

  for (let i = 0; i < 130; i++) {
    const x = LOW + 0.4 + rnd() * (HIGH_X - LOW - 0.8);
    const y = LOW + 0.4 + rnd() * (HIGH_Y - LOW - 0.8);
    const core = x > -0.4 && x < SIZE_X + 0.4 && y > -0.4 && y < SIZE_Y + 0.4;
    if (core || near(x, X_ROADS, 0.35) || near(y, Y_ROADS, 0.35) || (Math.abs(x - ENTRANCE.gx) < 0.8 && Math.abs(y - ENTRANCE.gy) < 0.8)) {
      continue;
    }
    if (rnd() > 0.45) {
      const size = 0.95 + rnd() * 0.4;
      add(point(x, y), (p) => conifer(p, x, y, size));
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
