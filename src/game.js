// 遊戲規則：任務進度、對話入口、發卡、用卡、探索卡拾取、讀檔修復。
// 3D 模式與文字模式共用這一份規則與進度，畫面只負責呈現與輸入。
import { newSave, rollExplore } from './state.js';

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
    this.stepIds = content.quest.steps.map((s) => s.id);
    this.cardById = Object.fromEntries(content.cards.cards.map((k) => [k.id, k]));
    this.pointById = Object.fromEntries(content.explore.points.map((p) => [p.id, p]));
    this.areaById = Object.fromEntries(content.places.areas.map((a) => [a.id, a]));
  }

  get s() { return this.store.data; }
  get step() { return this.s.step; }
  get stepInfo() { return this.c.quest.steps.find((x) => x.id === this.step); }
  stepIndex(id) { return this.stepIds.indexOf(id); }
  hasCard(id) { return this.s.cards.includes(id); }
  card(id) { return this.cardById[id]; }

  // ---- 開局、讀檔 ----
  newGame(forcedExplore) {
    const { cards, points } = this.c.explore;
    this.store.start(newSave(rollExplore(cards, points, forcedExplore)));
    this.changed();
  }

  // 讀檔後檢查：已走過發卡步驟卻缺卡就補回；探索對照表壞掉才重抽。回傳要告訴玩家的訊息。
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
      const { cards, points } = this.c.explore;
      const ex = s.explore || {};
      const ids = cards.map((c) => ex[c]);
      const valid = ids.every((id) => this.pointById[id]) && new Set(ids).size === ids.length;
      if (!valid) {
        s.explore = rollExplore(cards, points);
        s.picked = [];
        notes.push('探索卡的位置紀錄無法讀取，已重新放置。');
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
    return true;
  }

  characterSpot(ch) {
    let spot = ch.spots[0];
    for (const sp of ch.spots) if (!sp.fromStep || this.stepIndex(this.step) >= this.stepIndex(sp.fromStep)) spot = sp;
    return spot;
  }

  // 目前場景上所有可互動的目標（角色、物件、還沒拾取的探索卡）
  targets() {
    const list = [];
    for (const ch of this.c.characters.characters) {
      const sp = this.characterSpot(ch);
      list.push({ id: ch.id, kind: 'character', name: ch.name, area: sp.area, x: sp.x, z: sp.z, cardTarget: true, data: ch });
    }
    for (const o of this.c.places.objects) {
      list.push({ id: o.id, kind: 'object', name: o.name, area: o.area, x: o.x, z: o.z, cardTarget: !!o.cardTarget, data: o });
    }
    for (const [card, pid] of Object.entries(this.s.explore)) {
      if (this.s.picked.includes(pid)) continue;
      const p = this.pointById[pid];
      list.push({ id: `pickup:${pid}`, kind: 'pickup', name: `${p.name}的理解卡`, area: p.area, x: p.x, z: p.z, card, point: p });
    }
    return list;
  }

  target(id) { return this.targets().find((t) => t.id === id); }

  // 任務清單指引的目標（可能是多個）
  goalTargets() {
    const t = this.stepInfo?.target;
    if (!t) return [];
    const ids = Array.isArray(t) ? t : [t];
    if (this.step === 'wrap') {
      return ids.filter((id) => !this.s.flags[id === 'muyu' ? 'confirmedMuyu' : 'confirmedAcheng']);
    }
    return ids;
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
    if (t.kind === 'pickup') return this.pickup(t.point.id);
    const entry = t.data.talk.find((e) => this.check(e.when));
    if (entry) this.play(entry.dialogue);
  }

  play(dialogueId, vars) {
    this.ui.dialogue.play(dialogueId, {
      vars,
      onEffects: (effects) => this.apply(effects),
      onClose: () => this.flush(),
    });
  }

  pickup(pointId) {
    const card = Object.keys(this.s.explore).find((c) => this.s.explore[c] === pointId);
    if (!card || this.s.picked.includes(pointId)) return;
    const p = this.pointById[pointId];
    this.apply([{ giveCard: card }], (s) => { s.picked.push(pointId); });
    const k = this.card(card);
    this.ui.pickupAnimation?.(k);
    this.play('pickup', { place: p.name, title: k.title, useHint: `使用提示：${k.useHint}` });
  }

  // 用卡：找出符合目標、卡號與任務階段的互動
  useCard(targetId, cardId) {
    const t = this.target(targetId);
    if (!t || !this.hasCard(cardId)) return { ok: false, text: '你還沒有這張卡。' };
    const uses = this.c.uses.uses.filter((u) => u.target === targetId && u.card === cardId);
    const ok = uses.find((u) => this.useAvailable(u));
    if (ok) {
      this.store.mutate((s) => { if (!s.used.includes(ok.id)) s.used.push(ok.id); });
      this.changed();
      this.play(ok.dialogue);
      return { ok: true };
    }
    const goal = this.stepInfo?.goal;
    const early = uses.map((u) => this.c.uses.tooEarly[u.id]).find(Boolean);
    const base = early || (uses.length ? '現在好像還不是用這張卡的時候。' : t.data.notApplicable || '這張卡的觀點很好，只是現在好像不適用。');
    return { ok: false, text: base, goal };
  }

  useAvailable(u) {
    if (u.steps && !u.steps.includes(this.step)) return false;
    if (u.fromStep && this.stepIndex(this.step) < this.stepIndex(u.fromStep)) return false;
    return true;
  }

  // 選卡時預覽「這張卡在這裡會怎麼用」
  useIntent(targetId, cardId) {
    const u = this.c.uses.uses.find((x) => x.target === targetId && x.card === cardId && this.useAvailable(x));
    const t = this.target(targetId);
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
      if (e.quietSeat && s.arrangement) s.arrangement.quiet = true;
      if (e.openResources) after.push(() => window.openSupport?.());
      if (e.openCardbook) this.deferred.push(() => this.ui.openCardbook());
      if (e.tutorial) after.push(() => this.ui.tutorial(e.tutorial));
      if (e.dialogue) this.deferred.push(() => this.play(e.dialogue));
      if (e.minigame) this.deferred.push(() => this.startMinigame(e.minigame, e.mode));
      if (e.arrangement) this.deferred.push(() => this.openArrangement(e.arrangement === 'first'));
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

  // 對話結束後依序執行延後的動作（開練習、開佈置、接下一段對話）
  flush() {
    const next = this.deferred.shift();
    if (next) next();
  }

  startMinigame(id, mode) {
    this.ui.minigame(id, mode, this.c.minigames[id], (result) => {
      if (!result) return this.flush(); // 中途離開：不記錄，可再次進入
      this.apply(this.c.minigames[id].onComplete, (s) => { s.practice[id][result] += 1; });
    });
  }

  openArrangement(first) {
    const bench = this.c.places.objects.find((o) => o.id === 'bench');
    const cfg = bench.arrangement;
    this.ui.arrangement(cfg, this.s.arrangement, this.hasCard(cfg.quiet.card), (choice) => {
      if (!choice) return this.flush();
      this.apply(first ? cfg.onFirstComplete : [], (s) => { s.arrangement = choice; });
    });
  }

  // ---- 位置 ----
  setPlayer(x, z, area) {
    const s = this.s;
    if (!s) return;
    s.player = { x, z };
    if (area) s.area = area;
  }

  setArea(area) {
    this.store.mutate((s) => {
      s.area = area;
      s.player = { ...this.areaById[area].spawn };
    });
    this.changed();
  }

  locate(cardId) {
    const pid = this.s.explore[cardId];
    if (!pid) return null;
    const p = this.pointById[pid];
    this.dispatchEvent(new CustomEvent('locate', { detail: p }));
    return { point: p, area: this.areaById[p.area] };
  }

  changed() {
    this.dispatchEvent(new Event('change'));
  }
}
