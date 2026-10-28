// 手機虛擬搖桿：把方向寫進 registry 的 'stick'（x、y 介於 -1 到 1）
const RADIUS = 50;

export default class Joystick {
  constructor(scene, x, y) {
    this.scene = scene;
    this.origin = { x, y };
    this.base = scene.add.circle(x, y, RADIUS, 0xfbf6ee, 0.6).setStrokeStyle(3, 0xc98a6b, 0.8);
    this.thumb = scene.add.circle(x, y, 24, 0xc98a6b, 0.85);
    this.pointerId = null;
    scene.registry.set('stick', { x: 0, y: 0 });

    scene.input.on('pointerdown', (p) => {
      // 只有畫面左下半部會啟動搖桿，避免和對話按鈕搶觸控
      if (this.pointerId !== null || !this.base.visible || p.x > 400 || p.y < 300) return;
      this.pointerId = p.id;
      this.move(p);
    });
    scene.input.on('pointermove', (p) => p.id === this.pointerId && this.move(p));
    scene.input.on('pointerup', (p) => p.id === this.pointerId && this.reset());
  }

  move(p) {
    const v = new Phaser.Math.Vector2(p.x - this.origin.x, p.y - this.origin.y);
    if (v.length() > RADIUS) v.setLength(RADIUS);
    this.thumb.setPosition(this.origin.x + v.x, this.origin.y + v.y);
    this.scene.registry.set('stick', { x: v.x / RADIUS, y: v.y / RADIUS });
  }

  reset() {
    this.pointerId = null;
    this.thumb.setPosition(this.origin.x, this.origin.y);
    this.scene.registry.set('stick', { x: 0, y: 0 });
  }

  setVisible(visible) {
    if (!visible) this.reset();
    this.base.setVisible(visible);
    this.thumb.setVisible(visible);
  }
}
