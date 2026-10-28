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
    bg.fillStyle(0xfbf6ee, 0.96).fillRoundedRect(20, 430, 760, 150, 16);
    bg.lineStyle(3, 0xc98a6b).strokeRoundedRect(20, 430, 760, 150, 16);
    this.speaker = this.add.text(44, 444, '', { ...TEXT_STYLE, fontSize: '18px', color: '#c98a6b', fontStyle: 'bold' });
    this.bodyText = this.add.text(44, 476, '', {
      ...TEXT_STYLE, fontSize: '20px', lineSpacing: 6, wordWrap: { width: 712, useAdvancedWrap: true },
    });
    this.more = this.add.text(756, 560, '▼', { ...TEXT_STYLE, fontSize: '14px' }).setOrigin(1);
    this.tweens.add({ targets: this.more, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    this.box.add([bg, this.speaker, this.bodyText, this.more]);

    this.input.on('pointerdown', () => this.open && !this.choiceButtons.length && this.next());
    this.input.keyboard.on('keydown-SPACE', () => this.open && !this.choiceButtons.length && this.next());
    this.input.keyboard.on('keydown-ENTER', () => this.open && !this.choiceButtons.length && this.next());

    // ---- 互動提示 ----
    this.touch = this.sys.game.device.input.touch;
    this.hint = this.add.text(400, 590, '', {
      ...TEXT_STYLE, fontSize: '16px', backgroundColor: '#fbf6eecc', padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 1).setVisible(false);
    this.talkButton = makeButton(this, 700, 500, '對話', () => this.onTalk?.(), {
      fontSize: '22px', backgroundColor: '#c98a6b', color: '#ffffff', padding: { x: 18, y: 14 },
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
    this.bodyText.setText(line.text);
    this.more.setVisible(!line.choices);
    if (line.choices) this.showChoices(line.choices);
  }

  showChoices(choices) {
    this.choiceButtons = choices.map((c, i) => makeButton(this, 400, 410 - (choices.length - 1 - i) * 48, c.text, () => {
      this.choiceButtons.forEach((b) => b.destroy());
      this.choiceButtons = [];
      this.queue.unshift(...(c.response || []));
      this.next();
    }, { fontSize: '18px', backgroundColor: '#f0d9c8', padding: { x: 16, y: 8 } }));
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
