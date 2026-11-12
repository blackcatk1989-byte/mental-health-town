// 文字模式：用地點清單、角色與物件按鈕取代走路；「問問麻糬」提供和 3D 相同的三層提示。
// 和 3D 模式共用同一份進度、對話、練習、謎題、卡片與任務。
import { $, esc } from './ui.js';

export function startTextMode(game, ui) {
  const root = $('text-mode');
  root.classList.remove('hidden');
  let mark = null; // 麻糬的提示：{ layer, targetId, areaId }

  const verb = (t) => (t.kind === 'character' ? '對話' : t.kind === 'puzzle' ? '仔細看看' : '查看');

  function render() {
    if (!game.s) return;
    const areas = game.c.places.areas;
    const here = areas.find((a) => a.id === game.s.area) ?? areas[0];
    const goals = game.goalTargets();
    const targets = game.targets().filter((t) => t.area === here.id);
    // 目標已經完成（例如謎題解開），提示標記就收起來
    if (mark && !game.hintTopics().some((t) => t.target === mark.targetId)) mark = null;
    root.innerHTML = `
      <h2>${esc(game.c.places.town)}・${esc(here.name)}</h2>
      <p>${esc(here.description)}</p>
      <nav class="places" aria-label="前往其他地點">${areas.map((a) => `<button type="button" class="btn ${a.id === here.id ? 'on' : ''}"
        data-area="${a.id}" ${a.id === here.id ? 'aria-current="true" disabled' : ''}>${esc(a.name)}
        ${game.targets().some((t) => t.area === a.id && goals.includes(t.id)) ? '<span class="goal-dot" aria-label="目前目標">！</span>' : ''}
        ${mark?.areaId === a.id && a.id !== here.id ? '<span class="cat-dot">麻糬往這裡走了</span>' : ''}</button>`).join('')}</nav>
      <ul class="text-targets">${targets.map((t) => `<li class="${mark?.layer === 3 && mark.targetId === t.id ? 'marked' : ''}">
        <div><strong>${esc(t.name)}</strong>
          ${t.kind === 'character' ? `<small>${esc(t.data.role)}</small>` : ''}
          ${goals.includes(t.id) ? '<span class="goal-dot">目前目標</span>' : ''}
          ${mark && mark.layer >= 2 && mark.targetId === t.id ? '<span class="cat-dot">麻糬坐在旁邊</span>' : ''}
          ${mark?.layer === 3 && mark.targetId === t.id ? '<span class="goal-dot">就是這裡</span>' : ''}</div>
        <div class="row-actions left">
          <button type="button" class="btn primary" data-act="${t.id}">${verb(t)}</button>
          ${t.cardTarget ? `<button type="button" class="btn" data-use="${t.id}">使用理解卡</button>` : ''}
        </div></li>`).join('')}
        <li class="cat-row"><div><strong>橘貓麻糬</strong><small>不會說話，但很會帶路</small></div>
          <div class="row-actions left"><button type="button" class="btn" data-hint>問問麻糬</button></div></li>
      </ul>`;
    for (const b of root.querySelectorAll('[data-area]')) b.onclick = () => game.setArea(b.dataset.area);
    for (const b of root.querySelectorAll('[data-act]')) b.onclick = () => game.interact(b.dataset.act);
    for (const b of root.querySelectorAll('[data-use]')) b.onclick = () => ui.openUseCard(b.dataset.use);
    root.querySelector('[data-hint]').onclick = () => ui.hints();
  }

  const onHint = (e) => {
    const { layer, target, area } = e.detail;
    mark = { layer, targetId: target.id, areaId: area.id };
    render();
  };
  game.addEventListener('change', render);
  game.addEventListener('hint', onHint);
  render();

  return {
    stop() {
      game.removeEventListener('change', render);
      game.removeEventListener('hint', onHint);
      root.classList.add('hidden');
      root.innerHTML = '';
    },
  };
}
