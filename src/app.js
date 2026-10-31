// 遊戲入口：讀取 content/ 的內容、首頁、開始／繼續、3D 與文字模式切換、設定。
// 3D 無法使用或載入失敗時自動改用文字模式，不只顯示錯誤畫面。
import { Store } from './state.js';
import { Game } from './game.js';
import { createUI, $, esc } from './ui.js';
import { startTextMode } from './text-mode.js';

const FILES = {
  quest: 'quest', cards: 'cards', characters: 'characters', places: 'places', explore: 'explore-points',
  uses: 'card-uses', dialogues: 'dialogues', minigames: 'minigames',
};

const params = new URLSearchParams(location.search);
const testMode = params.has('test');

let content;
try {
  const entries = await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    const r = await fetch(`content/${file}.json`);
    if (!r.ok) throw new Error(`${file}.json 讀取失敗（${r.status}）`);
    return [key, await r.json()];
  }));
  content = Object.fromEntries(entries);
} catch (e) {
  $('home-message').innerHTML = `遊戲內容載入失敗：${esc(e.message)}。請確認是透過本機伺服器開啟（見 README）。「找支持」仍可使用。`;
  $('home-message').classList.remove('hidden');
  $('home-actions').classList.add('hidden');
  throw e;
}

const store = new Store();
const ui = createUI(content, store);
ui.applySettings();
const game = new Game(content, store, ui);
ui.attach(game);

let view = null;
let mode = null;
let pendingNotes = [];

function showHome(message) {
  view?.stop();
  view = null;
  mode = null;
  document.body.classList.add('home-open');
  document.body.dataset.mode = '';
  $('home').classList.remove('hidden');
  $('hud').classList.add('hidden');
  const has = !!store.data;
  $('home-continue').classList.toggle('hidden', !has);
  $('home-new').textContent = has ? '重新開始新遊戲' : '開始遊戲';
  $('home-message').classList.toggle('hidden', !message);
  if (message) $('home-message').innerHTML = message;
  (has ? $('home-continue') : $('home-new')).focus({ preventScroll: true });
}

async function enter(m) {
  view?.stop();
  view = null;
  mode = m;
  store.mutate((s) => { s.mode = m; });
  document.body.classList.remove('home-open');
  document.body.dataset.mode = m;
  $('home').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (m === '3d') {
    $('loading').classList.remove('hidden');
    try {
      const { start3D } = await import('./three/main.js');
      view = await start3D(game, ui, store);
    } catch (e) {
      console.warn('3D 無法使用，改用文字模式', e);
      $('loading').classList.add('hidden');
      ui.toast('3D 畫面無法載入，已切換成文字模式。進度不受影響。', { ms: 7000 });
      return enter('text');
    }
    $('loading').classList.add('hidden');
  } else {
    view = startTextMode(game, ui);
  }
  ui.renderGoal();
  for (const n of pendingNotes) ui.toast(esc(n), { ms: 7000 });
  pendingNotes = [];
  if (store.saveFailed) ui.toast('進度暫時無法保存，這次仍然可以繼續遊玩。', { ms: 7000 });
}

async function newGame(m) {
  if (store.hasSave() && store.data) {
    const ok = await ui.confirm('開始新遊戲會清除目前的進度，探索卡也會放到新的位置。確定嗎？', '開始新遊戲');
    if (!ok) return;
  }
  const forced = params.get('explore')?.split(',');
  game.newGame(forced);
  enter(m);
}

const settingsHandlers = {
  inGame: () => !!mode,
  mode: () => mode,
  setMode: (m) => enter(m),
  home: () => showHome(),
  restart: () => { game.newGame(); enter(mode ?? '3d'); },
  clear: () => { store.clear(); showHome('進度已清除。'); },
  onSettings: () => view?.applySettings?.(),
};

$('home-new').onclick = () => newGame('3d');
$('home-text').onclick = () => (store.data ? enter('text') : newGame('text'));
$('home-continue').onclick = () => enter(store.data.mode === 'text' ? 'text' : '3d');
for (const b of document.querySelectorAll('[data-open-settings]')) b.onclick = () => ui.openSettings(settingsHandlers);
$('cardbook-button').onclick = () => ui.openCardbook();

// 對話選項可以用數字鍵選擇
addEventListener('keydown', (e) => {
  if (!ui.dialogue.open || !/^Digit[1-9]$/.test(e.code)) return;
  ui.dialogue.choose(Number(e.code.slice(5)) - 1);
});

// ---- 讀取進度 ----
const loaded = store.load();
let homeMessage = '';
if (loaded.status === 'ok') {
  pendingNotes = game.repair();
} else if (loaded.status === 'error') {
  homeMessage = `之前的進度無法讀取：${esc(loaded.reason)}<br>可以選擇「開始遊戲」重新開始；舊資料會先備份在這個瀏覽器裡，不會直接刪除。`;
}
showHome(homeMessage);
$('loading').classList.add('hidden');

if (testMode) window.__xzj = { game, store, ui, enter, view: () => view };
