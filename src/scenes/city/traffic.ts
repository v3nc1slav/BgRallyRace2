import { random } from '../map/random';
import { HIGH_X, HIGH_Y, LOW, X_ROADS, Y_ROADS } from './plan';

export type Axis = 'h' | 'v';
export type Light = 'green' | 'yellow' | 'red';
type Dir = 1 | -1;
type Point = [number, number];

interface Lane {
  axis: Axis;
  road: number;
  dir: Dir;
}

interface Turn {
  from: Lane;
  next: Lane;
  p0: Point;
  p1: Point;
  p2: Point;
  length: number;
  s: number;
}

export interface Car extends Lane {
  t: number;
  speed: number;
  max: number;
  color: number;
  turn: Turn | null;
  hidden: boolean;
  x: number;
  y: number;
  along: 'x' | 'y';
  hx: number;
  hy: number;
}

const LANE = 0.23;
const PERIOD = 14;

export const laneOf = (axis: Axis, road: number, dir: Dir) => road + 0.5 + (axis === 'h' ? LANE * dir : -LANE * dir);

function bezier(p0: Point, p1: Point, p2: Point, u: number): Point {
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const c = u * u;
  return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
}

export class Traffic {
  readonly cars: Car[] = [];
  private time = 0;
  private readonly offsets = new Map<string, number>();
  private readonly rnd = random(4040);

  constructor(count: number, colors: number[]) {
    for (const c of X_ROADS) {
      for (const r of Y_ROADS) {
        this.offsets.set(`${c},${r}`, this.rnd() * PERIOD);
      }
    }
    for (let i = 0; i < count; i++) {
      const car = this.blank(colors[i % colors.length]);
      for (let attempt = 0; attempt < 12; attempt++) {
        this.pick(car);
        const high = car.axis === 'h' ? HIGH_X : HIGH_Y;
        car.t = LOW + 1 + this.rnd() * (high - LOW - 2);
        const crossing = (car.axis === 'h' ? X_ROADS : Y_ROADS).some((c) => car.t > c - 0.8 && car.t < c + 1.8);
        if (!crossing && this.free(car, car.t, 1.2)) {
          break;
        }
      }
      this.place(car);
      this.cars.push(car);
    }
  }

  light(c: number, r: number, axis: Axis): Light {
    const t = (this.time + (this.offsets.get(`${c},${r}`) ?? 0)) % PERIOD;
    if (axis === 'h') {
      return t < 6 ? 'green' : t < 7 ? 'yellow' : 'red';
    }
    return t >= 7 && t < 13 ? 'green' : t >= 13 ? 'yellow' : 'red';
  }

  update(dt: number) {
    this.time += dt;
    for (const car of this.cars) {
      if (car.hidden) {
        this.respawn(car);
        continue;
      }
      if (car.turn) {
        this.steer(car, dt);
      } else {
        this.drive(car, dt);
      }
      this.place(car);
    }
  }

  private blank(color: number): Car {
    return { axis: 'h', road: 5, dir: 1, t: 0, speed: 0, max: 1.1 + this.rnd() * 0.5, color, turn: null, hidden: false, x: 0, y: 0, along: 'x', hx: 1, hy: 0 };
  }

  private pick(car: Car) {
    car.axis = this.rnd() > 0.5 ? 'h' : 'v';
    const roads = car.axis === 'h' ? Y_ROADS : X_ROADS;
    car.road = roads[Math.floor(this.rnd() * roads.length)];
    car.dir = this.rnd() > 0.5 ? 1 : -1;
  }

  private respawn(car: Car) {
    this.pick(car);
    const high = car.axis === 'h' ? HIGH_X : HIGH_Y;
    const t = car.dir > 0 ? LOW + 0.3 : high - 0.3;
    if (this.free(car, t, 1.6)) {
      car.t = t;
      car.speed = car.max;
      car.hidden = false;
      this.place(car);
    }
  }

  private free(lane: Lane, t: number, gap: number) {
    return !this.cars.some((other) => !other.hidden && !other.turn && other.axis === lane.axis && other.road === lane.road && other.dir === lane.dir && Math.abs(other.t - t) < gap);
  }

  private stopAhead(car: Car) {
    const crossings = car.axis === 'h' ? X_ROADS : Y_ROADS;
    let best: { at: number; stop: number } | null = null;
    for (const at of crossings) {
      const stop = car.dir > 0 ? at - 0.5 : at + 1.5;
      const dist = (stop - car.t) * car.dir;
      if (dist > -0.02 && (!best || dist < (best.stop - car.t) * car.dir)) {
        best = { at, stop };
      }
    }
    return best;
  }

  private gapAhead(car: Car) {
    let gap = Infinity;
    for (const other of this.cars) {
      if (other === car || other.hidden) {
        continue;
      }
      if (!other.turn && other.axis === car.axis && other.road === car.road && other.dir === car.dir) {
        const d = (other.t - car.t) * car.dir;
        if (d > 0) {
          gap = Math.min(gap, d);
        }
      } else if (other.turn) {
        const { from, next, p0, p2 } = other.turn;
        if (from.axis === car.axis && from.road === car.road && from.dir === car.dir) {
          const d = ((car.axis === 'h' ? p0[0] : p0[1]) - car.t) * car.dir + 0.3;
          if (d > 0) {
            gap = Math.min(gap, d);
          }
        }
        if (next.axis === car.axis && next.road === car.road && next.dir === car.dir) {
          const d = ((car.axis === 'h' ? p2[0] : p2[1]) - car.t) * car.dir;
          if (d > 0) {
            gap = Math.min(gap, d);
          }
        }
      }
    }
    return gap;
  }

  private drive(car: Car, dt: number) {
    const ahead = this.stopAhead(car);
    let target = car.max;
    let mayEnter = true;
    if (ahead) {
      const dist = (ahead.stop - car.t) * car.dir;
      const [c, r] = car.axis === 'h' ? [ahead.at, car.road] : [car.road, ahead.at];
      const light = this.light(c, r, car.axis);
      if (light !== 'green' && !(light === 'yellow' && dist < 0.3)) {
        mayEnter = false;
        if (dist < 1.4) {
          target = Math.min(target, Math.max(0, (dist - 0.02) * 2.2));
        }
      }
    }
    const gap = this.gapAhead(car);
    if (gap < 1.8) {
      target = Math.min(target, Math.max(0, (gap - 0.75) * 1.6));
    }
    car.speed += Math.max(-5 * dt, Math.min(2 * dt, target - car.speed));
    const before = car.t;
    car.t += car.dir * car.speed * dt;

    if (ahead && (car.t - ahead.stop) * car.dir >= 0) {
      if (!mayEnter) {
        car.t = before;
        car.speed = 0;
      } else if (!this.enter(car, ahead.at)) {
        car.t = ahead.stop;
        car.speed = 0;
      }
    }
    const high = car.axis === 'h' ? HIGH_X : HIGH_Y;
    if (car.t > high - 0.2 || car.t < LOW + 0.2) {
      car.hidden = true;
    }
  }

  private enter(car: Car, at: number) {
    const lane: Lane = { axis: car.axis, road: car.road, dir: car.dir };
    const own = laneOf(car.axis, car.road, car.dir);
    const p0: Point = car.axis === 'h' ? [car.t, own] : [own, car.t];
    const options: { next: Lane; p1: Point; p2: Point; weight: number }[] = [];
    if (car.axis === 'h') {
      const c = at;
      const r = car.road;
      const exit = car.dir > 0 ? c + 1.5 : c - 0.5;
      options.push({ next: lane, p1: [(p0[0] + exit) / 2, own], p2: [exit, own], weight: 0.5 });
      for (const dy of [1, -1] as Dir[]) {
        const x = laneOf('v', c, dy);
        options.push({ next: { axis: 'v', road: c, dir: dy }, p1: [x, own], p2: [x, dy > 0 ? r + 1.5 : r - 0.5], weight: 0.25 });
      }
    } else {
      const r = at;
      const c = car.road;
      const exit = car.dir > 0 ? r + 1.5 : r - 0.5;
      options.push({ next: lane, p1: [own, (p0[1] + exit) / 2], p2: [own, exit], weight: 0.5 });
      for (const dx of [1, -1] as Dir[]) {
        const y = laneOf('h', r, dx);
        options.push({ next: { axis: 'h', road: r, dir: dx }, p1: [own, y], p2: [dx > 0 ? c + 1.5 : c - 0.5, y], weight: 0.25 });
      }
    }
    let roll = this.rnd();
    let choice = options[0];
    for (const option of options) {
      roll -= option.weight;
      if (roll <= 0) {
        choice = option;
        break;
      }
    }
    const exitT = choice.next.axis === 'h' ? choice.p2[0] : choice.p2[1];
    if (!this.free(choice.next, exitT + choice.next.dir * 0.4, 0.8)) {
      return false;
    }
    let length = 0;
    let prev = p0;
    for (let i = 1; i <= 8; i++) {
      const point = bezier(p0, choice.p1, choice.p2, i / 8);
      length += Math.hypot(point[0] - prev[0], point[1] - prev[1]);
      prev = point;
    }
    car.turn = { from: lane, next: choice.next, p0, p1: choice.p1, p2: choice.p2, length, s: 0 };
    car.speed = Math.max(car.speed, 0.5);
    return true;
  }

  private steer(car: Car, dt: number) {
    const turn = car.turn!;
    car.speed += Math.max(-5 * dt, Math.min(2 * dt, Math.min(car.max, 1.0) - car.speed));
    turn.s += Math.max(0.4, car.speed) * dt;
    if (turn.s >= turn.length) {
      car.axis = turn.next.axis;
      car.road = turn.next.road;
      car.dir = turn.next.dir;
      car.t = car.axis === 'h' ? turn.p2[0] : turn.p2[1];
      car.turn = null;
    }
  }

  private place(car: Car) {
    if (car.turn) {
      const { p0, p1, p2, length, s } = car.turn;
      const u = Math.min(1, s / length);
      const [x, y] = bezier(p0, p1, p2, u);
      const [ax, ay] = bezier(p0, p1, p2, Math.min(1, u + 0.05));
      const [bx, by] = bezier(p0, p1, p2, Math.max(0, u - 0.05));
      car.x = x;
      car.y = y;
      car.hx = ax - bx;
      car.hy = ay - by;
      const len = Math.hypot(car.hx, car.hy) || 1;
      car.hx /= len;
      car.hy /= len;
    } else if (car.axis === 'h') {
      car.x = car.t;
      car.y = laneOf('h', car.road, car.dir);
      car.hx = car.dir;
      car.hy = 0;
    } else {
      car.x = laneOf('v', car.road, car.dir);
      car.y = car.t;
      car.hx = 0;
      car.hy = car.dir;
    }
    car.along = Math.abs(car.hx) >= Math.abs(car.hy) ? 'x' : 'y';
  }
}
