// 背景音樂：三區各一首（或共用同一首），換區時淡入淡出；進入「回到這座花園」時自動降低音量，聆聽風鈴時完全靜音。
// 按下「開始遊戲」或「繼續」之後才播放。曲目與授權寫在 content/music.json，來源記錄在 docs/素材來源.md。
// 只使用 CC0 或授權明確允許免費使用的音樂；沒有設定曲目時，這個模組什麼都不做。
//
// 音量用 Web Audio 的 GainNode 控制：iPhone、iPad 的 Safari 不允許程式改 <audio> 的 volume（永遠是 1），
// 只靠 volume 淡出會讓舊曲子停不下來而和新曲子重疊。淡出結束後一定把舊曲子暫停，同一時間最多只有一首在播。

export function createMusic(config, settings) {
  const players = new Map(); // 檔案 → { el, gain, stopTimer }
  let ctx = null;
  let current = null;
  let started = false;
  let ducked = false;
  let muted = false; // 聆聽風鈴時完全靜音
  let wantArea = null; // 最新的區域：瀏覽器擋自動播放、等下一次點擊重試時用這個
  let retryArmed = false;

  const fade = () => config.fade ?? 1.5;
  const trackFor = (area) => config.tracks?.[area] ?? config.default ?? null;
  const targetVolume = () => (settings.music && !muted ? settings.musicVolume * (ducked ? config.duck ?? 0.3 : 1) : 0);

  function audioCtx() {
    try {
      ctx ??= new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
    } catch {
      ctx = null; // 不支援 Web Audio：退回用 <audio> 的 volume
    }
    return ctx;
  }

  function player(track) {
    if (!players.has(track.file)) {
      const el = new Audio(track.file);
      el.loop = true;
      el.preload = 'auto';
      const p = { el, gain: null, stopTimer: 0 };
      const a = audioCtx();
      if (a) {
        p.gain = a.createGain();
        p.gain.gain.value = 0;
        a.createMediaElementSource(el).connect(p.gain).connect(a.destination);
      } else {
        el.volume = 0;
      }
      players.set(track.file, p);
    }
    return players.get(track.file);
  }

  // 把一首曲子的音量在 seconds 秒內移到 value
  function rampTo(p, value, seconds) {
    if (p.gain) {
      const now = ctx.currentTime;
      p.gain.gain.cancelScheduledValues(now);
      p.gain.gain.setValueAtTime(p.gain.gain.value, now);
      p.gain.gain.linearRampToValueAtTime(value, now + Math.max(0.01, seconds));
    } else {
      p.el.volume = Math.min(1, Math.max(0, value));
    }
  }

  // 依目前狀態更新所有曲子：目前的曲子到目標音量，其他的淡出後暫停
  function apply(seconds = fade()) {
    for (const p of players.values()) {
      clearTimeout(p.stopTimer);
      if (p === current) {
        rampTo(p, targetVolume(), seconds);
      } else {
        rampTo(p, 0, seconds);
        p.stopTimer = setTimeout(() => { if (p !== current) p.el.pause(); }, seconds * 1000 + 100);
      }
    }
  }

  function play(area) {
    wantArea = area;
    const track = trackFor(area);
    current = track ? player(track) : null;
    if (current && settings.music && current.el.paused) {
      audioCtx();
      current.el.play().catch(() => {
        // 瀏覽器擋自動播放：等玩家下一次點擊，用最新的區域重試（不會叫回舊曲子）
        if (retryArmed) return;
        retryArmed = true;
        addEventListener('pointerdown', () => { retryArmed = false; if (started) play(wantArea); }, { once: true });
      });
    }
    apply();
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
      apply(0.4);
    },
    setArea(area) {
      if (started) play(area);
    },
    duck(on) {
      ducked = on;
      apply(0.6);
    },
    mute(on) {
      muted = on;
      apply(0.4);
    },
    // 設定改變（開關、音量）
    refresh(area) {
      if (started) play(area ?? wantArea);
      else apply(0.2);
    },
    get playing() { return !!current && !current.el.paused; },
    // 目前曲子的音量（0～1）；測試用來確認淡入、降低音量與靜音
    get volume() { return current ? (current.gain ? current.gain.gain.value : current.el.volume) : 0; },
    // 正在播放（沒暫停）的曲子數量；換區淡出結束後應該只剩一首
    get audible() { return [...players.values()].filter((p) => !p.el.paused).length; },
    get hasTracks() { return !!(config.default || Object.values(config.tracks ?? {}).some(Boolean)); },
  };
}
