// 謎題「失物招領箱的密碼鎖」（E02，取得「感受不是診斷」）。
// 箱子上有三位數密碼鎖，每一格對應一張桌子（上方的圖示用形狀區分：方形、圓形、拱門形）。
// 每張桌子有「表面數字」（走近就數得出來）與「真正數字」（多查看一個地方才會發現，也會改變對那張桌子的理解）；
// 三個表面數字打不開鎖。撥對一格會亮、有卡榫聲；拉不開時只有不對的那幾格會抖，不出現對錯字樣。
// 開鎖後箱子裡是三位客人留下的東西與他們自己說的話，看完才取得卡片。
// 不計時、不扣分、不限次數；看過的線索與撥到的數字都存起來，中途離開再回來仍保留。規則在 src/game.js（lookSpot、setDial、tryLock）。
import { $, esc, openPanel } from './ui.js';
import { play } from './sfx.js';

const DRAFT = '<p class="fine draft">內容草案，尚未完成專業審閱。</p>';
const reduceMotion = () => document.body.classList.contains('reduce-motion');
const ORDINAL = ['第一格', '第二格', '第三格'];

// ---- 插圖（自製 SVG）----
// 每一格上方的圖示：形狀不同，不只靠顏色
const SHAPE = {
  square: '<rect x="-9" y="-9" width="18" height="18" rx="2.5" fill="#9cc3c9" stroke="#5a504a" stroke-width="1.8"/>',
  circle: '<circle r="10" fill="#e7b9a0" stroke="#5a504a" stroke-width="1.8"/>',
  arch: '<path d="M-9 10 V0 a9 9 0 0 1 18 0 V10 Z" fill="#b9c9a0" stroke="#5a504a" stroke-width="1.8"/>',
};
export const shapeIcon = (shape, size = 26) => `<svg class="shape-icon" width="${size}" height="${size}" viewBox="-13 -13 26 26" aria-hidden="true">${SHAPE[shape] ?? ''}</svg>`;

// 線索的小圖（筆記與放大鏡共用），座標約在 -20～20 之間
const CLUE = {
  draft: `<rect x="-16" y="-12" width="32" height="24" rx="2" fill="#fffaf0" stroke="#c98f6b" stroke-width="1.4"/>
    <path d="M-11 -5 h18 M-11 1 h14 M-11 7 h10" stroke="#8a7a6c" stroke-width="1.3"/><path d="M-13 -7 l24 14" stroke="#c97f62" stroke-width="1.6"/>
    <path d="M-16 -12 l5 4 l-3 5" stroke="#d8c6ad" fill="none"/>`,
  bag: `<path d="M-13 -4 h26 l-2 18 h-22 Z" fill="#d9b98f" stroke="#b08a68" stroke-width="1.3"/><path d="M-6 -4 q0 -7 6 -7 q6 0 6 7" stroke="#b08a68" stroke-width="1.5" fill="none"/>
    <circle cx="-4" cy="-6" r="5" fill="#fffdf7" stroke="#cfc6ba"/><circle cx="5" cy="-5" r="4.5" fill="#fffdf7" stroke="#cfc6ba"/>`,
  receipt: `<path d="M-11 -15 h22 v28 l-3.7 -3 l-3.7 3 l-3.6 -3 l-3.7 3 l-3.6 -3 l-3.7 3 Z" fill="#fffdf7" stroke="#a89e95" stroke-width="1.2"/>
    <path d="M-7 -9 h14 M-7 -4 h10 M-7 1 h13" stroke="#5a504a" stroke-width="1.2"/><path d="M-6 6 l3 3 l7 -7" stroke="#6f9f78" stroke-width="1.6" fill="none"/>`,
  cups: `<path d="M-14 -2 h20 l-3 16 h-14 Z" fill="#d9b98f" stroke="#b08a68" stroke-width="1.2"/>
    ${[-9, 1].map((x) => `<rect x="${x}" y="-14" width="8" height="13" rx="1.5" fill="#fff" stroke="#a89e95"/><rect x="${x - 1}" y="-16" width="10" height="3" rx="1" fill="#8a7a6c"/>`).join('')}`,
  ballbite: `<circle r="12" fill="#f0a59a" stroke="#c97f62" stroke-width="1.4"/>${[[-5, -4], [3, -6], [6, 2], [-2, 5], [-7, 3]].map(([x, y]) => `<path d="M${x - 1.5} ${y} l1.5 -2 l1.5 2" stroke="#8a4f3c" stroke-width="1.1" fill="none"/>`).join('')}`,
  underchair: `<rect x="-16" y="-14" width="32" height="6" rx="2" fill="#b68a62"/><path d="M-13 -8 v18 M13 -8 v18" stroke="#8e6a4c" stroke-width="2.4"/>
    <circle cx="2" cy="8" r="6" fill="#f0a59a" stroke="#c97f62" stroke-width="1.2"/><path d="M-1 7 l1 -1.5 l1 1.5 M3 10 l1 -1.5 l1 1.5" stroke="#8a4f3c" stroke-width="0.9" fill="none"/>`,
  pen: '<g transform="rotate(-35)"><rect x="-3" y="-16" width="6" height="26" rx="2" fill="#8fb3c9" stroke="#5a504a" stroke-width="1.2"/><path d="M-3 10 l3 7 l3 -7 Z" fill="#efe6d8" stroke="#5a504a" stroke-width="1.2"/></g>',
  timetable: `<rect x="-14" y="-15" width="28" height="30" rx="2" fill="#fffaf0" stroke="#8a7a6c" stroke-width="1.3"/><rect x="-14" y="-15" width="28" height="7" fill="#9cc3c9"/>
    ${[-3, 2, 7, 12].map((y) => `<path d="M-10 ${y} h6 M0 ${y} h10" stroke="#8a7a6c" stroke-width="1.1"/>`).join('')}`,
  tag: '<path d="M0 -15 v6" stroke="#8a7a6c" stroke-width="1.4"/><circle cy="2" r="11" fill="#f2c46b" stroke="#c99a3e" stroke-width="1.6"/><path d="M-4 0 a2 2 0 1 1 4 0 a2 2 0 1 1 4 0 q0 4 -4 6 q-4 -2 -4 -6 Z" fill="#c99a3e" transform="translate(-2 0)"/>',
};
const clueSvg = (art, size = 34) => `<svg class="clue-svg" width="${size}" height="${size}" viewBox="-20 -20 40 40" aria-hidden="true">${CLUE[art] ?? ''}</svg>`;
const PAW = '<g fill="#d98d45"><ellipse cx="0" cy="4" rx="5" ry="4"/><circle cx="-5" cy="-2.5" r="2.2"/><circle cx="0" cy="-5" r="2.2"/><circle cx="5" cy="-2.5" r="2.2"/></g>';

// 桌子特寫：桌面上的東西（看過某個地方後會改變樣子）與可以點開的地方
const PAPER = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-11 -2 l7 -9 l9 2 l6 7 l-2 9 l-9 4 l-9 -4 Z" fill="#fffdf7" stroke="#cfc6ba" stroke-width="1.4"/><path d="M-5 0 l6 3 l6 -5 M-2 7 l5 -4" stroke="#cfc6ba" stroke-width="1.1" fill="none"/></g>`;
const CUP = (x, y) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="6" rx="17" ry="6" fill="#efe6d8"/><circle r="12" fill="#fff" stroke="#d8c6ad" stroke-width="1.6"/><circle r="8" fill="#e9dcc8"/><path d="M12 -2 a5 5 0 0 1 0 8" stroke="#d8c6ad" stroke-width="2" fill="none"/></g>`;
const BALL = (x, y, bitten) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="11" rx="12" ry="3.5" fill="#000" opacity=".08"/><g transform="scale(1.1)">${bitten ? CLUE.ballbite : '<circle r="12" fill="#f0a59a" stroke="#c97f62" stroke-width="1.4"/><path d="M-6 -6 a8 8 0 0 1 8 -3" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>'}</g></g>`;
const CHAIR = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-26" y="-22" width="52" height="40" rx="8" fill="#c79a6e" stroke="#8e6a4c" stroke-width="2"/><rect x="-26" y="-30" width="52" height="10" rx="4" fill="#b68a62"/></g>`;

const TABLE_ART = {
  t1: {
    art: (seen) => `${PAPER(168, 96)}${PAPER(222, 80)}${seen.has('t1a') ? `<g transform="translate(104 116) scale(1.15)">${CLUE.draft}</g>` : PAPER(104, 116)}
      <g transform="translate(300 196)"><path d="M-22 -10 h44 l-4 30 h-36 Z" fill="#d9b98f" stroke="#b08a68" stroke-width="1.6"/>${seen.has('t1b') ? `${PAPER(-9, -12)}${PAPER(9, -10)}` : ''}</g>`,
    spots: { t1a: [104, 116], t1b: [300, 196] },
  },
  t2: {
    art: (seen) => `${CUP(140, 96)}${CUP(196, 108)}
      <g transform="translate(252 100) rotate(8)">${seen.has('t2a') ? CLUE.receipt : '<path d="M-11 -15 h22 v28 l-3.7 -3 l-3.7 3 l-3.6 -3 l-3.7 3 l-3.6 -3 l-3.7 3 Z" fill="#fffdf7" stroke="#a89e95" stroke-width="1.2"/>'}</g>
      ${CHAIR(312, 168)}<g transform="translate(312 160)"><path d="M-16 -6 h32 l-3 22 h-26 Z" fill="#d9b98f" stroke="#b08a68" stroke-width="1.5"/>${seen.has('t2b') ? CLUE.cups.replace('<path d="M-14 -2 h20 l-3 16 h-14 Z" fill="#d9b98f" stroke="#b08a68" stroke-width="1.2"/>', '') : ''}</g>`,
    spots: { t2a: [252, 100], t2b: [312, 160] },
  },
  t3: {
    art: (seen) => `${BALL(176, 102, seen.has('t3a'))}
      ${CHAIR(300, 160)}<ellipse cx="300" cy="206" rx="34" ry="9" fill="#000" opacity=".1"/>${seen.has('t3b') ? BALL(304, 200, true) : ''}`,
    spots: { t3a: [176, 102], t3b: [300, 200] },
  },
};

function tableSvg(t, seen, mark) {
  const A = TABLE_ART[t.id];
  return `<svg class="stage table-close" viewBox="0 0 360 230" role="group" aria-label="${esc(t.short)}的桌面">
    <rect width="360" height="230" rx="18" fill="#efe3cf"/>
    <ellipse cx="180" cy="104" rx="128" ry="74" fill="#fffaf0" stroke="#e0cdb4" stroke-width="4"/>
    ${A.art(seen)}
    ${t.spots.map((s) => {
    const [x, y] = A.spots[s.id];
    const was = seen.has(s.id);
    return `<g class="spot ${was ? 'seen' : ''} ${mark === s.id ? 'marked' : ''}" data-spot="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}${was ? '（看過了）' : ''}${mark === s.id ? '（麻糬拍過這裡）' : ''}">
        <circle class="spot-hit" cx="${x}" cy="${y}" r="26" fill="transparent"/>
        ${mark === s.id ? `<g class="paw" transform="translate(${x - 22} ${y - 20})">${PAW}</g>` : ''}
      </g>`;
  }).join('')}
  </svg>`;
}

export function openLockPuzzle(game, id, view) {
  const p = game.c.puzzles.puzzles[id];
  const body = $('puzzle-body');
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const st = () => game.lockState(id);
  const tableOf = (tid) => p.tables.find((x) => x.id === tid);
  let showingBox = false;
  let hadCard = game.s.cards.includes(p.card);

  const setTitle = (s) => { $('puzzle-title').textContent = s; };

  // ---- 完成畫面 ----
  const solvedView = () => {
    showingBox = false;
    setTitle(p.title);
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
      lockView();
    };
  };

  // ---- 箱子打開：三位客人留下的東西與他們自己說的話 ----
  const finish = () => {
    if (!showingBox) return;
    showingBox = false;
    hadCard = game.s.cards.includes(p.card);
    game.finishLock(id);
  };
  const boxView = (animate) => {
    showingBox = true;
    setTitle(p.title);
    body.innerHTML = `<div class="box-open ${animate && !reduceMotion() ? 'animate' : ''}">
        <div class="lockbox opened" aria-hidden="true"><div class="lid"></div><div class="crate"></div></div>
        <p class="caption" role="status">${esc(animate ? p.open : p.boxIntro)}</p>
        <ul class="box-items">${p.tables.map((t, i) => `<li style="--i:${i}">
          <span class="item-art">${clueSvg(t.itemArt, 44)}</span>
          <div><strong>${esc(t.item)}</strong> <span class="fine">（${esc(t.short)}）</span><p>${esc(t.quote)}</p></div></li>`).join('')}</ul>
        <div class="row-actions"><button type="button" class="btn primary" data-done>收好，蓋上箱子</button></div></div>`;
    body.querySelector('[data-done]').onclick = () => { finish(); solvedView(); };
    if (animate) later(() => { const c = body.querySelector('.box-open .caption'); if (c) c.textContent = p.boxIntro; }, reduceMotion() ? 0 : 1600);
  };

  // ---- 密碼鎖特寫 ----
  function lockView() {
    showingBox = false;
    setTitle(p.title);
    const dial = st().dial;
    body.innerHTML = `<p class="fine">${esc(p.minutes)}・不計時，可以慢慢試</p>
      <p>${esc(p.intro)}</p>
      <div class="lock-layout">
        <div class="lockbox" aria-hidden="false">
          <div class="crate"><div class="padlock">
            <svg class="shackle" viewBox="0 0 120 70" aria-hidden="true"><path d="M22 70 V38 a38 34 0 0 1 76 0 V70" fill="none" stroke="#a89e95" stroke-width="12" stroke-linecap="round"/></svg>
            <div class="lock-body" role="group" aria-label="三位數密碼鎖">
              ${p.tables.map((t, i) => `<div class="dial ${dial[i] === p.code[i] ? 'right' : ''}" data-i="${i}">
                <span class="dial-shape" title="${esc(t.shapeName)}">${shapeIcon(t.shape, 24)}</span>
                <button type="button" class="dial-btn" data-step="1" aria-label="${ORDINAL[i]}加一">▲</button>
                <div class="dial-num" tabindex="0" role="spinbutton" aria-valuemin="0" aria-valuemax="9" aria-valuenow="${dial[i]}"
                  aria-label="${ORDINAL[i]}（${esc(t.shapeName)}）"><span class="n-prev">${(dial[i] + 9) % 10}</span><span class="n">${dial[i]}</span><span class="n-next">${(dial[i] + 1) % 10}</span></div>
                <button type="button" class="dial-btn" data-step="-1" aria-label="${ORDINAL[i]}減一">▼</button>
              </div>`).join('')}
            </div>
          </div></div>
        </div>
      </div>
      <p class="caption" role="status" aria-live="polite">${esc(p.lockStart)}</p>
      <div class="mg-footer"><button type="button" class="btn" data-later>先離開，回去看看桌子</button><button type="button" class="btn primary" data-try>拉拉看</button></div>`;
    body.querySelector('[data-later]').onclick = () => $('puzzle').close();
    const caption = body.querySelector('.caption');
    const padlock = body.querySelector('.padlock');
    const dials = [...body.querySelectorAll('.dial')];

    const show = (i, d) => {
      const el = dials[i];
      const num = el.querySelector('.dial-num');
      num.querySelector('.n').textContent = d[i];
      num.querySelector('.n-prev').textContent = (d[i] + 9) % 10;
      num.querySelector('.n-next').textContent = (d[i] + 1) % 10;
      num.setAttribute('aria-valuenow', d[i]);
      const right = d[i] === p.code[i];
      if (right && !el.classList.contains('right')) play('latch'); // 撥對一格：卡榫聲與亮光
      el.classList.toggle('right', right);
      el.classList.remove('shake');
    };
    const turn = (i, step) => {
      const d = game.setDial(id, i, st().dial[i] + step);
      play('tick');
      const num = dials[i].querySelector('.dial-num');
      num.classList.remove('roll-up', 'roll-down');
      void num.offsetWidth;
      num.classList.add(step > 0 ? 'roll-up' : 'roll-down');
      show(i, d);
    };
    for (const el of dials) {
      const i = Number(el.dataset.i);
      for (const b of el.querySelectorAll('[data-step]')) b.onclick = () => turn(i, Number(b.dataset.step));
      const num = el.querySelector('.dial-num');
      num.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); turn(i, 1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); turn(i, -1); }
      });
      num.addEventListener('wheel', (e) => { e.preventDefault(); turn(i, e.deltaY < 0 ? 1 : -1); }, { passive: false });
      // 在轉盤上上下滑動也可以撥（每滑 28px 一格）
      let drag = null;
      num.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, id: e.pointerId }; num.setPointerCapture(e.pointerId); });
      num.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dy = drag.y - e.clientY;
        if (Math.abs(dy) >= 28) { turn(i, dy > 0 ? 1 : -1); drag.y = e.clientY; }
      });
      const end = () => { drag = null; };
      num.addEventListener('pointerup', end);
      num.addEventListener('pointercancel', end);
    }

    body.querySelector('[data-try]').onclick = () => {
      const r = game.tryLock(id);
      if (r.ok) {
        play('unlock');
        padlock.classList.add('pop');
        caption.textContent = p.open;
        body.querySelector('[data-try]').disabled = true;
        later(() => boxView(true), reduceMotion() ? 600 : 1300);
        return;
      }
      play('stuck');
      padlock.classList.remove('wobble');
      void padlock.offsetWidth;
      padlock.classList.add('wobble');
      for (const i of r.wrong) {
        dials[i].classList.remove('shake');
        void dials[i].offsetWidth;
        dials[i].classList.add('shake');
      }
      // 減少動畫時沒有晃動，改用一行描述說明哪幾格沒有動
      const still = reduceMotion() ? ` ${r.wrong.map((i) => `${ORDINAL[i]}（${p.tables[i].shapeName}）`).join('、')}好像卡住了。` : '';
      caption.textContent = `${p.stuck}${still}${r.surface ? ` ${p.surfaceHint}` : ''}`;
    };
  }

  // ---- 桌子特寫 ----
  function tableView(tid) {
    showingBox = false;
    const t = tableOf(tid);
    setTitle(t.short);
    const render = (spotId) => {
      const seen = new Set(st().seen);
      // 只留桌角的圖形記號，不寫對應第幾格，也不描述桌上的東西（看圖）
      body.innerHTML = `<p class="table-head">${shapeIcon(t.shape, 30)}<span class="sr">桌角貼著一個${esc(t.shapeName)}的記號。${esc(t.look)}</span></p>
        <div class="stage-wrap">${tableSvg(t, seen, game.lockMark)}</div>
        <p class="caption" role="status" aria-live="polite"></p>
        <div class="lens hidden" aria-live="polite"></div>
        <div class="mg-footer"><button type="button" class="btn" data-later>先離開</button></div>`;
      body.querySelector('[data-later]').onclick = () => $('puzzle').close();
      const caption = body.querySelector('.caption');
      const lens = body.querySelector('.lens');
      const look = (sid) => {
        const s = game.lookSpot(id, sid);
        if (!s) return;
        render(sid);
      };
      for (const g of body.querySelectorAll('.spot')) {
        g.addEventListener('click', () => look(g.dataset.spot));
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); look(g.dataset.spot); } });
      }
      if (game.lockMark && t.spots.some((s) => s.id === game.lockMark)) caption.textContent = '麻糬拍過的地方有一個小腳印。';
      if (spotId) {
        const s = t.spots.find((x) => x.id === spotId);
        play('flip');
        caption.textContent = s.name;
        lens.innerHTML = `<div class="lens-glass">${clueSvg(s.art, 84)}</div><div class="lens-text"><h4>${esc(s.name)}</h4><p>${esc(s.text)}</p></div>`;
        lens.classList.remove('hidden', 'pop');
        void lens.offsetWidth;
        lens.classList.add('pop');
        lens.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
      }
    };
    render();
  }

  // ---- 打開哪一個畫面 ----
  const s0 = st();
  const active = !s0.solved || s0.replay; // 還沒解開，或已經有卡、正在重玩
  if (view && tableOf(view)) tableView(view);
  else if (!active) solvedView();
  else if (s0.opened) boxView(false);
  else lockView();
  // 箱子打開了、還沒按「收好」就離開：也算看過了，取得卡片
  openPanel('puzzle', () => { timers.forEach(clearTimeout); finish(); });
}
