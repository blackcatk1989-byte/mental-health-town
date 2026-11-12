// 里內的兩個謎題（E01 三盆植物、E02 還沒收的三張桌子），3D 與文字模式共用。
// 玩家看線索，把每一項放到對應的位置，按「放好了」檢查。不計時、不扣分、可無限重試；
// 擺好的位置會存起來，中途離開再回來仍保留。答錯只指出哪一項再看看、看哪個線索，不說答案。
import { $, esc, openPanel } from './ui.js';

const DRAFT = '<p class="fine draft">內容草案，尚未完成專業審閱。</p>';

export function openPuzzle(game, id) {
  const p = game.c.puzzles.puzzles[id];
  const body = $('puzzle-body');
  $('puzzle-title').textContent = p.title;
  const slot = (sid) => p.slots.find((x) => x.id === sid);

  const solvedView = () => {
    const place = game.s.puzzles[id].place;
    body.innerHTML = `<h3>${esc(p.solvedTitle)}</h3>
      <ul class="placed-list">${p.items.map((it) => `<li>${esc(it.label)} → ${esc(slot(place[it.id])?.icon)} ${esc(slot(place[it.id])?.label)}</li>`).join('')}</ul>
      ${p.solved.map((t) => `<p>${esc(t)}</p>`).join('')}
      <p>你取得了理解卡「${esc(game.card(p.card).title)}」。</p>
      ${DRAFT}
      <div class="row-actions"><button type="button" class="btn primary" data-close>關閉</button></div>`;
    body.querySelector('[data-close]').onclick = () => $('puzzle').close();
  };

  const render = (feedback) => {
    const place = game.s.puzzles[id].place;
    const wrong = new Set(feedback?.wrong ?? []);
    body.innerHTML = `<p class="fine">${esc(p.minutes)}・不計時、不扣分，可以一直重試</p>
      <p>${esc(p.intro)}</p>
      ${feedback?.text ? `<div class="notice" role="status">${esc(feedback.text)}</div>` : ''}
      ${feedback?.hints ? `<div class="notice" role="status">${feedback.hints.map((h) => `<p>${esc(h)}</p>`).join('')}</div>` : ''}
      <div class="puzzle-items">${p.items.map((it) => `<div class="puzzle-item ${wrong.has(it.id) ? 'again' : ''}">
        <h4>${esc(it.label)}${wrong.has(it.id) ? '<span class="tag-again">再看看</span>' : ''}</h4>
        <ul class="clues">${it.clues.map((c) => `<li><span class="clue-kind">${esc(c.kind)}</span>${esc(c.text)}</li>`).join('')}</ul>
        <div class="slot-buttons" role="group" aria-label="${esc(it.label)}要放在哪裡">${p.slots.map((s) => `<button type="button"
          class="option slot ${place[it.id] === s.id ? 'on' : ''}" data-item="${it.id}" data-slot="${s.id}" aria-pressed="${place[it.id] === s.id}">
          <span class="slot-icon" aria-hidden="true">${esc(s.icon)}</span><strong>${esc(s.label)}</strong>${s.detail ? `<small>${esc(s.detail)}</small>` : ''}</button>`).join('')}</div>
      </div>`).join('')}</div>
      <div class="mg-footer"><button type="button" class="btn" data-later>先離開，等等再來</button>
        <button type="button" class="btn primary" data-check>放好了</button></div>`;
    for (const b of body.querySelectorAll('[data-slot]')) {
      b.onclick = () => {
        const item = b.dataset.item;
        const target = b.dataset.slot;
        // 每個位置只放一項：被佔走的那一項先拿下來
        for (const it of p.items) if (it.id !== item && place[it.id] === target) game.placePuzzle(id, it.id, null);
        game.placePuzzle(id, item, place[item] === target ? null : target);
        render();
      };
    }
    body.querySelector('[data-later]').onclick = () => $('puzzle').close();
    body.querySelector('[data-check]').onclick = () => {
      const r = game.checkPuzzle(id);
      if (r.ok) solvedView();
      else render(r.notAll ? { text: r.text } : r);
    };
  };

  if (game.s.puzzles[id].solved) solvedView();
  else render();
  openPanel('puzzle');
}
