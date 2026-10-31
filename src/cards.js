// 理解卡：卡面插圖、卡冊、使用理解卡面板。
// 卡冊不是分數：不顯示稀有度、攻擊力或治癒力；基本說明與求助資訊在「找支持」，不受收藏限制。
import { $, esc, openPanel } from './ui.js';

// 簡單的線條插圖（自製 SVG，不使用外部素材）
const ICONS = {
  hands: '<path d="M18 44c6-10 14-14 22-14s16 4 22 14" /><circle cx="28" cy="26" r="6"/><circle cx="52" cy="26" r="6"/><path d="M30 50c4 4 16 4 20 0"/>',
  magnifier: '<circle cx="34" cy="32" r="14"/><path d="M44 42l14 14"/><path d="M28 32h12"/>',
  leaf: '<path d="M20 56C20 30 38 18 60 18c0 24-14 38-40 38z"/><path d="M20 56L46 30"/>',
  door: '<rect x="24" y="14" width="32" height="44" rx="4"/><circle cx="48" cy="38" r="2.5"/><path d="M14 58h52"/>',
  chair: '<path d="M24 16v40M24 36h28v20M24 36v-4h28"/><path d="M52 16v20"/><path d="M60 52h8M64 44v12"/>',
  cloud: '<path d="M22 46a10 10 0 0 1 2-20 14 14 0 0 1 27-2 10 10 0 0 1 7 22z"/><path d="M30 54h20"/>',
};

export function cardArt(card, owned = true) {
  const color = owned ? card.color : '#cfc6bd';
  const stroke = owned ? '#5a4a42' : '#a89e95';
  return `<svg class="art" viewBox="0 0 80 72" aria-hidden="true">
    <rect x="2" y="2" width="76" height="68" rx="12" fill="${color}" opacity="${owned ? 0.55 : 0.6}"/>
    <g fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${owned ? ICONS[card.icon] ?? '' : '<path d="M32 28a8 8 0 1 1 10 8v6M40 50v1"/>'}</g>
  </svg>`;
}

function themeName(game, id) {
  return game.c.cards.themes.find((t) => t.id === id)?.name ?? '';
}

function detailHtml(game, card) {
  const owned = game.hasCard(card.id);
  const sources = card.sources.length
    ? `<ul class="sources">${card.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>
        <small>（查核：${esc(s.checked)}）</small></li>`).join('')}</ul>`
    : '<p class="fine">本卡為遊戲內的衛教草案，尚未附外部來源（待補充）。</p>';
  if (!owned) {
    const explore = card.kind === '探索卡';
    return `<div class="card-detail locked">
      ${cardArt(card, false)}
      <h3>${esc(card.id)}　${esc(card.title)}</h3>
      <p class="tag">${esc(card.kind)}・${esc(themeName(game, card.theme))}</p>
      <p><strong>取得線索：</strong>${esc(card.hint)}</p>
      ${explore ? `<button type="button" class="btn primary" data-locate="${card.id}">顯示位置</button>` : ''}
      <p class="fine">取得後就能閱讀完整內容。</p>
    </div>`;
  }
  return `<div class="card-detail">
    ${cardArt(card)}
    <h3>${esc(card.id)}　${esc(card.title)}</h3>
    <p class="tag">${esc(card.kind)}・${esc(themeName(game, card.theme))}</p>
    <p class="key-point">${esc(card.keyPoint)}</p>
    <p>${esc(card.description)}</p>
    <h4>故事裡的例子</h4>
    <p>${esc(card.example)}</p>
    <h4>取得途徑</h4>
    <p>${esc(card.obtain)}</p>
    <h4>使用提示</h4>
    <p>${esc(card.useHint)}</p>
    <h4>來源</h4>
    ${sources}
    <p class="fine">審閱狀態：${esc(card.review)}｜更新日期：${esc(card.updated)}</p>
  </div>`;
}

export function openCardbook(game, { focus, toast, onLocate } = {}) {
  const body = $('cardbook-body');
  const list = () => {
    const groups = game.c.cards.themes.map((t) => {
      const cards = game.c.cards.cards.filter((k) => k.theme === t.id);
      return `<h3>${esc(t.name)}</h3><div class="card-grid">${cards.map((k) => {
        const owned = game.hasCard(k.id);
        return `<button type="button" class="card-tile ${owned ? '' : 'locked'}" data-card="${k.id}">
          ${cardArt(k, owned)}<strong>${esc(k.title)}</strong>
          <small>${owned ? esc(k.keyPoint) : `未取得：${esc(k.hint)}`}</small></button>`;
      }).join('')}</div>`;
    }).join('');
    body.innerHTML = `${groups}<p class="fine">理解卡是遊戲裡的知識整理，不代表任何心理健康分數或診斷。用卡後卡片會保留。</p>`;
    for (const b of body.querySelectorAll('[data-card]')) b.onclick = () => detail(b.dataset.card);
    $('cardbook-back').classList.add('hidden');
  };
  const detail = (id) => {
    body.innerHTML = detailHtml(game, game.card(id));
    $('cardbook-back').classList.remove('hidden');
    const loc = body.querySelector('[data-locate]');
    if (loc) {
      loc.onclick = () => {
        const r = game.locate(loc.dataset.locate);
        if (!r) return;
        $('cardbook').close();
        toast?.(`已標記位置：${esc(r.area.name)}・${esc(r.point.name)}`, { ms: 6000 });
        onLocate?.(r);
      };
    }
  };
  $('cardbook-back').onclick = list;
  if (focus) detail(focus);
  else list();
  openPanel('cardbook');
}

// 使用理解卡：選卡 → 確認意圖 → 角色或場景回應
export function openUseCard(game, targetId) {
  const t = game.target(targetId);
  if (!t) return;
  const body = $('usecard-body');
  $('usecard-title').textContent = `使用理解卡：${t.name}`;

  const pick = (message) => {
    const owned = game.c.cards.cards.filter((k) => game.hasCard(k.id));
    const miss = game.missingCard();
    const goalHere = game.goalTargets().includes(targetId);
    body.innerHTML = `
      ${message ? `<div class="notice">${message}</div>` : ''}
      ${miss && goalHere ? `<div class="notice">${esc(miss.text)}</div>` : ''}
      ${owned.length ? '<p>選一張卡，想想要怎麼和對方互動。閱讀卡片不算使用，要在這裡選卡才會觸發。</p>' : '<p>你還沒有任何理解卡。</p>'}
      <div class="card-grid">${owned.map((k) => `<button type="button" class="card-tile" data-card="${k.id}">
        ${cardArt(k)}<strong>${esc(k.title)}</strong></button>`).join('')}</div>`;
    for (const b of body.querySelectorAll('[data-card]')) b.onclick = () => confirmUse(b.dataset.card);
  };

  const confirmUse = (cardId) => {
    const k = game.card(cardId);
    body.innerHTML = `<div class="use-confirm">${cardArt(k)}
      <h3>「${esc(k.title)}」</h3>
      <p>${esc(game.useIntent(targetId, cardId))}</p>
      <div class="row-actions"><button type="button" class="btn" data-back>換一張</button>
      <button type="button" class="btn primary" data-go>使用</button></div></div>`;
    body.querySelector('[data-back]').onclick = () => pick();
    body.querySelector('[data-go]').onclick = () => {
      $('usecard').close();
      const r = game.useCard(targetId, cardId);
      if (r.ok) return;
      openPanel('usecard');
      body.innerHTML = `<div class="notice">${esc(r.text)}</div>
        ${r.goal ? `<p class="fine">目前目標：${esc(r.goal)}</p>` : ''}
        <p class="fine">卡片沒有被消耗，可以換一張試試，或晚點再來。</p>
        <div class="row-actions"><button type="button" class="btn" data-close>關閉</button>
        <button type="button" class="btn primary" data-again>再選一張</button></div>`;
      body.querySelector('[data-close]').onclick = () => $('usecard').close();
      body.querySelector('[data-again]').onclick = () => pick();
    };
  };

  pick();
  openPanel('usecard');
}
