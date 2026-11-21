// 許願池：丟一枚硬幣之後，可以留一句話給遊戲製作者（也可以只許願、不留言）。
// 這是本專案「不傳送玩家資料」的唯一例外：玩家按下「送出」才傳送，只送留言文字（送出時間由資料庫自己記），
// 不送遊戲進度、選項、卡片、裝置資訊、位置或任何身分資料。沒按「送出」就什麼都不傳。
// 留言只有登入的製作者看得到（權限規則見 docs/supabase-wishes.sql）；這裡不是求助管道，製作者不會即時看到，也不會回覆。
// 硬幣不是遊戲資源，和卡片、任務都無關。
import { $ } from './ui.js';
import { play } from './sfx.js';
import { WISH_CONFIG } from './wish-config.js';

const MAX = 200;
const COOLDOWN = 30 * 1000; // 同一個瀏覽器每 30 秒最多送出一次
const LAST_KEY = 'xinzhijian.wish.last';
const FAKE_KEY = 'xinzhijian.wish.fake'; // 只在本機測試：假的收件端存在這裡，給願望紀錄頁預覽版面用

const configured = () => !!(WISH_CONFIG.url && WISH_CONFIG.publicKey);
const local = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.hostname.endsWith('.localhost');
export const wishMode = () => (configured() ? 'live' : local() ? 'fake' : 'off');

function lastSent() {
  try { return Number(localStorage.getItem(LAST_KEY)) || 0; } catch { return 0; }
}
function markSent() {
  try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* 存不了也沒關係 */ }
}

// 送出一則留言。成功時 resolve，失敗時 reject（不影響遊戲）
async function send(message) {
  if (wishMode() === 'fake') {
    // 假的收件端：模擬網路延遲；離線或測試要求失敗時就失敗
    await new Promise((r) => setTimeout(r, 400));
    if (!navigator.onLine || window.__wishFail) throw new Error('fake offline');
    try {
      const list = JSON.parse(localStorage.getItem(FAKE_KEY) || '[]');
      list.push({ id: crypto.randomUUID?.() ?? String(Date.now()), message, created_at: new Date().toISOString(), is_read: false });
      localStorage.setItem(FAKE_KEY, JSON.stringify(list));
    } catch { /* 假資料存不了也算送出 */ }
    return;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${WISH_CONFIG.url}/rest/v1/${WISH_CONFIG.table}`, {
      method: 'POST',
      headers: { apikey: WISH_CONFIG.publicKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ message }),
      signal: ctrl.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

// 手機鍵盤彈出時，面板跟著可見範圍縮小，送出按鈕不被擋住
function fitToKeyboard(dialog) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const fit = () => {
    dialog.style.maxHeight = `${Math.max(240, vv.height - 16)}px`;
    dialog.style.top = `${vv.offsetTop}px`;
  };
  fit();
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  return () => {
    vv.removeEventListener('resize', fit);
    vv.removeEventListener('scroll', fit);
    dialog.style.maxHeight = '';
    dialog.style.top = '';
  };
}

export function openWish(ui) {
  const dialog = $('wish');
  const text = $('wish-text');
  const count = $('wish-count');
  const status = $('wish-status');
  const sendBtn = $('wish-send');
  const form = $('wish-form');
  const done = $('wish-done');
  const mode = wishMode();

  // 關閉動畫時沒有投幣的動畫：用一行描述代替
  $('wish-coin-line').classList.toggle('hidden', !document.body.classList.contains('reduce-motion'));
  form.classList.remove('hidden');
  done.classList.add('hidden');
  $('wish-off').classList.toggle('hidden', mode !== 'off');
  $('wish-write').classList.toggle('hidden', mode === 'off');
  sendBtn.classList.toggle('hidden', mode === 'off');
  $('wish-fake').classList.toggle('hidden', mode !== 'fake');
  status.textContent = '';
  status.className = 'fine';

  const update = () => {
    const left = MAX - text.value.length;
    count.textContent = `還可以寫 ${left} 字`;
    sendBtn.disabled = !text.value.trim();
  };
  text.oninput = update;
  update();

  text.onfocus = () => setTimeout(() => sendBtn.scrollIntoView({ block: 'nearest' }), 300);

  $('wish-skip').onclick = () => dialog.close();
  $('wish-close').onclick = () => dialog.close();
  $('wish-ok').onclick = () => dialog.close();
  sendBtn.onclick = async () => {
    const message = text.value.trim().slice(0, MAX);
    if (!message) { update(); return; }
    const wait = COOLDOWN - (Date.now() - lastSent());
    if (wait > 0) {
      status.textContent = `剛剛已經送過一則了，${Math.ceil(wait / 1000)} 秒後可以再送。這段文字會先留著。`;
      return;
    }
    sendBtn.disabled = true;
    status.textContent = '傳送中……';
    try {
      await send(message);
      markSent();
      play('good');
      text.value = '';
      form.classList.add('hidden');
      done.classList.remove('hidden');
      $('wish-ok').focus();
    } catch {
      status.textContent = '這次沒有送成功，可以稍後再試。你寫的字還留著。';
      update();
    }
  };

  let unfit = () => {};
  if (!dialog.open) {
    dialog.showModal();
    play('open');
  }
  unfit = fitToKeyboard(dialog);
  dialog.onclose = () => {
    dialog.onclose = null;
    unfit();
  };
  return dialog;
}
