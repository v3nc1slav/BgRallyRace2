import Phaser from 'phaser';
import { t } from '../i18n';
import { BUILDINGS, type BuildingDef } from './city/buildings';
import { car as drawCar, Painter } from './city/draw';
import { hull, iso, mix } from './city/iso';
import { duck } from './city/kit';
import { CRANE, OWN_BOX, OWN_RING, ownBoard, ownSign, ownState, ringPoint, type OwnStatus } from './city/own';
import { Crowd } from './city/people';
import { CITY, ENTRANCE, HIGH_X, HIGH_Y, LAKE, LOW, RIVER, X_ROADS, Y_ROADS, drawGround, items, sortItems, type Item } from './city/plan';
import { Traffic, type Light } from './city/traffic';
import type { Foot } from './city/kit';
import { darkness } from './map/effects';

export interface CityPlace {
  key: string;
  name: string;
  label?: string;
  text: string;
  to: string;
}

export interface OwnTrackState {
  status: OwnStatus;
  progress: number;
}

interface Spot {
  def: BuildingDef;
  place: CityPlace;
  painter: Painter;
  plate: Phaser.GameObjects.Text;
  lit: Phaser.GameObjects.Graphics;
  depth: number;
}

interface Mover {
  image: Phaser.GameObjects.Image;
  key: string;
}

interface Signal {
  c: number;
  r: number;
  axis: 'h' | 'v';
  lamp: Phaser.GameObjects.Arc;
  state: Light | null;
}

interface Badge {
  spot: Spot;
  ring: Phaser.GameObjects.Arc;
  mark: Phaser.GameObjects.Text;
}

interface Duck {
  image: Phaser.GameObjects.Image;
  river: boolean;
  t: number;
  speed: number;
  radius: number;
  lastX: number;
}

const FONT = 'system-ui, -apple-system, Segoe UI, sans-serif';
const PLATE = 'rgba(21, 23, 28, 0.82)';
const ACCENT = '#e63946';
const MAX_ZOOM = 3.5;
const LABEL_PX = 14;
const PHONE_ZOOM = 2.6;
const CAR_COLORS = [0xe63946, 0x2a6fdb, 0xf4f4f4, 0x2b2d31, 0xf2b134, 0x4caf50, 0x8e44ad, 0xb0b7bf];
const SHIRTS = [0xe63946, 0x2a6fdb, 0xf4d35e, 0x2a9d8f, 0xffffff, 0x8e44ad, 0xf28c28, 0x4caf50];
const SIGNAL_COLORS: Record<Light, number> = { green: 0x3ddc84, yellow: 0xf4c430, red: 0xff3b30 };

function person(p: Painter, color: number) {
  const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
  p.ellipse(1, 0.5, 3.2, 1.3, 0x000000, 0.25);
  p.line(v(-0.9, 0), v(-0.9, -4), 0x2d3a48, 1.3);
  p.line(v(0.9, 0), v(0.9, -4), 0x2d3a48, 1.3);
  p.rect(-1.9, -8.4, 3.8, 4.6, color);
  p.circle(0, -9.9, 1.7, 0xf1c9a5);
}

function signalPole(p: Painter) {
  const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
  p.ellipse(1, 0.5, 2.5, 1, 0x000000, 0.2);
  p.line(v(0, 0), v(0, -20), 0x30343b, 1.6);
  p.rect(-2, -26, 4, 7, 0x1b1d21);
}

export class CityScene extends Phaser.Scene {
  ready = false;
  private spots: Spot[] = [];
  private active: Spot | null = null;
  private tip!: Phaser.GameObjects.Text;
  private area = new Phaser.Geom.Rectangle();
  private core = new Phaser.Geom.Rectangle();
  private fit = 1;
  private minZoom = 1;
  private press: { x: number; y: number; moved: boolean } | null = null;
  private pinch: { distance: number; zoom: number } | null = null;
  private touchedAt = -Infinity;
  private bakeScale = 1;
  private sized = { w: 0, h: 0 };
  private baked = new Map<string, { x: number; y: number }>();
  private sign: Phaser.GameObjects.Text | null = null;
  private signOpen = false;
  private perks = '';
  private feet: Foot[] = [];
  private depthCache = new Map<number, number>();
  private tinted: Phaser.GameObjects.Image[] = [];
  private glows: { image: Phaser.GameObjects.Image; alpha: number }[] = [];
  private night = 0;
  private traffic!: Traffic;
  private crowd!: Crowd;
  private cars: Mover[] = [];
  private beams: Phaser.GameObjects.Image[] = [];
  private walkers: Mover[] = [];
  private ducks: Duck[] = [];
  private signals: Signal[] = [];
  private ownSpot: Spot | null = null;
  private badges = new Map<string, Badge>();
  private badgeText = new Map<string, string>();
  private labelScale = 1;
  private ownText: Phaser.GameObjects.Text | null = null;
  private ownFx!: Phaser.GameObjects.Graphics;
  private ownCar: Mover | null = null;
  private workers: { image: Phaser.GameObjects.Image; x: number; y: number; tx: number; ty: number }[] = [];
  private clock = 0;
  private readonly cityName: string;
  private readonly places: CityPlace[];
  private readonly onSelect: (to: string) => void;
  private readonly ratio: number;

  constructor(cityName: string, places: CityPlace[], onSelect: (to: string) => void, ratio: number) {
    super('City');
    this.cityName = cityName;
    this.places = places;
    this.onSelect = onSelect;
    this.ratio = ratio;
  }

  create() {
    const rect = (target: Phaser.Geom.Rectangle, lo: number, hiX: number, hiY: number, above: number, below: number) => {
      const left = iso(lo, hiY).x;
      const right = iso(hiX, lo).x;
      const top = iso(lo, lo).y - above;
      target.setTo(left, top, right - left, iso(hiX, hiY).y + below - top);
    };
    rect(this.area, LOW, HIGH_X, HIGH_Y, 70, 40);
    rect(this.core, CITY.x0 - 0.5, CITY.x1 + 0.5, CITY.y1 + 0.5, 70, 14);
    const fit = Math.min(this.scale.width / this.core.width, this.scale.height / this.core.height);
    this.bakeScale = Phaser.Math.Clamp(Math.ceil(fit * MAX_ZOOM * 4) / 4, 1, 2);
    this.makeGlowTexture();

    this.bakeGround();
    const depths = new Map<BuildingDef, number>();
    const sorted = sortItems(items());
    this.feet = sorted.map((item) => item.foot);
    sorted.forEach((item, index) => {
      const depth = index + 1;
      if (item.building) {
        depths.set(item.building, depth);
        this.addSpot(item.building, depth);
      } else {
        this.addItem(item, index, depth);
      }
      if (item.entrance) {
        this.addEntrance(depth + 0.5);
      }
    });

    for (const def of BUILDINGS) {
      for (const sign of def.signs()) {
        this.add
          .text(sign.at.x, sign.at.y, sign.text, { fontFamily: FONT, fontSize: `${sign.size}px`, fontStyle: 'bold', color: sign.color, resolution: 2 })
          .setOrigin(0.5)
          .setDepth((depths.get(def) ?? 0) + 0.5);
      }
    }

    this.ownFx = this.add.graphics().setDepth((this.ownSpot?.depth ?? 0) + 0.3);
    const board = ownBoard();
    this.ownText = this.add
      .text(board.x, board.y, '', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#d62612', resolution: 2 })
      .setOrigin(0.5)
      .setDepth((this.ownSpot?.depth ?? 0) + 0.5);
    this.refreshOwn();

    this.addSignals();
    this.addTraffic();
    this.addDucks();

    this.tip = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '17px', color: '#e9ebef', backgroundColor: PLATE, padding: { x: 10, y: 6 }, align: 'center', resolution: 2, wordWrap: { width: 330, useAdvancedWrap: true } })
      .setOrigin(0.5, 0)
      .setDepth(100001)
      .setVisible(false);

    this.input.addPointer(1);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => (this.press = { x: pointer.x, y: pointer.y, moved: false }));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.length && !this.press?.moved) {
        this.highlight(null, pointer.wasTouch);
      }
      this.pinch = null;
    });
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => this.zoomAt(dy > 0 ? 0.87 : 1.15, pointer.x, pointer.y));
    this.scale.on('resize', () => (this.scale.width !== this.sized.w || this.scale.height !== this.sized.h) && this.start());

    this.setNight(darkness(new Date().toISOString(), 0));
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this.setNight(darkness(new Date().toISOString(), 0)) });

    this.start();
    this.ready = true;
    this.applyBadges();
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;
    this.traffic.update(dt);
    this.crowd.update(dt);
    this.renderCars();
    this.renderPeople();
    this.renderDucks(dt);
    this.renderSignals();
    this.renderOwn(dt);
    this.renderBadges();
  }

  setBadges(list: { key: string; text: string }[]) {
    this.badgeText = new Map(list.map((b) => [b.key, b.text]));
    if (this.ready) {
      this.applyBadges();
    }
  }

  private applyBadges() {
    for (const [key, badge] of this.badges) {
      if (!this.badgeText.has(key)) {
        badge.ring.destroy();
        badge.mark.destroy();
        this.badges.delete(key);
      }
    }
    for (const key of this.badgeText.keys()) {
      const spot = this.spots.find((s) => s.def.key === key);
      if (!spot || this.badges.has(key)) {
        continue;
      }
      const ring = this.add.circle(0, 0, 11, 0xe63946).setStrokeStyle(2.5, 0xffffff).setDepth(99990).setInteractive({ useHandCursor: true });
      const mark = this.add.text(0, 0, '!', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#ffffff', resolution: 2 }).setOrigin(0.5).setDepth(99991);
      ring.on('pointerover', (pointer: Phaser.Input.Pointer) => this.isMouse(pointer) && this.highlight(spot, false));
      ring.on('pointerout', (pointer: Phaser.Input.Pointer) => this.isMouse(pointer) && this.active === spot && this.highlight(null, false));
      ring.on('pointerup', (pointer: Phaser.Input.Pointer) => this.tap(spot, pointer));
      this.badges.set(key, { spot, ring, mark });
    }
    if (this.active) {
      this.highlight(this.active, false);
    }
  }

  private renderBadges() {
    const bounce = Math.abs(Math.sin(this.clock * 3)) * 4;
    for (const { spot, ring, mark } of this.badges.values()) {
      const center = iso(spot.def.box.x + spot.def.box.w / 2, spot.def.box.y + spot.def.box.d / 2, spot.def.top);
      const lift = (spot.plate.visible ? spot.plate.displayHeight + 6 * this.labelScale : 0) + (14 + bounce) * this.labelScale;
      ring.setPosition(center.x, center.y - lift).setScale(this.labelScale);
      mark.setPosition(center.x, center.y - lift).setScale(this.labelScale);
    }
  }

  start() {
    this.reset();
    if (this.scale.width / this.ratio < 640) {
      const target = iso(8.5, 9.2);
      const camera = this.cameras.main;
      camera.setZoom(this.fit * PHONE_ZOOM);
      camera.centerOn(target.x, target.y - 40);
      this.clamp();
      this.updateTouch();
    }
  }

  private makeGlowTexture() {
    const texture = this.textures.createCanvas('city-glow', 64, 64);
    if (!texture) {
      return;
    }
    const ctx = texture.getContext();
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    texture.refresh();
  }

  private glow(x: number, y: number, w: number, h: number, color: number, depth: number, alpha = 1) {
    const image = this.add.image(x, y, 'city-glow').setDisplaySize(w, h).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setVisible(false);
    this.glows.push({ image, alpha });
    return image;
  }

  private bake(key: string, draw: (p: Painter) => void) {
    const known = this.baked.get(key);
    if (known) {
      return known;
    }
    const probe = new Painter(this.make.graphics({}, false));
    draw(probe);
    probe.g.destroy();
    const { x0, y0, x1, y1 } = probe.bounds;
    const origin = { x: Math.floor(x0 - 2), y: Math.floor(y0 - 2) };
    const s = this.bakeScale;
    const width = Math.max(1, Math.ceil((x1 + 2 - origin.x) * s));
    const height = Math.max(1, Math.ceil((y1 + 2 - origin.y) * s));
    const g = this.make.graphics({}, false);
    g.translateCanvas(-origin.x * s, -origin.y * s);
    g.scaleCanvas(s, s);
    draw(new Painter(g));
    g.generateTexture(key, width, height);
    g.destroy();
    if (probe.lit.length) {
      const lit = this.make.graphics({}, false);
      lit.translateCanvas(-origin.x * s, -origin.y * s);
      lit.scaleCanvas(s, s);
      for (const { points, strength, color } of probe.lit) {
        lit.fillStyle(color, strength);
        lit.fillPoints(points, true);
      }
      lit.generateTexture(`${key}:lit`, width, height);
      lit.destroy();
    }
    this.baked.set(key, origin);
    return origin;
  }

  private image(key: string, x: number, y: number, depth: number) {
    const origin = this.baked.get(key)!;
    const image = this.add.image(x + origin.x, y + origin.y, key).setOrigin(0).setScale(1 / this.bakeScale).setDepth(depth);
    this.tinted.push(image);
    return image;
  }

  private bakeGround() {
    const probe = new Painter(this.make.graphics({}, false));
    drawGround(probe);
    probe.g.destroy();
    const { x0, y0, x1, y1 } = probe.bounds;
    const s = this.bakeScale;
    const chunk = Math.floor(2048 / s);
    for (let x = Math.floor(x0); x < x1; x += chunk) {
      for (let y = Math.floor(y0); y < y1; y += chunk) {
        const key = `city-ground-${x}-${y}`;
        const left = x - 2;
        const top = y - 2;
        const g = this.make.graphics({}, false);
        g.translateCanvas(-left * s, -top * s);
        g.scaleCanvas(s, s);
        drawGround(new Painter(g));
        g.generateTexture(key, Math.ceil((Math.min(chunk, x1 - x) + 4) * s), Math.ceil((Math.min(chunk, y1 - y) + 4) * s));
        g.destroy();
        this.tinted.push(this.add.image(left, top, key).setOrigin(0).setScale(1 / s).setDepth(0));
      }
    }
  }

  private addItem(item: Item, index: number, depth: number) {
    const key = item.key ?? `city-item-${index}`;
    this.bake(key, item.draw);
    const at = item.at ?? { x: 0, y: 0 };
    this.image(key, at.x, at.y, depth);
    if (this.textures.exists(`${key}:lit`)) {
      const origin = this.baked.get(key)!;
      const lit = this.add.image(at.x + origin.x, at.y + origin.y, `${key}:lit`).setOrigin(0).setScale(1 / this.bakeScale).setDepth(depth + 0.02).setVisible(false);
      this.glows.push({ image: lit, alpha: 1 });
    }
    if (item.key === 'lamp') {
      this.glow(at.x + 6, at.y - 31, 26, 26, 0xffe2a0, depth + 0.03, 0.9);
      this.glow(at.x + 6, at.y + 2, 70, 30, 0xffcf70, 0.5, 0.45);
    }
  }

  depthAt(x: number, y: number) {
    const key = (Math.round(x * 4) + 400) * 1000 + Math.round(y * 4) + 400;
    const known = this.depthCache.get(key);
    if (known !== undefined) {
      return known;
    }
    const q = { x0: x - 0.1, y0: y - 0.1, x1: x + 0.1, y1: y + 0.1 };
    let depth = 0;
    this.feet.forEach((f, i) => {
      const behind = f.x1 <= q.x0 + 0.001 || f.y1 <= q.y0 + 0.001;
      const front = q.x1 <= f.x0 + 0.001 || q.y1 <= f.y0 + 0.001;
      if (behind && !front) {
        depth = i + 1;
      }
    });
    this.depthCache.set(key, depth + 0.5);
    return depth + 0.5;
  }

  private addSignals() {
    this.bake('signal', (p) => signalPole(p));
    for (const c of X_ROADS) {
      for (const r of Y_ROADS) {
        for (const [x, y, axis] of [[c - 0.08, r - 0.08, 'h'], [c + 1.08, r + 1.08, 'h'], [c + 1.08, r - 0.08, 'v'], [c - 0.08, r + 1.08, 'v']] as const) {
          const at = iso(x, y);
          const depth = this.depthAt(x, y);
          this.image('signal', at.x, at.y, depth);
          const lamp = this.add.circle(at.x, at.y - 22.5, 1.7, SIGNAL_COLORS.red).setDepth(depth + 0.01);
          this.signals.push({ c, r, axis, lamp, state: null });
        }
      }
    }
  }

  private addTraffic() {
    this.traffic = new Traffic(46, CAR_COLORS);
    for (const color of CAR_COLORS) {
      for (const along of ['x', 'y'] as const) {
        this.bake(`car:${color}:${along}`, (p) => drawCar(p, 0, 0, along, color));
      }
    }
    for (const car of this.traffic.cars) {
      const key = `car:${car.color}:${car.along}`;
      this.cars.push({ image: this.image(key, 0, 0, 1), key });
      this.beams.push(this.glow(0, 0, 26, 13, 0xfff4cc, 1, 0.55));
    }
    for (const shirt of SHIRTS) {
      this.bake(`person:${shirt}`, (p) => person(p, shirt));
    }
    this.crowd = new Crowd(110, SHIRTS, (c, r, axis) => this.traffic.light(c, r, axis));
    for (const walker of this.crowd.people) {
      const key = `person:${walker.color}`;
      this.walkers.push({ image: this.image(key, 0, 0, 1), key });
    }
  }

  private addDucks() {
    for (const mallard of [false, true]) {
      this.bake(`duck:${mallard}`, (p) => duck(p, 0, 0, mallard));
    }
    for (let i = 0; i < 7; i++) {
      const river = i >= 4;
      const key = `duck:${i % 2 === 1}`;
      const image = this.image(key, 0, 0, 0.6);
      this.ducks.push({ image, river, t: i * 1.7, speed: river ? 0.25 + i * 0.03 : 0.25 + i * 0.07, radius: 0.3 + (i % 4) * 0.13, lastX: 0 });
    }
  }

  private place(mover: Mover, key: string, x: number, y: number, lift = 0) {
    if (mover.key !== key) {
      mover.key = key;
      mover.image.setTexture(key);
    }
    const origin = this.baked.get(key)!;
    const at = iso(x, y);
    mover.image.setPosition(at.x + origin.x, at.y + origin.y - lift).setDepth(this.depthAt(x, y));
  }

  private renderCars() {
    this.traffic.cars.forEach((car, i) => {
      const mover = this.cars[i];
      const beam = this.beams[i];
      mover.image.setVisible(!car.hidden);
      if (car.hidden) {
        beam.setVisible(false);
        return;
      }
      this.place(mover, `car:${car.color}:${car.along}`, car.x, car.y);
      if (this.night > 0.05) {
        const front = iso(car.x + car.hx * 0.55, car.y + car.hy * 0.55, 2);
        beam.setPosition(front.x, front.y).setDepth(mover.image.depth + 0.01).setVisible(true);
      }
    });
  }

  private renderPeople() {
    this.crowd.people.forEach((walker, i) => {
      const lift = walker.walking ? Math.abs(Math.sin(walker.phase)) * 1.2 : 0;
      this.place(this.walkers[i], `person:${walker.color}`, walker.x, walker.y, lift);
    });
  }

  private renderDucks(dt: number) {
    for (const d of this.ducks) {
      d.t += d.speed * dt;
      let x: number;
      let y: number;
      if (d.river) {
        const span = 5;
        const u = (Math.sin(d.t * 0.3) + 1) / 2;
        const pos = 2 + u * span;
        const i = Math.min(RIVER.length - 2, Math.floor(pos));
        const f = pos - i;
        x = RIVER[i][0] + (RIVER[i + 1][0] - RIVER[i][0]) * f;
        y = RIVER[i][1] + (RIVER[i + 1][1] - RIVER[i][1]) * f + (d.radius - 0.4) * 0.4;
      } else {
        x = LAKE.x + Math.cos(d.t) * d.radius;
        y = LAKE.y + Math.sin(d.t) * d.radius * 0.9;
      }
      const at = iso(x, y);
      const origin = this.baked.get(d.image.texture.key)!;
      d.image.setPosition(at.x + origin.x, at.y + origin.y + Math.sin(this.clock * 2 + d.t) * 0.4);
      if (Math.abs(at.x - d.lastX) > 0.01) {
        d.image.setFlipX(at.x < d.lastX);
      }
      d.lastX = at.x;
    }
  }

  private renderSignals() {
    for (const signal of this.signals) {
      const state = this.traffic.light(signal.c, signal.r, signal.axis);
      if (state !== signal.state) {
        signal.state = state;
        signal.lamp.setFillStyle(SIGNAL_COLORS[state]);
      }
    }
  }

  setNight(value: number) {
    this.night = value;
    const r = 1 - 0.62 * value;
    const g = 1 - 0.55 * value;
    const b = 1 - 0.3 * value;
    const tint = mix(0xffffff, r, g, b);
    for (const image of this.tinted) {
      image.setTint(tint);
    }
    for (const { image, alpha } of this.glows) {
      image.setAlpha(alpha * value).setVisible(value > 0.05);
    }
    for (const spot of this.spots) {
      spot.painter.tint = [r, g, b];
      this.paint(spot, spot === this.active ? 1.14 : 1);
      spot.lit.setAlpha(value).setVisible(value > 0.05);
    }
  }

  setOwnTrack(state: OwnTrackState, place: Omit<CityPlace, 'key'>) {
    ownState.status = state.status;
    ownState.progress = state.progress;
    const target = this.places.find((p) => p.key === 'own');
    if (target) {
      Object.assign(target, place);
    }
    if (this.ownSpot && this.active === this.ownSpot) {
      this.highlight(this.ownSpot, false);
    }
    if (this.ready) {
      this.refreshOwn();
    }
  }

  private refreshOwn() {
    if (this.ownSpot) {
      this.paint(this.ownSpot, this.active === this.ownSpot ? 1.14 : 1);
    }
    const sign = ownSign();
    this.ownText?.setText(sign.text).setColor(sign.color);
    this.ownFx?.clear();
    this.ownCar?.image.setVisible(ownState.status === 'open');
    for (const worker of this.workers) {
      worker.image.setVisible(ownState.status === 'building');
    }
  }

  private renderOwn(dt: number) {
    const status = ownState.status;
    const depth = this.ownSpot?.depth ?? 0;
    if (status === 'building') {
      if (!this.workers.length) {
        this.bake('person:worker', (p) => person(p, 0xf28c28));
        for (let i = 0; i < 3; i++) {
          const x = OWN_BOX.x + 0.8 + i * 1.1;
          const y = OWN_BOX.y + 1.2 + i * 0.9;
          this.workers.push({ image: this.image('person:worker', 0, 0, depth + 0.25), x, y, tx: x, ty: y });
        }
        this.setNight(this.night);
      }
      const g = this.ownFx;
      const painter = new Painter(g);
      painter.tint = [1 - 0.62 * this.night, 1 - 0.55 * this.night, 1 - 0.3 * this.night];
      g.clear();
      const u = 0.6 + (CRANE.jib - 0.9) * (0.5 + 0.5 * Math.sin(this.clock * 0.35));
      const drop = 22 + 22 * (0.5 + 0.5 * Math.sin(this.clock * 0.8));
      const top = iso(CRANE.x + u, CRANE.y, CRANE.h);
      const hook = iso(CRANE.x + u, CRANE.y, CRANE.h - drop);
      painter.rect(top.x - 3, top.y - 1, 6, 3, 0x5b5f66);
      painter.line(top, hook, 0x30343b, 1);
      painter.box({ x: CRANE.x + u - 0.15, y: CRANE.y - 0.12, w: 0.3, d: 0.24, z: CRANE.h - drop - 6, h: 6 }, 0xb5523b);
      const ex = OWN_BOX.x + 1.4 + 1.6 * (0.5 + 0.5 * Math.sin(this.clock * 0.25));
      const ey = OWN_BOX.y + 2.9;
      painter.ellipse(iso(ex, ey).x + 3, iso(ex, ey).y + 1, 16, 6, 0x000000, 0.2);
      painter.box({ x: ex - 0.3, y: ey - 0.2, w: 0.6, d: 0.4, h: 3 }, 0x30343b);
      painter.box({ x: ex - 0.25, y: ey - 0.18, w: 0.5, d: 0.36, z: 3, h: 6 }, 0xf4c430);
      painter.box({ x: ex - 0.2, y: ey - 0.16, w: 0.22, d: 0.3, z: 9, h: 5 }, 0x9cc3db);
      const swing = Math.sin(this.clock * 1.3) * 0.15;
      const elbow = iso(ex + 0.45, ey, 13 + swing * 10);
      painter.line(iso(ex + 0.2, ey, 8), elbow, 0xe0a800, 2.5);
      painter.line(elbow, iso(ex + 0.75, ey, 4 - swing * 8), 0xe0a800, 2.5);
      painter.rect(iso(ex + 0.75, ey, 4 - swing * 8).x - 2.5, iso(ex + 0.75, ey, 4 - swing * 8).y - 2, 5, 4, 0x5b5f66);
      for (const w of this.workers) {
        if (Math.hypot(w.tx - w.x, w.ty - w.y) < 0.05) {
          w.tx = OWN_BOX.x + 0.4 + Math.random() * (OWN_BOX.w - 0.8);
          w.ty = OWN_BOX.y + 0.6 + Math.random() * (OWN_BOX.d - 1.2);
        }
        const dist = Math.hypot(w.tx - w.x, w.ty - w.y);
        const step = Math.min(dist, 0.3 * dt);
        w.x += ((w.tx - w.x) / dist) * step;
        w.y += ((w.ty - w.y) / dist) * step;
        const at = iso(w.x, w.y);
        const origin = this.baked.get('person:worker')!;
        w.image.setPosition(at.x + origin.x, at.y + origin.y - Math.abs(Math.sin(this.clock * 9 + w.tx)) * 1.2);
      }
    }
    if (status === 'open') {
      if (!this.ownCar) {
        for (const along of ['x', 'y'] as const) {
          this.bake(`car:${0xe63946}:${along}`, (p) => drawCar(p, 0, 0, along, 0xe63946));
        }
        this.ownCar = { image: this.image(`car:${0xe63946}:x`, 0, 0, depth + 0.3), key: `car:${0xe63946}:x` };
        this.setNight(this.night);
      }
      const a = this.clock * 0.7;
      const at = ringPoint(a);
      const along = Math.abs(Math.sin(a) * OWN_RING.rx) > Math.abs(Math.cos(a) * OWN_RING.ry) ? 'x' : 'y';
      const key = `car:${0xe63946}:${along}`;
      if (this.ownCar.key !== key) {
        this.ownCar.key = key;
        this.ownCar.image.setTexture(key);
      }
      const origin = this.baked.get(key)!;
      const screen = iso(at.x, at.y);
      this.ownCar.image.setPosition(screen.x + origin.x, screen.y + origin.y).setDepth(depth + 0.3);
    }
  }

  private addSpot(def: BuildingDef, depth: number) {
    const painter = new Painter(this.add.graphics().setDepth(depth));
    def.draw(painter);
    const lit = this.add.graphics().setDepth(depth + 0.02).setVisible(false);
    for (const { points, strength, color } of painter.lit) {
      lit.fillStyle(color, strength);
      lit.fillPoints(points, true);
    }
    const place = this.places.find((p) => p.key === def.key);
    if (!place) {
      return;
    }
    const center = iso(def.box.x + def.box.w / 2, def.box.y + def.box.d / 2, def.top);
    const plate = this.add
      .text(center.x, center.y, place.label ?? place.name, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#ffffff', backgroundColor: ACCENT, padding: { x: 10, y: 5 }, resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(100000)
      .setVisible(false);
    const spot: Spot = { def, place, painter, plate, lit, depth };

    painter.g.setInteractive({ hitArea: new Phaser.Geom.Polygon(hull(def.box)), hitAreaCallback: Phaser.Geom.Polygon.Contains, useHandCursor: true });
    painter.g.on('pointerover', (pointer: Phaser.Input.Pointer) => this.isMouse(pointer) && this.highlight(spot, false));
    painter.g.on('pointerout', (pointer: Phaser.Input.Pointer) => this.isMouse(pointer) && this.active === spot && this.highlight(null, false));
    painter.g.on('pointerup', (pointer: Phaser.Input.Pointer) => this.tap(spot, pointer));
    this.spots.push(spot);
    if (def.key === 'own') {
      this.ownSpot = spot;
    }
  }

  private isMouse(pointer: Phaser.Input.Pointer) {
    if (pointer.wasTouch) {
      this.touchedAt = performance.now();
      return false;
    }
    return performance.now() - this.touchedAt > 800;
  }

  private addEntrance(depth: number) {
    const foot = iso(ENTRANCE.gx, ENTRANCE.gy);
    const sign = this.add
      .text(foot.x, foot.y - 34, this.cityName, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#15171c', backgroundColor: '#ffffff', padding: { x: 9, y: 4 }, resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(depth + 0.1)
      .setInteractive({ useHandCursor: true });
    const frame = this.add.graphics().setDepth(depth + 0.2);
    frame.lineStyle(2, 0x15171c, 1);
    frame.strokeRect(sign.x - sign.width / 2 + 2, sign.y - sign.height + 2, sign.width - 4, sign.height - 4);

    sign.on('pointerover', (pointer: Phaser.Input.Pointer) => this.isMouse(pointer) && this.showSign(true));
    sign.on('pointerout', (pointer: Phaser.Input.Pointer) => this.isMouse(pointer) && this.showSign(false));
    sign.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const mouse = this.isMouse(pointer);
      if (!this.press?.moved && (mouse || pointer.wasTouch)) {
        this.showSign(mouse || !this.signOpen);
      }
    });
    this.sign = sign;
  }

  setPerks(text: string) {
    this.perks = text;
    if (this.signOpen) {
      this.showSign(true);
    }
  }

  private showSign(open: boolean) {
    this.highlight(null, false);
    this.signOpen = open && this.perks !== '' && !!this.sign;
    if (!this.signOpen || !this.sign) {
      this.tip.setVisible(false);
      return;
    }
    this.tip.setText(this.perks).setVisible(true);
    this.placeTip();
  }

  private tap(spot: Spot, pointer: Phaser.Input.Pointer) {
    const mouse = this.isMouse(pointer);
    if (this.press?.moved || this.pinch || (!mouse && !pointer.wasTouch)) {
      return;
    }
    if (pointer.wasTouch && this.active !== spot) {
      this.highlight(spot, true);
      return;
    }
    this.onSelect(spot.place.to);
  }

  private highlight(spot: Spot | null, touch: boolean) {
    this.signOpen = false;
    if (this.active && this.active !== spot) {
      this.active.plate.setVisible(false);
      this.paint(this.active, 1);
    }
    this.active = spot;
    if (!spot) {
      this.tip.setVisible(false);
      return;
    }
    this.paint(spot, 1.14);
    spot.plate.setText(spot.place.name).setVisible(true);
    const badge = this.badgeText.get(spot.def.key);
    const about = badge ? `${spot.place.text}\n! ${badge}` : spot.place.text;
    this.tip.setText(touch ? `${about}\n${t('city.tapAgain')}` : about).setVisible(true);
    this.placeTip();
  }

  private placeTip() {
    const anchor = this.active?.plate ?? (this.signOpen ? this.sign : null);
    if (!anchor || !this.tip.visible) {
      return;
    }
    const camera = this.cameras.main;
    const { width, height } = this.scale;
    const halfW = width / 2 / camera.zoom;
    const halfH = height / 2 / camera.zoom;
    const cx = camera.scrollX + width / 2;
    const cy = camera.scrollY + height / 2;
    const pad = (6 * this.ratio) / camera.zoom;
    const tipW = this.tip.displayWidth;
    const tipH = this.tip.displayHeight;
    const x = tipW + 2 * pad >= halfW * 2 ? cx : Phaser.Math.Clamp(anchor.x, cx - halfW + tipW / 2 + pad, cx + halfW - tipW / 2 - pad);
    let y = anchor.y + 6 * this.tip.scaleY;
    if (y + tipH > cy + halfH - pad) {
      y = anchor.y - anchor.displayHeight - tipH - 6 * this.tip.scaleY;
    }
    this.tip.setPosition(x, y);
    if (anchor !== this.sign) {
      const plateW = anchor.displayWidth;
      anchor.setX(Phaser.Math.Clamp(anchor.x, cx - halfW + plateW / 2 + pad, cx + halfW - plateW / 2 - pad));
    }
  }

  private paint(spot: Spot, light: number) {
    spot.painter.g.clear();
    spot.painter.light = light;
    spot.painter.lit.length = 0;
    spot.def.draw(spot.painter);
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    const down = this.input.manager.pointers.filter((p) => p.isDown);
    if (down.length >= 2) {
      const distance = Phaser.Math.Distance.Between(down[0].x, down[0].y, down[1].x, down[1].y);
      if (!this.pinch) {
        this.pinch = { distance, zoom: this.cameras.main.zoom };
      } else if (this.pinch.distance > 0) {
        const target = (this.pinch.zoom * distance) / this.pinch.distance;
        this.zoomAt(target / this.cameras.main.zoom, (down[0].x + down[1].x) / 2, (down[0].y + down[1].y) / 2);
      }
      if (this.press) {
        this.press.moved = true;
      }
      return;
    }
    if (!pointer.isDown || !this.press) {
      return;
    }
    if (Math.abs(pointer.x - this.press.x) + Math.abs(pointer.y - this.press.y) > 10 * (window.devicePixelRatio || 1)) {
      this.press.moved = true;
    }
    if (this.press.moved) {
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
      camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
      this.clamp();
      this.placeTip();
    }
  }

  reset() {
    const { width, height } = this.scale;
    this.sized = { w: width, h: height };
    this.fit = Math.min(width / this.core.width, height / this.core.height);
    this.minZoom = Math.min(this.fit, width / this.area.width, height / this.area.height);
    const camera = this.cameras.main;
    camera.setZoom(this.fit);
    camera.centerOn(this.core.centerX, this.core.centerY);
    this.clamp();
    this.updateTouch();
  }

  zoomCenter(factor: number) {
    this.zoomAt(factor, this.scale.width / 2, this.scale.height / 2);
  }

  private zoomAt(factor: number, sx: number, sy: number) {
    const camera = this.cameras.main;
    const { width, height } = this.scale;
    const zoom = Phaser.Math.Clamp(camera.zoom * factor, this.minZoom, this.fit * MAX_ZOOM);
    const worldX = camera.scrollX + width / 2 + (sx - width / 2) / camera.zoom;
    const worldY = camera.scrollY + height / 2 + (sy - height / 2) / camera.zoom;
    camera.setZoom(zoom);
    camera.scrollX = worldX - width / 2 - (sx - width / 2) / zoom;
    camera.scrollY = worldY - height / 2 - (sy - height / 2) / zoom;
    this.clamp();
    this.updateTouch();
  }

  private clamp() {
    const camera = this.cameras.main;
    const { width, height } = this.scale;
    const halfW = width / 2 / camera.zoom;
    const halfH = height / 2 / camera.zoom;
    const cx = halfW * 2 >= this.area.width ? this.area.centerX : Phaser.Math.Clamp(camera.scrollX + width / 2, this.area.left + halfW, this.area.right - halfW);
    const cy = halfH * 2 >= this.area.height ? this.area.centerY : Phaser.Math.Clamp(camera.scrollY + height / 2, this.area.top + halfH, this.area.bottom - halfH);
    camera.scrollX = cx - width / 2;
    camera.scrollY = cy - height / 2;
  }

  private updateTouch() {
    const zoom = this.cameras.main.zoom;
    this.game.canvas.style.touchAction = zoom > this.fit * 1.01 ? 'none' : 'pan-y';
    const px = Phaser.Math.Clamp(this.scale.width / this.ratio / 65, 10, LABEL_PX);
    const scale = (px * this.ratio) / (19 * zoom);
    for (const spot of this.spots) {
      const center = iso(spot.def.box.x + spot.def.box.w / 2, spot.def.box.y + spot.def.box.d / 2, spot.def.top);
      spot.plate.setScale(scale).setX(center.x);
    }
    this.tip.setScale(scale);
    this.labelScale = scale * 1.2;
    this.placeTip();
  }
}
