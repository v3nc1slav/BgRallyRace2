import Phaser from 'phaser';
import { BUILDINGS, type BuildingDef } from './city/buildings';
import { Painter } from './city/draw';
import { hull, iso } from './city/iso';
import { ENTRANCE, HIGH_X, HIGH_Y, LOW, SIZE_X, SIZE_Y, drawGround, items, sortItems } from './city/plan';

export interface CityPlace {
  key: string;
  name: string;
  label?: string;
  text: string;
  to: string;
}

interface Spot {
  def: BuildingDef;
  place: CityPlace;
  painter: Painter;
  plate: Phaser.GameObjects.Text;
}

const FONT = 'system-ui, -apple-system, Segoe UI, sans-serif';
const PLATE = 'rgba(21, 23, 28, 0.82)';
const ACCENT = '#e63946';
const MAX_ZOOM = 3.5;
const LABEL_PX = 14;

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
  private sign: Phaser.GameObjects.Text | null = null;
  private signOpen = false;
  private perks = '';
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
    drawGround(new Painter(this.add.graphics().setDepth(0)));

    const depths = new Map<BuildingDef, number>();
    sortItems(items()).forEach((item, index) => {
      const painter = new Painter(this.add.graphics().setDepth(index + 1));
      item.draw(painter);
      if (item.building) {
        depths.set(item.building, index + 1);
        this.addSpot(item.building, painter);
      }
      if (item.entrance) {
        this.addEntrance(index + 1.5);
      }
    });

    for (const def of BUILDINGS) {
      for (const sign of def.signs()) {
        this.add
          .text(sign.at.x, sign.at.y, sign.text, { fontFamily: FONT, fontSize: `${sign.size}px`, fontStyle: 'bold', color: sign.color })
          .setOrigin(0.5)
          .setDepth((depths.get(def) ?? 0) + 0.5);
      }
    }

    this.tip = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '17px', color: '#e9ebef', backgroundColor: PLATE, padding: { x: 10, y: 6 }, align: 'center', resolution: 2, wordWrap: { width: 330, useAdvancedWrap: true } })
      .setOrigin(0.5, 0)
      .setDepth(100001)
      .setVisible(false);

    const rect = (target: Phaser.Geom.Rectangle, lo: number, hiX: number, hiY: number, above: number, below: number) => {
      const left = iso(lo, hiY).x;
      const right = iso(hiX, lo).x;
      const top = iso(lo, lo).y - above;
      target.setTo(left, top, right - left, iso(hiX, hiY).y + below - top);
    };
    rect(this.area, LOW, HIGH_X, HIGH_Y, 70, 40);
    rect(this.core, -0.5, SIZE_X + 0.5, SIZE_Y + 0.5, 70, 14);

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
    this.scale.on('resize', () => this.reset());

    this.reset();
    this.ready = true;
  }

  private addSpot(def: BuildingDef, painter: Painter) {
    const place = this.places.find((p) => p.key === def.key);
    if (!place) {
      return;
    }
    const center = iso(def.box.x + def.box.w / 2, def.box.y + def.box.d / 2, def.top);
    const plate = this.add
      .text(center.x, center.y, place.label ?? place.name, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#ffffff', backgroundColor: PLATE, padding: { x: 10, y: 5 }, resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(100000)
      .setInteractive({ useHandCursor: true });
    const spot: Spot = { def, place, painter, plate };

    painter.g.setInteractive({ hitArea: new Phaser.Geom.Polygon(hull(def.box)), hitAreaCallback: Phaser.Geom.Polygon.Contains, useHandCursor: true });
    for (const target of [painter.g, plate]) {
      target.on('pointerover', (pointer: Phaser.Input.Pointer) => this.isMouse(pointer) && this.highlight(spot, false));
      target.on('pointerout', (pointer: Phaser.Input.Pointer) => this.isMouse(pointer) && this.active === spot && this.highlight(null, false));
      target.on('pointerup', (pointer: Phaser.Input.Pointer) => this.tap(spot, pointer));
    }
    this.spots.push(spot);
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
      this.paint(this.active, 1);
    }
    this.active = spot;
    if (!spot) {
      this.tip.setVisible(false);
      this.layoutLabels();
      return;
    }
    this.paint(spot, 1.14);
    const about = spot.place.label && spot.place.label !== spot.place.name ? `${spot.place.name}: ${spot.place.text}` : spot.place.text;
    this.tip.setText(touch ? `${about}\nДокосни отново, за да влезеш` : about).setVisible(true);
    this.layoutLabels();
    this.placeTip();
  }

  private layoutLabels() {
    const rank = (spot: Spot) => (spot === this.active ? -1 : this.places.indexOf(spot.place));
    const shown: Phaser.Geom.Rectangle[] = [];
    for (const spot of [...this.spots].sort((a, b) => rank(a) - rank(b))) {
      const bounds = spot.plate.getBounds();
      const free = spot === this.active || !shown.some((other) => Phaser.Geom.Intersects.RectangleToRectangle(other, bounds));
      spot.plate.setVisible(free);
      if (free) {
        shown.push(bounds);
      }
    }
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
  }

  private paint(spot: Spot, light: number) {
    spot.painter.g.clear();
    spot.painter.light = light;
    spot.def.draw(spot.painter);
    spot.plate.setBackgroundColor(light > 1 ? ACCENT : PLATE);
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
      spot.plate.setScale(scale);
    }
    this.tip.setScale(scale);
    this.layoutLabels();
    this.placeTip();
  }
}
