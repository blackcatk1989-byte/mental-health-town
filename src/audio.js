// 背景音樂：三區各一首（或共用同一首），換區時淡入淡出；進入「回到這座花園」時自動降低音量。
// 按下「開始遊戲」或「繼續」之後才播放。曲目與授權寫在 content/music.json，來源記錄在 docs/素材來源.md。
// 只使用 CC0 或授權明確允許免費使用的音樂；沒有設定曲目時，這個模組什麼都不做。

export function createMusic(config, settings) {
  const players = new Map(); // 檔案 → <audio>
  let current = null;
  let started = false;
  let ducked = false;
  let muted = false; // 聆聽風鈴時完全靜音
  let raf = 0;

  const trackFor = (area) => config.tracks?.[area] ?? config.default ?? null;

  function player(track) {
    if (!players.has(track.file)) {
      const a = new Audio(track.file);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      players.set(track.file, a);
    }
    return players.get(track.file);
  }

  const targetVolume = () => (settings.music && !muted ? settings.musicVolume * (ducked ? config.duck ?? 0.3 : 1) : 0);

  // 每一幀把音量往目標靠近；不是目前的曲目就淡出並暫停
  function step() {
    raf = 0;
    const speed = 1 / ((config.fade ?? 1.5) * 60);
    let moving = false;
    for (const a of players.values()) {
      const goal = a === current ? targetVolume() : 0;
      const v = a.volume + Math.sign(goal - a.volume) * Math.min(speed, Math.abs(goal - a.volume));
      a.volume = Math.min(1, Math.max(0, v));
      if (Math.abs(a.volume - goal) > 0.001) moving = true;
      if (a !== current && a.volume === 0 && !a.paused) a.pause();
    }
    if (moving) raf = requestAnimationFrame(step);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(step); };

  function play(area) {
    const track = trackFor(area);
    const next = track ? player(track) : null;
    if (next !== current) current = next;
    if (current && settings.music && current.paused) {
      current.play().catch(() => {
        // 瀏覽器擋自動播放：等玩家下一次點擊再試
        addEventListener('pointerdown', () => { if (started) play(area); }, { once: true });
      });
    }
    kick();
  }

  return {
    // 進入遊戲時呼叫（要在玩家點擊之後）
    start(area) {
      started = true;
      play(area);
    },
    stop() {
      started = false;
      current = null;
      kick();
    },
    setArea(area) {
      if (started) play(area);
    },
    duck(on) {
      ducked = on;
      kick();
    },
    mute(on) {
      muted = on;
      kick();
    },
    // 設定改變（開關、音量）
    refresh(area) {
      if (started) play(area);
      kick();
    },
    get playing() { return !!current && !current.paused; },
    get volume() { return current?.volume ?? 0; },
    get hasTracks() { return !!(config.default || Object.values(config.tracks ?? {}).some(Boolean)); },
  };
}
