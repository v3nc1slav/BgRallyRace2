import Phaser from 'phaser';
import { t } from '../i18n';
import { Dust, Precipitation, type Weather } from './map/effects';
import { HEADER, generatedLayout, tracedLayout, type Layout, type StageShape } from './map/layout';
import { PALETTES, type Palette } from './map/palette';
import { bridgesFromRivers, drawPois, drawRelief, drawScenery, roadGeometry, type RoadGeometry } from './map/terrain';

export type { StageRoute, StageShape } from './map/layout';
export type { Weather } from './map/effects';

export interface CarMarker {
  id: number;
  number: number;
  me: boolean;
  state: 'run' | 'pause' | 'stop';
  f: number;
}

export interface Environment {
  weather: Weather;
}

export type CameraMode = 'all' | 'me' | 'leader';

const CAR_COLORS = { run: 0xd0d7de, pause: 0xd29922, stop: 0x6e7681, me: 0xe63946 };
const ZOOM = 2.2;

interface Car {
  body: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  color: number;
  f: number;
  state: CarMarker['state'];
  dustTimer: number;
}

export class RaceScene extends Phaser.Scene {
  ready = false;
  private stageId = 0;
  private stage?: StageShape;
  private palette: Palette = PALETTES.asphalt;
  private path?: Phaser.Curves.Spline;
  private road?: RoadGeometry;
  private world!: Phaser.GameObjects.Layer;
  private ui!: Phaser.GameObjects.Layer;
  private terrain!: Phaser.GameObjects.Graphics;
  private roadLayer!: Phaser.GameObjects.Graphics;
  private tracks!: Phaser.GameObjects.Graphics;
  private wet!: Phaser.GameObjects.Graphics;
  private tint!: Phaser.GameObjects.Rectangle;
  private dustLayer!: Phaser.GameObjects.Graphics;
  private weatherLayer!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private caption!: Phaser.GameObjects.Text;
  private labels: Phaser.GameObjects.Text[] = [];
  private cars = new Map<number, Car>();
  private dust = new Dust();
  private precipitation!: Precipitation;
  private tracksProgress = 0;
  private lastFrame = 0;
  private cameraMode: CameraMode = 'all';
  private cameraTarget: Phaser.GameObjects.GameObject | null = null;
  private cameraZoomed = false;
  private userZoom = 1;
  private followZoom = ZOOM;
  private pinch: { distance: number; zoom: number } | null = null;

  constructor() {
    super('Race');
  }

  create() {
    const { width, height } = this.scale;
    this.world = this.add.layer();
    this.ui = this.add.layer();

    this.terrain = this.add.graphics().setDepth(0);
    this.roadLayer = this.add.graphics().setDepth(1);
    this.tracks = this.add.graphics().setDepth(1.1);
    this.wet = this.add.graphics().setDepth(1.2);
    this.tint = this.add.rectangle(0, 0, width, height, 0x000000, 0).setOrigin(0).setDepth(2.4);
    this.dustLayer = this.add.graphics().setDepth(2.8);
    this.world.add([this.terrain, this.roadLayer, this.tracks, this.wet, this.tint, this.dustLayer]);

    this.weatherLayer = this.add.graphics().setDepth(1);
    const header = this.add.rectangle(0, 0, width, HEADER, 0x0d1117, 0.6).setOrigin(0).setDepth(5);
    const font = { fontFamily: 'system-ui, sans-serif' };
    this.title = this.add.text(32, 20, '', { ...font, fontSize: '30px', color: '#ffffff' }).setDepth(6);
    this.caption = this.add.text(32, 62, '', { ...font, fontSize: '20px', color: '#d0d7de' }).setDepth(6);
    this.ui.add([this.weatherLayer, header, this.title, this.caption]);

    const uiCamera = this.cameras.add(0, 0, width, height);
    uiCamera.ignore(this.world);
    this.cameras.main.ignore(this.ui);
    this.cameras.main.setBounds(0, 0, width, height);

    this.precipitation = new Precipitation(width, height, HEADER);
    this.input.addPointer(1);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on('pointerup', () => (this.pinch = null));
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? 0.85 : 1.15));
    this.lastFrame = performance.now();
    this.ready = true;
  }

  setCamera(mode: CameraMode) {
    this.cameraMode = mode;
    this.userZoom = 1;
    this.updateTouch();
  }

  zoomBy(factor: number) {
    const camera = this.cameras.main;
    if (this.cameraMode === 'all') {
      this.userZoom = Phaser.Math.Clamp(this.userZoom * factor, 1, 4);
      camera.setZoom(this.userZoom);
      if (this.userZoom === 1) {
        camera.centerOn(this.scale.width / 2, this.scale.height / 2);
      }
    } else {
      this.followZoom = Phaser.Math.Clamp(this.followZoom * factor, 1.2, 4);
      if (this.cameraZoomed) {
        camera.setZoom(this.followZoom);
      }
    }
    this.updateTouch();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    const down = this.input.manager.pointers.filter((p) => p.isDown);
    if (down.length >= 2) {
      const distance = Phaser.Math.Distance.Between(down[0].x, down[0].y, down[1].x, down[1].y);
      const zoom = this.cameraMode === 'all' ? this.userZoom : this.followZoom;
      if (!this.pinch) {
        this.pinch = { distance, zoom };
      } else if (this.pinch.distance > 0) {
        this.zoomBy((this.pinch.zoom * distance) / this.pinch.distance / zoom);
      }
      return;
    }
    if (pointer.isDown && this.cameraMode === 'all' && this.userZoom > 1) {
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
      camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
    }
  }

  private updateTouch() {
    this.game.canvas.style.touchAction = this.cameraMode === 'all' && this.userZoom > 1 ? 'none' : 'pan-y';
  }

  draw(stage: StageShape, markers: CarMarker[], caption: string, env: Environment) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (stage.id !== this.stageId) {
      this.buildStage(stage);
    }
    this.caption.setText(caption);
    this.updateCars(markers, dt);
    this.updateEnvironment(env, dt);
    this.updateCamera(markers);
  }

  private buildStage(stage: StageShape) {
    this.stageId = stage.id;
    this.stage = stage;
    this.cars.forEach((car) => {
      car.body.destroy();
      car.label.destroy();
    });
    this.cars.clear();
    this.labels.forEach((label) => label.destroy());
    this.labels = [];
    this.dust.clear();
    this.tracksProgress = 0;
    this.cameras.main.stopFollow();
    this.cameraTarget = null;

    const { width, height } = this.scale;
    this.palette = PALETTES[stage.surface] ?? PALETTES.asphalt;
    const layout: Layout = stage.route?.points?.length && stage.route.points.length >= 2
      ? tracedLayout(stage.route, width, height)
      : generatedLayout(stage, width, height);

    this.cameras.main.setBackgroundColor(this.palette.ground);
    this.path = new Phaser.Curves.Spline(layout.points);
    this.road = roadGeometry(this.path.getSpacedPoints(Math.max(400, layout.points.length * 14)));

    this.terrain.clear();
    drawRelief(this.terrain, stage.id, width, height, HEADER);
    drawScenery(this.terrain, layout, this.road, this.palette, stage.id, width, height, HEADER);
    const pois = layout.traced ? layout.pois : [...layout.pois, ...bridgesFromRivers(layout, this.road)];

    this.drawRoad(stage.surface);
    drawPois(this.roadLayer, pois, this.road, stage.id);
    this.drawWetShine();
    this.tracks.clear();

    for (const label of layout.labels) {
      const text = this.add
        .text(label.x, label.y, label.name, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: this.palette.text,
          stroke: this.palette.stroke,
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(2.9);
      this.world.add(text);
      this.labels.push(text);
    }

    this.title.setText(t('stageMap.title', { seq: stage.seq, name: stage.name, km: stage.length_km }));
  }

  private drawRoad(surface: string) {
    const g = this.roadLayer;
    const points = this.road!.points;
    g.clear();
    g.lineStyle(30, this.palette.edge, 1);
    g.strokePoints(points);
    g.lineStyle(20, this.palette.road, 1);
    g.strokePoints(points);

    if (surface === 'asphalt') {
      g.lineStyle(2, this.palette.line, 0.7);
      for (let i = 0; i + 3 < points.length; i += 8) {
        g.lineBetween(points[i].x, points[i].y, points[i + 3].x, points[i + 3].y);
      }
    }

    const start = points[0];
    const finish = points[points.length - 1];
    g.fillStyle(0x3fb950, 1);
    g.fillCircle(start.x, start.y, 16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        g.fillStyle((i + j) % 2 ? 0x000000 : 0xffffff, 1);
        g.fillRect(finish.x - 16 + i * 8, finish.y - 16 + j * 8, 8, 8);
      }
    }
  }

  private drawWetShine() {
    const { points, normals } = this.road!;
    this.wet.clear();
    this.wet.lineStyle(3, 0xd8e6f3, 0.28);
    for (let i = 0; i + 4 < points.length; i += 9) {
      const o = (i % 18 === 0 ? 4 : -4);
      this.wet.lineBetween(points[i].x + normals[i].x * o, points[i].y + normals[i].y * o, points[i + 4].x + normals[i + 4].x * o, points[i + 4].y + normals[i + 4].y * o);
    }
    this.wet.setVisible(false);
  }

  private drawTracks(progress: number) {
    if (this.stage?.surface === 'asphalt' || progress < this.tracksProgress + 0.01) {
      return;
    }
    this.tracksProgress = progress;
    const { points, normals } = this.road!;
    const end = Math.round(progress * (points.length - 1));
    this.tracks.clear();
    this.tracks.lineStyle(2, this.palette.tracks, 0.55);
    for (const offset of [-4, 4]) {
      this.tracks.beginPath();
      for (let i = 0; i <= end; i += 2) {
        const x = points[i].x + normals[i].x * offset;
        const y = points[i].y + normals[i].y * offset;
        if (i === 0) {
          this.tracks.moveTo(x, y);
        } else {
          this.tracks.lineTo(x, y);
        }
      }
      this.tracks.strokePath();
    }
  }

  private drawCarBody(car: Car, color: number) {
    const g = car.body;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-10, -5, 22, 12, 3);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-11, -6, 22, 12, 3);
    g.fillStyle(0x1b2430, 1);
    g.fillRect(2, -4.5, 5, 9);
    g.fillRect(-7, -4, 3, 8);
    g.fillStyle(0xff4d4d, 1);
    g.fillRect(-11, -5, 1.5, 3);
    g.fillRect(-11, 2, 1.5, 3);
    car.color = color;
  }

  private updateCars(markers: CarMarker[], dt: number) {
    const seen = new Set<number>();
    const dusty = this.stage?.surface !== 'asphalt';
    let lead = 0;

    for (const marker of markers) {
      seen.add(marker.id);
      let car = this.cars.get(marker.id);
      if (!car) {
        const body = this.add.graphics().setDepth(marker.me ? 3.2 : 3);
        const label = this.add
          .text(0, 0, String(marker.number), { fontFamily: 'system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff', stroke: '#0d1117', strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(3.4);
        this.world.add([body, label]);
        car = { body, label, color: -1, f: marker.f, state: marker.state, dustTimer: 0 };
        this.cars.set(marker.id, car);
      }

      const color = marker.me ? CAR_COLORS.me : CAR_COLORS[marker.state];
      if (color !== car.color) {
        this.drawCarBody(car, color);
      }

      const f = Phaser.Math.Clamp(marker.f, 0, 1);
      const point = this.path!.getPointAt(f);
      const tangent = this.path!.getTangentAt(f);
      car.body.setPosition(point.x, point.y).setRotation(Math.atan2(tangent.y, tangent.x)).setAlpha(marker.state === 'stop' ? 0.7 : 1);
      car.label.setPosition(point.x, point.y - 15);
      car.f = f;
      car.state = marker.state;

      if (dusty && marker.state === 'run') {
        car.dustTimer += dt;
        if (car.dustTimer > 0.06) {
          car.dustTimer = 0;
          this.dust.add(point.x - tangent.x * 12, point.y - tangent.y * 12);
        }
      }
      if (marker.state !== 'stop') {
        lead = Math.max(lead, f);
      }
    }

    for (const [id, car] of this.cars) {
      if (!seen.has(id)) {
        if (car.body === this.cameraTarget) {
          this.cameras.main.stopFollow();
          this.cameraTarget = null;
        }
        car.body.destroy();
        car.label.destroy();
        this.cars.delete(id);
      }
    }

    this.dust.draw(this.dustLayer, this.palette.dust, dt);
    this.drawTracks(lead);
  }

  private updateEnvironment(env: Environment, dt: number) {
    this.wet.setVisible(env.weather === 'rain');

    if (env.weather === 'rain') {
      this.tint.setFillStyle(0x1b2a3a, 0.22);
    } else if (env.weather === 'snow') {
      this.tint.setFillStyle(0xffffff, this.stage?.surface === 'snow' ? 0.08 : 0.25);
    } else {
      this.tint.setFillStyle(0x000000, 0);
    }

    this.precipitation.draw(this.weatherLayer, env.weather, dt);
  }

  private updateCamera(markers: CarMarker[]) {
    const camera = this.cameras.main;
    let target: Phaser.GameObjects.Graphics | null = null;

    if (this.cameraMode === 'me') {
      const mine = markers.find((marker) => marker.me && marker.state !== 'stop') ?? markers.find((marker) => marker.me);
      target = mine ? this.cars.get(mine.id)?.body ?? null : null;
    } else if (this.cameraMode === 'leader') {
      const leader = markers.filter((marker) => marker.state !== 'stop').sort((a, b) => b.f - a.f)[0];
      target = leader ? this.cars.get(leader.id)?.body ?? null : null;
    }

    if (target) {
      if (target !== this.cameraTarget) {
        camera.startFollow(target, false, 0.08, 0.08);
        this.cameraTarget = target;
      }
      if (!this.cameraZoomed) {
        camera.zoomTo(this.followZoom, 600);
        this.cameraZoomed = true;
      }
    } else if (this.cameraTarget || this.cameraZoomed) {
      this.userZoom = 1;
      camera.stopFollow();
      camera.pan(this.scale.width / 2, this.scale.height / 2, 500);
      camera.zoomTo(1, 500);
      this.cameraTarget = null;
      this.cameraZoomed = false;
    }
  }
}
