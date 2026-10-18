import Phaser from 'phaser';
import type { Layout } from './layout';
import type { Palette } from './palette';
import { area, bounds, inside, random, terrainNoise, type Point } from './random';

export interface RoadGeometry {
  points: Phaser.Math.Vector2[];
  normals: Phaser.Math.Vector2[];
  tangents: Phaser.Math.Vector2[];
}

export function roadGeometry(points: Phaser.Math.Vector2[]): RoadGeometry {
  const tangents = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    return new Phaser.Math.Vector2(b.x - a.x, b.y - a.y).normalize();
  });
  return { points, tangents, normals: tangents.map((t) => new Phaser.Math.Vector2(-t.y, t.x)) };
}

function nearestIndex(road: RoadGeometry, x: number, y: number) {
  let best = 0;
  let distance = Infinity;
  road.points.forEach((p, i) => {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
}

export function drawRelief(g: Phaser.GameObjects.Graphics, seed: number, width: number, height: number, top: number) {
  const height2 = terrainNoise(seed);
  const cell = 16;
  const cols = Math.ceil(width / cell) + 1;
  const rows = Math.ceil((height - top) / cell) + 1;
  const values: number[][] = [];
  for (let r = 0; r <= rows; r++) {
    values.push([]);
    for (let c = 0; c <= cols; c++) {
      values[r].push(height2(c / cols, r / rows));
    }
  }

  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      const dx = values[r][c + 1] - values[r][c - 1];
      const dy = values[r + 1][c] - values[r - 1][c];
      const light = Phaser.Math.Clamp(-(dx + dy) * 9, -1, 1);
      if (light > 0) {
        g.fillStyle(0xffffff, light * 0.09);
      } else {
        g.fillStyle(0x000000, -light * 0.18);
      }
      g.fillRect(c * cell - cell / 2, top + r * cell - cell / 2, cell, cell);
    }
  }

  g.lineStyle(1, 0x000000, 0.13);
  for (const level of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const corners = [
          { v: values[r][c], x: c * cell, y: top + r * cell },
          { v: values[r][c + 1], x: (c + 1) * cell, y: top + r * cell },
          { v: values[r + 1][c + 1], x: (c + 1) * cell, y: top + (r + 1) * cell },
          { v: values[r + 1][c], x: c * cell, y: top + (r + 1) * cell },
        ];
        const crossings: Point[] = [];
        for (let i = 0; i < 4; i++) {
          const a = corners[i];
          const b = corners[(i + 1) % 4];
          if (a.v < level !== b.v < level) {
            const t = (level - a.v) / (b.v - a.v);
            crossings.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          }
        }
        for (let i = 0; i + 1 < crossings.length; i += 2) {
          g.lineBetween(crossings[i].x, crossings[i].y, crossings[i + 1].x, crossings[i + 1].y);
        }
      }
    }
  }
}

function drawTree(g: Phaser.GameObjects.Graphics, palette: Palette, x: number, y: number, r: number) {
  if (palette.conifers) {
    g.fillStyle(palette.shade, 0.7);
    g.fillTriangle(x - r + 2, y + r + 3, x + r + 2, y + r + 3, x + 2, y - r * 1.4 + 3);
    g.fillStyle(palette.tree, 1);
    g.fillTriangle(x - r, y + r, x + r, y + r, x, y - r * 1.4);
    g.fillStyle(0xffffff, 0.55);
    g.fillTriangle(x - r * 0.45, y - r * 0.3, x + r * 0.45, y - r * 0.3, x, y - r * 1.4);
    return;
  }
  g.fillStyle(palette.shade, 0.8);
  g.fillCircle(x + 2, y + 3, r);
  g.fillStyle(palette.tree, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(0xffffff, 0.08);
  g.fillCircle(x - r / 3, y - r / 3, r / 2);
}

function drawHouse(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0x000000, 0.25);
  g.fillRect(x - 4, y - 1, 11, 8);
  g.fillStyle(0xe7e0cf, 1);
  g.fillRect(x - 5, y - 3, 10, 8);
  g.fillStyle(0xb5533a, 1);
  g.fillTriangle(x - 7, y - 3, x + 7, y - 3, x, y - 10);
}

function fillPolygon(g: Phaser.GameObjects.Graphics, points: Point[], color: number, alpha: number) {
  g.fillStyle(color, alpha);
  g.fillPoints(points.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
}

export function drawScenery(
  g: Phaser.GameObjects.Graphics,
  layout: Layout,
  road: RoadGeometry,
  palette: Palette,
  seed: number,
  width: number,
  height: number,
  top: number,
): Point[] {
  const rnd = random(seed * 104729 + 7);
  const sample = road.points.filter((_, i) => i % 3 === 0);
  const riverSample = layout.rivers.flat();
  const free = (x: number, y: number, distance: number) =>
    y > top && sample.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 > distance * distance) && riverSample.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 > 100);
  const awayFromLabels = (x: number, y: number) => layout.labels.every((l) => (l.x - x) ** 2 + (l.y - y) ** 2 > 36 * 36);
  const trees: [number, number, number][] = [];
  const houses: Point[] = [];

  if (layout.zones.length) {
    const others = layout.zones.filter((zone) => zone.type !== 'forest');
    layout.zones.filter((zone) => zone.type === 'forest').forEach((zone) => fillPolygon(g, zone.points, palette.forest, 1));
    for (const zone of others) {
      const color = zone.type === 'water' ? palette.water : zone.type === 'field' ? palette.field : zone.type === 'village' ? palette.meadow : palette.meadow;
      fillPolygon(g, zone.points, color, zone.type === 'village' ? 0.6 : 0.9);
    }

    let budget = 1600;
    for (const zone of layout.zones) {
      const box = bounds(zone.points);
      if (zone.type === 'forest') {
        const wanted = Math.min(budget, Math.round(area(zone.points) / 300));
        for (let i = 0, placed = 0; i < wanted * 3 && placed < wanted; i++) {
          const p = { x: box.minX + rnd() * (box.maxX - box.minX), y: box.minY + rnd() * (box.maxY - box.minY) };
          if (inside(p, zone.points) && free(p.x, p.y, 24) && awayFromLabels(p.x, p.y) && !others.some((o) => inside(p, o.points))) {
            trees.push([p.x, p.y, 5 + rnd() * 5]);
            placed++;
          }
        }
        budget -= wanted;
      } else if (zone.type === 'village') {
        const wanted = Math.min(40, Math.max(4, Math.round(area(zone.points) / 700)));
        for (let i = 0, placed = 0; i < wanted * 4 && placed < wanted; i++) {
          const p = { x: box.minX + rnd() * (box.maxX - box.minX), y: box.minY + rnd() * (box.maxY - box.minY) };
          if (inside(p, zone.points) && free(p.x, p.y, 18) && houses.every((h) => (h.x - p.x) ** 2 + (h.y - p.y) ** 2 > 140)) {
            houses.push(p);
            placed++;
          }
        }
      }
    }
  } else {
    for (let i = 0; i < 20; i++) {
      const x = rnd() * width;
      const y = top + rnd() * (height - top);
      const w = 50 + rnd() * 120;
      const h = 30 + rnd() * 80;
      const angle = rnd() * Math.PI;
      const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([px, py]) => ({
        x: x + px * Math.cos(angle) - py * Math.sin(angle) + (rnd() - 0.5) * 16,
        y: y + px * Math.sin(angle) + py * Math.cos(angle) + (rnd() - 0.5) * 16,
      }));
      fillPolygon(g, corners, rnd() < 0.55 ? palette.meadow : palette.field, 0.85);
    }

    for (let c = 0; c < 60; c++) {
      const cx = rnd() * width;
      const cy = top + rnd() * (height - top);
      const spread = 25 + rnd() * 50;
      const count = 8 + Math.floor(rnd() * 16);
      for (let t = 0; t < count; t++) {
        const x = cx + (rnd() + rnd() - 1) * spread;
        const y = cy + (rnd() + rnd() - 1) * spread * 0.8;
        if (free(x, y, 24) && awayFromLabels(x, y)) {
          trees.push([x, y, 5 + rnd() * 5]);
        }
      }
    }

    for (const label of layout.labels) {
      for (let i = 0; i < 9; i++) {
        const x = label.x + (rnd() - 0.5) * 70;
        const y = label.y + 16 + (rnd() - 0.5) * 40;
        if (free(x, y, 18)) {
          houses.push({ x, y });
        }
      }
    }
  }

  for (const river of layout.rivers) {
    g.lineStyle(9, palette.water, 1);
    g.strokePoints(river);
    g.lineStyle(3, 0xffffff, 0.18);
    g.strokePoints(river);
  }

  trees.sort((a, b) => a[1] - b[1]).forEach(([x, y, r]) => drawTree(g, palette, x, y, r));
  houses.sort((a, b) => a.y - b.y).forEach((house) => drawHouse(g, house.x, house.y));
  return houses;
}

export function bridgesFromRivers(layout: Layout, road: RoadGeometry): Layout['pois'] {
  const bridges: Layout['pois'] = [];
  for (const river of layout.rivers) {
    let best: { x: number; y: number; d: number } | null = null;
    for (const p of road.points) {
      for (const q of river) {
        const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
        if (!best || d < best.d) {
          best = { x: p.x, y: p.y, d };
        }
      }
    }
    if (best && best.d < 30 * 30) {
      bridges.push({ type: 'bridge', x: best.x, y: best.y });
    }
  }
  return bridges;
}

export function drawPois(g: Phaser.GameObjects.Graphics, pois: Layout['pois'], road: RoadGeometry, seed: number) {
  const rnd = random(seed * 31 + 99);
  const crowd = [0xe63946, 0xf1faee, 0x457b9d, 0xffb703, 0x2a9d8f, 0xff006e, 0xffffff];

  for (const poi of pois) {
    const i = nearestIndex(road, poi.x, poi.y);
    const p = road.points[i];
    const t = road.tangents[i];
    const n = road.normals[i];

    if (poi.type === 'spectators') {
      const side = rnd() < 0.5 ? -1 : 1;
      g.lineStyle(2, 0xff3b3b, 0.9);
      g.lineBetween(p.x + n.x * side * 18 - t.x * 26, p.y + n.y * side * 18 - t.y * 26, p.x + n.x * side * 18 + t.x * 26, p.y + n.y * side * 18 + t.y * 26);
      for (let k = 0; k < 16; k++) {
        const along = (rnd() - 0.5) * 50;
        const out = 22 + rnd() * 14;
        g.fillStyle(crowd[Math.floor(rnd() * crowd.length)], 1);
        g.fillCircle(p.x + t.x * along + n.x * side * out, p.y + t.y * along + n.y * side * out, 2.4);
      }
    } else if (poi.type === 'bridge') {
      for (const side of [-1, 1]) {
        g.lineStyle(4, 0x6b4f2a, 1);
        g.lineBetween(p.x + n.x * side * 14 - t.x * 20, p.y + n.y * side * 14 - t.y * 20, p.x + n.x * side * 14 + t.x * 20, p.y + n.y * side * 14 + t.y * 20);
        g.fillStyle(0x3d2c15, 1);
        for (let k = -2; k <= 2; k++) {
          g.fillRect(p.x + n.x * side * 14 + t.x * k * 10 - 2, p.y + n.y * side * 14 + t.y * k * 10 - 2, 4, 4);
        }
      }
    } else {
      const tip = { x: p.x + t.x * 10, y: p.y + t.y * 10 };
      g.fillStyle(0xf0b400, 1);
      g.fillTriangle(tip.x, tip.y, p.x - t.x * 6 + n.x * 9, p.y - t.y * 6 + n.y * 9, p.x - t.x * 6 - n.x * 9, p.y - t.y * 6 - n.y * 9);
      g.lineStyle(1.5, 0x111111, 1);
      g.strokeTriangle(tip.x, tip.y, p.x - t.x * 6 + n.x * 9, p.y - t.y * 6 + n.y * 9, p.x - t.x * 6 - n.x * 9, p.y - t.y * 6 - n.y * 9);
    }
  }
}
