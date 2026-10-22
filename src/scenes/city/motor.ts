import { car, lamp } from './draw';
import { iso, type Box } from './iso';
import { banner, footOf, ribs, tyres, type BuildingDef } from './kit';

const garageBox: Box = { x: 14.35, y: 14.3, w: 2.3, d: 2.1, h: 28 };

export const garage: BuildingDef = {
  key: 'garage',
  box: garageBox,
  foot: footOf(garageBox, 0.2),
  top: 70,
  draw(p) {
    const b = garageBox;
    p.box(b, 0x7d8fa3, 0x66778a);
    ribs(p, b, 0x4f5d6c);
    p.left(b, 0.3, 1.65, 0, 20, 0xa9b4c0);
    for (let z = 2; z < 20; z += 2) {
      p.left(b, 0.3, 1.65, z, z + 0.4, 0x7f8a96);
    }
    p.left(b, 1.85, 2.15, 0, 11, 0x2d3a48);
    p.left(b, 0.3, 1.65, 21.5, 26, 0x15171c);
    p.right(b, 0.4, 1.7, 14, 20, 0x9cc3db);
    for (const x of [0.5, 1.4]) {
      p.box({ x: b.x + x, y: b.y + 0.6, w: 0.5, d: 0.7, z: b.h, h: 1.5 }, 0x9cc3db);
    }
  },
  signs: () => [{ text: 'ГАРАЖ', at: iso(garageBox.x + 0.975, garageBox.y + garageBox.d, 23.8), size: 8, color: '#f4d35e' }],
};

const trackBox: Box = { x: 18.3, y: 12.3, w: 4.4, d: 4.4, h: 24 };
const RING = { x: 20.5, y: 14.85, out: 1.85, in: 1.2 };

export const track: BuildingDef = {
  key: 'track',
  box: trackBox,
  foot: footOf(trackBox),
  top: 64,
  draw(p) {
    const r = RING;
    p.disc(r.x, r.y, r.out + 0.09, 0xd62612);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
      p.disc(r.x + Math.cos(a) * (r.out + 0.05), r.y + Math.sin(a) * (r.out + 0.05), 0.06, 0xffffff);
    }
    p.disc(r.x, r.y, r.out, 0x3d4148);
    p.disc(r.x, r.y, r.in + 0.06, 0xf2f2f2);
    p.disc(r.x, r.y, r.in, 0x6fa04a);
    p.disc(r.x - 0.2, r.y - 0.15, 0.45, 0x7fb256, 0, 0.7);
    const dir = Math.SQRT1_2;
    for (let i = 0; i < 4; i++) {
      const d0 = r.in + 0.06 + (i * (r.out - r.in - 0.06)) / 4;
      const d1 = r.in + 0.06 + ((i + 1) * (r.out - r.in - 0.06)) / 4;
      p.poly([
        iso(r.x + dir * d0 - 0.05, r.y + dir * d0 + 0.05),
        iso(r.x + dir * d1 - 0.05, r.y + dir * d1 + 0.05),
        iso(r.x + dir * d1 + 0.05, r.y + dir * d1 - 0.05),
        iso(r.x + dir * d0 + 0.05, r.y + dir * d0 - 0.05),
      ], i % 2 ? 0x15171c : 0xffffff);
    }

    const stand = { x: 18.55, y: 12.32, w: 3.9 };
    const crowd = [0xe63946, 0xf4d35e, 0x2a6fdb, 0xffffff, 0x4caf50, 0xf28c28];
    [[0.56, 4], [0.38, 8], [0.2, 12]].forEach(([d, h], tier) => {
      p.box({ x: stand.x, y: stand.y, w: stand.w, d, h }, 0xb7bec7, 0xd0d5db);
      for (let x = stand.x + 0.08; x < stand.x + stand.w - 0.05; x += 0.13) {
        const head = iso(x, stand.y + d - 0.06, h + 2);
        p.circle(head.x, head.y, 1.7, crowd[Math.floor((x * 7 + tier * 3) % crowd.length)]);
      }
    });
    for (const x of [stand.x + 0.05, stand.x + stand.w / 2, stand.x + stand.w - 0.05]) {
      p.line(iso(x, stand.y + 0.05, 0), iso(x, stand.y + 0.05, 24), 0x8a9099, 1.6);
    }
    p.box({ x: stand.x - 0.05, y: stand.y - 0.05, w: stand.w + 0.1, d: 0.65, z: 24, h: 1.6 }, 0xe63946);

    car(p, r.x, r.y + (r.in + r.out) / 2, 'x', 0x2a6fdb);
    car(p, r.x + (r.in + r.out) / 2, r.y - 0.25, 'y', 0xf4d35e);
    banner(p, 18.45, 16.55, 0xe63946);
    banner(p, 22.55, 16.55, 0x2a6fdb);
    banner(p, 22.55, 12.6, 0xf4d35e);
  },
  signs: () => [],
};

const blackBox: Box = { x: 18.3, y: 6.3, w: 4.4, d: 4.4, h: 34 };

export const black: BuildingDef = {
  key: 'black',
  box: blackBox,
  foot: footOf(blackBox),
  top: 74,
  draw(p) {
    const b = blackBox;
    p.tile(b.x, b.y, b.x + b.w, b.y + b.d, 0x5f5b55);
    for (const [x, y, r] of [[19.4, 10.2, 0.35], [21.6, 8.7, 0.25], [20.2, 7.9, 0.3], [22.2, 10.1, 0.2]]) {
      p.disc(x, y, r, 0x111214, 0, 0.35);
    }
    p.tile(18.4, 8.95, 22.6, 9.85, 0x34373c);
    for (const y of [9.2, 9.6]) {
      for (let x = 18.8; x < 21.8; x += 0.5) {
        p.line(iso(x, y + Math.sin(x * 3) * 0.04), iso(x + 0.5, y + Math.sin((x + 0.5) * 3) * 0.04), 0x15161a, 2, 0.6);
      }
    }
    p.line(iso(18.95, 8.95), iso(18.95, 9.85), 0xffffff, 2);
    for (let i = 0; i < 6; i++) {
      p.tile(22.25, 8.95 + i * 0.15, 22.4, 9.1 + i * 0.15, i % 2 ? 0x15171c : 0xffffff);
    }

    const shed: Box = { x: 18.45, y: 6.45, w: 2.3, d: 1.9, h: 34 };
    p.box(shed, 0x6f7d8c, 0x5a6573);
    ribs(p, shed, 0x47515c);
    p.left(shed, 0.2, 0.95, 3, 13, 0xe63946, 0.85);
    p.left(shed, 0.75, 1.55, 6, 16, 0xf4d35e, 0.8);
    p.left(shed, 1.4, 2.1, 2, 11, 0x2a9d8f, 0.85);
    p.right(shed, 0.3, 0.9, 4, 12, 0xff4fd8, 0.8);
    p.right(shed, 0.8, 1.6, 2, 9, 0x4caf50, 0.75);

    const store: Box = { x: 21.1, y: 6.45, w: 1.5, d: 1.4, h: 24 };
    p.box(store, 0x9a5b3c, 0x7c4a31);
    ribs(p, store, 0x6a3e29);
    p.right(store, 0.2, 0.9, 3, 12, 0xf4d35e, 0.75);
    p.box({ x: 21.1, y: 8.05, w: 1.3, d: 0.5, h: 10 }, 0xb33a2e);
    p.box({ x: 21.1, y: 8.05, w: 1.3, d: 0.5, z: 10, h: 10 }, 0x2f5f9a);
    for (const [x, y] of [[19.05, 8.45], [19.3, 8.5], [19.17, 8.25]]) {
      p.box({ x, y, w: 0.18, d: 0.18, h: 7 }, 0xd9822b);
    }
    tyres(p, 20.4, 8.45, 3);

    const lights = iso(18.75, 8.8);
    p.line(lights, iso(18.75, 8.8, 26), 0x30343b, 2);
    [0xe63946, 0xf4d35e, 0x4caf50].forEach((color, i) => {
      const at = iso(18.75, 8.8, 25 - i * 5);
      p.circle(at.x + 3, at.y, 2.2, color);
    });
    lamp(p, 22.5, 8.55);

    const fence = b.y + b.d - 0.12;
    for (let x = b.x + 0.05; x <= b.x + b.w; x += 0.55) {
      p.line(iso(x, fence), iso(x, fence, 14), 0x8a9099, 1.4);
    }
    for (const z of [4, 9, 14]) {
      p.line(iso(b.x + 0.05, fence, z), iso(b.x + b.w, fence, z), 0xaab1bb, 1, 0.6);
    }
  },
  signs: () => [],
};
