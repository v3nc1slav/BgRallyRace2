import Phaser from 'phaser';
import { billboard, type Painter } from './draw';
import { iso, type Box } from './iso';
import { footOf, type BuildingDef } from './kit';

const mallBox: Box = { x: 12.35, y: 6.35, w: 4.3, d: 3.9, h: 46 };

export const mall: BuildingDef = {
  key: 'mall',
  box: mallBox,
  foot: footOf(mallBox, 0.5),
  top: 108,
  draw(p) {
    const b = mallBox;
    const glass = 0x4d9cc6;
    p.box(b, 0xd6dbe1, 0xb7bec7);
    p.left(b, 0.2, b.w - 0.2, 1, 9, 0x2d4a5e);
    p.right(b, 0.2, b.d - 0.2, 1, 9, 0x2d4a5e);
    p.left(b, 0.25, b.w - 0.25, 12, 42, glass);
    p.right(b, 0.25, b.d - 0.25, 12, 42, glass);
    for (let u = 0.25; u < b.w - 0.3; u += 0.43) {
      p.left(b, u, u + 0.035, 12, 42, 0xe8edf2);
      p.right(b, u, u + 0.035, 12, 42, 0xe8edf2);
    }
    p.left(b, 0.25, b.w - 0.25, 26, 27.5, 0xe8edf2);
    p.right(b, 0.25, b.d - 0.25, 26, 27.5, 0xe8edf2);
    for (const u of [0.7, 2.4, 3.3]) {
      p.left(b, u, u + 0.3, 12, 42, 0xbfe6fa, 0.35);
    }
    for (const u of [1.1, 2.9]) {
      p.right(b, u, u + 0.3, 12, 42, 0xbfe6fa, 0.25);
    }
    p.left(b, 1.75, 2.55, 0, 9, 0x1d2a35);
    p.box({ x: b.x + 1.6, y: b.y + b.d, w: 1.1, d: 0.5, z: 10, h: 2 }, 0xe63946);
    p.box({ x: b.x + 0.4, y: b.y + 0.5, w: 0.55, d: 0.45, z: b.h, h: 5 }, 0xa7afba);
    p.box({ x: b.x + 1.2, y: b.y + 0.5, w: 0.55, d: 0.45, z: b.h, h: 5 }, 0xa7afba);
    p.box({ x: b.x + 0.5, y: b.y + 1.4, w: 1.2, d: 0.9, z: b.h, h: 8 }, 0xc4cbd3);
    billboard(p, iso(b.x + b.w * 0.6, b.y + b.d * 0.62, b.h + 30), 112, 34, 0xe63946);
  },
  signs: () => [{ text: 'МОЛ', at: iso(mallBox.x + mallBox.w * 0.6, mallBox.y + mallBox.d * 0.62, mallBox.h + 30), size: 26, color: '#ffffff' }],
};

const towerBox: Box = { x: 14.3, y: 2.45, w: 2.0, d: 2.0, h: 120 };

export const sponsors: BuildingDef = {
  key: 'sponsors',
  box: towerBox,
  foot: footOf(towerBox),
  top: 162,
  draw(p) {
    const b = towerBox;
    p.box(b, 0x2f5d73, 0x264b5d);
    p.left(b, 0.08, b.w - 0.08, 7, b.h - 6, 0x3f7f9c);
    p.right(b, 0.08, b.d - 0.08, 7, b.h - 6, 0x3f7f9c);
    for (let u = 0.25; u < b.w - 0.1; u += 0.25) {
      p.left(b, u, u + 0.02, 7, b.h - 6, 0x9ccde2, 0.55);
      p.right(b, u, u + 0.02, 7, b.h - 6, 0x9ccde2, 0.55);
    }
    for (let z = 16; z < b.h - 6; z += 9) {
      p.left(b, 0.08, b.w - 0.08, z, z + 0.8, 0x9ccde2, 0.5);
      p.right(b, 0.08, b.d - 0.08, z, z + 0.8, 0x9ccde2, 0.5);
    }
    p.left(b, 0.3, 0.75, 7, b.h - 6, 0xd5eef8, 0.22);
    p.right(b, 1.1, 1.4, 7, b.h - 6, 0xd5eef8, 0.15);
    p.left(b, 0.6, 1.4, 0, 7, 0xd9e7ee);
    const crown: Box = { x: b.x + 0.12, y: b.y + 0.12, w: b.w - 0.24, d: b.d - 0.24, z: b.h, h: 12 };
    p.box(crown, 0xe2e8ec, 0xc9d1d7);
    [0xe63946, 0xf4d35e, 0x2a6fdb].forEach((color, i) => {
      p.left(crown, 0.15 + i * 0.55, 0.55 + i * 0.55, 2.5, 9.5, color);
      p.right(crown, 0.15 + i * 0.55, 0.55 + i * 0.55, 2.5, 9.5, color);
    });
  },
  signs: () => [],
};

const barBox: Box = { x: 0.45, y: 12.45, w: 2.0, d: 1.7, h: 30 };

export const bar: BuildingDef = {
  key: 'bar',
  box: barBox,
  foot: footOf(barBox, 0.3),
  top: 74,
  draw(p) {
    const b = barBox;
    p.box(b, 0x9b4a3a, 0x6f3a30);
    for (let z = 3; z < b.h; z += 3) {
      p.left(b, 0, b.w, z, z + 0.5, 0x5c2a20, 0.35);
      p.right(b, 0, b.d, z, z + 0.5, 0x5c2a20, 0.35);
    }
    p.windows(b, [17], 7, 0.24, 0.22, 0xf2c46d);
    p.left(b, 0.15, 0.85, 2, 9, 0xf2c46d);
    p.right(b, 0.2, b.d - 0.2, 2, 9, 0xf2c46d);
    p.left(b, 1.05, 1.45, 0, 10, 0x3a2418);
    p.box({ x: b.x + 0.08, y: b.y + b.d, w: b.w - 0.16, d: 0.3, z: 10, h: 1.5 }, 0x1f5b3e);
    const neon = iso(b.x + b.w * 0.5, b.y + b.d, 24);
    p.rect(neon.x - 19, neon.y - 8, 38, 16, 0x15171c);
    p.edge([
      new Phaser.Math.Vector2(neon.x - 19, neon.y - 8),
      new Phaser.Math.Vector2(neon.x + 19, neon.y - 8),
      new Phaser.Math.Vector2(neon.x + 19, neon.y + 8),
      new Phaser.Math.Vector2(neon.x - 19, neon.y + 8),
    ], 1, 1);
  },
  signs: () => [{ text: 'БАР', at: iso(barBox.x + barBox.w * 0.5, barBox.y + barBox.d, 24), size: 12, color: '#ff4fd8' }],
};

const shopBox: Box = { x: 2.75, y: 12.45, w: 1.95, d: 2.2, h: 26 };

export const shop: BuildingDef = {
  key: 'shop',
  box: shopBox,
  foot: footOf(shopBox),
  top: 82,
  draw(p) {
    const b = shopBox;
    const orange = 0xf28c28;
    p.box(b, 0xc9cdd2, 0xaeb3ba);
    p.left(b, 0.12, b.w - 0.12, 2, 14, 0x4a6a85);
    p.right(b, 0.12, b.d - 0.12, 2, 14, 0x4a6a85);
    for (let u = 0.5; u < b.w - 0.2; u += 0.5) {
      p.left(b, u, u + 0.04, 2, 14, 0xd9dde2);
    }
    p.left(b, 0.8, 1.2, 0, 12, 0x1d2a35);
    p.left(b, 0, b.w, 16.5, 22, orange);
    p.right(b, 0, b.d, 16.5, 22, orange);
    const board = iso(b.x + b.w / 2, b.y + b.d / 2, b.h + 22);
    billboard(p, board, 58, 26, orange);
    p.circle(board.x, board.y, 9, 0x1c1d20);
    p.circle(board.x, board.y, 4, 0x9aa1ad);
  },
  signs: () => [{ text: 'АВТОЧАСТИ', at: iso(shopBox.x + shopBox.w / 2, shopBox.y + shopBox.d, 19.3), size: 7, color: '#ffffff' }],
};

const marketBox: Box = { x: 6.4, y: 12.4, w: 4.2, d: 2.6, h: 20 };
const STALLS = [0xe63946, 0x2a9d8f, 0xf4d35e, 0x457b9d, 0xf28c28, 0x8e44ad, 0x4caf50, 0xd62612];

function stall(p: Painter, x: number, y: number, color: number, seed: number) {
  p.ellipse(iso(x + 0.35, y + 0.2).x + 2, iso(x + 0.35, y + 0.2).y + 1, 16, 6, 0x000000, 0.15);
  p.box({ x, y, w: 0.7, d: 0.4, h: 6 }, 0x9b6b43);
  for (let i = 0; i < 4; i++) {
    const fruit = iso(x + 0.12 + i * 0.15, y + 0.22, 7);
    p.circle(fruit.x, fruit.y, 2.2, [0xe63946, 0xf28c28, 0x7cb342, 0xf4d35e][(i + seed) % 4]);
  }
  for (const [dx, dy] of [[0, 0.4], [0.7, 0.4], [0.7, 0]]) {
    p.line(iso(x + dx, y + dy, 0), iso(x + dx, y + dy, 14), 0x6b4a2f, 1.2);
  }
  const roof: Box = { x: x - 0.05, y: y - 0.05, w: 0.8, d: 0.5, z: 14, h: 1.6 };
  p.box(roof, color);
  for (let u = 0.1; u < roof.w; u += 0.2) {
    p.left(roof, u, u + 0.1, 0, roof.h, 0xffffff, 0.9);
  }
}

export const market: BuildingDef = {
  key: 'market',
  box: marketBox,
  foot: footOf(marketBox),
  top: 60,
  draw(p) {
    const b = marketBox;
    p.tile(b.x, b.y, b.x + b.w, b.y + b.d, 0xcdb98f, 0.3);
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 4; k++) {
        stall(p, b.x + 0.2 + k * 1.0, b.y + 0.25 + row * 1.0, STALLS[row * 4 + k], row * 4 + k);
      }
    }
    for (const [x, y] of [[b.x + 0.25, b.y + 2.3], [b.x + 3.7, b.y + 2.25]]) {
      p.box({ x, y, w: 0.3, d: 0.22, h: 5 }, 0xb07a48);
      p.box({ x: x + 0.04, y: y + 0.02, w: 0.22, d: 0.18, z: 5, h: 4 }, 0xc48c58);
    }
    const left = iso(b.x + 1.6, b.y + b.d);
    const right = iso(b.x + 2.6, b.y + b.d);
    p.line(left, new Phaser.Math.Vector2(left.x, left.y - 30), 0x6b4a2f, 2.5);
    p.line(right, new Phaser.Math.Vector2(right.x, right.y - 30), 0x6b4a2f, 2.5);
    const mid = new Phaser.Math.Vector2((left.x + right.x) / 2, (left.y + right.y) / 2 - 32);
    billboard(p, mid, 58, 16, 0x2a9d8f);
  },
  signs: () => {
    const left = iso(marketBox.x + 1.6, marketBox.y + marketBox.d);
    const right = iso(marketBox.x + 2.6, marketBox.y + marketBox.d);
    return [{ text: 'ПАЗАР', at: new Phaser.Math.Vector2((left.x + right.x) / 2, (left.y + right.y) / 2 - 32), size: 10, color: '#ffffff' }];
  },
};
