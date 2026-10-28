import { drawCharacter, drawCompanion, ensureMistTexture, ensureSparkleTexture, TEXT_STYLE } from '../art.js';

const SPEED = 130;
const TALK_DISTANCE = 56;
const REST_REMINDER_MS = 15 * 60 * 1000;

export default class TownScene extends Phaser.Scene {
  constructor() { super('Town'); }

  init(data) {
    this.zone = data.zone;
    this.fogLevel = 1; // 1 = 灰霧最濃，0 = 完全恢復色彩
  }

  create() {
    this.content = this.cache.json.get(`content:${this.zone}`);
    this.companionInfo = this.registry.get('companion');

    // ---- 地圖 ----
    const map = this.make.tilemap({ key: `map:${this.zone}` });
    const tileset = map.addTilesetImage('placeholder-tiles', 'tiles');
    const layers = ['ground', 'obstacles'].map((name) => {
      const layer = map.createLayer(name, tileset);
      layer.setCollisionByProperty({ collides: true });
      return layer;
    });
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    const spawns = map.getObjectLayer('spawns').objects;
    const spawn = (name) => spawns.find((o) => o.name === name);

    // ---- 玩家與陪伴小動物 ----
    drawCharacter(this, 'player', this.registry.get('look'));
    drawCompanion(this, 'companion', this.companionInfo.id);
    const p = spawn('player');
    this.player = this.physics.add.sprite(p.x, p.y, 'player').setScale(0.5);
    this.player.body.setSize(36, 22).setOffset(14, 54);
    this.player.setCollideWorldBounds(true);
    this.companion = this.add.image(p.x - 20, p.y + 6, 'companion').setScale(0.6);
    this.facing = 1;
    layers.forEach((layer) => this.physics.add.collider(this.player, layer));

    // ---- 居民 ----
    this.residents = this.content.residents.map((data) => {
      const pos = spawn(data.id);
      drawCharacter(this, `resident:${data.id}`, data.appearance);
      const sprite = this.physics.add.image(pos.x, pos.y, `resident:${data.id}`).setScale(0.5).setImmovable(true);
      sprite.body.setSize(36, 22).setOffset(14, 54);
      this.physics.add.collider(this.player, sprite);
      this.add.text(pos.x, pos.y - 30, data.name, {
        ...TEXT_STYLE, fontSize: '11px', backgroundColor: '#fffaf3', padding: { x: 5, y: 1 },
      }).setOrigin(0.5).setDepth(5000);
      const marker = this.add.text(pos.x, pos.y - 46, '♡', { ...TEXT_STYLE, fontSize: '15px', color: '#e8a08a' })
        .setOrigin(0.5).setDepth(5000);
      this.tweens.add({ targets: marker, y: marker.y - 4, duration: 600, yoyo: true, repeat: -1 });
      const resident = { data, sprite, marker, talked: false };
      sprite.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.distanceTo(resident) < TALK_DISTANCE * 1.5) this.talk(resident);
      });
      return resident;
    });

    // ---- 灰霧與微光 ----
    this.createFog(map.widthInPixels, map.heightInPixels);
    ensureSparkleTexture(this);
    // 漂浮的小光點：灰霧越淡，出現得越頻繁
    this.motes = this.add.particles(0, 0, 'sparkle', {
      x: { min: 0, max: map.widthInPixels }, y: { min: 0, max: map.heightInPixels },
      lifespan: 4000, speedY: { min: -12, max: -4 }, speedX: { min: -4, max: 4 },
      scale: { start: 0.5, end: 0.1 }, alpha: { start: 0.9, end: 0 }, frequency: 1500,
    }).setDepth(9002);
    this.burst = this.add.particles(0, 0, 'sparkle', {
      lifespan: 1600, speed: { min: 30, max: 90 }, gravityY: -30,
      scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(9003);
    this.applyFog();

    // ---- 鏡頭與輸入 ----
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels).setZoom(1.5);
    cam.startFollow(this.player, true, 0.12, 0.12);
    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,ENTER');

    this.scene.launch('UI');
    this.ui = this.scene.get('UI');
    this.ui.events.once('create', () => {
      this.ui.showDialogue([{ speaker: this.companionInfo.label, text: this.content.intro }]);
    });

    // 陪伴小動物提醒休息
    this.time.addEvent({
      delay: REST_REMINDER_MS, loop: true,
      callback: () => this.companionSay('玩一陣子了，要不要起來伸展一下、喝口水？'),
    });
  }

  createFog(w, h) {
    ensureMistTexture(this);
    this.fogOverlay = this.add.rectangle(0, 0, w, h, 0xd6d0cb).setOrigin(0).setDepth(9000);
    this.mists = [];
    for (let i = 0; i < 10; i++) {
      const m = this.add.image(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), 'mist')
        .setScale(Phaser.Math.FloatBetween(1.2, 2.2)).setDepth(9001);
      this.tweens.add({
        targets: m, x: m.x + Phaser.Math.Between(60, 140), duration: Phaser.Math.Between(9000, 15000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.mists.push(m);
    }
    // WebGL 下讓整個畫面去飽和；Canvas 模式只用霧層
    if (this.renderer.type === Phaser.WEBGL) this.colorFx = this.cameras.main.postFX.addColorMatrix();
    this.applyFog();
  }

  applyFog() {
    this.fogOverlay.setAlpha(0.3 * this.fogLevel);
    this.mists.forEach((m) => m.setAlpha(0.45 * this.fogLevel));
    if (this.colorFx) this.colorFx.reset().saturate(-0.75 * this.fogLevel);
    this.motes?.setFrequency(250 + 1500 * this.fogLevel);
  }

  clearFog(amount) {
    this.tweens.addCounter({
      from: this.fogLevel, to: Math.max(0, this.fogLevel - amount), duration: 3000, ease: 'Sine.easeInOut',
      onUpdate: (tw) => { this.fogLevel = tw.getValue(); this.applyFog(); },
    });
  }

  distanceTo(resident) {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, resident.sprite.x, resident.sprite.y);
  }

  nearestResident() {
    return this.residents.find((r) => this.distanceTo(r) < TALK_DISTANCE);
  }

  talk(resident) {
    if (!this.ui.canStartDialogue()) return;
    this.ui.showDialogue(resident.data.dialogue, () => {
      if (resident.talked) return;
      resident.talked = true;
      resident.marker.destroy();
      this.burst.explode(40, resident.sprite.x, resident.sprite.y - 10);
      this.clearFog(resident.data.fogReduction ?? 0.3);
      this.time.delayedCall(1200, () => this.companionSay('你看，廣場的顏色回來了一些。'));
    });
  }

  companionSay(text) {
    this.bubble?.destroy();
    this.bubble = this.add.text(this.companion.x, this.companion.y - 22, text, {
      ...TEXT_STYLE, fontSize: '11px', backgroundColor: '#fbf6ee', padding: { x: 6, y: 4 },
      wordWrap: { width: 180, useAdvancedWrap: true },
    }).setOrigin(0.5, 1).setDepth(9500);
    this.tweens.add({ targets: this.bubble, alpha: 0, delay: 4000, duration: 800 });
  }

  update() {
    const near = this.nearestResident();
    const busy = this.ui.isDialogueOpen?.();
    this.ui.setTalkTarget?.(busy ? null : near, () => near && this.talk(near));

    const k = this.keys;
    // 每一幀都讀取 JustDown，避免對話中按的鍵在對話結束後才被當成新的一次按鍵
    const pressed = Phaser.Input.Keyboard.JustDown(k.SPACE) | Phaser.Input.Keyboard.JustDown(k.ENTER);
    let dx = 0, dy = 0;
    if (!busy) {
      const stick = this.registry.get('stick') || { x: 0, y: 0 };
      dx = (k.LEFT.isDown || k.A.isDown ? -1 : 0) + (k.RIGHT.isDown || k.D.isDown ? 1 : 0) + stick.x;
      dy = (k.UP.isDown || k.W.isDown ? -1 : 0) + (k.DOWN.isDown || k.S.isDown ? 1 : 0) + stick.y;
      if (near && pressed) this.talk(near);
    }
    const v = new Phaser.Math.Vector2(dx, dy);
    if (v.length() > 1) v.normalize();
    this.player.setVelocity(v.x * SPEED, v.y * SPEED);
    if (v.x !== 0) {
      this.facing = Math.sign(v.x);
      this.player.setFlipX(this.facing < 0);
    }

    // 走路時輕輕搖擺，站著時慢慢呼吸
    const t = this.time.now;
    this.player.setAngle(v.length() > 0 ? Math.sin(t / 70) * 5 : 0);
    this.residents.forEach((r) => r.sprite.setAngle(Math.sin(t / 700 + r.sprite.x) * 2.5));

    // 依 y 座標排前後
    this.player.setDepth(this.player.y);
    this.residents.forEach((r) => r.sprite.setDepth(r.sprite.y));

    // 小動物跟在身後
    const tx = this.player.x - 18 * this.facing;
    const ty = this.player.y + 8;
    this.companion.x += (tx - this.companion.x) * 0.08;
    this.companion.y += (ty - this.companion.y) * 0.08 + Math.sin(t / 160) * 0.25;
    this.companion.setFlipX(this.facing < 0).setDepth(this.companion.y);
    if (this.bubble?.active) this.bubble.setPosition(this.companion.x, this.companion.y - 22);
  }
}
