// 「願望紀錄」頁（wishes.html）：製作者登入後，依時間列出許願池的留言，可以標記已讀、刪除單筆、匯出成 CSV。
// 用 Supabase 的 REST 介面（不加框架）：登入用 /auth/v1/token，讀取／標記／刪除用 /rest/v1/wishes。
// 權限由資料庫的規則把關（docs/supabase-wishes.sql）：沒登入的人讀不到、改不了、刪不掉任何留言。
// 登入狀態只存在這個分頁（sessionStorage），關掉分頁就登出。
import { WISH_CONFIG } from './wish-config.js';

const $ = (id) => document.getElementById(id);
const SESSION_KEY = 'xinzhijian.wishes.session';
const FAKE_KEY = 'xinzhijian.wish.fake';
const configured = !!(WISH_CONFIG.url && WISH_CONFIG.publicKey);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.hostname.endsWith('.localhost');
const fake = !configured && local; // 本機、還沒設定 Supabase：用假資料預覽版面

let session = null;
let wishes = [];
let filter = 'all';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmt = (iso) => new Date(iso).toLocaleString('zh-TW', { hour12: false });

function loadSession() {
  try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }
}
function saveSession() {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* 存不了就每次重新登入 */ }
}

// ---- 和 Supabase 溝通 ----
async function api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const res = await fetch(`${WISH_CONFIG.url}${path}`, {
    method,
    headers: {
      apikey: WISH_CONFIG.publicKey,
      ...(auth && session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit',
  });
  if (res.status === 401) {
    // 登入過期：試著換一張新的通行證，不行就回到登入畫面
    if (auth && session?.refresh_token && !path.startsWith('/auth/')) {
      const ok = await refresh();
      if (ok) return api(path, { method, body, auth, headers });
    }
    session = null;
    saveSession();
    show();
    throw new Error('需要重新登入');
  }
  if (!res.ok) throw new Error(`伺服器回應 ${res.status}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function refresh() {
  try {
    const r = await fetch(`${WISH_CONFIG.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: WISH_CONFIG.publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!r.ok) return false;
    session = await r.json();
    saveSession();
    return true;
  } catch { return false; }
}

const store = fake ? {
  // 假資料：本機遊戲的假收件端寫在這個瀏覽器的 localStorage
  async login() { session = { user: { email: '本機測試' } }; saveSession(); },
  async list() { try { return JSON.parse(localStorage.getItem(FAKE_KEY) || '[]').sort((a, b) => b.created_at.localeCompare(a.created_at)); } catch { return []; } },
  async markRead(id) { const all = await this.list(); for (const w of all) if (w.id === id) w.is_read = true; localStorage.setItem(FAKE_KEY, JSON.stringify(all)); },
  async remove(id) { const all = (await this.list()).filter((w) => w.id !== id); localStorage.setItem(FAKE_KEY, JSON.stringify(all)); },
  async logout() { session = null; saveSession(); },
} : {
  async login(email, password) {
    const r = await fetch(`${WISH_CONFIG.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: WISH_CONFIG.publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error('帳號或密碼不對');
    session = await r.json();
    saveSession();
  },
  list: () => api(`/rest/v1/${WISH_CONFIG.table}?select=id,message,created_at,is_read&order=created_at.desc`),
  markRead: (id) => api(`/rest/v1/${WISH_CONFIG.table}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { is_read: true }, headers: { Prefer: 'return=minimal' } }),
  remove: (id) => api(`/rest/v1/${WISH_CONFIG.table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
  async logout() {
    try { await api('/auth/v1/logout', { method: 'POST' }); } catch { /* 已經過期也沒關係 */ }
    session = null;
    saveSession();
  },
};

// ---- 畫面 ----
function show() {
  const noBackend = !configured && !local;
  $('mode-note').classList.toggle('hidden', configured);
  if (fake) $('mode-note').textContent = '本機測試：還沒設定 Supabase，這裡顯示的是這個瀏覽器裡的假資料，帳號密碼隨便填都能登入。';
  if (noBackend) $('mode-note').textContent = '還沒有設定留言資料庫，目前沒有任何留言。';
  $('login').classList.toggle('hidden', !!session || noBackend);
  $('board').classList.toggle('hidden', !session);
  if (session) {
    $('who').textContent = `已登入：${session.user?.email ?? ''}`;
    load();
  }
}

async function load() {
  $('board-status').textContent = '讀取中……';
  try {
    wishes = (await store.list()) ?? [];
    $('board-status').textContent = '';
    render();
  } catch (e) {
    $('board-status').textContent = `讀不到留言：${e.message}`;
  }
}

function render() {
  const list = filter === 'unread' ? wishes.filter((w) => !w.is_read) : wishes;
  $('count').textContent = `共 ${wishes.length} 則，未讀 ${wishes.filter((w) => !w.is_read).length} 則`;
  $('wishes').innerHTML = list.length ? list.map((w) => `<li class="wish ${w.is_read ? '' : 'unread'}" data-id="${esc(w.id)}">
      <div class="meta"><time datetime="${esc(w.created_at)}">${esc(fmt(w.created_at))}</time>
        ${w.is_read ? '<span class="tag">已讀</span>' : '<span class="tag unread-tag">未讀</span>'}</div>
      <p class="msg">${esc(w.message)}</p>
      <div class="row">${w.is_read ? '' : '<button type="button" data-read>標記已讀</button>'}<button type="button" data-del>刪除</button></div>
    </li>`).join('') : '<li class="fine">目前沒有留言。</li>';
  for (const li of $('wishes').querySelectorAll('.wish')) {
    const id = li.dataset.id;
    li.querySelector('[data-read]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { await store.markRead(id); const w = wishes.find((x) => String(x.id) === id); if (w) w.is_read = true; render(); } catch (err) { $('board-status').textContent = `沒有標記成功：${err.message}`; e.target.disabled = false; }
    });
    li.querySelector('[data-del]').addEventListener('click', async (e) => {
      if (!window.confirm('確定要刪除這則留言嗎？刪除後無法復原。')) return;
      e.target.disabled = true;
      try { await store.remove(id); wishes = wishes.filter((x) => String(x.id) !== id); render(); } catch (err) { $('board-status').textContent = `沒有刪除成功：${err.message}`; e.target.disabled = false; }
    });
  }
}

// 匯出：CSV（開頭加 BOM，Excel 打開中文不會變亂碼）
function exportCsv() {
  const cell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['送出時間', '留言', '已讀'], ...wishes.map((w) => [fmt(w.created_at), w.message, w.is_read ? '是' : '否'])];
  const blob = new Blob(['﻿', rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `願望紀錄-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-status').textContent = '登入中……';
  try {
    await store.login($('email').value.trim(), $('password').value);
    $('password').value = '';
    $('login-status').textContent = '';
    show();
  } catch (err) {
    $('login-status').textContent = `沒有登入成功：${err.message}`;
  }
});
$('logout').addEventListener('click', async () => { await store.logout(); wishes = []; show(); });
$('reload').addEventListener('click', load);
$('export').addEventListener('click', exportCsv);
for (const b of document.querySelectorAll('[data-filter]')) {
  b.addEventListener('click', () => {
    filter = b.dataset.filter;
    for (const x of document.querySelectorAll('[data-filter]')) x.setAttribute('aria-pressed', String(x === b));
    render();
  });
}

loadSession();
show();
