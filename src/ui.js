// 共用的 HTML 介面：對話框、提示訊息、確認視窗、設定、佈置面板、任務目標。
// 3D 模式與文字模式都用這一套；所有文字都在 HTML 裡呈現，不畫進 3D 場景。
import { openCardbook, openUseCard } from './cards.js';
import { openMinigame } from './minigames.js';

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
      <div class="setting"><span>音效</span><div class="segs">${opt('sound', false, '關閉')}${opt('sound', true, '開啟')}</div></div>
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
    for (const b of $('settings-body').querySelectorAll('[data-mode]')) {
      b.onclick = () => { $('settings').close(); handlers.setMode(b.dataset.mode); };
    }
    for (const b of $('settings-body').querySelectorAll('[data-act]')) {
      b.onclick = async () => {
        const act = b.dataset.act;
        if (act === 'home') { $('settings').close(); handlers.home(); return; }
        const ok = await confirm(act === 'clear'
          ? '確定要清除這個瀏覽器裡的所有進度嗎？卡片、任務與探索位置都會刪除，無法復原。'
          : '確定要重新開始嗎？目前的進度會被清除，探索卡會放到新的位置。', act === 'clear' ? '清除進度' : '重新開始');
        if (!ok) return;
        $('settings').close();
        if (act === 'clear') handlers.clear();
        else handlers.restart();
      };
    }
  }

  // ---- 佈置花園角落 ----
  function arrangement(cfg, current, hasQuiet, done) {
    const pick = { spot: current?.spot ?? cfg.spots[0].id, sign: current?.sign ?? 0, quiet: current?.quiet ?? false };
    const render = () => {
      $('arrange-body').innerHTML = `
        <h3>座位放在哪裡？</h3>
        <div class="options">${cfg.spots.map((s) => `<button type="button" class="option ${pick.spot === s.id ? 'on' : ''}"
          data-spot="${s.id}" aria-pressed="${pick.spot === s.id}"><strong>${esc(s.label)}</strong><small>${esc(s.note)}</small></button>`).join('')}</div>
        <h3>告示牌寫什麼？</h3>
        <div class="options">${cfg.signs.map((t, i) => `<button type="button" class="option ${pick.sign === i ? 'on' : ''}"
          data-sign="${i}" aria-pressed="${pick.sign === i}">「${esc(t)}」</button>`).join('')}</div>
        <h3>${esc(cfg.quiet.label)}</h3>
        ${hasQuiet
    ? `<button type="button" class="option ${pick.quiet ? 'on' : ''}" data-quiet aria-pressed="${pick.quiet}">
            <strong>${pick.quiet ? '已加入' : '加入'}安靜座位</strong><small>${esc(cfg.quiet.note)}</small></button>`
    : '<p class="fine">找到探索卡「每個人需要的空間不同」後，可以額外加入安靜座位（不影響完成任務）。</p>'}
        <p class="fine">每個選項都可以完成佈置，沒有標準答案。</p>`;
      for (const b of $('arrange-body').querySelectorAll('[data-spot]')) b.onclick = () => { pick.spot = b.dataset.spot; render(); };
      for (const b of $('arrange-body').querySelectorAll('[data-sign]')) b.onclick = () => { pick.sign = Number(b.dataset.sign); render(); };
      const q = $('arrange-body').querySelector('[data-quiet]');
      if (q) q.onclick = () => { pick.quiet = !pick.quiet; render(); };
    };
    render();
    let result = null;
    $('arrange-ok').onclick = () => { result = { ...pick }; $('arrange').close(); };
    $('arrange-cancel').onclick = () => $('arrange').close();
    openPanel('arrange', () => done(result));
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
    openCardbook: () => openCardbook(game, { toast, onLocate: (r) => game.dispatchEvent(new CustomEvent('located', { detail: r })) }),
    openUseCard: (targetId) => openUseCard(game, targetId),
    minigame: (id, mode, data, done) => openMinigame(id, mode, data, store.settings, done),
    arrangement,
    cardToast(card) {
      toast(`取得理解卡「<strong>${esc(card.title)}</strong>」`, { action: { label: '查看', fn: () => openCardbook(game, { focus: card.id, toast }) } });
    },
    tutorial(kind) {
      if (kind !== 'cardbook') return;
      const b = $('cardbook-button');
      b.classList.add('pulse');
      setTimeout(() => b.classList.remove('pulse'), 8000);
    },
    pickupAnimation(card) {
      if (store.settings.reduceMotion) return;
      const el = document.createElement('div');
      el.className = 'pickup-fly';
      el.style.background = card.color;
      document.body.append(el);
      setTimeout(() => el.remove(), 900);
    },
  };
}
