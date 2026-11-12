// 本機進度與設定。只存在玩家自己的瀏覽器（localStorage），不傳送到任何伺服器。
// 不儲存姓名、病史或心情紀錄；只有任務進度、卡片、練習與謎題紀錄、位置與操作設定。
const SAVE_KEY = 'xinzhijian.save';
const UNREADABLE_KEY = 'xinzhijian.save.unreadable'; // 讀不懂的舊進度先備份在這裡，不默默丟棄
const SETTINGS_KEY = 'xinzhijian.settings';
export const SAVE_VERSION = 2; // v2：《今天有點卡卡的》與謎題改版，v1 進度無法沿用

export const DEFAULT_SETTINGS = { sound: false, music: true, musicVolume: 0.5, reduceMotion: false, textSize: 'm', quality: 'high' };

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function newSave(puzzleIds) {
  return {
    version: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    step: 'arrive',
    cards: [], // 已持有的卡號，依取得順序
    used: [], // 已成功的用卡互動
    rewards: [], // 已發放的獎勵紀錄（卡號），避免重複發獎
    flags: {},
    practice: { thought: 0, present: 0 }, // 親手完成練習的次數
    puzzles: Object.fromEntries(puzzleIds.map((id) => [id, { place: {}, solved: false }])), // 謎題：已擺放的位置、是否解開
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
      this.hasSavedSettings = !!raw;
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
      if (data?.version === 1) {
        return { status: 'error', reason: '遊戲已經改版：故事、角色與謎題都換新了，舊版（v1）的進度沒辦法沿用。' };
      }
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
