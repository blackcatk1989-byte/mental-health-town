// 佔位美術：用程式畫出 Q 版角色與陪伴小動物，之後替換成正式素材。
// 角色貼圖 64x80、小動物 48x40，遊戲中再縮放。

export const HAIR_STYLES = [
  { id: 'short', label: '短髮' },
  { id: 'long', label: '長髮' },
  { id: 'bun', label: '丸子頭' },
];
export const HAIR_COLORS = [
  { id: '#4a3a32', label: '深褐' },
  { id: '#7a5a44', label: '栗色' },
  { id: '#b08a62', label: '亞麻' },
  { id: '#8c8c8c', label: '銀灰' },
];
export const OUTFITS = [
  { id: '#c98a6b', label: '陶土' },
  { id: '#9bb7a5', label: '鼠尾草綠' },
  { id: '#a9b8d0', label: '霧藍' },
  { id: '#e3c98f', label: '麥黃' },
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

export function drawCharacter(scene, key, look) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x000000, 0.12).fillEllipse(32, 74, 36, 10);
  g.fillStyle(color(look.outfit)).fillRoundedRect(16, 44, 32, 28, 10);

  const hair = color(look.hairColor);
  if (look.hairStyle === 'long') {
    g.fillStyle(hair).fillRoundedRect(11, 18, 42, 36, 10);
  }
  g.fillStyle(color(look.skin)).fillCircle(32, 30, 20);
  g.fillStyle(hair).fillEllipse(32, 17, 42, 20);
  if (look.hairStyle === 'bun') g.fillCircle(32, 6, 8);
  if (look.hairStyle === 'short') g.fillEllipse(18, 22, 10, 14).fillEllipse(46, 22, 10, 14);

  g.fillStyle(0x4a3f38).fillCircle(25, 33, 2.5).fillCircle(39, 33, 2.5);
  g.fillStyle(0xe8a99a, 0.6).fillCircle(21, 39, 3.5).fillCircle(43, 39, 3.5);
  replaceTexture(scene, key, g, 64, 80);
}

export function drawCompanion(scene, key, type) {
  const g = scene.make.graphics({ add: false });
  const fur = { cat: 0xd9a877, dog: 0xc49a6c, hedgehog: 0x8a7060, otter: 0xa07a5a }[type];
  g.fillStyle(0x000000, 0.12).fillEllipse(24, 37, 30, 6);

  if (type === 'hedgehog') {
    g.fillStyle(0x6e5a4c);
    for (let i = 0; i < 6; i++) g.fillTriangle(8 + i * 6, 22, 12 + i * 6, 8, 16 + i * 6, 22);
  }
  g.fillStyle(fur).fillEllipse(24, 28, 32, 16);
  if (type === 'otter') g.fillEllipse(40, 32, 14, 6); // 尾巴

  if (type === 'cat') g.fillTriangle(14, 14, 17, 2, 22, 10).fillTriangle(26, 10, 31, 2, 34, 14);
  if (type === 'otter') g.fillCircle(15, 9, 3.5).fillCircle(33, 9, 3.5);
  g.fillStyle(type === 'hedgehog' ? 0xe6cdb0 : fur).fillCircle(24, 17, 11);
  if (type === 'dog') g.fillStyle(0x9a7450).fillEllipse(13, 18, 7, 14).fillEllipse(35, 18, 7, 14);
  if (type === 'otter') g.fillStyle(0xe6cdb0).fillEllipse(24, 22, 12, 7);

  g.fillStyle(0x4a3f38).fillCircle(20, 16, 1.8).fillCircle(28, 16, 1.8).fillCircle(24, 20, 1.6);
  replaceTexture(scene, key, g, 48, 40);
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

export function makeButton(scene, x, y, label, onClick, style = {}) {
  const btn = scene.add.text(x, y, label, {
    ...TEXT_STYLE, fontSize: '18px', backgroundColor: '#fbf6ee', padding: { x: 12, y: 6 }, ...style,
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  btn.on('pointerover', () => btn.setAlpha(0.8));
  btn.on('pointerout', () => btn.setAlpha(1));
  btn.on('pointerup', onClick);
  return btn;
}
