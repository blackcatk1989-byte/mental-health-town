// 佔位美術：用程式畫出 Q 版角色與陪伴小動物，之後替換成正式素材。
// 角色貼圖 64x80、小動物 48x40，遊戲中再縮放。

export const HAIR_STYLES = [
  { id: 'short', label: '短髮' },
  { id: 'long', label: '長髮' },
  { id: 'bun', label: '丸子頭' },
  { id: 'spiky', label: '刺刺短髮' }, // 3D 版專用；2D 版會畫成一般短髮
];
export const HAIR_COLORS = [
  { id: '#4a3a32', label: '深褐' },
  { id: '#7a5a44', label: '栗色' },
  { id: '#b08a62', label: '亞麻' },
  { id: '#8c8c8c', label: '銀灰' },
  { id: '#25201e', label: '黑' },
];
export const OUTFITS = [
  { id: '#c98a6b', label: '陶土' },
  { id: '#9bb7a5', label: '鼠尾草綠' },
  { id: '#a9b8d0', label: '霧藍' },
  { id: '#e3c98f', label: '麥黃' },
  { id: '#2a2a30', label: '羽球衣', style: 'jersey' }, // 3D 版有潑墨圖案、短褲與球拍
];
// 3D 版的配件
export const GLASSES = [
  { id: false, label: '無' },
  { id: true, label: '黑框眼鏡' },
];
export const SKINS = [
  { id: '#f6dcc5', label: '淺' },
  { id: '#f1d3b8', label: '自然' },
  { id: '#d9a882', label: '小麥' },
  { id: '#a8754f', label: '深' },
];
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

const OUTLINE = 0x8a6f60;
const BLUSH = 0xf4a6a0;

// 臉：大眼睛加高光、腮紅、小微笑
function drawFace(g, cx, cy, spread, eye) {
  g.fillStyle(0x4a3f38).fillEllipse(cx - spread, cy, eye, eye * 1.2).fillEllipse(cx + spread, cy, eye, eye * 1.2);
  g.fillStyle(0xffffff).fillCircle(cx - spread + eye * 0.2, cy - eye * 0.25, eye * 0.28)
    .fillCircle(cx + spread + eye * 0.2, cy - eye * 0.25, eye * 0.28);
  g.fillStyle(BLUSH, 0.55).fillEllipse(cx - spread - eye * 1.1, cy + eye * 1.1, eye * 1.4, eye * 0.8)
    .fillEllipse(cx + spread + eye * 1.1, cy + eye * 1.1, eye * 1.4, eye * 0.8);
  g.lineStyle(1.6, 0x7a5a4c).beginPath()
    .arc(cx, cy + eye * 0.7, eye * 0.5, Math.PI * 0.15, Math.PI * 0.85).strokePath();
}

export function drawCharacter(scene, key, look) {
  const g = scene.make.graphics({ add: false });
  const hair = color(look.hairColor);
  const skin = color(look.skin);
  const outfit = color(look.outfit);
  const darker = (c) => Phaser.Display.Color.IntegerToColor(c).darken(15).color;

  g.fillStyle(0x000000, 0.1).fillEllipse(32, 76, 30, 7);
  // 腳與身體
  g.fillStyle(darker(outfit)).fillEllipse(26, 72, 10, 7).fillEllipse(38, 72, 10, 7);
  g.fillStyle(outfit).fillRoundedRect(20, 48, 24, 24, 10);
  g.lineStyle(1.5, OUTLINE, 0.6).strokeRoundedRect(20, 48, 24, 24, 10);
  g.fillStyle(skin).fillCircle(19, 60, 4.5).fillCircle(45, 60, 4.5);

  // 長髮在頭後面
  if (look.hairStyle === 'long') {
    g.fillStyle(hair).fillRoundedRect(9, 20, 46, 42, 16);
    g.lineStyle(1.5, OUTLINE, 0.5).strokeRoundedRect(9, 20, 46, 42, 16);
  }
  // 大大的頭
  g.fillStyle(skin).fillCircle(32, 32, 22);
  g.lineStyle(1.5, OUTLINE, 0.6).strokeCircle(32, 32, 22);

  // 頭髮與瀏海
  if (look.hairStyle === 'bun') {
    g.fillStyle(hair).fillCircle(32, 7, 9);
    g.lineStyle(1.5, OUTLINE, 0.5).strokeCircle(32, 7, 9);
  }
  g.fillStyle(hair).fillEllipse(32, 18, 46, 24);
  g.fillCircle(19, 23, 7).fillCircle(30, 22, 8).fillCircle(43, 23, 7);
  if (look.hairStyle === 'short') g.fillEllipse(12, 30, 8, 14).fillEllipse(52, 30, 8, 14);
  g.fillStyle(0xffffff, 0.3).fillEllipse(24, 13, 12, 4);

  drawFace(g, 32, 37, 8, 4.6);
  replaceTexture(scene, key, g, 64, 80);
}

export function drawCompanion(scene, key, type) {
  const g = scene.make.graphics({ add: false });
  const fur = { cat: 0xf0c493, dog: 0xd9b088, hedgehog: 0xf1dcc0, otter: 0xc49a76 }[type];
  const accent = { cat: 0xe0a46e, dog: 0xb48a62, hedgehog: 0xa88a72, otter: 0xa47a58 }[type];
  g.fillStyle(0x000000, 0.1).fillEllipse(26, 39, 30, 5);

  // 尾巴
  if (type === 'cat') g.lineStyle(4, accent).beginPath().arc(40, 24, 6, Math.PI * 0.5, Math.PI * 1.6, true).strokePath();
  if (type === 'dog') g.fillStyle(accent).fillEllipse(41, 25, 7, 10);
  if (type === 'otter') g.fillStyle(accent).fillEllipse(42, 34, 12, 6);

  // 刺蝟的背刺：一圈圓圓的小波浪
  if (type === 'hedgehog') {
    g.fillStyle(accent);
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI * (1.05 + i * 0.16);
      g.fillCircle(27 + Math.cos(a) * 13, 29 + Math.sin(a) * 11, 5.5);
    }
  }
  // 身體
  g.fillStyle(type === 'hedgehog' ? accent : fur).fillEllipse(28, 30, 28, 17);
  g.lineStyle(1.3, OUTLINE, 0.5).strokeEllipse(28, 30, 28, 17);
  g.fillStyle(0xffffff, 0.35).fillEllipse(28, 34, 14, 7);
  g.fillStyle(accent).fillEllipse(20, 37, 6, 4).fillEllipse(34, 37, 6, 4);

  // 耳朵
  if (type === 'cat') {
    g.fillStyle(fur).fillTriangle(10, 12, 12, 1, 20, 8).fillTriangle(24, 8, 32, 1, 34, 12);
    g.fillStyle(BLUSH, 0.8).fillTriangle(12, 10, 13, 4, 17, 8).fillTriangle(27, 8, 31, 4, 32, 10);
  }
  if (type === 'otter' || type === 'hedgehog') g.fillStyle(type === 'otter' ? accent : fur).fillCircle(13, 8, 3.5).fillCircle(31, 8, 3.5);

  // 頭
  g.fillStyle(fur).fillCircle(22, 18, 12);
  g.lineStyle(1.3, OUTLINE, 0.5).strokeCircle(22, 18, 12);
  if (type === 'dog') g.fillStyle(accent).fillEllipse(10, 18, 7, 14).fillEllipse(34, 18, 7, 14);
  if (type === 'dog' || type === 'otter') g.fillStyle(0xfff4e6).fillEllipse(22, 23, 11, 7);

  drawFace(g, 22, 18, 5, 3);
  g.fillStyle(0x6b4f45).fillEllipse(22, 21.5, 3, 2);
  replaceTexture(scene, key, g, 48, 44);
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
