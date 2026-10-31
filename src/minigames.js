// 兩個心理練習：「想法放大鏡」與「回到這座花園」。
// 不倒數、不計分、不偵測情緒；隨時可以離開（不記錄）或改看摘要。只用點選，不需要拖曳。
import { $, esc, openPanel } from './ui.js';

let audio = null;
// 用 Web Audio 合成的木頭風鈴聲（自製，不使用外部音檔）；只在玩家開啟音效並按下按鈕時播放
function playChime() {
  try {
    audio ??= new AudioContext();
    const now = audio.currentTime;
    [660, 880, 990, 1320].forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = now + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 1.7);
    });
  } catch { /* 不支援音效時，文字描述仍可完成練習 */ }
}

export function openMinigame(id, mode, data, settings, done) {
  const body = $('minigame-body');
  $('minigame-title').textContent = data.title;
  let result = null;
  const finish = (r) => { result = r; $('minigame').close(); };

  const summary = (status) => {
    body.innerHTML = `<h3>${esc(data.summaryTitle)}</h3>
      ${data.summary.map((p) => `<p>${esc(p)}</p>`).join('')}
      <p class="fine">概念參考：<a href="${esc(data.source.url)}" target="_blank" rel="noopener noreferrer">${esc(data.source.title)}</a>。
      內容為衛教草案，尚未完成心理專業審閱。</p>
      <div class="row-actions"><button type="button" class="btn primary" data-done>收下理解卡</button></div>`;
    body.querySelector('[data-done]').onclick = () => finish(status);
    body.querySelector('[data-done]').focus();
  };

  const footer = (extra = '') => `<div class="mg-footer">${extra}</div>`;

  // ---- 想法放大鏡 ----
  const thought = () => {
    const sorted = {};
    const intro = () => {
      body.innerHTML = `<p class="fine">${esc(data.place)}・${esc(data.minutes)}・不倒數、不計分</p>
        <p>${esc(data.intro)}</p>
        <blockquote class="note-paper">${esc(data.situation)}</blockquote>
        <div class="row-actions"><button type="button" class="btn" data-sum>改看摘要</button>
        <button type="button" class="btn primary" data-go>開始</button></div>`;
      body.querySelector('[data-sum]').onclick = () => summary('summary');
      body.querySelector('[data-go]').onclick = sort;
    };
    const sort = (msg) => {
      const all = data.items.every((it, i) => sorted[i]);
      body.innerHTML = `<p>把三張卡片分別放進「發生的事」「腦中的解讀」「感受」。點選卡片下方的按鈕即可。</p>
        <ul class="bins">${data.bins.map((b) => `<li><strong>${esc(b.label)}</strong>：${esc(b.explain)}</li>`).join('')}</ul>
        ${typeof msg === 'string' ? `<div class="notice">${esc(msg)}</div>` : ''}
        <div class="sort-items">${data.items.map((it, i) => `<div class="sort-item ${sorted[i] ? 'done' : ''}">
          <p>「${esc(it.text)}」</p>
          ${sorted[i]
    ? `<p class="placed">放進「${esc(data.bins.find((b) => b.id === it.bin).label)}」：${esc(it.why)}</p>`
    : `<div class="bin-buttons">${data.bins.map((b) => `<button type="button" class="btn small" data-item="${i}" data-bin="${b.id}">${esc(b.label)}</button>`).join('')}</div>`}
        </div>`).join('')}</div>
        ${footer(`<button type="button" class="btn" data-sum>改看摘要</button>
          <button type="button" class="btn primary" data-next ${all ? '' : 'disabled'}>下一步</button>`)}`;
      for (const b of body.querySelectorAll('[data-item]')) {
        b.onclick = () => {
          const i = Number(b.dataset.item);
          if (data.items[i].bin === b.dataset.bin) {
            sorted[i] = true;
            sort();
          } else {
            sort(data.wrongHint);
          }
        };
      }
      body.querySelector('[data-sum]').onclick = () => summary('summary');
      body.querySelector('[data-next]').onclick = alternatives;
    };
    const seen = new Set();
    const alternatives = () => {
      body.innerHTML = `<p>${esc(data.alternativesIntro)}</p>
        <div class="options">${data.alternatives.map((a, i) => `<button type="button" class="option ${seen.has(i) ? 'on' : ''}" data-alt="${i}" aria-pressed="${seen.has(i)}">
          <strong>${esc(a.text)}</strong>${seen.has(i) ? `<small>${esc(a.note)}</small>` : ''}</button>`).join('')}</div>
        ${footer('<button type="button" class="btn primary" data-next>下一步</button>')}`;
      for (const b of body.querySelectorAll('[data-alt]')) b.onclick = () => { seen.add(Number(b.dataset.alt)); alternatives(); };
      body.querySelector('[data-next]').onclick = () => steps();
    };
    const steps = (chosen) => {
      body.innerHTML = `<p>${esc(data.stepsIntro)}</p>
        <div class="options">${data.steps.map((s, i) => `<button type="button" class="option ${chosen === i ? 'on' : ''}" data-step="${i}" aria-pressed="${chosen === i}">
          <strong>${esc(s.text)}</strong>${chosen === i ? `<small>${esc(s.note)}</small>` : ''}</button>`).join('')}</div>
        ${footer(`<button type="button" class="btn primary" data-next ${chosen === undefined ? 'disabled' : ''}>看摘要</button>`)}`;
      for (const b of body.querySelectorAll('[data-step]')) b.onclick = () => steps(Number(b.dataset.step));
      body.querySelector('[data-next]').onclick = () => summary('completed');
    };
    intro();
  };

  // ---- 回到這座花園 ----
  const present = () => {
    const stop = () => `<button type="button" class="btn" data-stop>先停在這裡</button>`;
    const bindStop = () => { body.querySelector('[data-stop]').onclick = () => summary('completed'); };
    const intro = () => {
      body.innerHTML = `<p class="fine">${esc(data.place)}・${esc(data.minutes)}・沒有強制等待時間</p>
        <p>${esc(data.intro)}</p>
        <div class="row-actions"><button type="button" class="btn" data-sum>改看摘要</button>
        <button type="button" class="btn primary" data-go>開始</button></div>`;
      body.querySelector('[data-sum]').onclick = () => summary('summary');
      body.querySelector('[data-go]').onclick = () => objects();
    };
    const objects = (obj, detail) => {
      const o = data.objects.find((x) => x.id === obj);
      body.innerHTML = `<p>${esc(data.objectsIntro)}</p>
        <div class="options row">${data.objects.map((x) => `<button type="button" class="option ${obj === x.id ? 'on' : ''}" data-obj="${x.id}" aria-pressed="${obj === x.id}">${esc(x.label)}</button>`).join('')}</div>
        ${o ? `<p>你注意到它的什麼？${esc(data.objectsNote)}</p>
          <div class="options row">${o.details.map((d, i) => `<button type="button" class="option ${detail === i ? 'on' : ''}" data-detail="${i}" aria-pressed="${detail === i}">${esc(d)}</button>`).join('')}</div>` : ''}
        ${detail !== undefined ? `<p class="placed">你留意了${esc(o.label)}：${esc(o.details[detail])}。</p>` : ''}
        ${footer(`${stop()}<button type="button" class="btn primary" data-next ${detail === undefined ? 'disabled' : ''}>下一步</button>`)}`;
      for (const b of body.querySelectorAll('[data-obj]')) b.onclick = () => objects(b.dataset.obj);
      for (const b of body.querySelectorAll('[data-detail]')) b.onclick = () => objects(obj, Number(b.dataset.detail));
      bindStop();
      body.querySelector('[data-next]').onclick = () => sound();
    };
    const sound = (chosen) => {
      body.innerHTML = `<p>${esc(settings.sound ? data.soundOn : data.soundOff)}</p>
        ${settings.sound ? '<div class="row-actions left"><button type="button" class="btn" data-play>播放風鈴聲</button></div>' : ''}
        <div class="options row">${data.soundChoices.map((c, i) => `<button type="button" class="option ${chosen === i ? 'on' : ''}" data-snd="${i}" aria-pressed="${chosen === i}">${esc(c)}</button>`).join('')}</div>
        ${footer(`${stop()}<button type="button" class="btn primary" data-next ${chosen === undefined ? 'disabled' : ''}>下一步</button>`)}`;
      body.querySelector('[data-play]')?.addEventListener('click', playChime);
      for (const b of body.querySelectorAll('[data-snd]')) b.onclick = () => sound(Number(b.dataset.snd));
      bindStop();
      body.querySelector('[data-next]').onclick = offscreen;
    };
    const offscreen = () => {
      body.innerHTML = `<p>${esc(data.offscreen)}</p>
        ${footer(`${stop()}<button type="button" class="btn primary" data-end>結束練習</button>`)}`;
      bindStop();
      body.querySelector('[data-end]').onclick = () => summary('completed');
    };
    intro();
  };

  if (mode === 'summary') summary('summary');
  else if (id === 'thought') thought();
  else present();
  openPanel('minigame', () => done(result));
}
