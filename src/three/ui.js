// 3D 版的 HTML 介面：角色創建、對話框、頭上名牌、手機搖桿
const $ = (id) => document.getElementById(id);

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function setupCreatePanel(rows, moods, { onChange, onMood, onStart }) {
  const wrap = $('create-rows');
  const choice = {};
  const refreshers = [];
  for (const [label, field, options, initial = 0] of rows) {
    choice[field] = initial;
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="label">${label}</span><button class="pill" type="button">◀</button>`
      + '<span class="value"></span><button class="pill" type="button">▶</button>';
    const value = row.querySelector('.value');
    const refresh = () => { value.textContent = options[choice[field]].label; };
    const [prev, next] = row.querySelectorAll('button');
    const step = (d) => {
      choice[field] = (choice[field] + d + options.length) % options.length;
      refresh();
      onChange(choice);
    };
    refreshers.push(refresh);
    prev.onclick = () => step(-1);
    next.onclick = () => step(1);
    refresh();
    wrap.append(row);
  }
  const moodWrap = $('moods');
  moods.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'pill';
    b.type = 'button';
    b.textContent = m.label;
    b.onclick = () => {
      moodWrap.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', i === j));
      onMood(m);
    };
    moodWrap.append(b);
  });
  $('start').onclick = () => {
    $('create').classList.add('hidden');
    onStart(choice);
  };
  onChange(choice);
  return {
    say: (text) => { $('pet-say').textContent = text; },
    // 一次設定多個選項（例如套用預設造型）
    set: (values) => {
      Object.assign(choice, values);
      refreshers.forEach((r) => r());
      onChange(choice);
    },
  };
}

export class Dialogue {
  constructor() {
    this.open = false;
    this.closedAt = 0;
    this.queue = [];
    this.hasChoices = false;
    $('dlg-box').addEventListener('pointerup', () => this.advance());
  }

  canStart() { return !this.open && performance.now() - this.closedAt > 300; }

  show(lines, onDone) {
    this.queue = [...lines];
    this.onDone = onDone;
    this.open = true;
    $('dialogue').classList.remove('hidden');
    document.body.classList.add('talking');
    this.next();
  }

  advance() { if (this.open && !this.hasChoices) this.next(); }

  next() {
    const line = this.queue.shift();
    if (!line) return this.close();
    $('dlg-name').textContent = line.speaker || '';
    $('dlg-name').classList.toggle('hidden', !line.speaker);
    $('dlg-text').textContent = line.text;
    $('dlg-more').classList.toggle('hidden', !!line.choices);
    const box = $('dlg-choices');
    box.innerHTML = '';
    this.hasChoices = !!line.choices;
    for (const c of line.choices || []) {
      const b = document.createElement('button');
      b.className = 'pill';
      b.type = 'button';
      b.textContent = c.text;
      b.onclick = () => {
        box.innerHTML = '';
        this.hasChoices = false;
        this.queue.unshift(...(c.response || []));
        this.next();
      };
      box.append(b);
    }
  }

  close() {
    this.open = false;
    this.closedAt = performance.now();
    $('dialogue').classList.add('hidden');
    document.body.classList.remove('talking');
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }
}

// 跟著 3D 物件移動的 HTML 標籤
export function makeLabel(className, text) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  $('labels').append(el);
  return el;
}

export function showPlayControls() {
  if (isTouch) {
    $('stick').classList.remove('hidden');
    $('rotate').classList.remove('hidden');
  } else {
    $('controls-tip').classList.remove('hidden');
  }
}

export function setTalkHint(name, onTalk) {
  const hint = $('hint');
  const talk = $('talk');
  talk.onclick = onTalk;
  hint.onclick = onTalk;
  if (isTouch) {
    talk.classList.toggle('hidden', !name);
  } else {
    hint.classList.toggle('hidden', !name);
    if (name) hint.textContent = `按空白鍵和 ${name} 說話`;
  }
}

// 手機搖桿：回傳目前方向（x、y 介於 -1 到 1）
export function setupJoystick() {
  const stick = $('stick');
  const thumb = $('stick-thumb');
  const state = { x: 0, y: 0 };
  let id = null;
  const move = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    thumb.style.transform = `translate(${dx}px, ${dy}px)`;
    state.x = dx / max;
    state.y = dy / max;
  };
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    thumb.style.transform = '';
    state.x = state.y = 0;
  };
  stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); move(e); });
  stick.addEventListener('pointermove', (e) => e.pointerId === id && move(e));
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  return state;
}

export function setupRotateButtons(state) {
  for (const b of document.querySelectorAll('#rotate button')) {
    const dir = Number(b.dataset.rot);
    b.addEventListener('pointerdown', () => { state.rotate = dir; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { state.rotate = 0; });
  }
}
