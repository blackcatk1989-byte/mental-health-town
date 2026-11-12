// 里內的兩個謎題（E01 三盆植物、E02 還沒收的三張桌子），直接拿起東西放到場地上，不用文字選單。
// 操作：電腦可拖曳，也可「點東西 → 點位置」；手機只用點選。鍵盤：Tab 選到東西按 Enter，再選位置按 Enter。
// 回饋：植物放下約 2 秒後做出反應（合適就舒展、冒新葉或開花；不合適就垂下、轉向光或葉緣捲起），麻糬歪頭看；
// 桌子放錯時東西滑回托盤、那桌的東西輕輕晃、嘆氣泡泡浮出主題圖示；放對時桌上出現小變化。
// 不計時、不扣分、不出現對錯字樣；「減少動畫」時改成靜態的前後變化加一行描述。文字模式用描述代替插畫。
import { $, esc, openPanel } from './ui.js';
import { play } from './sfx.js';
import { PLANT_STAGE, TABLE_STAGE, plantStageSvg, tableStageSvg, potSvg, itemSvg } from './puzzle-art.js';

const DRAFT = '<p class="fine draft">內容草案，尚未完成專業審閱。</p>';
const SOIL = { rosemary: 'dry', mint: 'dry', fern: 'wet' };
const REACT_DELAY = 2000; // 放下後多久做出反應（毫秒）

const reduceMotion = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

export function openPuzzle(game, id) {
  const p = game.c.puzzles.puzzles[id];
  const body = $('puzzle-body');
  $('puzzle-title').textContent = p.title;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const solvedView = () => {
    body.innerHTML = `<div class="solved">
      <h3 class="hand">${esc(p.solvedTitle)}</h3>
      ${p.solved.map((t) => `<p>${esc(t)}</p>`).join('')}
      <p>你取得了理解卡「<span class="hand">${esc(game.card(p.card).title)}</span>」。</p>
      ${DRAFT}
      <div class="row-actions"><button type="button" class="btn primary" data-close>關閉</button></div></div>`;
    body.querySelector('[data-close]').onclick = () => $('puzzle').close();
  };

  if (game.s.puzzles[id].solved) solvedView();
  else if (document.body.dataset.mode === 'text') textView();
  else stageView();
  openPanel('puzzle', () => timers.forEach(clearTimeout));

  // ---- 插畫版：拖曳或點選 ----
  function stageView() {
    const plants = p.kind === 'plants';
    const S = plants ? PLANT_STAGE : TABLE_STAGE;
    const slotPos = (slot) => (plants ? S.spots[slot] : S.tables[slot]);
    body.innerHTML = `<p class="fine">${esc(p.minutes)}・不計時，可以一直重新擺</p>
      <p>${esc(p.intro)}</p>
      <div class="stage-wrap ${plants ? 'plants' : 'tables'}">${plants ? plantStageSvg() : tableStageSvg(p.tables)}</div>
      <p class="caption" role="status" aria-live="polite">${plants ? '點一下花盆看看它的樣子，再點地上的位置放下去。電腦也可以直接拖曳。' : '點一下托盤上的東西，再點它原本的桌子。電腦也可以直接拖曳。'}</p>
      <div class="mg-footer"><button type="button" class="btn" data-later>先離開，等等再來</button></div>`;
    body.querySelector('[data-later]').onclick = () => $('puzzle').close();
    const svg = body.querySelector('svg.stage');
    const layer = svg.querySelector('.pots');
    const caption = body.querySelector('.caption');
    const cat = svg.querySelector('.cat');
    let selected = null;

    // 每一項東西
    const nodes = new Map();
    for (const it of p.items) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'pot');
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.dataset.item = it.id;
      g.setAttribute('aria-label', `${it.label}：${plants ? it.looks.join('') : it.look}`);
      // 透明的點擊區比圖案大一點，手機上比較好點
      g.innerHTML = (plants ? potSvg(it.id, { soil: SOIL[it.id] }) : itemSvg(it.id))
        + (plants ? '<rect class="pot-hit" x="-26" y="-84" width="52" height="88" fill="transparent"/>' : '<rect class="pot-hit" x="-22" y="-18" width="44" height="36" fill="transparent"/>');
      layer.append(g);
      nodes.set(it.id, g);
    }
    // 場地上的位置也可以用鍵盤選
    for (const z of svg.querySelectorAll('.zone')) {
      z.setAttribute('tabindex', '0');
      z.setAttribute('role', 'button');
      const info = (plants ? p.spots : p.tables).find((x) => x.id === z.dataset.slot);
      z.setAttribute('aria-label', info.look);
    }

    const posOf = (itemId) => {
      const slot = game.s.puzzles[id].place[itemId];
      if (!slot) return S.tray[itemId];
      const s = slotPos(slot);
      return plants ? { x: s.x, y: s.y + 18 } : { x: s.x - 6, y: s.y + 28 };
    };
    const moveTo = (g, { x, y }, instant) => {
      g.style.transition = instant || reduceMotion() ? 'none' : '';
      g.style.transform = `translate(${x}px, ${y}px)`; // 用 CSS transform 才能有滑動的過場
    };
    // 植物目前的狀態（已放下的會保留反應）
    const showState = (itemId) => {
      const g = nodes.get(itemId);
      const slot = game.s.puzzles[id].place[itemId];
      const plant = g.querySelector('.plant');
      if (plant) plant.setAttribute('class', `plant plant-${itemId}${slot ? ` r-${p.items.find((x) => x.id === itemId).reactions[slot].anim}` : ''}`);
      g.classList.toggle('placed', !!slot);
      if (!plants && slot) svg.querySelector(`.zone[data-slot="${slot}"] .table-win`).setAttribute('opacity', '1');
    };
    for (const it of p.items) {
      moveTo(nodes.get(it.id), posOf(it.id), true);
      showState(it.id);
    }

    const select = (itemId) => {
      selected = itemId;
      for (const [k, g] of nodes) g.classList.toggle('selected', k === itemId);
      const it = p.items.find((x) => x.id === itemId);
      if (itemId) {
        play('pickup');
        caption.textContent = plants ? `${it.label}：${it.looks.join('')}` : `${it.label}：${it.look}`;
      }
    };

    // 放下
    const drop = (itemId, slot) => {
      const g = nodes.get(itemId);
      const it = p.items.find((x) => x.id === itemId);
      select(null);
      if (slot && game.s.puzzles[id].place[itemId] === slot) { moveTo(g, posOf(itemId)); return; }
      if (plants) {
        // 先讓位置上原本的那盆回到托盤
        const r = game.placePuzzle(id, itemId, slot || null);
        for (const other of p.items) { moveTo(nodes.get(other.id), posOf(other.id)); showState(other.id); }
        const plant = g.querySelector('.plant');
        plant.setAttribute('class', `plant plant-${itemId}`); // 先回到原本的樣子，等一下再反應
        play('drop');
        if (!slot || !r) { caption.textContent = `${it.label}回到托盤上。`; return; }
        caption.textContent = '……';
        later(() => {
          showState(itemId);
          caption.textContent = r.reaction.text;
          if (r.fit) play('good');
          else {
            play('hmm');
            cat.classList.remove('tilt');
            void cat.getBBox();
            cat.classList.add('tilt');
            caption.textContent += ` ${p.catLook}`;
          }
          if (r.solved) later(solvedView, reduceMotion() ? 600 : 2200);
        }, reduceMotion() ? 0 : REACT_DELAY);
      } else {
        if (!slot) { moveTo(g, posOf(itemId)); return; }
        const r = game.placePuzzle(id, itemId, slot);
        const zone = svg.querySelector(`.zone[data-slot="${slot}"]`);
        if (r?.fit) {
          moveTo(g, posOf(itemId));
          showState(itemId);
          play('good');
          caption.textContent = it.win;
          if (r.solved) later(solvedView, reduceMotion() ? 600 : 2200);
        } else {
          // 放錯：先放到桌上，再輕輕滑回托盤；那桌的東西晃一下，嘆氣泡泡浮出主題圖示
          const s = slotPos(slot);
          moveTo(g, { x: s.x, y: s.y }, true);
          g.classList.add('returning'); // 滑回托盤前點不到，點擊會落在桌子上
          const t = p.tables.find((x) => x.id === slot);
          caption.textContent = p.wrongReaction.replace('{table}', t.short).replace('{theme}', t.themeName).replace('{item}', it.label);
          play('slide');
          zone.classList.remove('wiggle');
          void zone.getBBox();
          zone.classList.add('wiggle');
          const theme = zone.querySelector('.sigh-theme');
          const dots = zone.querySelector('.sigh-dots');
          theme.setAttribute('opacity', '1');
          dots.setAttribute('opacity', '0');
          later(() => moveTo(g, posOf(itemId)), reduceMotion() ? 0 : 350);
          later(() => g.classList.remove('returning'), reduceMotion() ? 0 : 900); // 滑回托盤後才能再點
          later(() => { theme.setAttribute('opacity', '0'); dots.setAttribute('opacity', '1'); }, 2200);
        }
      }
    };

    // 指標：拖曳（滑鼠、觸控筆）或點選（觸控只用點選）
    const toSvg = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    };
    const slotAt = (pt) => {
      let best = null;
      for (const z of svg.querySelectorAll('.zone')) {
        const s = slotPos(z.dataset.slot);
        const d = Math.hypot(pt.x - s.x, pt.y - s.y);
        if (d <= s.r * 1.1 && (!best || d < best.d)) best = { slot: z.dataset.slot, d };
      }
      return best?.slot ?? null;
    };
    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.pot');
      if (!g || e.pointerType === 'touch') return;
      drag = { item: g.dataset.item, start: toSvg(e), moved: false, id: e.pointerId };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const pt = toSvg(e);
      if (!drag.moved && Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) > 6) {
        drag.moved = true;
        select(drag.item);
        nodes.get(drag.item).classList.add('dragging');
      }
      if (drag.moved) moveTo(nodes.get(drag.item), pt, true);
    });
    svg.addEventListener('pointerup', (e) => {
      if (drag && e.pointerId === drag.id) {
        const d = drag;
        drag = null;
        nodes.get(d.item).classList.remove('dragging');
        if (d.moved) { drop(d.item, slotAt(toSvg(e))); return; }
        const occ = game.s.puzzles[id].place[d.item];
        if (selected && selected !== d.item && occ) { drop(selected, occ); return; } // 點到位置上的另一盆
        select(selected === d.item ? null : d.item); // 沒有拖動：當成點一下
        return;
      }
      // 點選
      const pot = e.target.closest('.pot');
      // 手上拿著一盆、點到已經放在位置上的另一盆：放到那個位置（原本那盆回到托盤）
      const occupied = pot && game.s.puzzles[id].place[pot.dataset.item];
      if (pot && selected && selected !== pot.dataset.item && occupied) { drop(selected, occupied); return; }
      if (pot) { select(selected === pot.dataset.item ? null : pot.dataset.item); return; }
      if (!selected) return;
      const zone = e.target.closest('.zone');
      if (zone) drop(selected, zone.dataset.slot);
      else if (e.target.closest('.tray-area')) drop(selected, null);
    });
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const pot = e.target.closest('.pot');
      if (pot) select(selected === pot.dataset.item ? null : pot.dataset.item);
      else if (selected && e.target.closest('.zone')) drop(selected, e.target.closest('.zone').dataset.slot);
    });
  }

  // ---- 文字模式：用描述代替插畫，放置後描述反應 ----
  function textView(message) {
    const plants = p.kind === 'plants';
    const place = game.s.puzzles[id].place;
    const slots = plants ? p.spots : p.tables;
    const where = (sid) => slots.find((x) => x.id === sid)?.short;
    body.innerHTML = `<p class="fine">${esc(p.minutes)}・不計時，可以一直重新擺</p>
      <p>${esc(p.intro)}</p>
      <h3>${plants ? '地上的位置' : '三張桌子'}</h3>
      <ul class="text-list">${slots.map((x) => `<li>${esc(x.look)}</li>`).join('')}</ul>
      ${message ? `<div class="notice" role="status">${esc(message)}</div>` : ''}
      <div class="puzzle-items">${p.items.map((it) => {
    const at = place[it.id];
    return `<div class="puzzle-item">
          <h4>${esc(it.label)}</h4>
          <p>${esc(plants ? it.looks.join('') : it.look)}</p>
          <p class="fine">${at ? `現在在：${esc(where(at))}${plants ? `。${esc(it.reactions[at].text)}` : ''}` : '現在在托盤上。'}</p>
          ${plants || !at ? `<div class="bin-buttons">${slots.map((x) => `<button type="button" class="btn small ${at === x.id ? 'on' : ''}" data-item="${it.id}" data-slot="${x.id}" aria-pressed="${at === x.id}">放到${esc(x.short)}</button>`).join('')}
            ${at ? `<button type="button" class="btn small" data-item="${it.id}" data-slot="">拿回托盤</button>` : ''}</div>` : ''}
        </div>`;
  }).join('')}</div>
      <div class="mg-footer"><button type="button" class="btn" data-later>先離開，等等再來</button></div>`;
    body.querySelector('[data-later]').onclick = () => $('puzzle').close();
    for (const b of body.querySelectorAll('[data-slot]')) {
      b.onclick = () => {
        const item = b.dataset.item;
        const slot = b.dataset.slot || null;
        const it = p.items.find((x) => x.id === item);
        const r = game.placePuzzle(id, item, slot);
        play(slot ? 'drop' : 'pickup');
        if (!r || !slot) return textView();
        if (r.solved) { play('good'); return solvedView(); }
        if (plants) {
          play(r.fit ? 'good' : 'hmm');
          return textView(`${it.label}：${r.reaction.text}${r.fit ? '' : ` ${p.catLook}`}`);
        }
        if (r.fit) { play('good'); return textView(it.win); }
        play('slide');
        const t = p.tables.find((x) => x.id === slot);
        return textView(p.wrongReaction.replace('{table}', t.short).replace('{theme}', t.themeName).replace('{item}', it.label));
      };
    }
  }
}
