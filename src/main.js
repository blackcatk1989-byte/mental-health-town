import BootScene from './scenes/BootScene.js';
import CreateScene from './scenes/CreateScene.js';
import TownScene from './scenes/TownScene.js';
import UIScene from './scenes/UIScene.js';

// Phaser 由 index.html 以 CDN 載入（全域變數 Phaser）
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  backgroundColor: '#e9e1d4',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 }, // 手機上搖桿與對話按鈕可同時按
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, CreateScene, TownScene, UIScene],
});
