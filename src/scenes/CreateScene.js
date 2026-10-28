import {
  HAIR_STYLES, HAIR_COLORS, OUTFITS, SKINS, COMPANIONS,
  drawCharacter, drawCompanion, makeButton, TEXT_STYLE,
} from '../art.js';

// 今日心情溫度計：只是互動，不儲存、不評分
const MOODS = [
  { label: '有點冷', reply: '今天有點冷啊。那我們慢慢走就好，不用急。' },
  { label: '涼涼的', reply: '涼涼的也沒關係，我會陪著你。' },
  { label: '普通', reply: '普普通通的一天，也是很好的一天。' },
  { label: '暖暖的', reply: '暖暖的呀，真好。一起去看看小鎮吧！' },
  { label: '很溫暖', reply: '你的溫暖，說不定也能分一點給小鎮呢。' },
];

export default class CreateScene extends Phaser.Scene {
  constructor() { super('Create'); }

  create() {
    this.choice = { hairStyle: 0, hairColor: 0, outfit: 0, skin: 1, companion: 0 };
    this.mood = null;

    this.add.text(400, 44, '建立你的角色', { ...TEXT_STYLE, fontSize: '30px' }).setOrigin(0.5);

    drawCharacter(this, 'player-preview', this.look());
    drawCompanion(this, 'pet-preview', COMPANIONS[this.choice.companion].id);
    this.add.ellipse(200, 270, 260, 300, 0xfbf6ee);
    this.preview = this.add.image(185, 250, 'player-preview').setScale(2.4);
    this.petPreview = this.add.image(270, 330, 'pet-preview').setScale(1.6);
    this.petSay = this.add.text(200, 450, '', {
      ...TEXT_STYLE, fontSize: '15px', align: 'center', wordWrap: { width: 300, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    const rows = [
      ['髮型', 'hairStyle', HAIR_STYLES],
      ['髮色', 'hairColor', HAIR_COLORS],
      ['服裝', 'outfit', OUTFITS],
      ['膚色', 'skin', SKINS],
      ['陪伴小動物', 'companion', COMPANIONS],
    ];
    rows.forEach(([label, field, options], i) => {
      const y = 115 + i * 54;
      this.add.text(410, y, label, { ...TEXT_STYLE, fontSize: '18px' }).setOrigin(0, 0.5);
      const value = this.add.text(640, y, '', { ...TEXT_STYLE, fontSize: '18px' }).setOrigin(0.5);
      const refresh = () => value.setText(options[this.choice[field]].label);
      const step = (d) => {
        this.choice[field] = (this.choice[field] + d + options.length) % options.length;
        refresh();
        this.redraw();
      };
      makeButton(this, 560, y, '◀', () => step(-1));
      makeButton(this, 720, y, '▶', () => step(1));
      refresh();
    });

    this.add.text(410, 395, '今日心情溫度計（可略過，不會儲存）', { ...TEXT_STYLE, fontSize: '16px' }).setOrigin(0, 0.5);
    this.moodButtons = MOODS.map((m, i) => makeButton(this, 448 + i * 72, 440, m.label, () => {
      this.mood = i;
      this.moodButtons.forEach((b, j) => b.setBackgroundColor(j === i ? '#f0d9c8' : '#fbf6ee'));
      this.petSay.setText(m.reply);
    }, { fontSize: '15px', padding: { x: 6, y: 6 } }));

    makeButton(this, 590, 540, '出發，去晨光廣場', () => this.start(), {
      fontSize: '22px', backgroundColor: '#c98a6b', color: '#ffffff', padding: { x: 20, y: 10 },
    });
    this.input.keyboard.on('keydown-ENTER', () => this.start());

    this.redraw();
  }

  look() {
    return {
      hairStyle: HAIR_STYLES[this.choice.hairStyle].id,
      hairColor: HAIR_COLORS[this.choice.hairColor].id,
      outfit: OUTFITS[this.choice.outfit].id,
      skin: SKINS[this.choice.skin].id,
    };
  }

  redraw() {
    drawCharacter(this, 'player-preview', this.look());
    drawCompanion(this, 'pet-preview', COMPANIONS[this.choice.companion].id);
    this.preview.setTexture('player-preview');
    this.petPreview.setTexture('pet-preview');
    if (this.mood === null) this.petSay.setText(`我是你的${COMPANIONS[this.choice.companion].label}夥伴，會陪你逛小鎮，也會提醒你休息喔。`);
  }

  start() {
    const companion = COMPANIONS[this.choice.companion];
    this.registry.set('look', this.look());
    this.registry.set('companion', { id: companion.id, label: companion.label });
    this.scene.start('Town', { zone: '晨光廣場' });
  }
}
