import Phaser from 'phaser';

const WORLD = 4000;

export class RaceScene extends Phaser.Scene {
  private car!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private speed = 0;

  private readonly maxSpeed = 450;
  private readonly accel = 300;
  private readonly friction = 150;
  private readonly turnRate = 2.8; // радиани в секунда

  constructor() {
    super('Race');
  }

  create() {
    // Временна кола, нарисувана с код (без външни файлове)
    fetch('/wp-json')
  .then((r) => r.json())
  .then((d) => console.log('WordPress казва:', d.name));
  
    const g = this.add.graphics();
    g.fillStyle(0xe63946);
    g.fillRect(0, 0, 40, 20);
    g.fillStyle(0xffffff);
    g.fillRect(24, 3, 8, 14);
    g.generateTexture('car', 40, 20);
    g.destroy();

    // Решетка, за да се вижда движението
    this.add.grid(WORLD / 2, WORLD / 2, WORLD, WORLD, 100, 100, 0x3a3a3a, 1, 0x555555, 1);

    this.physics.world.setBounds(0, 0, WORLD, WORLD);

    this.car = this.physics.add.sprite(WORLD / 2, WORLD / 2, 'car');
    this.car.setCollideWorldBounds(true);

    this.cameras.main.setBounds(0, 0, WORLD, WORLD);
    this.cameras.main.startFollow(this.car, true, 0.1, 0.1);

    this.cursors = this.input.keyboard!.createCursorKeys();
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;

    // Газ, спирачка и триене
    if (this.cursors.up.isDown) {
      this.speed += this.accel * dt;
    } else if (this.cursors.down.isDown) {
      this.speed -= this.accel * 1.5 * dt;
    } else if (this.speed > 0) {
      this.speed = Math.max(0, this.speed - this.friction * dt);
    } else if (this.speed < 0) {
      this.speed = Math.min(0, this.speed + this.friction * dt);
    }
    this.speed = Phaser.Math.Clamp(this.speed, -this.maxSpeed / 2, this.maxSpeed);

    // Завиване (само ако колата се движи)
    const turn = (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
    const grip = Math.min(1, Math.abs(this.speed) / 150);
    const direction = this.speed >= 0 ? 1 : -1;
    this.car.rotation += turn * this.turnRate * grip * direction * dt;

    // Скорост по посока на колата
    const body = this.car.body as Phaser.Physics.Arcade.Body;
    this.physics.velocityFromRotation(this.car.rotation, this.speed, body.velocity);
  }
}