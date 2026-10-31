// 本機進度與設定。只存在玩家自己的瀏覽器（localStorage），不傳送到任何伺服器。
// 不儲存姓名、病史或心情紀錄；只有任務進度、卡片、探索點位、佈置選擇、位置與操作設定。
const SAVE_KEY = 'xinzhijian.save';
const UNREADABLE_KEY = 'xinzhijian.save.unreadable'; // 讀不懂的舊進度先備份在這裡，不默默丟棄
const SETTINGS_KEY = 'xinzhijian.settings';
export const SAVE_VERSION = 1;

export const DEFAULT_SETTINGS = { sound: false, reduceMotion: false, textSize: 'm', quality: 'high' };

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function randomInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

// 從候選點抽出不重複的點，分給每一張探索卡
export function rollExplore(cards, points, forced) {
  if (forced?.length === cards.length && new Set(forced).size === forced.length
    && forced.every((id) => points.some((p) => p.id === id))) {
    return Object.fromEntries(cards.map((c, i) => [c, forced[i]]));
  }
  const pool = points.map((p) => p.id);
  const out = {};
  for (const c of cards) out[c] = pool.splice(randomInt(pool.length), 1)[0];
  return out;
}

export function newSave(explore) {
  return {
    version: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    step: 'arrive',
    cards: [], // 已持有的卡號，依取得順序
    used: [], // 已成功的用卡互動
    rewards: [], // 已發放的獎勵紀錄（卡號），避免重複發獎
    flags: {},
    practice: { thought: { completed: 0, summary: 0 }, present: { completed: 0, summary: 0 } },
    explore, // 探索卡 → 點位
    picked: [], // 已拾取的點位
    arrangement: null, // { spot, sign, quiet }
    area: 'plaza',
    player: null, // { x, z }
    mode: '3d',
  };
}

export class Store {
  constructor() {
    this.data = null;
    this.saveFailed = false;
    this.settings = { ...DEFAULT_SETTINGS };
    try {
      const raw = storage()?.getItem(SETTINGS_KEY);
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch { /* 設定讀不到就用預設值 */ }
  }

  // 回傳 { status: 'none' | 'ok' | 'error', reason }
  load() {
    let raw;
    try {
      raw = storage()?.getItem(SAVE_KEY);
    } catch (e) {
      return { status: 'error', reason: '瀏覽器不允許讀取本機資料。' };
    }
    if (!raw) return { status: 'none' };
    try {
      const data = JSON.parse(raw);
      if (data?.version !== SAVE_VERSION) {
        return { status: 'error', reason: `進度的版本（${data?.version ?? '不明'}）和目前的遊戲版本不同。` };
      }
      this.data = data;
      return { status: 'ok' };
    } catch {
      return { status: 'error', reason: '進度資料損毀，無法讀取。' };
    }
  }

  hasSave() {
    try {
      return !!storage()?.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  start(data) {
    // 讀不懂的舊進度先備份，再建立新進度
    try {
      const old = storage()?.getItem(SAVE_KEY);
      if (old && !this.data) storage().setItem(UNREADABLE_KEY, old);
    } catch { /* 備份失敗不影響開新局 */ }
    this.data = data;
    return this.save();
  }

  // 所有進度修改都經過這裡，改完一次儲存，避免拿到卡卻沒更新任務（或相反）
  mutate(fn) {
    const result = fn(this.data);
    this.save();
    return result;
  }

  save() {
    try {
      storage().setItem(SAVE_KEY, JSON.stringify(this.data));
      this.saveFailed = false;
      return true;
    } catch {
      this.saveFailed = true;
      return false;
    }
  }

  clear() {
    try {
      storage()?.removeItem(SAVE_KEY);
      storage()?.removeItem(UNREADABLE_KEY);
    } catch { /* 無法清除時也讓遊戲繼續 */ }
    this.data = null;
  }

  saveSettings() {
    try {
      storage().setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* 設定存不了，這次遊玩仍然有效 */ }
  }
}
