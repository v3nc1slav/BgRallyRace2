import Phaser from 'phaser';

export interface StageShape {
  id: number;
  seq: number;
  name: string;
  length_km: number;
  turns: number;
  surface: string;
  difficulty: number;
}

export interface CarMarker {
  id: number;
  number: number;
  me: boolean;
  state: 'run' | 'pause' | 'stop';
  f: number;
}

const COLORS: Record<string, { ground: number; road: number; edge: number }> = {
  asphalt: { ground: 0x1f2a1c, road: 0x5b5f66, edge: 0x2b2e33 },
  gravel: { ground: 0x332b1e, road: 0xa38b5c, edge: 0x5c4c31 },
  snow: { ground: 0x8fa3b3, road: 0xeef3f7, edge: 0x6f8393 },
};

const MARKER = { run: 0xd0d7de, pause: 0xd29922, stop: 0x6e7681, me: 0xe63946 };

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPoints(stage: StageShape, width: number, height: number) {
  const rnd = random(stage.id * 7919 + stage.turns * 31);
  const count = Math.max(8, Math.min(36, Math.round(stage.turns / 2)));
  const sharpness = 0.35 + stage.difficulty * 0.07;

  let angle = (rnd() - 0.5) * 0.6;
  let x = 0;
  let y = 0;
  const raw = [{ x, y }];
  for (let i = 0; i < count; i++) {
    angle = Phaser.Math.Clamp(angle + (rnd() - 0.5) * sharpness * 2, -1.25, 1.25);
    x += Math.cos(angle);
    y += Math.sin(angle);
    raw.push({ x, y });
  }

  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const scale = Math.min((width - 160) / spanX, (height - 200) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = 120 + (height - 180 - spanY * scale) / 2;

  return raw.map((p) => new Phaser.Math.Vector2(offsetX + (p.x - minX) * scale, offsetY + (p.y - minY) * scale));
}

export class RaceScene extends Phaser.Scene {
  ready = false;
  private stageId = 0;
  private path?: Phaser.Curves.Spline;
  private road!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private caption!: Phaser.GameObjects.Text;
  private markers = new Map<number, Phaser.GameObjects.Container>();

  constructor() {
    super('Race');
  }

  create() {
    this.road = this.add.graphics();
    this.title = this.add.text(32, 24, '', { fontFamily: 'system-ui, sans-serif', fontSize: '30px', color: '#ffffff' });
    this.caption = this.add.text(32, 66, '', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#d0d7de' });
    this.title.setShadow(0, 2, '#000000', 4);
    this.caption.setShadow(0, 2, '#000000', 4);
    this.ready = true;
  }

  draw(stage: StageShape, cars: CarMarker[], caption: string) {
    if (stage.id !== this.stageId) {
      this.buildStage(stage);
    }
    this.caption.setText(caption);

    const seen = new Set<number>();
    for (const car of cars) {
      seen.add(car.id);
      const marker = this.markers.get(car.id) ?? this.createMarker(car);
      const point = this.path!.getPointAt(Phaser.Math.Clamp(car.f, 0, 1));
      marker.setPosition(point.x, point.y);
      (marker.getAt(0) as Phaser.GameObjects.Arc).setFillStyle(car.me ? MARKER.me : MARKER[car.state]);
      marker.setAlpha(car.state === 'stop' ? 0.75 : 1);
      marker.setDepth(car.me ? 3 : 2);
    }

    for (const [id, marker] of this.markers) {
      if (!seen.has(id)) {
        marker.destroy();
        this.markers.delete(id);
      }
    }
  }

  private buildStage(stage: StageShape) {
    this.stageId = stage.id;
    this.markers.forEach((marker) => marker.destroy());
    this.markers.clear();

    const colors = COLORS[stage.surface] ?? COLORS.asphalt;
    this.cameras.main.setBackgroundColor(colors.ground);
    this.path = new Phaser.Curves.Spline(buildPoints(stage, this.scale.width, this.scale.height));
    const points = this.path.getSpacedPoints(600);

    const g = this.road;
    g.clear();
    g.lineStyle(30, colors.edge, 1);
    g.strokePoints(points);
    g.lineStyle(20, colors.road, 1);
    g.strokePoints(points);

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

    this.title.setText(`Етап ${stage.seq}: ${stage.name} · ${stage.length_km} км`);
  }

  private createMarker(car: CarMarker) {
    const circle = this.add.circle(0, 0, 13, MARKER.run).setStrokeStyle(2, 0x0d1117);
    const label = this.add
      .text(0, 0, String(car.number), { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#0d1117', fontStyle: 'bold' })
      .setOrigin(0.5);
    const marker = this.add.container(0, 0, [circle, label]);
    this.markers.set(car.id, marker);
    return marker;
  }
}
