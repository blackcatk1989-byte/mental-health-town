// 兩個心理練習：「想法放大鏡」與「回到這座花園」。
// 練習的動作本身就是概念：親手把事實和猜測分開、親手把注意力從念頭帶回花園，完成後才取得卡片。
// 不倒數、不計分、不偵測情緒；隨時可以離開（不記錄，下次從頭開始）。只用點選，不需要拖曳。
import { $, esc, openPanel } from './ui.js';

const DRAFT = '<p class="fine draft">內容草案，尚未完成專業審閱。</p>';

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

export function openMinigame(id, data, settings, done) {
  const body = $('minigame-body');
  $('minigame-title').textContent = data.title;
  let completed = false;

  const summary = () => {
    body.innerHTML = `<h3>${esc(data.summaryTitle)}</h3>
      ${data.summary.map((p) => `<p>${esc(p)}</p>`).join('')}
      <p class="fine">概念參考：<a href="${esc(data.source.url)}" target="_blank" rel="noopener noreferrer">${esc(data.source.title)}</a></p>
      ${DRAFT}
      <div class="row-actions"><button type="button" class="btn primary" data-done>收下理解卡</button></div>`;
    body.querySelector('[data-done]').onclick = () => { completed = true; $('minigame').close(); };
    body.querySelector('[data-done]').focus();
  };

  const footer = (extra = '') => `<div class="mg-footer">${extra}</div>`;
  // 聆聽風鈴的那一段，背景音樂完全靜音（離開這一段就恢復）
  let listening = false;
  const listen = (on) => {
    if (listening === on) return;
    listening = on;
    document.dispatchEvent(new CustomEvent('listen-chime', { detail: on }));
  };

  // ---- 想法放大鏡：把便條上的句子分成「確定知道的事」「猜測」「感受」 ----
  const thought = () => {
    const placed = {}; // 句子 id → 盒子 id
    const picked = new Set();
    const boxOf = (id) => data.boxes.find((b) => b.id === id);

    const intro = () => {
      body.innerHTML = `<p class="fine">${esc(data.place)}・${esc(data.minutes)}・不倒數、不計分</p>
        <p>${esc(data.intro)}</p>
        <blockquote class="note-paper">${esc(data.note)}</blockquote>
        <div class="row-actions"><button type="button" class="btn primary" data-go>拿起放大鏡</button></div>`;
      body.querySelector('[data-go]').onclick = () => sort();
    };

    const sort = (msg) => {
      const left = data.fragments.filter((f) => !placed[f.id]);
      body.innerHTML = `<p>${esc(data.factRule)}點一句話下方的按鈕，把它放進適合的地方。</p>
        <ul class="bins">${data.boxes.map((b) => `<li><strong>${esc(b.icon)} ${esc(b.label)}</strong>：${esc(b.explain)}</li>`).join('')}</ul>
        ${msg ? `<div class="notice" role="status">${esc(msg)}</div>` : ''}
        <div class="sort-items">${left.map((f) => `<div class="sort-item"><p>「${esc(f.text)}」</p>
          <div class="bin-buttons">${data.boxes.map((b) => `<button type="button" class="btn small" data-frag="${f.id}" data-box="${b.id}">${esc(b.icon)} ${esc(b.label)}</button>`).join('')}</div></div>`).join('')}</div>
        <div class="boxes">${data.boxes.map((b) => `<div class="box"><strong>${esc(b.icon)} ${esc(b.label)}</strong>
          <ul>${data.fragments.filter((f) => placed[f.id] === b.id).map((f) => `<li>${esc(f.text)}</li>`).join('') || '<li class="fine">（還沒有）</li>'}</ul></div>`).join('')}</div>
        ${footer(`<button type="button" class="btn primary" data-next ${left.length ? 'disabled' : ''}>下一步</button>`)}`;
      for (const b of body.querySelectorAll('[data-frag]')) {
        b.onclick = () => {
          const f = data.fragments.find((x) => x.id === b.dataset.frag);
          if (f.type === b.dataset.box) {
            placed[f.id] = f.type;
            sort();
          } else {
            sort(data.wrongHints[f.type]); // 只給線索方向，不評價
          }
        };
      }
      body.querySelector('[data-next]').onclick = () => others();
    };

    const others = () => {
      body.innerHTML = `<p>${esc(data.alternativesIntro)}</p>
        <div class="options">${data.alternatives.map((a, i) => `<button type="button" class="option ${picked.has(i) ? 'on' : ''}" data-alt="${i}" aria-pressed="${picked.has(i)}">
          <strong>${esc(a.text)}</strong>${picked.has(i) ? `<small>${esc(a.note)}</small>` : ''}</button>`).join('')}</div>
        ${footer(`<button type="button" class="btn primary" data-next ${picked.size ? '' : 'disabled'}>整理好了</button>`)}`;
      for (const b of body.querySelectorAll('[data-alt]')) {
        b.onclick = () => {
          const i = Number(b.dataset.alt);
          if (picked.has(i)) picked.delete(i);
          else picked.add(i);
          others();
        };
      }
      body.querySelector('[data-next]').onclick = result;
    };

    const result = () => {
      const list = (type) => data.fragments.filter((f) => f.type === type).map((f) => `<li>${esc(f.text)}</li>`).join('');
      body.innerHTML = `<h3>${esc(data.resultTitle)}</h3>
        <div class="boxes">
          <div class="box"><strong>${esc(boxOf('fact').icon)} ${esc(boxOf('fact').label)}</strong><ul>${list('fact')}</ul></div>
          <div class="box"><strong>${esc(boxOf('guess').icon)} ${esc(boxOf('guess').label)}</strong><ul>${list('guess')}</ul></div>
          <div class="box"><strong>${esc(boxOf('feeling').icon)} ${esc(boxOf('feeling').label)}</strong><ul>${list('feeling')}</ul></div>
          <div class="box"><strong>還可能是</strong><ul>${[...picked].map((i) => `<li>${esc(data.alternatives[i].text)}</li>`).join('')}
            <li><strong>${esc(data.unknown)}</strong></li></ul></div>
        </div>
        ${footer('<button type="button" class="btn primary" data-next>完成</button>')}`;
      body.querySelector('[data-next]').onclick = summary;
    };
    intro();
  };

  // ---- 回到這座花園：留意花園 → 念頭冒出來 → 看見它，回到花園 ----
  const present = () => {
    const stop = '<button type="button" class="btn" data-stop>先停在這裡</button>';
    const bindStop = () => { body.querySelector('[data-stop]').onclick = () => $('minigame').close(); };
    const intro = () => {
      body.innerHTML = `<p class="fine">${esc(data.place)}・${esc(data.minutes)}・沒有強制等待時間</p>
        <p>${esc(data.intro)}</p>
        <p class="fine">中途停下來不會取得卡片，下次可以再來。</p>
        <div class="row-actions"><button type="button" class="btn primary" data-go>開始</button></div>`;
      body.querySelector('[data-go]').onclick = () => round(0);
    };
    const round = (i, chosen, stage = 'notice') => {
      const r = data.rounds[i];
      const opt = r.options[chosen];
      const sound = r.sense === '聽' ? `<p>${esc(settings.sound ? r.soundOn : r.soundOff)}</p>
        ${settings.sound ? '<div class="row-actions left"><button type="button" class="btn" data-play>播放風鈴聲</button></div>' : ''}` : '';
      let main = '';
      if (stage === 'notice') {
        main = `<div class="options row">${r.options.map((o, j) => `<button type="button" class="option" data-opt="${j}">${esc(o.label)}</button>`).join('')}</div>`;
      } else if (stage === 'thought') {
        main = `<p class="placed">你留意到${esc(opt.label)}：${esc(opt.detail)}。</p>
          <div class="thought-bubble" role="status"><span class="fine">${esc(data.thoughtIntro)}</span><p>「${esc(r.thought)}」</p></div>
          <div class="row-actions left"><button type="button" class="btn primary" data-return>${esc(data.returnLabel)}</button></div>`;
      } else {
        main = `<p class="placed">${esc(data.returned)}</p>`;
      }
      listen(r.sense === '聽');
      body.innerHTML = `<p class="fine">${i + 1}／${data.rounds.length}・${esc(r.sense)}</p>
        <p>${esc(r.prompt)}</p>${stage === 'notice' ? sound : ''}${main}
        ${footer(`${stop}${stage === 'returned' ? '<button type="button" class="btn primary" data-next>繼續</button>' : ''}`)}`;
      body.querySelector('[data-play]')?.addEventListener('click', playChime);
      for (const b of body.querySelectorAll('[data-opt]')) b.onclick = () => round(i, Number(b.dataset.opt), 'thought');
      const ret = body.querySelector('[data-return]');
      if (ret) { ret.onclick = () => round(i, chosen, 'returned'); ret.focus(); }
      const next = body.querySelector('[data-next]');
      if (next) next.onclick = () => (i + 1 < data.rounds.length ? round(i + 1) : offscreen());
      bindStop();
    };
    const offscreen = () => {
      listen(false);
      body.innerHTML = `<p>${esc(data.offscreen)}</p>
        ${footer(`${stop}<button type="button" class="btn primary" data-end>結束練習</button>`)}`;
      bindStop();
      body.querySelector('[data-end]').onclick = summary;
    };
    intro();
  };

  if (id === 'thought') thought();
  else present();
  openPanel('minigame', () => {
    listen(false);
    done(completed);
  });
}
