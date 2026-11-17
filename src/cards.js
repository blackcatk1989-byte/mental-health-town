// 理解卡：卡面插圖、卡冊、使用理解卡面板。
// 卡冊不是分數：不顯示稀有度、攻擊力或治癒力；基本說明與求助資訊在「找支持」，不受收藏限制。
import { $, esc, openPanel, EMOTES } from './ui.js';

// 簡單的線條插圖（自製 SVG，不使用外部素材）
const ICONS = {
  umbrella: '<path d="M14 40a26 26 0 0 1 52 0z"/><path d="M40 40v16a5 5 0 0 1-10 0"/><path d="M40 12v4"/>',
  hands: '<path d="M18 44c6-10 14-14 22-14s16 4 22 14" /><circle cx="28" cy="26" r="6"/><circle cx="52" cy="26" r="6"/><path d="M30 50c4 4 16 4 20 0"/>',
  magnifier: '<circle cx="34" cy="32" r="14"/><path d="M44 42l14 14"/><path d="M28 32h12"/>',
  leaf: '<path d="M20 56C20 30 38 18 60 18c0 24-14 38-40 38z"/><path d="M20 56L46 30"/>',
  door: '<rect x="24" y="14" width="32" height="44" rx="4"/><circle cx="48" cy="38" r="2.5"/><path d="M14 58h52"/>',
  chair: '<path d="M24 16v40M24 36h28v20M24 36v-4h28"/><path d="M52 16v20"/><path d="M60 52h8M64 44v12"/>',
  cloud: '<path d="M22 46a10 10 0 0 1 2-20 14 14 0 0 1 27-2 10 10 0 0 1 7 22z"/><path d="M30 54h20"/>',
};

// 金卡：取得的隱藏卡。金色只是外觀與分類，不代表稀有度或強度
export const isGold = (card, owned = true) => !!card.hidden && owned;

export function cardArt(card, owned = true) {
  const gold = isGold(card, owned);
  const color = owned ? card.color : '#cfc6bd';
  const stroke = owned ? '#5a4a42' : '#a89e95';
  return `<svg class="art" viewBox="0 0 80 72" aria-hidden="true">
    <rect x="2" y="2" width="76" height="68" rx="12" fill="${color}" opacity="${owned ? 0.55 : 0.6}"/>
    ${gold ? '<rect x="3.5" y="3.5" width="73" height="65" rx="11" fill="none" stroke="#c99a3e" stroke-width="3"/><rect x="8" y="8" width="64" height="56" rx="8" fill="none" stroke="#efd38a" stroke-width="1.4"/>' : ''}
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
    return `<div class="card-detail locked">
      ${cardArt(card, false)}
      <h3>${esc(card.id)}　${esc(card.title)}</h3>
      <p class="tag">${esc(card.kind)}・${esc(themeName(game, card.theme))}</p>
      <p><strong>取得線索：</strong>${esc(card.hint)}</p>
      <p class="fine">取得後就能閱讀完整內容。卡住的時候，可以找橘貓麻糬。</p>
    </div>`;
  }
  return `<div class="card-detail ${isGold(card) ? 'gold' : ''}">
    ${cardArt(card)}
    <h3>${esc(card.id)}　${esc(card.title)}</h3>
    <p class="tag">${esc(card.kind)}・${esc(themeName(game, card.theme))}${isGold(card) ? '・<span class="gold-label">金卡</span>' : ''}</p>
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

export function openCardbook(game, { focus } = {}) {
  const body = $('cardbook-body');
  const list = () => {
    const all = game.c.cards.cards;
    const normal = all.filter((k) => !k.hidden);
    const hidden = all.filter((k) => k.hidden);
    const count = (cards) => cards.filter((k) => game.hasCard(k.id)).length;
    const tile = (k) => {
      const owned = game.hasCard(k.id);
      // 隱藏卡：取得前只是一個「？」，沒有名稱、剪影與線索，也不是金色，點不開
      if (k.hidden && !owned) return '<div class="card-tile locked secret" aria-label="還沒有取得的隱藏卡">？</div>';
      return `<button type="button" class="card-tile ${owned ? '' : 'locked'} ${isGold(k, owned) ? 'gold' : ''}" data-card="${k.id}">
          ${isGold(k, owned) ? '<span class="gold-label">金卡</span>' : ''}${cardArt(k, owned)}<strong>${esc(k.title)}</strong>
          <small>${owned ? esc(k.keyPoint) : `未取得：${esc(k.hint)}`}</small></button>`;
    };
    const groups = game.c.cards.themes.map((t) => {
      const cards = normal.filter((k) => k.theme === t.id);
      return cards.length ? `<h4>${esc(t.name)}</h4><div class="card-grid">${cards.map(tile).join('')}</div>` : '';
    }).join('');
    const sec = game.c.cards.hiddenSection ?? { name: '隱藏卡' };
    body.innerHTML = `<section class="cardbook-section" aria-label="理解卡">
        <h3 class="section-head">理解卡 <span class="count">${count(normal)}/${normal.length}</span></h3>${groups}</section>
      ${hidden.length ? `<section class="cardbook-section hidden-cards" aria-label="${esc(sec.name)}">
        <h3 class="section-head">${esc(sec.name)} <span class="count">${count(hidden)}/${hidden.length}</span></h3>
        <div class="card-grid">${hidden.map(tile).join('')}</div>
        ${sec.note ? `<p class="fine">${esc(sec.note)}</p>` : ''}</section>` : ''}
      <p class="fine">理解卡是遊戲裡的知識整理，不代表任何心理健康分數或診斷。用卡後卡片會保留。</p>`;
    for (const b of body.querySelectorAll('[data-card]')) b.onclick = () => detail(b.dataset.card);
    $('cardbook-back').classList.add('hidden');
  };
  const detail = (id) => {
    body.innerHTML = detailHtml(game, game.card(id));
    $('cardbook-back').classList.remove('hidden');
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
      <div class="card-grid">${owned.map((k) => `<button type="button" class="card-tile ${isGold(k) ? 'gold' : ''}" data-card="${k.id}">
        ${isGold(k) ? '<span class="gold-label">金卡</span>' : ''}${cardArt(k)}<strong>${esc(k.title)}</strong></button>`).join('')}</div>`;
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
      if (r.quiet) {
        // 隱藏角色：只有簡短的情境描述，沒有表情、目標或其他提示
        body.innerHTML = `<div class="notice">${esc(r.text)}</div>
          <div class="row-actions"><button type="button" class="btn" data-close>關閉</button>
          <button type="button" class="btn primary" data-again>再選一張</button></div>`;
        body.querySelector('[data-close]').onclick = () => $('usecard').close();
        body.querySelector('[data-again]').onclick = () => pick();
        return;
      }
      body.innerHTML = `<div class="notice puzzled"><span class="emote-inline" aria-hidden="true">${EMOTES.question}</span>
          <span>${esc(r.text)}</span></div>
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
