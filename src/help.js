// 「找支持」面板。按鈕寫在 index.html，獨立於遊戲與 3D 程式：遊戲出錯時也必須能用。
// 不需要完成任務或持有卡片；外部連結由玩家主動開啟，網址不附帶任何遊戲資料。
const dialog = document.getElementById('support');
const body = document.getElementById('support-body');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function item(r) {
  const outdated = r.validYear && new Date().getFullYear() > r.validYear;
  const rows = [
    ['提供單位', r.provider],
    ['用途', r.purpose],
    ['服務地區', r.region],
    ['服務時間', r.hours],
    ['費用', r.cost],
    ['適用對象', r.eligibility],
  ].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  return `<li class="resource">
    <div class="resource-head"><strong>${esc(r.name)}</strong><span class="kind">${esc(r.kind)}</span>
      ${outdated ? '<span class="kind warn">本年度內容待更新</span>' : ''}</div>
    <dl>${rows}</dl>
    ${r.note ? `<p class="fine">${esc(r.note)}</p>` : ''}
    <div class="resource-links">
      ${r.phone ? `<a class="btn primary" href="tel:${esc(r.phone)}">撥打 ${esc(r.phone)}</a>` : ''}
      <a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">開啟官方頁面</a>
    </div>
    <p class="fine">最後查核：${esc(r.checked)}</p>
  </li>`;
}

function render(data) {
  body.innerHTML = `
    <div class="emergency"><strong>${esc(data.emergency.title)}</strong><p>${esc(data.emergency.text)}</p>
      <div class="resource-links">${data.emergency.phones.map((p) => `<a class="btn danger" href="tel:${esc(p.number)}">撥打 ${esc(p.number)}（${esc(p.label)}）</a>`).join('')}</div></div>
    <p>${esc(data.notice)}</p>
    ${data.categories.map((c) => `<h3>${esc(c.title)}</h3><ul class="resources">${c.items.map(item).join('')}</ul>`).join('')}
    <p class="fine">資源連結查核日期：${esc(data.checked)}。年度方案可能變動，請以官方公告為準；未確認的條件標示為「請洽官方確認」。</p>`;
}

export function openSupport() {
  if (!dialog.open) dialog.showModal();
}
window.openSupport = openSupport;

for (const b of document.querySelectorAll('[data-open-support]')) b.addEventListener('click', openSupport);
document.getElementById('support-close').addEventListener('click', () => dialog.close());

fetch('content/resources.json')
  .then((r) => r.json())
  .then(render)
  .catch(() => { /* 保留 index.html 內的備用內容 */ });
