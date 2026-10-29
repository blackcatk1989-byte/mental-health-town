import {
  HAIR_STYLES, HAIR_COLORS, OUTFITS, SKINS, COMPANIONS,
  drawCharacter, drawCompanion, makeButton, TEXT_STYLE,
} from '../art.js';

export default class CreateScene extends Phaser.Scene {
  constructor() { super('Create'); }

  create() {
    this.choice = { hairStyle: 0, hairColor: 0, outfit: 0, skin: 1, companion: 0 };
    this.mood = null;
    this.lines = this.cache.json.get('companion-lines'); // 台詞與心情溫度計（content/陪伴小動物.json）

    // 柔和的背景光點
    [[90, 80, 70, 0xf6cfc6], [720, 70, 50, 0xd7e8c8], [760, 560, 80, 0xf8e3b0], [40, 540, 60, 0xd9e6ef], [400, 590, 40, 0xe9dcf2]]
      .forEach(([x, y, r, c], i) => {
        const dot = this.add.circle(x, y, r, c, 0.55);
        this.tweens.add({ targets: dot, y: y - 12, duration: 2600 + i * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      });
    this.add.text(400, 44, '建立你的角色', { ...TEXT_STYLE, fontSize: '30px' }).setOrigin(0.5);

    drawCharacter(this, 'player-preview', this.look());
    drawCompanion(this, 'pet-preview', COMPANIONS[this.choice.companion].id);
    this.add.ellipse(200, 270, 260, 300, 0xfffaf3).setStrokeStyle(3, 0xf0d9c8);
    this.preview = this.add.image(185, 250, 'player-preview').setScale(2.4);
    this.petPreview = this.add.image(275, 330, 'pet-preview').setScale(1.6);
    this.tweens.add({ targets: this.preview, y: 244, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.petPreview, y: 325, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
    this.moodButtons = this.lines.moods.map((m, i) => makeButton(this, 448 + i * 72, 440, m.label, () => {
      this.mood = i;
      this.moodButtons.forEach((b, j) => b.setFill(j === i ? '#f6d3c6' : '#fffaf3'));
      this.petSay.setText(m.reply);
    }, { fontSize: '15px', padX: 8, padY: 6 }));

    makeButton(this, 590, 540, '出發，去晨光廣場', () => this.start(), {
      fontSize: '22px', fill: '#e8a08a', color: '#ffffff', padX: 24, padY: 10,
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
    if (this.mood === null) this.petSay.setText(this.lines.greeting.replace('{animal}', COMPANIONS[this.choice.companion].label));
  }

  start() {
    const companion = COMPANIONS[this.choice.companion];
    this.registry.set('look', this.look());
    this.registry.set('companion', { id: companion.id, label: companion.label });
    this.scene.start('Town', { zone: '晨光廣場' });
  }
}
