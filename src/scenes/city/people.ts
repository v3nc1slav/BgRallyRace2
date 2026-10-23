import { random } from '../map/random';
import { BLOCKS, type Block } from './plan';
import type { Axis, Light } from './traffic';

type Point = [number, number];

export interface Person {
  block: Block;
  s: number;
  dir: 1 | -1;
  speed: number;
  color: number;
  path: Point[] | null;
  leg: number;
  next: { block: Block; corner: number } | null;
  wait: number;
  waitFor: { c: number; r: number; axis: Axis } | null;
  x: number;
  y: number;
  phase: number;
  walking: boolean;
}

const INSET = 0.13;
const CROSS = 0.28;

function ring(block: Block) {
  const x0 = block.x0 + INSET;
  const y0 = block.y0 + INSET;
  const w = block.x1 - INSET - x0;
  const h = block.y1 - INSET - y0;
  return { x0, y0, w, h, length: 2 * (w + h), corners: [0, w, w + h, 2 * w + h] };
}

function pointOn(block: Block, s: number): Point {
  const { x0, y0, w, h, length } = ring(block);
  const t = ((s % length) + length) % length;
  if (t < w) {
    return [x0 + t, y0];
  }
  if (t < w + h) {
    return [x0 + w, y0 + (t - w)];
  }
  if (t < 2 * w + h) {
    return [x0 + w - (t - w - h), y0 + h];
  }
  return [x0, y0 + h - (t - 2 * w - h)];
}

const find = (x0: number, y0: number) => BLOCKS.find((b) => b.x0 === x0 && b.y0 === y0);

interface Option {
  block: Block;
  corner: number;
  path: Point[];
  c: number;
  r: number;
  axis: Axis;
}

function crossings(block: Block, corner: number): Option[] {
  const { x0, y0, x1, y1 } = block;
  const options: Option[] = [];
  const add = (target: Block | undefined, targetCorner: number, via: Point[], c: number, r: number, axis: Axis) => {
    if (target) {
      options.push({ block: target, corner: targetCorner, path: [pointOn(block, ring(block).corners[corner]), ...via, pointOn(target, ring(target).corners[targetCorner])], c, r, axis });
    }
  };
  if (corner === 0) {
    add(find(x0 - 6, y0), 1, [[x0 + INSET, y0 + CROSS], [x0 - 1 - INSET, y0 + CROSS]], x0 - 1, y0 - 1, 'h');
    add(find(x0, y0 - 6), 3, [[x0 + CROSS, y0 + INSET], [x0 + CROSS, y0 - 1 - INSET]], x0 - 1, y0 - 1, 'v');
  } else if (corner === 1) {
    add(find(x1 + 1, y0), 0, [[x1 - INSET, y0 + CROSS], [x1 + 1 + INSET, y0 + CROSS]], x1, y0 - 1, 'h');
    add(find(x0, y0 - 6), 2, [[x1 - CROSS, y0 + INSET], [x1 - CROSS, y0 - 1 - INSET]], x1, y0 - 1, 'v');
  } else if (corner === 2) {
    add(find(x1 + 1, y0), 3, [[x1 - INSET, y1 - CROSS], [x1 + 1 + INSET, y1 - CROSS]], x1, y1, 'h');
    add(find(x0, y1 + 1), 1, [[x1 - CROSS, y1 - INSET], [x1 - CROSS, y1 + 1 + INSET]], x1, y1, 'v');
  } else {
    add(find(x0 - 6, y0), 2, [[x0 + INSET, y1 - CROSS], [x0 - 1 - INSET, y1 - CROSS]], x0 - 1, y1, 'h');
    add(find(x0, y1 + 1), 0, [[x0 + CROSS, y1 - INSET], [x0 + CROSS, y1 + 1 + INSET]], x0 - 1, y1, 'v');
  }
  return options;
}

export class Crowd {
  readonly people: Person[] = [];
  private readonly rnd = random(5151);

  constructor(count: number, colors: number[], light: (c: number, r: number, axis: Axis) => Light) {
    this.light = light;
    const busy = BLOCKS.filter((b) => b.x0 >= 0 && b.x0 <= 18 && b.y0 >= 0 && b.y0 <= 12);
    for (let i = 0; i < count; i++) {
      const pool = i % 3 === 2 ? BLOCKS : busy;
      const block = pool[Math.floor(this.rnd() * pool.length)];
      const person: Person = {
        block,
        s: this.rnd() * ring(block).length,
        dir: this.rnd() > 0.5 ? 1 : -1,
        speed: 0.3 + this.rnd() * 0.2,
        color: colors[i % colors.length],
        path: null,
        leg: 0,
        next: null,
        wait: 0,
        waitFor: null,
        x: 0,
        y: 0,
        phase: this.rnd() * 6,
        walking: true,
      };
      [person.x, person.y] = pointOn(block, person.s);
      this.people.push(person);
    }
  }

  private readonly light: (c: number, r: number, axis: Axis) => Light;

  update(dt: number) {
    for (const person of this.people) {
      person.walking = false;
      if (person.waitFor) {
        const { c, r, axis } = person.waitFor;
        person.wait -= dt;
        if (this.light(c, r, axis === 'h' ? 'h' : 'v') === 'green') {
          person.waitFor = null;
        } else if (person.wait <= 0) {
          person.waitFor = null;
          person.path = null;
          person.next = null;
        }
        continue;
      }
      if (person.wait > 0) {
        person.wait -= dt;
        continue;
      }
      person.walking = true;
      person.phase += dt * 9;
      if (person.path && person.next) {
        this.follow(person, dt);
        continue;
      }
      this.stroll(person, dt);
    }
  }

  private follow(person: Person, dt: number) {
    const path = person.path!;
    let step = person.speed * 1.2 * dt;
    while (step > 0 && person.leg < path.length - 1) {
      const [tx, ty] = path[person.leg + 1];
      const dist = Math.hypot(tx - person.x, ty - person.y);
      if (dist <= step) {
        person.x = tx;
        person.y = ty;
        person.leg++;
        step -= dist;
      } else {
        person.x += ((tx - person.x) / dist) * step;
        person.y += ((ty - person.y) / dist) * step;
        step = 0;
      }
    }
    if (person.leg >= path.length - 1) {
      const { block, corner } = person.next!;
      person.block = block;
      person.s = ring(block).corners[corner];
      person.dir = this.rnd() > 0.5 ? 1 : -1;
      person.path = null;
      person.next = null;
    }
  }

  private stroll(person: Person, dt: number) {
    const { length, corners } = ring(person.block);
    const before = person.s;
    person.s += person.dir * person.speed * dt;
    const lo = Math.min(before, person.s);
    const hi = Math.max(before, person.s);
    for (let k = -1; k <= 1; k++) {
      corners.forEach((corner, index) => {
        const at = corner + k * length;
        if (person.path || at <= lo || at > hi) {
          return;
        }
        if (this.rnd() < 0.35) {
          const options = crossings(person.block, index);
          if (options.length) {
            const option = options[Math.floor(this.rnd() * options.length)];
            person.s = at;
            person.path = option.path;
            person.leg = 0;
            person.next = { block: option.block, corner: option.corner };
            person.waitFor = { c: option.c, r: option.r, axis: option.axis };
            person.wait = 12;
          }
        } else if (this.rnd() < 0.15) {
          person.wait = 1 + this.rnd() * 2.5;
        }
      });
    }
    if (!person.path) {
      [person.x, person.y] = pointOn(person.block, person.s);
    } else {
      [person.x, person.y] = person.path[0];
    }
  }
}
