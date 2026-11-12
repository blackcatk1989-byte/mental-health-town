// 音效：全部用 Web Audio 即時合成（自製，不使用外部音檔），記錄在 docs/素材來源.md。
// 遵守設定裡的「音效」開關；聲音都很輕、很短，不用刺耳的錯誤音，也不代表對錯的評價。
let ctx = null;
let settings = { sound: true };

export function setupSfx(s) {
  settings = s;
}

function audio() {
  if (!settings.sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// 一個音：頻率、長度、音量、波形、起音延遲
function tone(a, freq, { dur = 0.25, vol = 0.06, type = 'sine', at = 0, slide = 0 } = {}) {
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// 一小段過濾過的雜訊（腳步、紙張）
function noise(a, { dur = 0.06, vol = 0.05, freq = 900, q = 0.8, at = 0 } = {}) {
  const t = a.currentTime + at;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const SOUNDS = {
  step: (a) => noise(a, { dur: 0.05, vol: 0.035, freq: 500 + Math.random() * 300 }),
  click: (a) => tone(a, 880, { dur: 0.06, vol: 0.03, type: 'triangle' }),
  open: (a) => { tone(a, 523, { dur: 0.12, vol: 0.025 }); tone(a, 784, { dur: 0.16, vol: 0.02, at: 0.05 }); },
  close: (a) => { tone(a, 659, { dur: 0.1, vol: 0.02 }); tone(a, 494, { dur: 0.12, vol: 0.02, at: 0.04 }); },
  near: (a) => tone(a, 1318, { dur: 0.12, vol: 0.012 }),
  type: (a) => tone(a, 1500 + Math.random() * 200, { dur: 0.02, vol: 0.006, type: 'square' }),
  pickup: (a) => tone(a, 440, { dur: 0.1, vol: 0.03, type: 'triangle', slide: 1.5 }),
  drop: (a) => noise(a, { dur: 0.08, vol: 0.05, freq: 300, q: 1.5 }),
  // 不合適：軟軟的、往下的兩個音（不是錯誤音）
  hmm: (a) => { tone(a, 392, { dur: 0.22, vol: 0.03, type: 'triangle' }); tone(a, 330, { dur: 0.3, vol: 0.03, type: 'triangle', at: 0.14 }); },
  slide: (a) => noise(a, { dur: 0.25, vol: 0.03, freq: 1200, q: 0.5 }),
  // 合適：植物舒展、桌上的小變化
  good: (a) => [523, 659, 784].forEach((f, i) => tone(a, f, { dur: 0.5, vol: 0.035, at: i * 0.08 })),
  card: (a) => [784, 988, 1175, 1568].forEach((f, i) => tone(a, f, { dur: 0.6, vol: 0.03, at: i * 0.07 })),
  flip: (a) => noise(a, { dur: 0.12, vol: 0.03, freq: 2400, q: 0.6 }),
  quest: (a) => { tone(a, 659, { dur: 0.25, vol: 0.03 }); tone(a, 988, { dur: 0.4, vol: 0.03, at: 0.1 }); },
  wonder: (a) => tone(a, 523, { dur: 0.3, vol: 0.025, type: 'triangle', slide: 1.25 }),
  happy: (a) => { tone(a, 784, { dur: 0.15, vol: 0.025 }); tone(a, 1047, { dur: 0.25, vol: 0.025, at: 0.08 }); },
};

export function play(name) {
  const a = audio();
  if (a && SOUNDS[name]) SOUNDS[name](a);
  document.dispatchEvent(new CustomEvent('sfx', { detail: { name, audible: !!a } })); // 測試用：記錄播放了哪些音效
}
