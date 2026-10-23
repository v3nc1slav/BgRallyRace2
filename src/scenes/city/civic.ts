import Phaser from 'phaser';
import { t } from '../../i18n';
import { flag } from './draw';
import { iso, type Box } from './iso';
import { GLASS, columns, footOf, steps, type BuildingDef } from './kit';

const hallBox: Box = { x: 6.5, y: 6.35, w: 4, d: 1.5, h: 58 };
const hallTower: Box = { x: 8.05, y: 6.6, w: 0.9, d: 0.9, z: 62, h: 34 };

export const hall: BuildingDef = {
  key: 'hall',
  box: hallBox,
  foot: footOf(hallBox, 0.75),
  top: 150,
  draw(p) {
    const b = hallBox;
    const stone = 0xe4d6b5;
    p.box(b, stone, 0xc9bb98);
    p.left(b, 0, b.w, 0, 7, 0xa39679);
    p.right(b, 0, b.d, 0, 7, 0xa39679);
    p.windows(b, [14, 36], 14, 0.26, 0.24, GLASS);
    p.box({ x: b.x - 0.06, y: b.y - 0.06, w: b.w + 0.12, d: b.d + 0.12, z: b.h, h: 4 }, 0xf1e7cf);

    const t = hallTower;
    p.box({ x: t.x - 0.1, y: t.y - 0.1, w: t.w + 0.2, d: t.d + 0.2, z: b.h + 4, h: 4 }, 0xf1e7cf);
    p.box(t, stone);
    p.windows(t, [8], 10, 0.2, 0.2, GLASS);
    const clock = iso(t.x + t.w / 2, t.y + t.d, (t.z ?? 0) + 24);
    p.circle(clock.x, clock.y, 6.5, 0xfdfaf2);
    p.line(clock, new Phaser.Math.Vector2(clock.x, clock.y - 4.5), 0x1b1f24, 1.4);
    p.line(clock, new Phaser.Math.Vector2(clock.x + 3.5, clock.y + 1), 0x1b1f24, 1.4);
    const top = (t.z ?? 0) + t.h;
    const apex = iso(t.x + t.w / 2, t.y + t.d / 2, top + 20);
    p.poly([iso(t.x, t.y + t.d, top), iso(t.x + t.w, t.y + t.d, top), apex], 0x9a4434);
    p.poly([iso(t.x + t.w, t.y + t.d, top), iso(t.x + t.w, t.y, top), apex], 0x73311f);
    flag(p, apex, 24);

    const front = b.y + b.d;
    p.left(b, 1.45, 2.55, 7, 30, 0x5a3f2b);
    steps(p, 7.6, front, 1.8, 0xcfc4ad);
    columns(p, 7.78, front + 0.3, 4, 0.44, 5, 40, 0xf6efdf);
    const slab: Box = { x: 7.68, y: front, w: 1.64, d: 0.48, z: 40, h: 5 };
    p.box(slab, 0xf1e7cf);
    p.pediment(slab, 0, slab.w, slab.h, 13, 0xf1e7cf);
  },
  signs: () => [],
};

const bankBox: Box = { x: 6.5, y: 1.1, w: 2.5, d: 2.5, h: 74 };

export const bank: BuildingDef = {
  key: 'bank',
  box: bankBox,
  foot: footOf(bankBox, 0.75),
  top: 128,
  draw(p) {
    const b = bankBox;
    p.box(b, 0xece7dc, 0xd2ccc0);
    p.left(b, 0, b.w, 0, 8, 0x8f8a80);
    p.right(b, 0, b.d, 0, 8, 0x8f8a80);
    for (let u = 0.12; u < b.w - 0.05; u += 0.45) {
      p.left(b, u, u + 0.08, 8, 68, 0xfbf8f1);
      p.right(b, u, u + 0.08, 8, 68, 0xfbf8f1);
    }
    p.windows(b, [40, 54], 10, 0.2, 0.25, GLASS);
    p.glow(p.right(b, 0.3, b.d - 0.3, 14, 30, GLASS), 0.6, true);
    for (let u = 0.3; u < b.d - 0.35; u += 0.45) {
      p.right(b, u + 0.2, u + 0.26, 14, 30, 0xfbf8f1);
    }
    p.box({ x: b.x - 0.06, y: b.y - 0.06, w: b.w + 0.12, d: b.d + 0.12, z: b.h - 6, h: 6 }, 0xfbf8f1);
    p.box({ x: b.x + 1.6, y: b.y + 0.5, w: 0.06, d: 0.06, z: b.h, h: 22 }, 0x8a9099, 0x8a9099, false);

    const front = b.y + b.d;
    p.left(b, 0.85, 1.65, 8, 28, 0x4a3a2a);
    steps(p, b.x + 0.45, front, 1.6, 0xb9b2a5);
    columns(p, b.x + 0.58, front + 0.3, 4, 0.4, 5, 34, 0xfbf8f1);
    const slab: Box = { x: b.x + 0.48, y: front, w: 1.52, d: 0.46, z: 34, h: 5 };
    p.box(slab, 0xfbf8f1);
    p.pediment(slab, 0, slab.w, slab.h, 12, 0xfbf8f1);
    const emblem = iso(slab.x + slab.w / 2, front, 34 + 5 + 4.5);
    p.circle(emblem.x, emblem.y, 4.5, 0xd4a73a);
  },
  signs: () => [{ text: t('city.sign.bank'), at: iso(bankBox.x + bankBox.w / 2, bankBox.y + bankBox.d, bankBox.h - 3), size: 11, color: '#b8892a' }],
};

const policeBox: Box = { x: 2.6, y: 2.55, w: 2.1, d: 1.85, h: 42 };

export const police: BuildingDef = {
  key: 'police',
  box: policeBox,
  foot: footOf(policeBox, 0.4),
  top: 92,
  draw(p) {
    const b = policeBox;
    const blue = 0x1f4e9c;
    p.box(b, 0xf2f4f7, 0xd5d9df);
    p.left(b, 0, b.w, 0, 5, 0x9aa1ad);
    p.right(b, 0, b.d, 0, 5, 0x9aa1ad);
    p.windows(b, [11, 31], 8, 0.22, 0.2, GLASS);
    p.left(b, 0, b.w, 23, 28, blue);
    p.right(b, 0, b.d, 23, 28, blue);
    p.left(b, 0.85, 1.3, 0, 10, 0x1d2a35);
    p.box({ x: b.x + 0.72, y: b.y + b.d, w: 0.72, d: 0.4, z: 10.5, h: 2 }, blue);
    p.box({ x: b.x + 0.8, y: b.y + 0.7, w: 0.4, d: 0.22, z: b.h, h: 3 }, 0x30343b);
    const light = iso(b.x + 1.0, b.y + 0.81, b.h + 5);
    p.circle(light.x - 3, light.y, 2.6, 0xe63946);
    p.circle(light.x + 3, light.y, 2.6, 0x2a6fdb);
    p.line(iso(b.x + 1.7, b.y + 0.4, b.h), iso(b.x + 1.7, b.y + 0.4, b.h + 20), 0x8a9099, 1.2);
  },
  signs: () => [{ text: t('city.sign.police'), at: iso(policeBox.x + policeBox.w / 2, policeBox.y + policeBox.d, 25.5), size: 9, color: '#ffffff' }],
};

const jobsBox: Box = { x: 9.25, y: 2.5, w: 1.4, d: 1.75, h: 32 };

export const jobs: BuildingDef = {
  key: 'jobs',
  box: jobsBox,
  foot: footOf(jobsBox),
  top: 72,
  draw(p) {
    const b = jobsBox;
    p.box(b, 0xe8d9a8, 0xcbbd8e);
    p.glow(p.left(b, 0.12, b.w - 0.12, 1, 8, 0x4a6a85), 1, true);
    p.glow(p.right(b, 0.12, b.d - 0.12, 1, 8, 0x4a6a85), 0.8, true);
    p.left(b, 0.55, 0.85, 0, 8, 0x1d2a35);
    p.left(b, 0.06, b.w - 0.06, 8.5, 12.5, 0x2a9d8f);
    p.right(b, 0.06, b.d - 0.06, 8.5, 12.5, 0x2a9d8f);
    p.windows(b, [16, 24], 5.5, 0.2, 0.18, GLASS);
  },
  signs: () => [{ text: t('city.sign.jobs'), at: iso(jobsBox.x + jobsBox.w / 2, jobsBox.y + jobsBox.d, 10.5), size: 7, color: '#ffffff' }],
};
