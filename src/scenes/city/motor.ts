import Phaser from 'phaser';
import { car, conifer, type Painter } from './draw';
import { iso, type Box, type Vec } from './iso';
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

// Официалната писта временно не е на картата, докато се тества изгледът на града: вместо нея има пътна табела (officialSign).
// Рисунката се пази, за да може да се върне по-късно.
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

const OFFICIAL = { gx: 18.2, gy: 25.5 };
const officialBox: Box = { x: OFFICIAL.gx - 1.3, y: OFFICIAL.gy - 1.3, w: 2.6, d: 2.6, h: 66 };
const officialBoard = () => iso(OFFICIAL.gx, OFFICIAL.gy, 52);

export const officialSign: BuildingDef = {
  key: 'track',
  box: officialBox,
  foot: { x0: OFFICIAL.gx - 0.2, y0: OFFICIAL.gy - 0.2, x1: OFFICIAL.gx + 0.2, y1: OFFICIAL.gy + 0.2 },
  top: 74,
  noPlate: true,
  draw(p) {
    const foot = iso(OFFICIAL.gx, OFFICIAL.gy);
    const at = officialBoard();
    const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
    p.ellipse(foot.x + 4, foot.y + 1, 46, 7, 0x000000, 0.18);
    for (const dx of [-40, 44]) {
      p.line(v(foot.x + dx, foot.y), v(at.x + dx, at.y + 18), 0x9aa1ad, 3);
    }
    p.poly([v(at.x - 102, at.y), v(at.x - 80, at.y - 19), v(at.x + 94, at.y - 19), v(at.x + 94, at.y + 19), v(at.x - 80, at.y + 19)], 0x1f5fbf);
    p.stroke([v(at.x - 96, at.y), v(at.x - 78, at.y - 15.5), v(at.x + 90.5, at.y - 15.5), v(at.x + 90.5, at.y + 15.5), v(at.x - 78, at.y + 15.5)], 0xffffff, 2);
  },
  signs: () => [{ text: 'Официална писта', at: officialBoard().add(new Phaser.Math.Vector2(6, 0)), size: 15, color: '#ffffff' }],
};

const LOOP = { x: 33.6, y: 8.8, rx: 2.3, ry: 1.8 };

function loopPoints(offset: number): Vec[] {
  const points: Vec[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rx = LOOP.rx * (1 + 0.08 * Math.sin(3 * a)) + offset;
    const ry = LOOP.ry * (1 + 0.06 * Math.cos(2 * a)) + offset;
    points.push(new Phaser.Math.Vector2(LOOP.x + Math.cos(a) * rx, LOOP.y + Math.sin(a) * ry));
  }
  return points;
}

function band(p: Painter, inner: Vec[], outer: Vec[], color: number) {
  for (let i = 0; i < inner.length - 1; i++) {
    p.poly([iso(inner[i].x, inner[i].y), iso(inner[i + 1].x, inner[i + 1].y), iso(outer[i + 1].x, outer[i + 1].y), iso(outer[i].x, outer[i].y)], color);
  }
}

const blackBox: Box = { x: 30.9, y: 6.4, w: 5.4, d: 4.8, h: 8 };

export const black: BuildingDef = {
  key: 'black',
  box: blackBox,
  foot: { x0: blackBox.x, y0: 6.0, x1: blackBox.x + blackBox.w, y1: blackBox.y + blackBox.d },
  top: 44,
  draw(p) {
    p.tile(33.3, 6.0, 33.9, 7.1, 0x6a4c31);
    band(p, loopPoints(-0.42), loopPoints(0.42), 0x5e4430);
    band(p, loopPoints(-0.32), loopPoints(0.32), 0x7b5b3b);
    for (const offset of [-0.13, 0.13]) {
      const rut = loopPoints(offset);
      for (let i = 0; i < rut.length - 1; i++) {
        p.line(iso(rut[i].x, rut[i].y), iso(rut[i + 1].x, rut[i + 1].y), 0x5a4129, 1.4, 0.8);
      }
    }
    for (const a of [0.4, 2.2, 3.9, 5.3]) {
      p.disc(LOOP.x + Math.cos(a) * LOOP.rx, LOOP.y + Math.sin(a) * LOOP.ry, 0.16, 0x4b4b3a, 0, 0.75);
    }
    for (const [x, y] of [[32.2, 8.6], [34.8, 9.3], [33.4, 8.0]]) {
      p.disc(x, y, 0.35, 0x8a7a50, 0, 0.6);
    }
    for (const [x, y] of [[31.0, 7.2], [36.2, 9.6], [32.0, 10.9], [35.4, 7.0]]) {
      p.box({ x, y, w: 0.22, d: 0.16, h: 4 }, 0x8c8f94);
    }
    tyres(p, 30.95, 9.0, 2);
    tyres(p, 36.35, 8.3, 3);
    conifer(p, 33.6, 8.9, 1.1);
  },
  signs: () => [],
};
