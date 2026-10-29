import { TEXT_STYLE } from '../art.js';

// 目前只有晨光廣場；新增區域時加進這個清單
export const ZONES = ['晨光廣場'];

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.add.text(400, 300, '小鎮甦醒中……', { ...TEXT_STYLE, fontSize: '20px' }).setOrigin(0.5);
    this.load.image('tiles', 'assets/images/placeholder-tiles.png');
    for (const zone of ZONES) this.load.json(`content:${zone}`, `content/${zone}.json`);
    this.load.json('companion-lines', 'content/陪伴小動物.json');
  }

  create() {
    // 地圖路徑寫在各區內容 JSON 裡，讀完內容再載入地圖
    for (const zone of ZONES) {
      const content = this.cache.json.get(`content:${zone}`);
      this.load.tilemapTiledJSON(`map:${zone}`, content.map);
    }
    this.load.once('complete', () => this.scene.start('Create'));
    this.load.start();
  }
}
