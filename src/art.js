// 2D 版的共用美術工具。人物與造景已清空，等重新設計；暫時用簡單的標記代表角色。

export const COMPANIONS = [
  { id: 'cat', label: '貓' },
  { id: 'dog', label: '狗' },
  { id: 'hedgehog', label: '刺蝟' },
  { id: 'otter', label: '水獺' },
];

const color = (hex) => Phaser.Display.Color.HexStringToColor(hex).color;

function replaceTexture(scene, key, g, w, h) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  g.generateTexture(key, w, h);
  g.destroy();
}

// 角色標記：圓角膠囊加上地面陰影，上方的白點代表臉的方向
export function drawMarker(scene, key, fill, w = 28, h = 40) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x000000, 0.12).fillEllipse(w / 2 + 2, h + 2, w, 8);
  g.fillStyle(fill).fillRoundedRect(2, 2, w, h, w / 2);
  g.lineStyle(2, 0x8a6f60, 0.6).strokeRoundedRect(2, 2, w, h, w / 2);
  g.fillStyle(0xfffaf3).fillCircle(w / 2 + 2, 2 + w / 2, w * 0.14);
  replaceTexture(scene, key, g, w + 4, h + 8);
}

// 灰霧散去時的小閃光
export function ensureSparkleTexture(scene) {
  if (scene.textures.exists('sparkle')) return;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xfff6d8, 0.5).fillCircle(8, 8, 7);
  g.fillStyle(0xffffff).fillTriangle(8, 0, 6.5, 8, 9.5, 8).fillTriangle(8, 16, 6.5, 8, 9.5, 8)
    .fillTriangle(0, 8, 8, 6.5, 8, 9.5).fillTriangle(16, 8, 8, 6.5, 8, 9.5);
  g.generateTexture('sparkle', 16, 16);
  g.destroy();
}

// 灰霧用的柔邊圓形
export function ensureMistTexture(scene) {
  if (scene.textures.exists('mist')) return;
  const tex = scene.textures.createCanvas('mist', 256, 256);
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(235,232,228,0.9)');
  grad.addColorStop(1, 'rgba(235,232,228,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  tex.refresh();
}

export const TEXT_STYLE = {
  fontFamily: '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif',
  color: '#4a3f38',
  resolution: 2,
};

// 圓角膠囊按鈕。style: fill、color、fontSize、padX、padY
export function makeButton(scene, x, y, label, onClick, style = {}) {
  const { fill = '#fffaf3', color: textColor = '#4a3f38', fontSize = '18px', padX = 16, padY = 8 } = style;
  const text = scene.add.text(0, 0, label, { ...TEXT_STYLE, fontSize, color: textColor }).setOrigin(0.5);
  const w = text.width + padX * 2;
  const h = text.height + padY * 2;
  const r = Math.min(h / 2, 22);
  const bg = scene.add.graphics();
  const btn = scene.add.container(x, y, [bg, text]).setSize(w, h).setInteractive({ useHandCursor: true });
  btn.setFill = (f) => {
    bg.clear();
    bg.fillStyle(0x8a6f60, 0.12).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, r);
    bg.fillStyle(color(f)).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    bg.lineStyle(2, 0xead6c4).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    return btn;
  };
  btn.setFill(fill);
  btn.on('pointerover', () => scene.tweens.add({ targets: btn, scale: 1.06, duration: 120 }));
  btn.on('pointerout', () => scene.tweens.add({ targets: btn, scale: 1, duration: 120 }));
  btn.on('pointerup', onClick);
  return btn;
}
