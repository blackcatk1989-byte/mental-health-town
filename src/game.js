// 遊戲規則：任務進度、對話入口、發卡、用卡、謎題、麻糬的提示、讀檔修復。
// 3D 模式與文字模式共用這一份規則與進度，畫面只負責呈現與輸入。
import { newSave } from './state.js';
import { play } from './sfx.js';

export class Game extends EventTarget {
  /**
   * @param {object} content content/ 的所有 JSON
   * @param {import('./state.js').Store} store
   * @param {object} ui src/ui.js 建立的介面
   */
  constructor(content, store, ui) {
    super();
    this.c = content;
    this.store = store;
    this.ui = ui;
    this.deferred = [];
    this.hintTurn = 0; // 麻糬這次要帶去第幾個地方
    this.stepIds = content.quest.steps.map((s) => s.id);
    this.cardById = Object.fromEntries(content.cards.cards.map((k) => [k.id, k]));
    this.puzzleIds = Object.keys(content.puzzles.puzzles);
    this.areaById = Object.fromEntries(content.places.areas.map((a) => [a.id, a]));
  }

  get s() { return this.store.data; }
  get step() { return this.s.step; }
  get stepInfo() { return this.c.quest.steps.find((x) => x.id === this.step); }
  stepIndex(id) { return this.stepIds.indexOf(id); }
  hasCard(id) { return this.s.cards.includes(id); }
  card(id) { return this.cardById[id]; }

  // ---- 開局、讀檔 ----
  newGame() {
    this.store.start(newSave(this.puzzleIds));
    this.changed();
  }

  // 讀檔後檢查：已走過發卡步驟卻缺卡就補回；解開的謎題卻缺卡也補回。回傳要告訴玩家的訊息。
  repair() {
    const notes = [];
    this.store.mutate((s) => {
      if (!this.stepIds.includes(s.step)) {
        notes.push('任務進度無法辨識，已回到任務開頭；已取得的卡片都保留。');
        s.step = 'arrive';
      }
      for (const g of this.c.quest.guaranteed) {
        if (this.stepIndex(s.step) >= this.stepIndex(g.fromStep) && !s.cards.includes(g.card)) {
          s.cards.push(g.card);
          if (!s.rewards.includes(g.card)) s.rewards.push(g.card);
          notes.push(`依任務紀錄補回理解卡「${this.card(g.card).title}」。`);
        }
      }
      s.side ??= {}; // 舊存檔沒有支線紀錄：補上空的，直接沿用
      for (const id of this.puzzleIds) {
        s.puzzles[id] ??= { place: {}, solved: false };
        // 謎題改版後，舊存檔裡已經不存在的位置清掉（植物回到托盤上）
        const pz = this.c.puzzles.puzzles[id];
        const slots = new Set((pz.spots ?? pz.tables).map((x) => x.id));
        const items = new Set(pz.items.map((x) => x.id));
        for (const [item, slot] of Object.entries(s.puzzles[id].place)) {
          if (!items.has(item) || !slots.has(slot)) delete s.puzzles[id].place[item];
        }
        const card = this.c.puzzles.puzzles[id].card;
        if (s.puzzles[id].solved && !s.cards.includes(card)) {
          s.cards.push(card);
          notes.push(`依謎題紀錄補回理解卡「${this.card(card).title}」。`);
        }
      }
      s.cards = s.cards.filter((id, i, a) => this.cardById[id] && a.indexOf(id) === i);
    });
    this.changed();
    return notes;
  }

  // ---- 條件與目標 ----
  check(when) {
    if (!when) return true;
    const s = this.s;
    if (when.step && !when.step.includes(s.step)) return false;
    if (when.stepFrom && this.stepIndex(s.step) < this.stepIndex(when.stepFrom)) return false;
    if (when.flag && !s.flags[when.flag]) return false;
    if (when.notFlag && s.flags[when.notFlag]) return false;
    if (when.card && !this.hasCard(when.card)) return false;
    if (when.side && !when.side.in.includes(this.side(when.side.id))) return false;
    if (when.absent && this.present(when.absent)) return false;
    return true;
  }

  // ---- 支線（隱藏角色）----
  // 支線進度：還沒開始時是 'closed'
  side(id) { return this.s.side?.[id] ?? 'closed'; }

  // 角色現在在不在：支線完成後，每次走進那個區域輪流在與不在（完成當下他就離開了）
  present(charId) {
    const ch = this.c.characters.characters.find((x) => x.id === charId);
    const pr = ch?.presence;
    if (!pr || this.side(pr.side) !== pr.alternateAfter) return true;
    return (this.s.side[`${pr.side}Visits`] ?? 0) % 2 === 1;
  }

  // 走進一個區域：支線完成後，記一次來訪（決定角色這次在不在）
  enterArea(s, area) {
    for (const ch of this.c.characters.characters) {
      const pr = ch.presence;
      if (pr && ch.spots[0].area === area && (s.side?.[pr.side] ?? 'closed') === pr.alternateAfter) {
        s.side[`${pr.side}Visits`] = (s.side[`${pr.side}Visits`] ?? 0) + 1;
      }
    }
  }

  characterSpot(ch) {
    let spot = ch.spots[0];
    for (const sp of ch.spots) if (!sp.fromStep || this.stepIndex(this.step) >= this.stepIndex(sp.fromStep)) spot = sp;
    return spot;
  }

  // 目前場景上所有可互動的目標（角色、物件、謎題入口）
  targets() {
    const list = [];
    for (const ch of this.c.characters.characters) {
      if (!this.present(ch.id)) continue;
      const sp = this.characterSpot(ch);
      list.push({ id: ch.id, kind: 'character', name: ch.name, area: sp.area, x: sp.x, z: sp.z, sit: !!sp.sit, cardTarget: true, data: ch });
    }
    for (const o of this.c.places.objects) {
      if (o.showWhen && !this.check(o.showWhen)) continue;
      list.push({ id: o.id, kind: o.puzzle ? 'puzzle' : 'object', name: o.name, area: o.area, x: o.x, z: o.z, cardTarget: !!o.cardTarget, data: o });
    }
    return list;
  }

  target(id) { return this.targets().find((t) => t.id === id); }

  // 任務清單指引的目標（可能是多個）
  goalTargets() {
    const t = this.stepInfo?.target;
    if (!t) return [];
    const ids = Array.isArray(t) ? t : [t];
    const done = this.stepInfo.targetFlags ?? {};
    return ids.filter((id) => !this.s.flags[done[id]]);
  }

  // 目前目標需要、但玩家還沒有的卡，與取得方式
  missingCard() {
    const need = this.stepInfo?.needCard;
    if (!need || this.hasCard(need)) return null;
    return { card: this.card(need), text: this.c.uses.missing[need] };
  }

  // ---- 互動 ----
  interact(id) {
    const t = this.target(id);
    if (!t || this.ui.busy()) return;
    if (t.kind === 'puzzle') return this.openPuzzle(t.data.puzzle);
    const entry = t.data.talk.find((e) => this.check(e.when));
    if (!entry) return;
    if (entry.dialogueCycle) {
      // 每次輪流一句（記在存檔裡）
      const key = `${id}Line`;
      const i = (this.s.side[key] ?? 0) % entry.dialogueCycle.length;
      this.store.mutate((s) => { s.side[key] = i + 1; });
      this.play(entry.dialogueCycle[i]);
    } else {
      this.play(entry.dialogue);
    }
  }

  play(dialogueId, vars) {
    this.ui.dialogue.play(dialogueId, {
      vars,
      onEffects: (effects) => this.apply(effects),
      onClose: () => this.flush(),
    });
  }

  // ---- 謎題 ----
  // 不計時、不扣分、可無限重試；已擺好的位置會存起來，中途離開再回來仍保留
  openPuzzle(id) {
    this.ui.puzzle(this, id);
  }

  // 把一項東西放到一個位置（slot 為 null 表示拿回托盤）。回傳 { fit, reaction, solved }。
  // 植物：放下就留在原地，用反應提示合不合適，玩家可以再拿起來；桌子：放錯會滑回托盤，不保留。
  // 全部放對時才發卡；不計分、不記錄放錯次數。
  placePuzzle(id, item, slot) {
    const p = this.c.puzzles.puzzles[id];
    const it = p.items.find((x) => x.id === item);
    if (!it || this.s.puzzles[id].solved) return null;
    const fit = !!slot && slot === it.answer;
    const reaction = p.kind === 'plants' ? it.reactions?.[slot] ?? null : null;
    const keep = slot && (p.kind === 'plants' || fit);
    // answer 為 null 的是混淆物，不用放；其他每一項都放對才算解開
    const solvedNow = keep && p.items.filter((x) => x.answer).every((x) => (x.id === item ? fit : this.s.puzzles[id].place[x.id] === x.answer));
    this.apply(solvedNow ? [{ giveCard: p.card }] : [], (s) => {
      const place = s.puzzles[id].place;
      if (keep) {
        for (const [other, sl] of Object.entries(place)) if (other !== item && sl === slot) delete place[other]; // 一個位置放一盆
        place[item] = slot;
      } else if (!slot) {
        delete place[item];
      }
      if (solvedNow) s.puzzles[id].solved = true;
    });
    return { fit, reaction, solved: solvedNow };
  }

  // ---- 麻糬的提示 ----
  // 可以帶去的地方：目前的主線目標，以及還沒解開的謎題
  hintTopics() {
    const topics = [];
    const goal = this.goalTargets()[0];
    if (goal) topics.push({ id: 'goal', target: goal });
    for (const id of this.puzzleIds) {
      if (!this.s.puzzles[id].solved) topics.push({ id, target: this.c.puzzles.puzzles[id].entry });
    }
    return topics;
  }

  // 問麻糬：牠自己走到該去的地方坐下（主線目標優先；再問一次換下一個地方）
  catHint() {
    const topics = this.hintTopics();
    if (!topics.length) return { text: this.c.hints.nothing };
    const topic = topics[this.hintTurn % topics.length];
    this.hintTurn += 1;
    const t = this.target(topic.target);
    const area = this.areaById[t.area];
    const fill = (str) => str.replace('{area}', area.name).replace('{name}', t.name);
    const detail = { target: t, area };
    this.dispatchEvent(new CustomEvent('hint', { detail }));
    play('meow');
    return { ...detail, text: fill(this.s.area === t.area ? this.c.hints.here : this.c.hints.go) };
  }

  // 用卡：找出符合目標、卡號與任務階段的互動
  useCard(targetId, cardId) {
    const t = this.target(targetId);
    if (!t || !this.hasCard(cardId)) return { ok: false, text: '你還沒有這張卡。' };
    const uses = this.c.uses.uses.filter((u) => u.target === targetId && u.card === cardId);
    const ok = uses.find((u) => this.useAvailable(u));
    const hidden = !!t.data.hidden; // 隱藏角色：沒有明顯反應，不顯示目標或其他提示
    if (ok) {
      this.store.mutate((s) => { if (!s.used.includes(ok.id)) s.used.push(ok.id); });
      this.changed();
      if (!hidden) this.react(targetId, 'happy'); // 適用：角色有明顯的反應
      this.play(ok.dialogue);
      return { ok: true };
    }
    if (hidden) return { ok: false, text: t.data.notApplicable, quiet: true };
    this.react(targetId, 'question'); // 不適用：露出疑惑的表情，卡片不消耗
    const goal = this.stepInfo?.goal;
    const early = uses.map((u) => this.c.uses.tooEarly[u.id]).find(Boolean);
    const base = early || (uses.length ? '現在好像還不是用這張卡的時候。' : t.data.notApplicable || '這張卡的觀點很好，只是現在好像不適用。');
    return { ok: false, text: base, goal };
  }

  // 角色或物件的反應（3D 會讓角色跳一下、頭上出現表情圖示）
  react(targetId, kind) {
    play(kind === 'happy' ? 'happy' : 'wonder');
    this.dispatchEvent(new CustomEvent('reaction', { detail: { target: targetId, kind } }));
  }

  useAvailable(u) {
    if (u.steps && !u.steps.includes(this.step)) return false;
    if (u.fromStep && this.stepIndex(this.step) < this.stepIndex(u.fromStep)) return false;
    if (u.side && !u.side.in.includes(this.side(u.side.id))) return false;
    return true;
  }

  // 選卡時預覽「這張卡在這裡會怎麼用」
  useIntent(targetId, cardId) {
    const t = this.target(targetId);
    // 隱藏角色不預覽意圖，避免變成「哪張卡才對」的提示
    const u = t.data.hidden ? null : this.c.uses.uses.find((x) => x.target === targetId && x.card === cardId && this.useAvailable(x));
    return u?.intent ?? `試著用「${this.card(cardId).title}」的觀點，和${t.name}互動。`;
  }

  // ---- 效果 ----
  // 一組效果在同一次儲存內完成；需要開啟其他畫面的效果等對話結束後再執行
  // pre：要和這組效果一起儲存的其他修改（例如拾取點位、練習紀錄）
  apply(effects, pre) {
    const after = [];
    this.store.mutate((s) => {
      pre?.(s);
      this.applyInto(s, effects, after);
    });
    this.checkComplete();
    this.changed();
    for (const fn of after) fn();
    if (!this.ui.dialogue.open) this.flush();
  }

  applyInto(s, effects, after) {
    for (const e of effects || []) {
      if (e.giveCard) {
        if (!s.cards.includes(e.giveCard)) {
          s.cards.push(e.giveCard);
          if (!s.rewards.includes(e.giveCard)) s.rewards.push(e.giveCard);
          const k = this.card(e.giveCard);
          after.push(() => this.ui.cardToast(k));
        }
      }
      if (e.advance && e.advance.from.includes(s.step)) {
        s.step = e.advance.to;
        this.applyInto(s, e.advance.then, after);
      }
      if (e.setFlag) s.flags[e.setFlag] = true;
      if (e.setSide) s.side[e.setSide[0]] = e.setSide[1];
      if (e.gesture) after.push(() => this.dispatchEvent(new CustomEvent('reaction', { detail: { target: e.gesture[0], kind: e.gesture[1] } })));
      if (e.openResources) after.push(() => window.openSupport?.());
      if (e.openCardbook) this.deferred.push(() => this.ui.openCardbook());
      if (e.tutorial) after.push(() => this.ui.tutorial(e.tutorial));
      if (e.dialogue) this.deferred.push(() => this.play(e.dialogue));
      if (e.minigame) this.deferred.push(() => this.startMinigame(e.minigame));
    }
  }

  checkComplete() {
    const info = this.stepInfo;
    const flags = info?.completeWhen?.flags;
    if (flags && flags.every((f) => this.s.flags[f])) {
      const after = [];
      this.store.mutate((s) => this.applyInto(s, info.onComplete, after));
      for (const fn of after) fn();
    }
  }

  // 對話結束後依序執行延後的動作（開練習、接下一段對話）
  flush() {
    const next = this.deferred.shift();
    if (next) next();
  }

  // 練習要親手完成才取得卡片；中途離開不記錄，下次從頭開始
  startMinigame(id) {
    this.dispatchEvent(new CustomEvent('practice', { detail: { id, open: true } }));
    this.ui.minigame(id, this.c.minigames[id], (completed) => {
      this.dispatchEvent(new CustomEvent('practice', { detail: { id, open: false } }));
      if (!completed) return this.flush();
      this.apply(this.c.minigames[id].onComplete, (s) => { s.practice[id] += 1; });
    });
  }

  // ---- 位置 ----
  setPlayer(x, z, area) {
    const s = this.s;
    if (!s) return;
    s.player = { x, z };
    if (area && area !== s.area) {
      s.area = area;
      this.enterArea(s, area);
      this.changed();
      this.dispatchEvent(new CustomEvent('area', { detail: area }));
    }
  }

  setArea(area) {
    this.store.mutate((s) => {
      s.area = area;
      s.player = { ...this.areaById[area].spawn };
      this.enterArea(s, area);
    });
    this.dispatchEvent(new CustomEvent('area', { detail: area }));
    this.changed();
  }

  changed() {
    this.dispatchEvent(new Event('change'));
  }
}
