import Phaser from 'phaser';
import type { Painter } from './draw';
import { iso, type Box, type Vec } from './iso';
import { footOf, tyres, type BuildingDef } from './kit';

export type OwnStatus = '' | 'building' | 'open' | 'closed';

export const ownState = { status: '' as OwnStatus, progress: 0 };

export const OWN_BOX: Box = { x: 0.5, y: 24.8, w: 4.1, d: 4.4, h: 34 };
export const OWN_RING = { x: 2.55, y: 27.0, rx: 1.4, ry: 1.55 };
export const CRANE = { x: 0.95, y: 25.25, h: 78, jib: 3.3 };

export const ownBoard = () => iso(OWN_BOX.x + OWN_BOX.w / 2, OWN_BOX.y + OWN_BOX.d - 0.35, 26);

export function ringPoint(a: number, offset = 0): Vec {
  return new Phaser.Math.Vector2(OWN_RING.x + Math.cos(a) * (OWN_RING.rx + offset), OWN_RING.y + Math.sin(a) * (OWN_RING.ry + offset));
}

function ring(p: Painter, from: number, to: number, inner: number, outer: number, color: number) {
  const steps = Math.max(2, Math.ceil(((to - from) / (Math.PI * 2)) * 48));
  for (let i = 0; i < steps; i++) {
    const a0 = from + ((to - from) * i) / steps;
    const a1 = from + ((to - from) * (i + 1)) / steps;
    const pts = [ringPoint(a0, inner), ringPoint(a1, inner), ringPoint(a1, outer), ringPoint(a0, outer)];
    p.poly(pts.map((v) => iso(v.x, v.y)), color);
  }
}

function fence(p: Painter, x0: number, y0: number, x1: number, y1: number, site: boolean) {
  const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.5));
  for (let i = 0; i < steps; i++) {
    const ax = x0 + ((x1 - x0) * i) / steps;
    const ay = y0 + ((y1 - y0) * i) / steps;
    const bx = x0 + ((x1 - x0) * (i + 1)) / steps;
    const by = y0 + ((y1 - y0) * (i + 1)) / steps;
    if (site) {
      p.poly([iso(ax, ay, 0), iso(bx, by, 0), iso(bx, by, 10), iso(ax, ay, 10)], i % 2 ? 0xffffff : 0xf28c28, 0.95);
    }
    p.line(iso(ax, ay), iso(ax, ay, site ? 11 : 8), site ? 0x5b5f66 : 0x8a5a36, 1.5);
  }
  if (!site) {
    for (const z of [3.5, 7]) {
      p.line(iso(x0, y0, z), iso(x1, y1, z), 0xa06d45, 1.2);
    }
  }
}

function board(p: Painter, color: number, border: number) {
  const at = ownBoard();
  const foot = iso(OWN_BOX.x + OWN_BOX.w / 2, OWN_BOX.y + OWN_BOX.d - 0.35);
  for (const dx of [-26, 26]) {
    p.line(new Phaser.Math.Vector2(foot.x + dx, foot.y), new Phaser.Math.Vector2(at.x + dx, at.y), 0x8a5a36, 2.5);
  }
  p.rect(at.x - 42, at.y - 13, 84, 26, color);
  p.g.lineStyle(2, border, 1);
  p.g.strokeRect(at.x - 40, at.y - 11, 80, 22);
}

function track(p: Painter, faded: boolean) {
  ring(p, 0, Math.PI * 2, 0.32, 0.4, 0xd62612);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    ring(p, a, a + Math.PI / 16, 0.32, 0.4, 0xffffff);
  }
  ring(p, 0, Math.PI * 2, -0.32, 0.32, faded ? 0x5b5f66 : 0x3d4148);
  ring(p, 0, Math.PI * 2, -0.38, -0.32, 0xf2f2f2);
  const s0 = ringPoint(Math.PI / 2, -0.32);
  const s1 = ringPoint(Math.PI / 2, 0.32);
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4;
    const t1 = (i + 1) / 4;
    const lerp = (t: number) => new Phaser.Math.Vector2(s0.x + (s1.x - s0.x) * t, s0.y + (s1.y - s0.y) * t);
    const a = lerp(t0);
    const b = lerp(t1);
    p.poly([iso(a.x - 0.06, a.y), iso(a.x + 0.06, a.y), iso(b.x + 0.06, b.y), iso(b.x - 0.06, b.y)], i % 2 ? 0x15171c : 0xffffff);
  }
}

export const own: BuildingDef = {
  key: 'own',
  box: OWN_BOX,
  foot: footOf(OWN_BOX),
  top: 40,
  noPlate: true,
  draw(p) {
    const b = OWN_BOX;
    const { status, progress } = ownState;
    const site = status === 'building';
    p.tile(b.x, b.y, b.x + b.w, b.y + b.d, site ? 0x8f7451 : status === '' ? 0x9aa65a : 0x74a24c);

    if (status === '') {
      for (const [x, y, r] of [[1.3, 25.7, 0.5], [3.4, 26.4, 0.7], [2.0, 27.9, 0.6], [3.8, 28.4, 0.4]]) {
        p.disc(x, y, r, 0xb4b870, 0, 0.6);
      }
      p.disc(2.6, 26.9, 0.4, 0x8a7a50, 0, 0.5);
    }
    if (site) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        ring(p, a, a + Math.PI / 24, -0.36, 0.36, 0xa88a62);
      }
      if (progress > 0) {
        ring(p, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * Math.min(1, progress), -0.32, 0.32, 0x3d4148);
      }
      for (const [x, y] of [[3.9, 25.4], [1.1, 28.6]]) {
        p.disc(x, y, 0.42, 0x6e5537);
        p.disc(x - 0.05, y - 0.05, 0.28, 0x8a6a45, 4);
      }
      p.box({ x: 3.5, y: 28.3, w: 0.9, d: 0.6, h: 12 }, 0xd9dde2);
      p.left({ x: 3.5, y: 28.3, w: 0.9, d: 0.6, h: 12 }, 0.2, 0.45, 5, 9, 0x4a6a85);
      for (let i = 0; i < 3; i++) {
        p.box({ x: 1.6 + i * 0.05, y: 25.3, w: 0.5, d: 0.35, z: i * 2.5, h: 2.5 }, i % 2 ? 0xa06d45 : 0xc48c58);
      }
      const base = iso(CRANE.x, CRANE.y);
      p.ellipse(base.x + 3, base.y + 1, 10, 4, 0x000000, 0.2);
      p.box({ x: CRANE.x - 0.12, y: CRANE.y - 0.12, w: 0.24, d: 0.24, h: CRANE.h }, 0xf4c430, 0xf4c430);
      for (let z = 6; z < CRANE.h; z += 6) {
        p.line(iso(CRANE.x - 0.12, CRANE.y + 0.12, z), iso(CRANE.x + 0.12, CRANE.y + 0.12, z + 6), 0xa8841a, 1);
      }
      p.line(iso(CRANE.x - 0.9, CRANE.y, CRANE.h), iso(CRANE.x + CRANE.jib, CRANE.y, CRANE.h), 0xf4c430, 3);
      p.box({ x: CRANE.x - 0.95, y: CRANE.y - 0.15, w: 0.4, d: 0.3, z: CRANE.h - 6, h: 6 }, 0x8a9099);
      p.box({ x: CRANE.x + 0.12, y: CRANE.y - 0.15, w: 0.3, d: 0.3, z: CRANE.h - 8, h: 7 }, 0xe8edf2);
    }
    if (status === 'open' || status === 'closed') {
      track(p, status === 'closed');
      p.box({ x: 3.85, y: 25.0, w: 0.7, d: 0.5, h: 14 }, 0xd9dde2);
      p.left({ x: 3.85, y: 25.0, w: 0.7, d: 0.5, h: 14 }, 0.1, 0.6, 0, 9, 0x2d3a48);
      tyres(p, 0.75, 25.1, 3);
      tyres(p, 4.35, 28.9, 2);
      if (status === 'closed') {
        const a = ringPoint(Math.PI, -0.4);
        const c = ringPoint(Math.PI, 0.4);
        for (const v of [a, c]) {
          p.line(iso(v.x, v.y), iso(v.x, v.y, 8), 0x5b5f66, 1.5);
        }
        p.poly([iso(a.x, a.y, 6), iso(c.x, c.y, 6), iso(c.x, c.y, 9), iso(a.x, a.y, 9)], 0xd62612);
      }
    }

    fence(p, b.x, b.y, b.x + b.w, b.y, site);
    fence(p, b.x, b.y, b.x, b.y + b.d, site);
    if (status === '') {
      board(p, 0xffffff, 0xd62612);
    } else if (site) {
      board(p, 0xf4d35e, 0x15171c);
    } else {
      board(p, status === 'open' ? 0x2a9d8f : 0xd62612, 0xffffff);
    }
    fence(p, b.x, b.y + b.d, b.x + b.w, b.y + b.d, site);
    fence(p, b.x + b.w, b.y, b.x + b.w, b.y + b.d, site);
  },
  signs: () => [],
};

export function ownSign(): { text: string; color: string } {
  switch (ownState.status) {
    case 'building':
      return { text: `СТРОИ СЕ ${Math.round(ownState.progress * 100)}%`, color: '#15171c' };
    case 'open':
      return { text: 'ТВОЯТА ПИСТА', color: '#ffffff' };
    case 'closed':
      return { text: 'ЗАТВОРЕНО', color: '#ffffff' };
    default:
      return { text: 'ПРОДАВА СЕ', color: '#d62612' };
  }
}
