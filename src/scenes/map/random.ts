export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(seed: number, size: number) {
  const rnd = random(seed);
  const grid = Array.from({ length: (size + 1) * (size + 1) }, () => rnd());
  const at = (x: number, y: number) => grid[y * (size + 1) + x];
  const smooth = (t: number) => t * t * (3 - 2 * t);

  return (u: number, v: number) => {
    const x = Math.min(size - 1e-4, Math.max(0, u * size));
    const y = Math.min(size - 1e-4, Math.max(0, v * size));
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const a = at(ix, iy);
    const b = at(ix + 1, iy);
    const c = at(ix, iy + 1);
    const d = at(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

export function terrainNoise(seed: number) {
  const broad = valueNoise(seed, 5);
  const detail = valueNoise(seed + 1, 13);
  return (u: number, v: number) => 0.7 * broad(u, v) + 0.3 * detail(u, v);
}

export interface Point {
  x: number;
  y: number;
}

export function inside(point: Point, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      result = !result;
    }
  }
  return result;
}

export function area(polygon: Point[]) {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
  }
  return Math.abs(sum / 2);
}

export function bounds(polygon: Point[]) {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
