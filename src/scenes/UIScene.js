import { makeButton, TEXT_STYLE } from '../art.js';
import Joystick from '../ui/Joystick.js';

// 疊在小鎮上方的介面：對話框、互動提示、手機搖桿。不受小鎮鏡頭縮放與灰霧濾鏡影響。
export default class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    this.queue = [];
    this.open = false;
    this.closedAt = 0;
    this.choiceButtons = [];

    // ---- 對話框 ----
    this.box = this.add.container(0, 0).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x8a6f60, 0.12).fillRoundedRect(20, 446, 760, 140, 24);
    bg.fillStyle(0xfffaf3, 0.97).fillRoundedRect(20, 440, 760, 140, 24);
    bg.lineStyle(3, 0xf0c9b8).strokeRoundedRect(20, 440, 760, 140, 24);
    bg.lineStyle(1.5, 0xf6dfd3).strokeRoundedRect(28, 448, 744, 124, 18);
    // 說話者名牌（膠囊形，依名字長度重畫）
    this.nameTag = this.add.graphics();
    this.speaker = this.add.text(70, 440, '', { ...TEXT_STYLE, fontSize: '17px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.bodyText = this.add.text(48, 468, '', {
      ...TEXT_STYLE, fontSize: '20px', lineSpacing: 8, wordWrap: { width: 704, useAdvancedWrap: true },
    });
    this.more = this.add.text(752, 562, '♡', { ...TEXT_STYLE, fontSize: '16px', color: '#e8a08a' }).setOrigin(1);
    this.tweens.add({ targets: this.more, y: 557, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.box.add([bg, this.nameTag, this.speaker, this.bodyText, this.more]);

    this.input.on('pointerdown', () => this.open && !this.choiceButtons.length && this.next());
    this.input.keyboard.on('keydown-SPACE', () => this.open && !this.choiceButtons.length && this.next());
    this.input.keyboard.on('keydown-ENTER', () => this.open && !this.choiceButtons.length && this.next());

    // ---- 互動提示 ----
    this.touch = this.sys.game.device.input.touch;
    const hintBg = this.add.graphics();
    const hintText = this.add.text(0, 0, '', { ...TEXT_STYLE, fontSize: '16px' }).setOrigin(0.5);
    this.hint = this.add.container(400, 570, [hintBg, hintText]).setVisible(false);
    this.hint.setText = (t) => {
      if (hintText.text === t) return;
      hintText.setText(t);
      const w = hintText.width + 28;
      hintBg.clear().fillStyle(0xfffaf3, 0.92).fillRoundedRect(-w / 2, -16, w, 32, 16)
        .lineStyle(2, 0xf0c9b8).strokeRoundedRect(-w / 2, -16, w, 32, 16);
    };
    this.talkButton = makeButton(this, 700, 500, '對話 ♡', () => this.onTalk?.(), {
      fontSize: '22px', fill: '#e8a08a', color: '#ffffff', padX: 20, padY: 14,
    }).setVisible(false);

    if (this.touch) this.joystick = new Joystick(this, 110, 490);
  }

  isDialogueOpen() { return this.open; }

  canStartDialogue() { return !this.open && this.time.now - this.closedAt > 300; }

  setTalkTarget(resident, onTalk) {
    this.onTalk = onTalk;
    const show = !!resident && !this.open;
    if (this.touch) {
      this.talkButton.setVisible(show);
    } else {
      this.hint.setVisible(show);
      if (show) this.hint.setText(`按空白鍵和 ${resident.data.name} 說話`);
    }
  }

  showDialogue(lines, onDone) {
    this.queue = [...lines];
    this.onDone = onDone;
    this.open = true;
    this.box.setVisible(true);
    this.hint.setVisible(false);
    this.talkButton.setVisible(false);
    this.joystick?.setVisible(false);
    this.next();
  }

  next() {
    const line = this.queue.shift();
    if (!line) return this.close();
    this.speaker.setText(line.speaker || '');
    const w = this.speaker.width + 32;
    this.speaker.setX(40 + w / 2);
    this.nameTag.clear();
    if (line.speaker) this.nameTag.fillStyle(0xe8a08a).fillRoundedRect(40, 425, w, 30, 15);
    this.bodyText.setText(line.text);
    this.more.setVisible(!line.choices);
    if (line.choices) this.showChoices(line.choices);
  }

  showChoices(choices) {
    this.choiceButtons = choices.map((c, i) => makeButton(this, 400, 392 - (choices.length - 1 - i) * 54, c.text, () => {
      this.choiceButtons.forEach((b) => b.destroy());
      this.choiceButtons = [];
      this.queue.unshift(...(c.response || []));
      this.next();
    }, { fontSize: '18px', fill: '#fdeee6', padX: 20, padY: 10 }));
  }

  close() {
    this.open = false;
    this.closedAt = this.time.now;
    this.box.setVisible(false);
    this.joystick?.setVisible(true);
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }
}
