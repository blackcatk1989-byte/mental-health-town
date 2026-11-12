// 共用的 HTML 介面：對話框、提示訊息、確認視窗、設定、麻糬的提示、任務目標。
// 3D 模式與文字模式都用這一套；所有文字都在 HTML 裡呈現，不畫進 3D 場景。
import { openCardbook, openUseCard } from './cards.js';
import { openMinigame } from './minigames.js';
import { openPuzzle } from './puzzles.js';

export const $ = (id) => document.getElementById(id);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m) : text);

// 開啟 <dialog> 面板；關閉（含按 Esc）時呼叫 onClose
export function openPanel(id, onClose) {
  const d = $(id);
  if (!d.open) d.showModal();
  d.onclose = () => {
    d.onclose = null;
    onClose?.();
  };
  return d;
}

class DialogueBox {
  constructor(dialogues) {
    this.dialogues = dialogues;
    this.open = false;
    this.el = $('dialogue');
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
    $('dlg-name').textContent = narrator ? '' : line.speaker;
    $('dlg-name').classList.toggle('hidden', narrator);
    $('dlg-text').textContent = fill(line.text, this.vars);
    $('dlg-text').classList.toggle('narration', narrator);
    const last = this.index === this.seg.lines.length - 1;
    const box = $('dlg-choices');
    box.innerHTML = '';
    this.choosing = false;
    if (last) {
      if (this.seg.effects) this.onEffects(this.seg.effects);
      if (this.seg.choices) {
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
    }
    $('dlg-next').classList.toggle('hidden', this.choosing);
    $('dlg-next').textContent = last && !this.seg.next ? '結束' : '繼續';
    (this.choosing ? box.querySelector('button') : $('dlg-next')).focus({ preventScroll: true });
  }

  advance() {
    if (!this.open || this.choosing) return;
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
    this.open = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('in-dialogue');
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
      <div class="setting"><span>音效（風鈴聲）</span><div class="segs">${opt('sound', false, '關閉')}${opt('sound', true, '開啟')}</div></div>
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

  // ---- 麻糬的提示：先選要問什麼，再由玩家決定看到第幾層 ----
  function hints() {
    const h = content.hints;
    const body = $('hints-body');
    const topics = () => {
      const list = game.hintTopics();
      body.innerHTML = `<p>${esc(h.greeting)}</p>
        ${list.length ? `<p>想問麻糬什麼？</p><div class="options">${list.map((t) => `<button type="button" class="option" data-topic="${t.id}">
          <strong>${esc(t.label)}</strong></button>`).join('')}</div>` : `<p>${esc(h.nothing)}</p>`}`;
      for (const b of body.querySelectorAll('[data-topic]')) b.onclick = () => layers(b.dataset.topic, 0);
    };
    const layers = (topic, shown, text) => {
      body.innerHTML = `<p class="fine">${esc(game.hintTopics().find((t) => t.id === topic)?.label ?? '')}</p>
        ${text ? `<div class="notice">${esc(text)}</div>` : ''}
        <p>${shown ? '還需要更多提示嗎？' : '想看到哪一層提示？可以一層一層來。'}</p>
        <div class="options">${h.layers.map((l, i) => `<button type="button" class="option ${i < shown ? 'on' : ''}" data-layer="${i + 1}">
          <strong>${i + 1}．${esc(l.label)}</strong></button>`).join('')}</div>
        <div class="row-actions"><button type="button" class="btn" data-back>問別的</button>
        <button type="button" class="btn primary" data-close>好，我自己找找</button></div>`;
      for (const b of body.querySelectorAll('[data-layer]')) {
        b.onclick = () => {
          const n = Number(b.dataset.layer);
          const r = game.hint(topic, n);
          if (r) layers(topic, Math.max(shown, n), r.text);
        };
      }
      body.querySelector('[data-back]').onclick = topics;
      body.querySelector('[data-close]').onclick = () => $('hints').close();
    };
    topics();
    openPanel('hints');
  }

  // ---- 任務目標 ----
  function renderGoal() {
    if (!game?.s) return;
    const info = game.stepInfo;
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
    busy: () => dialogue.open || anyPanelOpen(),
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
    cardToast(card) {
      toast(`取得理解卡「<strong>${esc(card.title)}</strong>」`, { action: { label: '查看', fn: () => openCardbook(game, { focus: card.id }) } });
    },
    tutorial(kind) {
      if (kind !== 'cardbook') return;
      const b = $('cardbook-button');
      b.classList.add('pulse');
      setTimeout(() => b.classList.remove('pulse'), 8000);
    },
  };
}
