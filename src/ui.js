// 共用的 HTML 介面：對話框、提示訊息、確認視窗、設定、麻糬的提示、任務目標。
// 3D 模式與文字模式都用這一套；所有文字都在 HTML 裡呈現，不畫進 3D 場景。
import { cardArt, openCardbook, openUseCard } from './cards.js';
import { openMinigame } from './minigames.js';
import { openPuzzle } from './puzzles.js';
import { play } from './sfx.js';

export const $ = (id) => document.getElementById(id);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m) : text);
const reduceMotion = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

// 表情圖示（不是文字）：對話時出現在說話者頭上與名牌旁
const FACE = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffe7b8" stroke="#d9a35a"/>${inner}</svg>`;
export const EMOTES = {
  smile: FACE('<circle cx="8.5" cy="10" r="1.3" fill="#4f4038"/><circle cx="15.5" cy="10" r="1.3" fill="#4f4038"/><path d="M8 14 q4 4 8 0" stroke="#4f4038" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  worry: FACE('<path d="M7 9 l3 1.5 M17 9 l-3 1.5" stroke="#4f4038" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="12" r="1.2" fill="#4f4038"/><circle cx="15" cy="12" r="1.2" fill="#4f4038"/><path d="M9 17 q3 -2 6 0" stroke="#4f4038" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M19 5 q1.5 2.5 0 4 q-1.5 -1.5 0 -4" fill="#9cc3d6"/>'),
  think: FACE('<circle cx="8.5" cy="10" r="1.3" fill="#4f4038"/><circle cx="15.5" cy="10" r="1.3" fill="#4f4038"/><path d="M9 15.5 h6" stroke="#4f4038" stroke-width="1.6" stroke-linecap="round"/><circle cx="19" cy="4" r="1.5" fill="#c9b9a6"/><circle cx="21.5" cy="1.8" r="1" fill="#c9b9a6"/>'),
  surprise: FACE('<circle cx="8.5" cy="10" r="1.6" fill="#4f4038"/><circle cx="15.5" cy="10" r="1.6" fill="#4f4038"/><ellipse cx="12" cy="16" rx="2" ry="2.5" fill="#4f4038"/>'),
  relief: FACE('<path d="M6.5 10.5 q2 -2 4 0 M13.5 10.5 q2 -2 4 0" stroke="#4f4038" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M8.5 14.5 q3.5 3 7 0" stroke="#4f4038" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="6.5" cy="14" r="1.6" fill="#f2a99a"/><circle cx="17.5" cy="14" r="1.6" fill="#f2a99a"/>'),
  question: FACE('<circle cx="8.5" cy="11" r="1.3" fill="#4f4038"/><circle cx="15.5" cy="11" r="1.3" fill="#4f4038"/><path d="M10 16 h4" stroke="#4f4038" stroke-width="1.6" stroke-linecap="round"/><text x="17" y="7" font-size="8" fill="#c97f62" font-weight="700">?</text>'),
  happy: FACE('<path d="M7 10 q1.5 -2 3 0 M14 10 q1.5 -2 3 0" stroke="#4f4038" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M8 13.5 q4 5 8 0 Z" fill="#4f4038"/><path d="M18.5 3.5 l1 2 l2 .5 l-2 .8 l-.8 2 l-.8 -2 l-2 -.8 l2 -.5 Z" fill="#f2c46b"/>'),
};

// 開啟 <dialog> 面板；關閉（含按 Esc）時呼叫 onClose
export function openPanel(id, onClose) {
  const d = $(id);
  if (!d.open) {
    d.showModal();
    play('open');
  }
  d.onclose = () => {
    d.onclose = null;
    onClose?.();
  };
  return d;
}

// 對話框：文字逐字出現（點一下顯示整句，再點才換下一句），說話者頭上有表情氣泡
class DialogueBox {
  constructor(dialogues) {
    this.dialogues = dialogues;
    this.open = false;
    this.el = $('dialogue');
    this.timer = 0;
    $('dlg-next').onclick = () => this.advance();
    $('dlg-exit').onclick = () => this.close();
    $('dlg-text').onclick = () => this.advance();
  }

  play(id, { vars, onEffects, onClose }) {
    this.vars = vars;
    this.onEffects = onEffects;
    this.onClose = onClose;
    this.open = true;
    this.el.classList.remove('hidden');
    document.body.classList.add('in-dialogue');
    this.load(id);
  }

  load(id) {
    this.seg = this.dialogues[id];
    if (!this.seg) {
      console.warn(`找不到對話 ${id}`);
      return this.close();
    }
    this.index = 0;
    this.show();
  }

  show() {
    const line = this.seg.lines[this.index];
    const narrator = line.speaker === '旁白';
    const emote = EMOTES[line.emote];
    $('dlg-name').innerHTML = narrator ? '' : `${esc(line.speaker)}${emote ? `<span id="dlg-emote">${emote}</span>` : ''}`;
    $('dlg-name').classList.toggle('hidden', narrator);
    $('dlg-text').classList.toggle('narration', narrator);
    document.dispatchEvent(new CustomEvent('emote', { detail: { speaker: line.speaker, emote: line.emote ?? null } }));
    const last = this.index === this.seg.lines.length - 1;
    if (last && this.seg.effects) this.onEffects(this.seg.effects);
    this.typeText(fill(line.text, this.vars), () => this.showChoices(last));
  }

  // 逐字出現；減少動畫時一次顯示
  typeText(text, done) {
    clearInterval(this.timer);
    const el = $('dlg-text');
    this.full = text;
    this.afterType = done;
    $('dlg-choices').innerHTML = '';
    $('dlg-next').classList.remove('hidden');
    $('dlg-next').textContent = '…';
    if (reduceMotion()) return this.finishType();
    this.typing = true;
    let n = 0;
    el.textContent = '';
    this.timer = setInterval(() => {
      n += 1;
      el.textContent = text.slice(0, n);
      if (n % 3 === 1) play('type');
      if (n >= text.length) this.finishType();
    }, 32);
  }

  finishType() {
    clearInterval(this.timer);
    this.typing = false;
    $('dlg-text').textContent = this.full;
    const done = this.afterType;
    this.afterType = null;
    done?.();
  }

  showChoices(last) {
    const box = $('dlg-choices');
    box.innerHTML = '';
    this.choosing = false;
    if (last && this.seg.choices) {
      this.choosing = true;
      this.seg.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice';
        b.innerHTML = `<span class="key">${i + 1}</span>${esc(c.text)}`;
        b.onclick = () => this.choose(i);
        box.append(b);
      });
    }
    $('dlg-next').classList.toggle('hidden', this.choosing);
    $('dlg-next').textContent = last && !this.seg.next ? '結束' : '繼續';
    (this.choosing ? box.querySelector('button') : $('dlg-next')).focus({ preventScroll: true });
  }

  advance() {
    if (!this.open) return;
    if (this.typing) return this.finishType(); // 點一下：先顯示整句
    if (this.choosing) return;
    if (this.index < this.seg.lines.length - 1) {
      this.index += 1;
      this.show();
    } else if (this.seg.next) {
      this.load(this.seg.next);
    } else {
      this.close();
    }
  }

  choose(i) {
    const c = this.seg.choices?.[i];
    if (!this.choosing || !c) return;
    this.choosing = false;
    if (c.effects) this.onEffects(c.effects);
    if (c.next) this.load(c.next);
    else this.close();
  }

  close() {
    if (!this.open) return;
    clearInterval(this.timer);
    this.typing = false;
    this.open = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('in-dialogue');
    document.dispatchEvent(new CustomEvent('emote', { detail: { speaker: null, emote: null } }));
    const done = this.onClose;
    this.onClose = null;
    done?.();
  }
}

export function createUI(content, store) {
  const dialogue = new DialogueBox(content.dialogues.dialogues);
  let game = null;

  function toast(html, { action, ms = 4200 } = {}) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${html}</span>`;
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small';
      b.textContent = action.label;
      b.onclick = () => { el.remove(); action.fn(); };
      el.append(b);
    }
    $('toasts').append(el);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 600);
  }

  function confirm(text, okLabel = '確定') {
    return new Promise((resolve) => {
      $('confirm-text').textContent = text;
      $('confirm-ok').textContent = okLabel;
      let answer = false;
      $('confirm-ok').onclick = () => { answer = true; $('confirm').close(); };
      $('confirm-cancel').onclick = () => $('confirm').close();
      openPanel('confirm', () => resolve(answer));
    });
  }

  // 按鈕的輕聲回饋；面板關上的聲音
  document.addEventListener('click', (e) => { if (e.target.closest('button, .btn, .choice, .option')) play('click'); });
  for (const d of document.querySelectorAll('dialog')) d.addEventListener('close', () => play('close'));

  function anyPanelOpen() {
    return [...document.querySelectorAll('dialog')].some((d) => d.open);
  }

  // ---- 設定 ----
  function applySettings() {
    const st = store.settings;
    document.documentElement.dataset.textSize = st.textSize;
    document.body.classList.toggle('reduce-motion', !!st.reduceMotion);
  }

  function renderSettings(handlers) {
    const st = store.settings;
    const inGame = !!store.data && handlers.inGame();
    const opt = (key, value, label) => `<button type="button" class="seg ${st[key] === value ? 'on' : ''}"
      data-key="${key}" data-value="${value}" aria-pressed="${st[key] === value}">${label}</button>`;
    $('settings-body').innerHTML = `
      <div class="setting"><span>背景音樂</span><div class="segs">${opt('music', false, '關閉')}${opt('music', true, '開啟')}</div></div>
      <div class="setting"><label for="music-volume">音樂音量</label>
        <input type="range" id="music-volume" min="0" max="1" step="0.05" value="${st.musicVolume}" aria-valuetext="${Math.round(st.musicVolume * 100)}%"></div>
      <div class="setting"><span>音效（腳步、按鈕、風鈴）</span><div class="segs">${opt('sound', false, '關閉')}${opt('sound', true, '開啟')}</div></div>
      <div class="setting"><span>減少動畫</span><div class="segs">${opt('reduceMotion', false, '關閉')}${opt('reduceMotion', true, '開啟')}</div></div>
      <div class="setting"><span>文字大小</span><div class="segs">${opt('textSize', 's', '小')}${opt('textSize', 'm', '中')}${opt('textSize', 'l', '大')}</div></div>
      <div class="setting"><span>3D 畫質</span><div class="segs">${opt('quality', 'high', '標準')}${opt('quality', 'low', '省電')}</div></div>
      ${inGame ? `<div class="setting"><span>遊玩模式</span><div class="segs">
        <button type="button" class="seg ${handlers.mode() === '3d' ? 'on' : ''}" data-mode="3d">3D</button>
        <button type="button" class="seg ${handlers.mode() === 'text' ? 'on' : ''}" data-mode="text">文字</button></div></div>
        <div class="setting-actions">
          <button type="button" class="btn" data-act="home">回到首頁</button>
          <button type="button" class="btn" data-act="restart">重新開始</button>
        </div>` : ''}
      ${store.hasSave() ? '<div class="setting-actions"><button type="button" class="btn danger" data-act="clear">清除進度</button></div>' : ''}
      <p class="fine">進度與設定只存在這個瀏覽器裡，不會傳送到伺服器。</p>`;
    for (const b of $('settings-body').querySelectorAll('[data-key]')) {
      b.onclick = () => {
        const v = b.dataset.value;
        store.settings[b.dataset.key] = v === 'true' ? true : v === 'false' ? false : v;
        store.saveSettings();
        applySettings();
        handlers.onSettings();
        renderSettings(handlers);
      };
    }
    const vol = $('music-volume');
    vol.oninput = () => {
      store.settings.musicVolume = Number(vol.value);
      vol.setAttribute('aria-valuetext', `${Math.round(store.settings.musicVolume * 100)}%`);
      handlers.onSettings();
    };
    vol.onchange = () => store.saveSettings();
    for (const b of $('settings-body').querySelectorAll('[data-mode]')) {
      b.onclick = () => { $('settings').close(); handlers.setMode(b.dataset.mode); };
    }
    for (const b of $('settings-body').querySelectorAll('[data-act]')) {
      b.onclick = async () => {
        const act = b.dataset.act;
        if (act === 'home') { $('settings').close(); handlers.home(); return; }
        const ok = await confirm(act === 'clear'
          ? '確定要清除這個瀏覽器裡的所有進度嗎？卡片、任務與謎題紀錄都會刪除，無法復原。'
          : '確定要重新開始嗎？目前的進度（卡片、任務與謎題）會被清除。', act === 'clear' ? '清除進度' : '重新開始');
        if (!ok) return;
        $('settings').close();
        if (act === 'clear') handlers.clear();
        else handlers.restart();
      };
    }
  }

  // ---- 麻糬的提示：不跳選單，牠自己走過去；畫面上用一行字說明牠去了哪裡 ----
  function hints() {
    const r = game.catHint();
    toast(esc(r.text), { ms: 5000 });
    return r;
  }

  // ---- 任務目標：步驟改變時有更新動畫與提示音 ----
  let shownStep = null;
  function renderGoal() {
    if (!game?.s) return;
    const info = game.stepInfo;
    if (shownStep && shownStep !== info.id) {
      const g = $('goal');
      g.classList.remove('advance');
      void g.offsetWidth;
      g.classList.add('advance');
      play('quest');
    }
    shownStep = info.id;
    const miss = game.missingCard();
    $('goal-text').textContent = info.goal;
    $('goal-missing').classList.toggle('hidden', !miss);
    if (miss) $('goal-missing').textContent = miss.text;
    const n = game.s.cards.length;
    $('cardbook-count').textContent = `${n}/${content.cards.cards.length}`;
    $('save-warning').classList.toggle('hidden', !store.saveFailed);
  }

  return {
    dialogue,
    toast,
    confirm,
    applySettings,
    attach(g) {
      game = g;
      g.addEventListener('change', renderGoal);
    },
    busy: () => dialogue.open || anyPanelOpen() || !!document.querySelector('.card-fly'),
    anyPanelOpen,
    renderGoal,
    openSettings(handlers) {
      renderSettings(handlers);
      openPanel('settings');
    },
    openCardbook: () => openCardbook(game),
    openUseCard: (targetId) => openUseCard(game, targetId),
    minigame: (id, data, done) => openMinigame(id, data, store.settings, done),
    puzzle: (g, id) => openPuzzle(g, id),
    hints,
    // 取得理解卡：卡片飛入、翻面、收進卡冊；點一下可以略過
    cardToast(card) {
      const view = () => openCardbook(game, { focus: card.id });
      const finish = () => {
        const b = $('cardbook-button');
        b.classList.remove('got');
        void b.offsetWidth;
        b.classList.add('got');
        toast(`取得理解卡「<strong>${esc(card.title)}</strong>」`, { action: { label: '查看', fn: view } });
      };
      if (reduceMotion()) {
        play('card');
        finish();
        return;
      }
      const fly = document.createElement('div');
      fly.className = 'card-fly';
      fly.setAttribute('role', 'status');
      const sparks = Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg;--d:${130 + (i % 3) * 30}px"></i>`).join('');
      fly.innerHTML = `<div class="rays"></div><div class="halo"></div>
        <div class="flip"><div class="inner">
          <div class="face back"></div>
          <div class="face front">${cardArt(card)}<strong>${esc(card.title)}</strong><small>${esc(card.keyPoint)}</small></div>
        </div></div>
        <div class="flash"></div><div class="sparks">${sparks}</div>
        <span class="got-label">收集到理解卡！</span><span class="skip">點一下略過</span>`;
      const target = $('cardbook-button').getBoundingClientRect();
      fly.style.setProperty('--fx', `${target.left + target.width / 2 - innerWidth / 2}px`);
      fly.style.setProperty('--fy', `${target.top + target.height / 2 - innerHeight / 2}px`);
      (document.querySelector('dialog[open]') ?? document.body).append(fly); // 面板開著時，飛在面板上面
      play('spin');
      const shine = setTimeout(() => play('card'), 1150); // 轉到正面、閃光時
      fly.addEventListener('pointerdown', () => clearTimeout(shine), { once: true });
      let gone = false;
      const leave = () => {
        if (gone) return;
        gone = true;
        fly.classList.add('leave');
        setTimeout(() => { fly.remove(); finish(); }, 520);
      };
      fly.addEventListener('pointerdown', () => { fly.remove(); gone = true; finish(); }, { once: true });
      setTimeout(leave, 3000);
    },
    tutorial(kind) {
      if (kind !== 'cardbook') return;
      const b = $('cardbook-button');
      b.classList.add('pulse');
      setTimeout(() => b.classList.remove('pulse'), 8000);
    },
  };
}
