// 「我需要幫忙」對話框。按鈕寫在 index.html，不依賴 Phaser，遊戲出錯時也能使用。
const button = document.getElementById('help-button');
const dialog = document.getElementById('help-dialog');
const list = document.getElementById('help-list');

button.addEventListener('click', () => dialog.showModal());
document.getElementById('help-close').addEventListener('click', () => dialog.close());

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

fetch('content/resources.json')
  .then((r) => r.json())
  .then((data) => {
    if (data.emergency?.text) document.getElementById('help-emergency').textContent = data.emergency.text;
    list.innerHTML = data.resources.map((r) => {
      const pending = r.verification === '待核對' ? '<span class="pending">待核對</span>' : '';
      const phone = r.phone ? `<a class="phone" href="tel:${escapeHtml(r.phone)}">${escapeHtml(r.phone)}</a> ` : '';
      return `<li>${phone}<strong>${escapeHtml(r.name)}</strong>${pending}
        <div>${escapeHtml(r.description)}</div>
        <div class="meta">${escapeHtml(r.provider)}・${escapeHtml(r.hours)}</div></li>`;
    }).join('');
  })
  .catch(() => { /* 保留 index.html 內的備用清單 */ });
