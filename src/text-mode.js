// 文字模式：用地點清單、角色與物件按鈕取代走路。
// 和 3D 模式共用同一份進度、對話、練習、卡片、探索點位與任務。
import { $, esc } from './ui.js';

export function startTextMode(game, ui) {
  const root = $('text-mode');
  root.classList.remove('hidden');
  let marked = null;

  const verb = (t) => (t.kind === 'character' ? '對話' : t.kind === 'pickup' ? '拾取理解卡' : '查看');

  function render() {
    if (!game.s) return;
    const areas = game.c.places.areas;
    const here = areas.find((a) => a.id === game.s.area) ?? areas[0];
    const goals = game.goalTargets();
    const targets = game.targets().filter((t) => t.area === here.id);
    root.innerHTML = `
      <h2>${esc(game.c.places.town)}・${esc(here.name)}</h2>
      <p>${esc(here.description)}</p>
      <nav class="places" aria-label="前往其他地點">${areas.map((a) => `<button type="button" class="btn ${a.id === here.id ? 'on' : ''}"
        data-area="${a.id}" ${a.id === here.id ? 'aria-current="true" disabled' : ''}>${esc(a.name)}
        ${game.targets().some((t) => t.area === a.id && goals.includes(t.id)) ? '<span class="goal-dot" aria-label="目前目標">！</span>' : ''}</button>`).join('')}</nav>
      <ul class="text-targets">${targets.map((t) => `<li>
        <div><strong>${t.kind === 'pickup' ? `${esc(t.point.name)}：有一張發亮的理解卡` : esc(t.name)}</strong>
          ${t.kind === 'character' ? `<small>${esc(t.data.role)}</small>` : ''}
          ${goals.includes(t.id) ? '<span class="goal-dot">目前目標</span>' : ''}
          ${marked && t.kind === 'pickup' && t.point.id === marked ? '<span class="goal-dot">已標記</span>' : ''}</div>
        <div class="row-actions left">
          <button type="button" class="btn primary" data-act="${t.id}">${verb(t)}</button>
          ${t.cardTarget ? `<button type="button" class="btn" data-use="${t.id}">使用理解卡</button>` : ''}
        </div></li>`).join('')}</ul>`;
    for (const b of root.querySelectorAll('[data-area]')) b.onclick = () => game.setArea(b.dataset.area);
    for (const b of root.querySelectorAll('[data-act]')) b.onclick = () => game.interact(b.dataset.act);
    for (const b of root.querySelectorAll('[data-use]')) b.onclick = () => ui.openUseCard(b.dataset.use);
  }

  const onLocate = (e) => {
    marked = e.detail.id;
    render();
  };
  game.addEventListener('change', render);
  game.addEventListener('locate', onLocate);
  render();

  return {
    stop() {
      game.removeEventListener('change', render);
      game.removeEventListener('locate', onLocate);
      root.classList.add('hidden');
      root.innerHTML = '';
    },
  };
}
