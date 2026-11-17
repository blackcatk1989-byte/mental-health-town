// 謎題「先別急著貼標籤」（E02，取得「感受不是診斷」）。
// 三張桌子留下的痕跡很像。玩家把圖示貼紙（很累、在難過、在生氣、是不是生病了）貼到桌上，
// 貼上後約 1 秒出現下一層線索；查看後，原本的貼紙翹起、飄回手上——沒有任何一張圖示貼紙撐得到最後。
// 貼上空白的問號，或看完那張桌子的所有線索，桌子的主人就走回來，自己說真正的原因。
// 沒有對錯、不計時、不扣分，也不記錄玩家貼過哪些貼紙；規則與進度在 src/game.js（stickLabel、viewClue）。
// 操作：點貼紙再點桌子；電腦也可以拖曳；鍵盤用 Tab 與 Enter。「減少動畫」時改成靜態的前後變化加一行描述。
import { $, esc, openPanel } from './ui.js';
import { play } from './sfx.js';

const DRAFT = '<p class="fine draft">內容草案，尚未完成專業審閱。</p>';
const W = 400;
const H = 320;
const SEATS = [{ x: 78, y: 116 }, { x: 200, y: 96 }, { x: 322, y: 116 }];
const R = 52;
const SHEET_Y = 274;
const REVEAL_DELAY = 1000; // 貼上後多久出現下一層線索（毫秒）
const OWNER_STAY = 3600; // 主人回來說話後停留多久

const reduceMotion = () => document.body.classList.contains('reduce-motion');

// ---- 插圖（自製 SVG）----
// 貼紙：只有圖、沒有字；用表情和小物件的形狀區分，不只靠顏色
const FACE = '<circle r="15" fill="#fffaf0" stroke="#c9b9a6" stroke-width="1.6"/>';
const STICKER_ART = {
  tired: `${FACE}<path d="M-8 -1 q3 3 6 0 M2 -1 q3 3 6 0" stroke="#5a504a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M-4 7 h8" stroke="#5a504a" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M7 -12 a5 5 0 1 0 5 6 a4 4 0 0 1 -5 -6 Z" fill="#8fa3c9"/>`,
  sad: `${FACE}<circle cx="-5" cy="-3" r="1.6" fill="#5a504a"/><circle cx="5" cy="-3" r="1.6" fill="#5a504a"/>
    <path d="M-5 8 q5 -5 10 0" stroke="#5a504a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M9 0 q3 5 0 7 q-3 -2 0 -7 Z" fill="#8fc3dc"/>`,
  angry: `${FACE}<path d="M-9 -7 l6 3 M9 -7 l-6 3" stroke="#5a504a" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="-5" cy="-1" r="1.5" fill="#5a504a"/><circle cx="5" cy="-1" r="1.5" fill="#5a504a"/>
    <path d="M-5 7 h10" stroke="#5a504a" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M8 -13 l2 -4 M11 -11 l4 -2" stroke="#d2705f" stroke-width="1.8" stroke-linecap="round"/>`,
  sick: `${FACE}<circle cx="-6" cy="-4" r="1.5" fill="#5a504a"/><circle cx="2" cy="-4" r="1.5" fill="#5a504a"/>
    <path d="M-7 5 q3 -2 6 0" stroke="#5a504a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <g transform="rotate(35 6 4)"><rect x="4" y="-6" width="4.5" height="15" rx="2.2" fill="#fff" stroke="#8a7a6c" stroke-width="1.2"/>
    <rect x="5.4" y="1" width="1.7" height="6" fill="#d2705f"/><circle cx="6.25" cy="9" r="3" fill="#d2705f" stroke="#8a7a6c" stroke-width="1.2"/></g>`,
  ask: `<circle r="15" fill="#fffdf7" stroke="#c9b9a6" stroke-width="1.6" stroke-dasharray="3 3"/>
    <path d="M-4.5 -4 a4.5 4.5 0 1 1 6.5 4 q-2 1.2 -2 3.5" stroke="#8a7a6c" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="0" cy="8.5" r="1.6" fill="#8a7a6c"/>`,
};

// 桌上一開始的東西：放涼的咖啡、揉成一團的紙巾
const CUP = '<g class="cup"><ellipse cx="-12" cy="2" rx="11" ry="4" fill="#efe6d8"/><circle cx="-12" cy="-2" r="8" fill="#fff" stroke="#d8c6ad" stroke-width="1.4"/><circle cx="-12" cy="-2" r="5" fill="#b08a68"/><path d="M-4 -2 a4 4 0 0 1 0 6" stroke="#d8c6ad" stroke-width="1.6" fill="none"/></g>';
const TISSUE = '<g class="tissue"><path d="M6 -4 l5 -5 l6 2 l4 5 l-2 6 l-7 3 l-6 -3 Z" fill="#fff" stroke="#cfc6ba" stroke-width="1.2"/><path d="M9 -1 l4 2 l4 -3 M11 5 l3 -3" stroke="#cfc6ba" stroke-width="1" fill="none"/></g>';

// 每一層線索的小圖
const CLUE_ART = {
  phone: `<rect x="-9" y="-15" width="18" height="30" rx="3.5" fill="#5a504a"/><rect x="-7" y="-12" width="14" height="22" rx="1.5" fill="#fdf3c4"/>
    ${[-8, -2, 4].map((y) => `<rect x="-5" y="${y}" width="10" height="3.6" rx="1.2" fill="#e9b98a"/>`).join('')}<circle cx="0" cy="12.4" r="1.2" fill="#b9aea4"/>`,
  card: `<rect x="-15" y="-11" width="30" height="22" rx="2.5" fill="#fffaf0" stroke="#c98f6b" stroke-width="1.4"/>
    <circle cx="-7" cy="-3" r="4" fill="#f0a59a"/><circle cx="-1" cy="-5" r="4" fill="#f2c46b"/><path d="M-7 1 q1 4 -1 7 M-1 -1 q-1 5 1 9" stroke="#8a7a6c" stroke-width="0.9" fill="none"/>
    <path d="M5 -3 h7 M5 2 h5" stroke="#8a7a6c" stroke-width="1.2"/>`,
  receipt: `<path d="M-11 -15 h22 v28 l-3.7 -3 l-3.7 3 l-3.6 -3 l-3.7 3 l-3.6 -3 l-3.7 3 Z" fill="#fffdf7" stroke="#a89e95" stroke-width="1.2"/>
    ${[-9, -3, 3].map((y) => `<path d="M-7 ${y} h14" stroke="#a89e95" stroke-width="1.1"/><path d="M-8 ${y + 1.5} l16 -3" stroke="#c97f62" stroke-width="1.2"/>`).join('')}`,
  bag: `<path d="M-12 -6 h24 l-2 20 h-20 Z" fill="#d9b98f" stroke="#b08a68" stroke-width="1.3"/><path d="M-6 -6 q0 -8 6 -8 q6 0 6 8" stroke="#b08a68" stroke-width="1.5" fill="none"/>
    <rect x="-7" y="-13" width="12" height="10" rx="1.5" fill="#fffaf0" stroke="#c98f6b" stroke-width="1.1" transform="rotate(-10)"/>`,
  ball: `<circle cx="-6" cy="3" r="9" fill="#f0a59a" stroke="#c97f62" stroke-width="1.3"/>${[[-9, 0], [-4, 6], [-2, -1]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#c97f62"/>`).join('')}
    <path d="M6 -12 q10 2 8 12" stroke="#6f9f78" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="14" cy="4" rx="4" ry="6" fill="none" stroke="#6f9f78" stroke-width="3"/>`,
  paws: [[-10, 8, -20], [0, -1, -10], [10, -10, 0]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r})" fill="#9fb9c9"><ellipse cx="0" cy="2" rx="3.6" ry="3"/><circle cx="-3.4" cy="-2.2" r="1.5"/><circle cx="0" cy="-3.6" r="1.5"/><circle cx="3.4" cy="-2.2" r="1.5"/></g>`).join(''),
};
const MAGNIFIER = '<circle r="11" fill="#fff" stroke="#c9b9a6"/><circle cx="-1.5" cy="-1.5" r="4.5" fill="#e6f1f4" stroke="#8a7a6c" stroke-width="1.6"/><path d="M2 2 L6.5 6.5" stroke="#8a7a6c" stroke-width="2.2" stroke-linecap="round"/>';
// 走回來拿東西的主人：只是路過的居民，沒有名字、不能對話（門口那桌的客人牽著狗）
const OWNER_LOOK = { t1: '#9cc3c9', t2: '#e7b9a0', t3: '#b9c9a0' };
const ownerArt = (id) => `<ellipse cx="0" cy="24" rx="11" ry="3" fill="#000" opacity=".08"/>
  <rect x="-8" y="2" width="16" height="20" rx="7" fill="${OWNER_LOOK[id]}"/><circle cx="0" cy="-6" r="9" fill="#efcfb2"/><path d="M-9 -8 a9 9 0 0 1 18 0 q-9 -5 -18 0 Z" fill="#6a5446"/>
  ${id === 't3' ? '<g transform="translate(17 16)"><ellipse cx="0" cy="3" rx="7" ry="4.5" fill="#d9b98f"/><circle cx="6" cy="-2" r="4" fill="#d9b98f"/><path d="M8 -5 l2 -4 l1 5" fill="#b08a68"/><path d="M-9 -2 q-6 -6 -9 -14" stroke="#6f9f78" stroke-width="1.5" fill="none"/></g>' : ''}`;

const closeUp = (art, box = '-22 -22 44 44') => `<svg class="lens-art" viewBox="${box}" aria-hidden="true">${art}</svg>`;

function stageSvg(p) {
  const seats = Object.fromEntries(p.tables.map((t, i) => [t.id, SEATS[i]]));
  const icons = p.stickers.filter((s) => !s.blank);
  const blank = p.stickers.find((s) => s.blank);
  const sx = (i) => 92 + i * 60;
  const sticker = (s, x, y, rot = 0) => `<g class="sticker" data-sticker="${s.id}" data-x="${x}" data-y="${y}" transform="translate(${x} ${y}) rotate(${rot})" tabindex="0" role="button" aria-label="貼紙：${esc(s.label)}">
      <g class="sticker-art">${STICKER_ART[s.id]}</g><circle r="20" fill="transparent"/></g>`;
  return `<svg class="stage labels" viewBox="0 0 ${W} ${H}" role="group" aria-label="咖啡店外的三張桌子與一疊貼紙">
    <rect width="${W}" height="${H}" rx="18" fill="#efe3cf"/>
    ${p.tables.map((t) => {
    const s = seats[t.id];
    return `<g class="zone ltable" data-slot="${t.id}" tabindex="0" role="button">
        <rect class="chair" x="${s.x - 62}" y="${s.y + 26}" width="24" height="22" rx="6" fill="#b68a62" transform="rotate(-24 ${s.x - 50} ${s.y + 37})"/>
        <circle cx="${s.x}" cy="${s.y}" r="${R}" fill="#fffaf0" stroke="#e0cdb4" stroke-width="3"/>
        <g class="t-base" transform="translate(${s.x - 4} ${s.y - 6})">${CUP}${TISSUE}</g>
        <g class="t-clues" transform="translate(${s.x} ${s.y + 22})">${t.clues.map((c, i) => `<g class="clue-icon" data-n="${i + 2}" transform="translate(${-16 + i * 32} 0) scale(.62)" opacity="0">${CLUE_ART[c.art] ?? ''}</g>`).join('')}</g>
        <g class="stuck-spot" transform="translate(${s.x + 28} ${s.y - 30})"></g>
        <g class="q-bubble" transform="translate(${s.x - 30} ${s.y - 56})" opacity="0">
          <path d="M-13 -12 h26 a7 7 0 0 1 7 7 v9 a7 7 0 0 1 -7 7 h-8 l-7 7 v-7 h-11 a7 7 0 0 1 -7 -7 v-9 a7 7 0 0 1 7 -7 Z" fill="#fff" stroke="#c9b9a6"/>
          <path d="M-3.5 -4 a3.6 3.6 0 1 1 5.2 3.2 q-1.6 1 -1.6 2.6" stroke="#8a7a6c" stroke-width="1.9" fill="none" stroke-linecap="round"/><circle cx="0" cy="5.6" r="1.3" fill="#8a7a6c"/>
        </g>
        <g class="clue-mark" transform="translate(${s.x - 38} ${s.y + 38})" opacity="0">${MAGNIFIER}</g>
        <g class="owner" transform="translate(${s.x + 54} ${s.y + 30})" opacity="0">${ownerArt(t.id)}</g>
        <circle class="zone-hit" cx="${s.x}" cy="${s.y}" r="${R}" fill="transparent"/>
      </g>`;
  }).join('')}
    ${sticker(blank, 322, SHEET_Y + 4, 14)}
    <rect class="sheet" x="58" y="${SHEET_Y - 30}" width="256" height="58" rx="10" fill="#fffdf7" stroke="#d8c6ad" stroke-width="2"/>
    ${icons.map((s, i) => sticker(s, sx(i), SHEET_Y)).join('')}
    <g class="flying"></g>
  </svg>`;
}

export function openLabelPuzzle(game, id) {
  const p = game.c.puzzles.puzzles[id];
  const body = $('puzzle-body');
  $('puzzle-title').textContent = p.title;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const st = (tid) => game.labelTable(id, tid);
  const tableOf = (tid) => p.tables.find((x) => x.id === tid);
  let hadCard = game.s.cards.includes(p.card); // 打開時就已經有卡（舊玩法取得，或重玩）
  const textMode = () => document.body.dataset.mode === 'text';

  const solvedView = () => {
    body.innerHTML = `<div class="solved">
      <h3 class="hand">${esc(p.solvedTitle)}</h3>
      ${p.solved.map((t) => `<p>${esc(t)}</p>`).join('')}
      <p>${hadCard ? '你已經有' : '你取得了'}理解卡「<span class="hand">${esc(game.card(p.card).title)}</span>」。</p>
      ${DRAFT}
      <div class="row-actions"><button type="button" class="btn" data-replay>再玩一次（不會重複拿卡）</button><button type="button" class="btn primary" data-close>關閉</button></div></div>`;
    body.querySelector('[data-close]').onclick = () => $('puzzle').close();
    body.querySelector('[data-replay]').onclick = () => {
      game.replayPuzzle(id);
      hadCard = true;
      (textMode() ? textView : stageView)();
    };
  };

  const allDone = () => p.tables.every((t) => st(t.id).done);
  if (game.s.puzzles[id].solved && (allDone() || !Object.keys(game.s.puzzles[id].tables ?? {}).length)) solvedView();
  else if (textMode()) textView();
  else stageView();
  openPanel('puzzle', () => timers.forEach(clearTimeout));

  // 已經看過的東西（第一層加上看過的線索）
  function seenList(t) {
    const n = st(t.id).seen;
    return [{ name: '桌上', text: t.look.replace(/^[^：]*：/, '') }, ...t.clues.slice(0, n - 1)];
  }

  // ---- 插畫版 ----
  function stageView() {
    body.innerHTML = `<p class="fine">${esc(p.minutes)}・不計時，可以慢慢看</p>
      <p>${esc(p.intro)}</p>
      <div class="stage-wrap labels">${stageSvg(p)}</div>
      <p class="caption" role="status" aria-live="polite">${esc(p.start)}</p>
      <div class="lens hidden" aria-live="polite"></div>
      <div class="mg-footer"><button type="button" class="btn" data-later>先離開，等等再來</button></div>`;
    body.querySelector('[data-later]').onclick = () => $('puzzle').close();
    const svg = body.querySelector('svg.stage');
    const caption = body.querySelector('.caption');
    const lens = body.querySelector('.lens');
    const flying = svg.querySelector('.flying');
    const zone = (tid) => svg.querySelector(`.zone[data-slot="${tid}"]`);
    const stickerNode = (sid) => svg.querySelector(`.sticker[data-sticker="${sid}"]`);
    const labelOf = (sid) => p.stickers.find((x) => x.id === sid).label;
    const busy = new Set(); // 正在播動畫的桌子，先不接受新的操作
    let selected = null;

    const showLens = (title, art, html) => {
      lens.innerHTML = `<div class="lens-glass">${art}</div><div class="lens-text"><h4>${esc(title)}</h4>${html}</div>`;
      lens.classList.remove('hidden', 'pop');
      void lens.offsetWidth;
      lens.classList.add('pop');
      lens.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
    };

    // 依進度更新一張桌子的樣子
    const render = (tid) => {
      const z = zone(tid);
      const t = tableOf(tid);
      const s = st(tid);
      for (const g of z.querySelectorAll('.clue-icon')) g.setAttribute('opacity', Number(g.dataset.n) <= s.seen ? '1' : '0');
      z.querySelector('.clue-mark').setAttribute('opacity', !s.done && s.layer > s.seen ? '1' : '0');
      z.classList.toggle('has-new', !s.done && s.layer > s.seen);
      z.classList.toggle('done', s.done);
      z.querySelector('.cup').setAttribute('opacity', s.done ? '0' : '1'); // 主人回來後把杯子收走
      const state = s.done ? `客人回來過了：${t.owner}` : s.layer > s.seen ? '有新出現的東西，可以點一下看看。' : '';
      z.setAttribute('aria-label', `${t.look}${seenList(t).slice(1).map((c) => `${c.name}：${c.text}`).join('')}${state}`);
    };
    for (const t of p.tables) render(t.id); // 回來繼續玩：桌上不留貼紙（不記錄貼過什麼），只保留看過的線索與收走的杯子

    const select = (sid) => {
      selected = sid;
      for (const g of svg.querySelectorAll('.sticker')) g.classList.toggle('selected', g.dataset.sticker === sid);
      if (sid) {
        play('pickup');
        caption.textContent = `拿起「${labelOf(sid)}」的貼紙。點一張桌子貼上去；再點一次貼紙就放下。`;
      }
    };

    // 主人走回來，自己說原因；桌上的杯子被收走
    const ownerReturns = (tid, solved) => {
      const z = zone(tid);
      const t = tableOf(tid);
      const o = z.querySelector('.owner');
      busy.add(tid);
      render(tid);
      o.setAttribute('opacity', '1');
      o.classList.add('in');
      play('happy');
      caption.textContent = `${p.ownerBack.replace('{table}', t.short)}${t.owner}${t.after}`;
      showLens(`${t.short}的客人`, closeUp(ownerArt(tid), '-24 -20 52 50'), `<p>${esc(t.owner)}</p><p class="fine">${esc(t.after)}</p>`);
      later(() => {
        o.classList.remove('in');
        o.setAttribute('opacity', '0');
        busy.delete(tid);
      }, reduceMotion() ? 2400 : OWNER_STAY);
      if (solved) later(solvedView, (reduceMotion() ? 2400 : OWNER_STAY) + 1200);
    };

    // 貼紙翹起、飄回手上
    const peel = (tid) => {
      const z = zone(tid);
      const stuck = z.querySelector('.stuck');
      if (!stuck) return false;
      const bubble = z.querySelector('.q-bubble');
      bubble.setAttribute('opacity', '1');
      later(() => bubble.setAttribute('opacity', '0'), 2200);
      play('flip');
      if (reduceMotion()) { stuck.remove(); return true; }
      stuck.classList.add('peel');
      later(() => stuck.classList.add('fly'), 520);
      later(() => stuck.remove(), 1150);
      return true;
    };

    const stick = (tid, sid) => {
      select(null);
      if (busy.has(tid)) return;
      const t = tableOf(tid);
      if (st(tid).done) { caption.textContent = p.doneTable; return; }
      const r = game.stickLabel(id, tid, sid);
      if (!r) return;
      if (r.pending) { caption.textContent = p.lookFirst; return; }
      const z = zone(tid);
      z.querySelector('.stuck-spot').innerHTML = `<g class="stuck${reduceMotion() ? '' : ' land'}">${STICKER_ART[sid]}</g>`;
      play('drop');
      lens.classList.add('hidden');
      if (r.done) {
        caption.textContent = p.askLine;
        busy.add(tid);
        later(() => ownerReturns(tid, r.solved), reduceMotion() ? 0 : 900);
        return;
      }
      caption.textContent = `你把「${labelOf(sid)}」貼在${t.short}。……`;
      busy.add(tid);
      later(() => {
        busy.delete(tid);
        render(tid);
        play('near');
        caption.textContent = p.noticed;
      }, reduceMotion() ? 0 : REVEAL_DELAY);
    };

    // 點桌子（手上沒有貼紙）：有新線索就查看，否則用放大鏡回顧看過的東西
    const look = (tid) => {
      if (busy.has(tid)) return;
      const t = tableOf(tid);
      const r = game.viewClue(id, tid);
      if (!r) {
        const s = st(tid);
        play('flip');
        if (s.done) {
          showLens(`${t.short}的客人`, closeUp(ownerArt(tid), '-24 -20 52 50'), `<p>${esc(t.owner)}</p>`);
          caption.textContent = p.doneTable;
        } else {
          showLens(t.short, closeUp(`<g transform="translate(0 2) scale(.9)">${CUP}${TISSUE}</g>`), `<ul>${seenList(t).map((c) => `<li><strong>${esc(c.name)}</strong>：${esc(c.text)}</li>`).join('')}</ul>`);
          caption.textContent = `用放大鏡看${t.short}。想貼貼紙的時候，先點下面的貼紙。`;
        }
        return;
      }
      render(tid);
      showLens(r.clue.name, closeUp(CLUE_ART[r.clue.art] ?? ''), `<p>${esc(r.clue.text)}</p>`);
      const peeled = peel(tid);
      caption.textContent = `${r.clue.text}${peeled ? p.peel : ''}`;
      if (r.done) {
        busy.add(tid);
        later(() => ownerReturns(tid, r.solved), reduceMotion() ? 1800 : 2600);
      }
    };

    // ---- 指標與鍵盤 ----
    const toSvg = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    };
    const zoneAt = (pt) => {
      for (const [i, t] of p.tables.entries()) if (Math.hypot(pt.x - SEATS[i].x, pt.y - SEATS[i].y) <= R * 1.1) return t.id;
      return null;
    };
    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.sticker');
      if (!g || e.pointerType === 'touch') return;
      drag = { sticker: g.dataset.sticker, start: toSvg(e), moved: false, id: e.pointerId, ghost: null };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const pt = toSvg(e);
      if (!drag.moved && Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) > 6) {
        drag.moved = true;
        select(drag.sticker);
        flying.innerHTML = `<g class="ghost">${STICKER_ART[drag.sticker]}</g>`;
        drag.ghost = flying.firstElementChild;
      }
      if (drag.moved) drag.ghost.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    });
    svg.addEventListener('pointerup', (e) => {
      if (drag && e.pointerId === drag.id) {
        const d = drag;
        drag = null;
        flying.innerHTML = '';
        if (d.moved) {
          const tid = zoneAt(toSvg(e));
          if (tid) stick(tid, d.sticker); else select(null);
          return;
        }
        select(selected === d.sticker ? null : d.sticker); // 沒有拖動：當成點一下
        return;
      }
      const g = e.target.closest('.sticker');
      if (g) { select(selected === g.dataset.sticker ? null : g.dataset.sticker); return; }
      const z = e.target.closest('.zone');
      if (!z) return;
      if (selected) stick(z.dataset.slot, selected); else look(z.dataset.slot);
    });
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const g = e.target.closest('.sticker');
      const z = e.target.closest('.zone');
      if (g) select(selected === g.dataset.sticker ? null : g.dataset.sticker);
      else if (z && selected) stick(z.dataset.slot, selected);
      else if (z) look(z.dataset.slot);
    });
  }

  // ---- 文字模式：用描述代替插畫；貼上貼紙後直接描述新線索與貼紙翹起，流程與結果相同 ----
  function textView(message, finished) {
    body.innerHTML = `<p class="fine">${esc(p.minutes)}・不計時，可以慢慢看</p>
      <p>${esc(p.intro)}</p>
      ${message ? `<div class="notice" role="status">${message.map((m) => `<p>${esc(m)}</p>`).join('')}</div>` : ''}
      <div class="puzzle-items">${p.tables.map((t) => {
    const s = st(t.id);
    return `<div class="puzzle-item">
          <h4>${esc(t.short)}</h4>
          <p>${esc(t.look.replace(/^[^：]*：/, ''))}</p>
          ${t.clues.slice(0, s.seen - 1).map((c) => `<p>${esc(c.name)}：${esc(c.text)}</p>`).join('')}
          ${s.done ? `<p class="fine">客人回來過了：${esc(t.owner)}${esc(t.after)}</p>`
    : `<p class="fine">選一張貼紙貼在這張桌子上：</p>
            <div class="bin-buttons">${p.stickers.map((k) => `<button type="button" class="btn small" data-table="${t.id}" data-sticker="${k.id}">${esc(k.label)}</button>`).join('')}</div>`}
        </div>`;
  }).join('')}</div>
      <div class="mg-footer">${finished ? '<button type="button" class="btn primary" data-next>繼續</button>' : '<button type="button" class="btn" data-later>先離開，等等再來</button>'}</div>`;
    if (finished) body.querySelector('[data-next]').onclick = solvedView;
    else body.querySelector('[data-later]').onclick = () => $('puzzle').close();
    for (const b of body.querySelectorAll('[data-sticker]')) {
      b.onclick = () => {
        const tid = b.dataset.table;
        const t = tableOf(tid);
        const k = p.stickers.find((x) => x.id === b.dataset.sticker);
        // 之前在插畫版留下還沒看的線索：先補看
        const r = game.stickLabel(id, tid, k.id);
        if (!r) return textView();
        const lines = [];
        let done = r.done;
        let solved = r.solved;
        if (r.done) {
          lines.push(p.askLine);
        } else {
          if (!r.pending) lines.push(`你把「${k.label}」貼在${t.short}。`);
          const v = game.viewClue(id, tid);
          if (v) {
            lines.push(`${r.pending ? '' : '過了一會兒，'}你注意到${v.clue.name}：${v.clue.text}`);
            if (!r.pending) lines.push(p.peel);
            done = v.done;
            solved = v.solved;
          }
        }
        play(done ? 'happy' : 'flip');
        if (done) lines.push(`${p.ownerBack.replace('{table}', t.short)}${t.owner}${t.after}`);
        textView(lines, solved); // 三張桌子都完成時，先讓玩家讀完最後一位客人說的話，再看說明
      };
    }
  }
}
