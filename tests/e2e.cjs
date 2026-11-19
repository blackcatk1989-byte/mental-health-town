// 端對端驗收測試（Playwright，瀏覽器實際操作）：v4 主線、兩個練習、兩個謎題、麻糬的三層提示、
// 文字模式、手機觸控、各階段重新整理後的存檔。不屬於遊戲本身，也不需要 npm 安裝到專案：
//   python -m http.server 8000   （另一個終端機）
//   BASE=http://localhost:8000 node tests/e2e.cjs
// 無法連到 jsDelivr 時，可設 THREE_DIR 指向 three@0.170.0 套件資料夾，測試會改從本機讀取。
const fs = require('fs');
const path = require('path');
const { launch, BASE } = require('./helpers.cjs');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? `：${detail}` : ''}`);
};

// 等瀏覽器處理完排隊中的事件（面板的 close 事件是非同步的；測試機用軟體繪圖，每幀很慢）
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30))));

const state = async (page) => {
  await settle(page);
  return page.evaluate(() => JSON.parse(localStorage.getItem('xinzhijian.save')));
};

// 一路點完對話；prefer 是想選的選項文字（依序比對，找不到就選第一個）
async function talkThrough(page, prefer = []) {
  await settle(page);
  for (let i = 0; i < 160; i++) {
    const fly = await page.$('.card-fly');
    if (fly) { await fly.dispatchEvent('pointerdown'); await page.waitForTimeout(40); continue; } // 略過取得卡片的動畫
    if (!(await page.isVisible('#dialogue'))) return;
    if (await page.$('dialog[open]')) return; // 對話途中開啟了其他面板（例如找支持），交給呼叫端處理
    const choices = await page.$$('#dlg-choices button');
    if (choices.length) {
      const texts = await Promise.all(choices.map((c) => c.innerText()));
      let idx = 0;
      for (const p of prefer) {
        const j = texts.findIndex((t) => t.includes(p));
        if (j >= 0) { idx = j; break; }
      }
      await choices[idx].click({ timeout: 3000 }).catch(() => {});
    } else {
      await page.click('#dlg-next', { timeout: 3000 }).catch(() => {}); // 對話剛好結束時按鈕會消失，下一輪重新判斷
    }
    await page.waitForTimeout(40);
  }
  throw new Error('對話沒有結束');
}

async function useCard(page, opener, card) {
  await settle(page);
  if (await page.evaluate(() => document.body.dataset.mode === '3d')) {
    await page.waitForSelector('#interact:not(.hidden)', { timeout: 20000 });
  }
  await opener();
  await page.waitForSelector('#usecard[open]');
  await page.click(`#usecard-body [data-card="${card}"]`);
  await page.click('#usecard-body [data-go]');
  await page.waitForTimeout(80);
}

// 按住方向鍵，直到角色停下來（撞到障礙或邊界）
async function holdUntilStopped(page, key) {
  const pos = () => page.evaluate(() => window.__xzj.view().position);
  await page.keyboard.down(key);
  let last = await pos();
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const p = await pos();
    if (Math.hypot(p.x - last.x, p.z - last.z) < 0.01) break;
    last = p;
  }
  await page.keyboard.up(key);
  return pos();
}

// 想法放大鏡：先故意放錯一次（確認只有線索方向），再全部放對、選其他可能、完成
async function playThought(page) {
  await page.waitForSelector('#minigame[open]');
  await page.click('#minigame-body [data-go]');
  await page.click('#minigame-body [data-frag="f4"][data-box="fact"]');
  const hint = await page.innerText('#minigame-body .notice').catch(() => '');
  for (const [f, b] of [['f1', 'fact'], ['f2', 'fact'], ['f3', 'fact'], ['f4', 'guess'], ['f5', 'guess'], ['f6', 'feeling']]) {
    await page.click(`#minigame-body [data-frag="${f}"][data-box="${b}"]`);
  }
  await page.click('#minigame-body [data-next]');
  await page.click('#minigame-body [data-alt="0"]');
  await page.click('#minigame-body [data-next]');
  const result = await page.innerText('#minigame-body');
  await page.click('#minigame-body [data-next]');
  await page.click('#minigame-body [data-done]');
  return { hint, result };
}

// 回到這座花園：三輪「留意 → 念頭冒出來 → 看見了，回到花園」
async function playPresent(page) {
  await page.waitForSelector('#minigame[open]');
  await page.click('#minigame-body [data-go]');
  let bubbles = 0;
  for (let i = 0; i < 3; i++) {
    await page.click('#minigame-body [data-opt="0"]');
    if (await page.isVisible('#minigame-body .thought-bubble')) bubbles++;
    await page.click('#minigame-body [data-return]');
    await page.click('#minigame-body [data-next]');
  }
  await page.click('#minigame-body [data-end]');
  await page.click('#minigame-body [data-done]');
  return bubbles;
}

// 謎題：直接操作。插畫版「點東西 → 點位置」；drag 為 true 時用滑鼠拖曳；文字模式按「放到……」
const E01 = { rosemary: 'sun', mint: 'wet', fern: 'shade' };
// 謎題「失物招領箱的密碼鎖」（E02）：轉盤由左到右是 圓形（中間那桌）、拱門形（門口那桌）、方形（靠窗那桌）。
// 密碼 4-2-5；三個表面數字 2-1-3 打不開
const CODE = [4, 2, 5];
const SURFACE = [2, 1, 3];
const SPOTS = { t1: ['t1a', 't1b'], t2: ['t2a', 't2b'], t3: ['t3a', 't3b'] };
// 打開一張桌子的特寫，查看指定的地方（文字模式按清單的按鈕；插畫版點桌面上的放大鏡）
async function lookAt(page, table, spots) {
  await page.evaluate((t) => { const d = document.getElementById('puzzle'); if (d.open) d.close(); window.__xzj.game.openPuzzle('E02', t); }, table);
  await page.waitForSelector('#puzzle[open]');
  for (const sp of spots) {
    const text = await page.$('#puzzle-body .text-list');
    await page.click(text ? `#puzzle-body [data-spot="${sp}"]` : `#puzzle .spot[data-spot="${sp}"] .spot-hit`, { force: true });
  }
}
// 打開密碼鎖，撥到指定的數字，拉拉看；回傳說明文字
async function tryCode(page, digits, { tap = false } = {}) {
  await page.evaluate(() => { const d = document.getElementById('puzzle'); if (d.open) d.close(); window.__xzj.game.openPuzzle('E02'); });
  await page.waitForSelector('#puzzle[open]');
  if (await page.$('#puzzle-body select')) {
    for (const [i, n] of digits.entries()) await page.selectOption(`#puzzle-body select[data-i="${i}"]`, String(n));
    await page.click('#puzzle-body [data-try]');
    return page.innerText('#puzzle-body .notice, #puzzle-body .box-items').catch(() => '');
  }
  for (const [i, n] of digits.entries()) {
    const now = await page.evaluate((k) => window.__xzj.game.lockState('E02').dial[k], i);
    const steps = (n - now + 10) % 10;
    const btn = page.locator(`#puzzle .dial[data-i="${i}"] [data-step="1"]`);
    for (let k = 0; k < steps; k++) { if (tap) await btn.tap(); else await btn.click(); }
  }
  await page.click('#puzzle-body [data-try]');
  return caption(page);
}
async function place(page, item, slot, { drag = false, tap = false } = {}) {
  await page.waitForSelector('#puzzle[open]');
  if (await page.$('#puzzle-body .text-list')) {
    await page.click(`#puzzle-body [data-item="${item}"][data-slot="${slot}"]`);
    return;
  }
  const pot = page.locator(`#puzzle .pot[data-item="${item}"] .pot-hit`);
  const zone = page.locator(`#puzzle .zone[data-slot="${slot}"] .zone-hit`);
  if (drag) {
    const a = await pot.boundingBox();
    const b = await zone.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 - 10, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
    await page.mouse.up();
  } else if (tap) {
    await pot.tap({ force: true });
    await zone.tap({ force: true });
  } else {
    await pot.click({ force: true });
    await zone.click({ force: true });
  }
}
// 等植物或桌子做出反應（說明文字改變）
async function reaction(page, before) {
  await page.waitForFunction((b) => {
    const c = document.querySelector('#puzzle-body .caption, #puzzle-body .notice');
    const t = c?.textContent ?? '';
    return t && t !== b && t !== '……';
  }, before, { timeout: 15000 }).catch(() => {});
  return page.evaluate(() => document.querySelector('#puzzle-body .caption, #puzzle-body .notice')?.textContent ?? '');
}
async function caption(page) {
  return page.evaluate(() => document.querySelector('#puzzle-body .caption, #puzzle-body .notice')?.textContent ?? '');
}
// 讀對話的整句（逐字出現完才讀）
async function lineText(page) {
  await page.waitForFunction(() => document.getElementById('dlg-next').textContent !== '…', null, { timeout: 15000 }).catch(() => {});
  return page.innerText('#dlg-text');
}
const NO_JUDGE = /錯|對了|失敗|扣分|分數|答案是|正確/;

const text = {
  go: (page, area) => page.click(`#text-mode [data-area="${area}"]:not([disabled])`).catch(() => {}),
  act: async (page, id) => {
    // 取得卡片的動畫還在播時先略過（玩家點一下也是略過）
    const fly = await page.$('.card-fly');
    if (fly) { await fly.dispatchEvent('pointerdown').catch(() => {}); await page.waitForTimeout(60); }
    await page.click(`#text-mode [data-act="${id}"]`);
  },
  use: (page, id, card) => useCard(page, () => page.click(`#text-mode [data-use="${id}"]`), card),
};

async function newGame(page, modeButton = '#home-new') {
  await page.goto(`${BASE}/?test=1`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/?test=1`);
  await page.click(modeButton);
}

async function reloadContinue(page) {
  await page.reload();
  await page.click('#home-continue');
  if (await page.evaluate(() => JSON.parse(localStorage.getItem('xinzhijian.save')).mode === '3d')) {
    await page.waitForFunction(() => window.__xzj?.view()?.position, null, { timeout: 30000 });
  }
}

async function textMainline(page) {
  await text.act(page, 'board');
  await talkThrough(page, ['先去咖啡店']);
  await text.go(page, 'cafe');
  await text.act(page, 'xiaoqing');
  await talkThrough(page, ['想聊聊嗎', '一直想']);
  await text.act(page, 'note');
  await talkThrough(page, ['開始']);
  await playThought(page);
  await talkThrough(page);
  await text.use(page, 'xiaoqing', 'K02');
  await talkThrough(page, ['做別的事']);
  await text.go(page, 'garden');
  await text.use(page, 'ade', 'K01');
  await talkThrough(page, ['一起試試']);
  await playPresent(page);
  await talkThrough(page);
  await text.use(page, 'bench', 'K03');
  await talkThrough(page, ['坐十分鐘']);
  await text.go(page, 'cafe');
  await text.act(page, 'xiaoqing');
  await talkThrough(page);
  await text.go(page, 'garden');
  await text.act(page, 'ade');
  await talkThrough(page, ['繼續逛逛']);
}

// 11. v4.3：動畫預設開啟、桌子謎題加難、隱藏角色小安與隱藏卡 H01
async function sectionV43() {
  // 動畫預設開啟：系統開了「減少動態效果」也照樣有動畫（只看遊戲裡的設定）
  {
    const { browser, page } = await launch();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await newGame(page, '#home-text');
    await text.act(page, 'board');
    await page.waitForSelector('#dialogue:not(.hidden)');
    await page.waitForTimeout(60);
    const partial = (await page.innerText('#dlg-text')).length;
    await page.click('#dlg-text');
    const full = (await page.innerText('#dlg-text')).length;
    const cls = await page.evaluate(() => document.body.classList.contains('reduce-motion'));
    check('動畫預設開啟（系統設定「減少動態效果」時也是）', !cls && partial < full, `${partial} → ${full} 字`);
    await talkThrough(page, ['先去咖啡店']);
    // 謎題「失物招領箱的密碼鎖」：表面數字打不開；只有不對的格子會抖；看過的線索記在小筆記上
    await page.evaluate(() => { document.body.dataset.mode = '3d'; }); // 用插畫版
    const surface = await tryCode(page, SURFACE);
    const shaken = await page.evaluate(() => [...document.querySelectorAll('#puzzle .dial.shake')].map((d) => d.dataset.i).join());
    check('E02 用三個表面數字打不開，出現「好像不只是看到的那樣」，不出現對錯字樣', /拉不開/.test(surface) && /好像不只是看到的那樣/.test(surface) && !NO_JUDGE.test(surface) && shaken === '0,1,2', surface);
    const oneOff = await tryCode(page, [4, 2, 3]);
    const shaken1 = await page.evaluate(() => [...document.querySelectorAll('#puzzle .dial.shake')].map((d) => d.dataset.i).join());
    const lit = await page.evaluate(() => [...document.querySelectorAll('#puzzle .dial.right')].map((d) => d.dataset.i).join());
    check('E02 只錯一格：只有那一格會抖，撥對的兩格會亮', /拉不開/.test(oneOff) && shaken1 === '2' && lit === '0,1', `${shaken1}｜${lit}`);
    await lookAt(page, 't1', ['t1a']);
    const lensT1 = await page.innerText('#puzzle-body .lens');
    const tableHints = await page.evaluate(() => ({ badges: document.querySelectorAll('#puzzle .spot-badge').length, text: document.querySelector('#puzzle-body .table-head').innerText.trim() }));
    check('E02 桌子特寫：只有桌角的圖形記號，沒有放大鏡記號與「對應第幾格」的文字', tableHints.badges === 0 && !/對應|第.格/.test(tableHints.text), JSON.stringify(tableHints));
    check('E02 查看桌上的東西：放大鏡說明真正的樣子', /生日快樂/.test(lensT1) && !NO_JUDGE.test(lensT1), lensT1);
    await page.click('#puzzle .panel-head button:last-child');
    await settle(page);
    await page.evaluate(() => window.__xzj.game.openPuzzle('E02'));
    await page.waitForSelector('#puzzle[open] .lock-body');
    const kept = await page.evaluate(() => ({ dial: window.__xzj.game.lockState('E02').dial.join(), seen: window.__xzj.game.lockState('E02').seen.join(), notes: !!document.querySelector('#puzzle .lock-notes'), shapes: [...document.querySelectorAll('#puzzle .dial-shape')].map((e) => e.title).join() }));
    check('E02 中途離開再回來：撥好的數字與看過的線索保留；鎖上只有圖形，沒有小筆記，順序打亂', kept.dial === '4,2,3' && kept.seen === 't1a' && !kept.notes && kept.shapes === '圓形,拱門形,方形', JSON.stringify(kept));
    const opened = await tryCode(page, CODE);
    await page.waitForSelector('#puzzle-body .box-items', { timeout: 10000 });
    const boxText = await page.innerText('#puzzle-body .box-items');
    check('E02 全部正確：鎖彈開、箱子裡有三位客人的物品與他們說的話', /鎖彈開/.test(opened) && /生日卡/.test(boxText) && /火車/.test(boxText) && /鴿子/.test(boxText), boxText);
    await page.click('#puzzle-body [data-done]');
    const solvedE02 = await page.innerText('#puzzle-body .solved');
    const saved = (await state(page)).puzzles.E02;
    check('看完箱子裡的東西才取得 E02，說明「可以問，也可以等對方說」', saved.solved && (await state(page)).cards.includes('E02') && /可以問，也可以等對方說/.test(solvedE02), solvedE02);
    check('E02 的存檔只記看過的線索、撥到的數字、是否開鎖', Object.keys(saved).sort().join() === 'dial,opened,place,seen,solved', JSON.stringify(saved));
    // 重玩：不重複發卡
    await page.click('#puzzle-body [data-replay]');
    await page.waitForSelector('#puzzle-body .lock-body');
    await page.evaluate(() => { const g = window.__xzj.game; [5, 4, 2].forEach((n, i) => g.setDial('E02', i, n)); g.tryLock('E02'); g.finishLock('E02'); });
    const again = await state(page);
    check('E02 可以重玩，不會重複發卡', again.cards.filter((c) => c === 'E02').length === 1 && again.rewards.filter((c) => c === 'E02').length === 1 && again.puzzles.E02.solved);
    // 用前一版謎題取得 E02 的存檔：卡片保留，可以重玩
    await page.evaluate(() => { const g = window.__xzj.game; g.store.mutate((d) => { d.puzzles.E02 = { place: { bookmark: 't1' }, solved: true, tables: { t1: { layer: 2, seen: 2, done: true } } }; }); g.repair(); });
    const oldSave = await state(page);
    check('舊版謎題取得 E02 的存檔：卡片保留，舊的紀錄清掉', oldSave.cards.includes('E02') && oldSave.puzzles.E02.solved && !oldSave.puzzles.E02.tables && Object.keys(oldSave.puzzles.E02.place).length === 0, JSON.stringify(oldSave.puzzles.E02));
    await browser.close();
  }

  // 小安（文字模式走完整段）
  {
    const { browser, page, errors } = await launch();
    await page.goto(`${BASE}/?test=1`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/?test=1`);
    await page.click('#home .btn[data-open-support]');
    const sup = await page.innerText('#support-body');
    check('找支持：新增「校園霸凌」類別與 1953，不用找到小安就看得到', /校園霸凌/.test(sup) && /1953/.test(sup) && /請洽官方確認/.test(sup));
    await page.click('#support-close');
    await page.click('#home-text');
    const lines = async () => { const out = []; for (let i = 0; i < 12 && await page.isVisible('#dialogue'); i++) { out.push(await lineText(page)); if ((await page.$$('#dlg-choices button')).length) break; await page.click('#dlg-next'); await page.waitForTimeout(40); } return out.join('｜'); };
    const options = () => page.$$eval('#dlg-choices button', (bs) => bs.map((b) => b.innerText.replace(/^\d/, '').trim()));
    const pick = async (t) => { const bs = await page.$$('#dlg-choices button'); for (const b of bs) if ((await b.innerText()).includes(t)) { await b.click(); await page.waitForTimeout(60); return; } throw new Error(`沒有選項：${t}`); };
    const side = async () => (await state(page)).side.xiaoan ?? 'closed';
    const useOn = async (card) => { await text.use(page, 'xiaoan', card); await settle(page); };
    const quietText = async () => { const t = await page.innerText('#usecard-body'); await page.click('#usecard-body [data-close]'); await settle(page); return t; };

    const nav = await page.innerText('#text-mode nav.places');
    const alleyBtn = await page.innerHTML('#text-mode [data-area="alley"]');
    check('文字模式地點清單有「舊倉庫旁的窄巷」，沒有任何特殊標記', /舊倉庫旁的窄巷/.test(nav) && !/咖啡店旁的小巷/.test(nav) && !/goal-dot|cat-dot/.test(alleyBtn));
    const hintTargets = await page.evaluate(() => window.__xzj.game.hintTopics().map((t) => t.target));
    const book0 = await page.evaluate(() => { window.__xzj.ui.openCardbook(); return document.getElementById('cardbook-body').innerText; });
    const secretTile = await page.$('#cardbook-body .card-tile.secret');
    await page.click('#cardbook .panel-head button:last-child');
    check('完全不提示：麻糬、任務欄、卡冊都沒有小安的線索；隱藏卡只顯示「？」', !hintTargets.includes('xiaoan') && !/小安|小巷|窄巷|不是你的錯/.test(book0 + await page.innerText('#goal')) && !!secretTile && /0\/6/.test(await page.innerText('#cardbook-count')));

    // 沒有 E02 時
    await text.go(page, 'alley');
    await text.act(page, 'xiaoan');
    const closed = await lines();
    const closedOpts = await options();
    await pick('嗨');
    await talkThrough(page);
    check('沒有 E02 時：只說「沒事，我在等人」，選項只有打招呼與離開，不顯示缺卡提示', /沒事，我在等人/.test(closed) && closedOpts.join() === '嗨。,離開' && !(await page.isVisible('#goal-missing')), closedOpts.join('、'));

    // 用錯卡（有 K01，沒有 E02）
    await page.evaluate(() => { const g = window.__xzj.game; g.store.mutate((s) => { s.cards = ['K01']; }); g.changed(); });
    await useOn('K01');
    const wrong1 = await quietText();
    check('用其他卡：只有簡短的情境描述，沒有表情、目標或缺卡說明，卡片不消耗', /低頭看著鞋尖/.test(wrong1) && !/目前目標|你還沒有/.test(wrong1) && (await state(page)).cards.includes('K01') && await side() === 'closed', wrong1.split('\n')[0]);

    // 拿到全部六張卡（主線完成）之後：順序不對也沒有反應
    await page.evaluate(() => { const g = window.__xzj.game; g.store.mutate((s) => { s.step = 'done'; s.cards = ['K01', 'K02', 'K03', 'K04', 'E01', 'E02']; }); g.changed(); });
    await useOn('K02');
    const early = await quietText();
    await page.click('#text-mode [data-use="xiaoan"]');
    await page.click('#usecard-body [data-card="E02"]');
    const intent = await page.innerText('#usecard-body');
    check('選卡時不預覽意圖（不洩漏哪張卡才對）；順序不對時沒有反應', /試著用/.test(intent) && !/亂猜/.test(intent) && /鞋尖/.test(early));
    await page.click('#usecard-body [data-go]');
    await settle(page);
    const open = await lines();
    await pick('慢慢來');
    const beat1 = await lines();
    check('使用 E02：玩家不亂猜，小安才慢慢開口', /不想亂猜/.test(open) && /踢出班群/.test(beat1) && /想太多/.test(beat1) && await side() === 'talk');

    // 三種不合適的回應各選一次（每次都可以離開再回來）
    const bad = {};
    for (const [key, opt] of [['label', '憂鬱症'], ['ignore', '不要理他們'], ['joke', '開玩笑']]) {
      await pick(opt);
      bad[key] = await lines();
      bad[`${key}Opts`] = (await options()).join('、');
      await pick('先聊到這裡');
      await settle(page);
      await text.act(page, 'xiaoan');
      await lines();
    }
    check('「你是不是憂鬱症？」：小安縮回去，補充說明相似的感受不能判定疾病', /我只是很累/.test(bad.label) && /不能用來判定疾病/.test(bad.label));
    check('「不要理他們就好了。」：小安說試過了，補充說明', /我試過了/.test(bad.ignore) && /沒被看見/.test(bad.ignore));
    check('「他們只是開玩笑吧？」：小安沉默，補充說明', /沒有回答/.test(bad.joke) && /更難開口/.test(bad.joke));
    check('不合適的回應後可以重新回應，不扣分、不羞辱玩家；中途離開再回來從同一段繼續', /抱歉，我剛剛說太快了/.test(bad.labelOpts) && !NO_JUDGE.test(bad.label + bad.ignore + bad.joke) && await side() === 'talk');
    await pick('陪他坐一下');
    const sit = await lines();
    await talkThrough(page);
    check('先不說話陪他坐一下：小安過一會兒自己開口', /忍一下就過了/.test(sit) && await side() === 'waitK02');

    // 第二張卡：K02
    await text.act(page, 'xiaoan');
    const wait2 = await lines();
    await talkThrough(page);
    await useOn('K04');
    const wrongOrder = await quietText();
    await useOn('K02');
    const k02 = await lines();
    await pick('你覺得呢');
    await lines();
    await pick('不是你的錯');
    const notFault = await lines();
    await talkThrough(page);
    check('要接著用 K02 才繼續（沒有提示，先用 K04 沒反應）；釐清責任：「被這樣對待不是你的錯」', /沒有再說話/.test(wait2) && /鞋尖/.test(wrongOrder) && /不是事實/.test(k02) && /是不是我有問題/.test(k02) && /真的嗎/.test(notFault) && await side() === 'waitK04');

    // 重新整理後的存檔
    await reloadContinue(page);
    check('重新整理後保留小安的對話進度', await side() === 'waitK04');
    await text.go(page, 'cafe');
    await text.go(page, 'alley');

    // 第三張卡：K04
    await useOn('K04');
    const adults = await lines();
    await pick('今天就去跟老師說');
    const push = await lines();
    await pick('好，不急');
    await talkThrough(page);
    const afterPush = await side();
    await text.act(page, 'xiaoan');
    await lines();
    await pick('我不會跟任何人說');
    const secret = await lines();
    check('找可信任的大人：小安提到輔導老師和姊姊；他說「今天不想講了」時，尊重後對話結束、下次從這段繼續', /輔導老師/.test(adults) && /我姊/.test(adults) && /今天不想講了/.test(push) && afterPush === 'adults');
    check('「我不會跟任何人說」：補充說明不必承諾永遠保密', /不必承諾永遠保密/.test(secret) && /陪你想想可以跟誰說/.test(secret));
    await pick('也許就很好了');
    let end = await lineText(page);
    await page.click('#dlg-next');
    await page.waitForSelector('.card-fly', { timeout: 5000 }); // 最後一句出現時發卡
    const fly = !!(await page.$('.card-fly .rays'));
    end += await lineText(page);
    await talkThrough(page);
    let st = await state(page);
    check('收尾：也許會去輔導室看看，不寫成事情已解決；取得 H01（有取得動畫）', /也許會去輔導室/.test(secret + end) && /沒有因此解決/.test(end) && fly && st.cards.includes('H01') && st.side.xiaoan === 'done');
    const book = await page.evaluate(() => { window.__xzj.ui.openCardbook(); return document.getElementById('cardbook-body').innerText; });
    await page.click('#cardbook-body [data-card="H01"]');
    const detail = await page.innerText('#cardbook-body');
    await page.click('#cardbook .panel-head button:last-child');
    check('H01 取得後正常顯示詳情、例子、來源與審閱狀態；不計入 6/6', /不是你的錯/.test(book) && /故事裡的例子/.test(detail) && /來源/.test(detail) && /尚未完成專業審閱/.test(detail) && /6\/6/.test(await page.innerText('#cardbook-count')));

    // 之後再訪：有時在、有時不在
    const gone = !(await page.$('#text-mode [data-act="xiaoan"]'));
    await text.act(page, 'steps');
    const empty = await lines();
    await talkThrough(page);
    const visit = async () => { await text.go(page, 'cafe'); await text.go(page, 'alley'); return !!(await page.$('#text-mode [data-act="xiaoan"]')); };
    const v1 = await visit();
    await text.act(page, 'xiaoan');
    const again0 = await lines();
    await talkThrough(page);
    await useOn('E02');
    const remember = await lines();
    await talkThrough(page);
    const v2 = await visit();
    const v3 = await visit();
    await text.act(page, 'xiaoan');
    const again1 = await lines();
    await talkThrough(page);
    check('取得後再訪：小安有時在、有時不在；在的時候有一句新對話', gone && /階梯上沒有人/.test(empty) && v1 && !v2 && v3 && /輔導室/.test(again0) && /我姊/.test(again1) && again0 !== again1 && /沒有亂猜/.test(remember));
    await reloadContinue(page);
    st = await state(page);
    check('重新整理後保留 H01 與再訪紀錄', st.cards.includes('H01') && st.side.xiaoan === 'done' && st.side.xiaoanVisits === 3);
    const led = await page.evaluate(() => [1, 2, 3].map(() => window.__xzj.ui.hints().target?.id ?? '沒有'));
    check('小安的故事結束後，麻糬仍不會帶去小巷', !led.includes('xiaoan') && !led.includes('steps'), led.join('、'));
    const all = [closed, open, beat1, bad.label, bad.ignore, bad.joke, sit, k02, notFault, adults, push, secret, end, again0, again1].join('');
    check('小安的對話裡，旁白與角色都不說他有憂鬱症（只有玩家的那個選項提到），也沒有「霸凌」標籤', !/霸凌/.test(all) && !/他有憂鬱|你有憂鬱|得了憂鬱/.test(all));
    check('小安流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // 舊存檔可直接沿用；3D 裡要走進巷子才會遇到小安
  {
    const { browser, page, errors } = await launch();
    await newGame(page, '#home-text');
    // 模擬 v4.2 以前的存檔：沒有支線紀錄
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('xinzhijian.save')); delete s.side; s.step = 'thought'; s.cards = ['K01']; s.mode = '3d'; localStorage.setItem('xinzhijian.save', JSON.stringify(s)); });
    await page.reload();
    await page.waitForSelector('#home-continue:not(.hidden)');
    const msg = await page.isVisible('#home-message');
    await page.click('#home-continue');
    await page.waitForFunction(() => window.__xzj?.view()?.position, null, { timeout: 30000 });
    const st = await state(page);
    check('舊存檔（沒有支線紀錄）可直接沿用，不需重新開始', !msg && st.step === 'thought' && st.cards.includes('K01') && typeof st.side === 'object');
    // 主要步道上：畫面裡看不到小安、互動提示不會出現小安，也沒有目標記號（小安在地圖西南角舊倉庫旁的窄巷）
    const seenOnPath = [];
    for (const [x, z] of [[3.0, 13.8], [9, 15], [5, 8.4], [18, 17], [18, 21.2], [26.5, 12], [30, 18]]) {
      await page.evaluate(([px, pz]) => window.__xzj.view().teleport(px, pz), [x, z]);
      await page.waitForTimeout(1500);
      const seen = await page.evaluate(() => { const t = window.__xzj.game.target('xiaoan'); return window.__xzj.view().onScreen(t.x, 0.8, t.z); });
      const name = await page.evaluate(() => document.getElementById('interact-name').textContent);
      if (seen || name === '小安') seenOnPath.push(`${x},${z}`);
    }
    await page.evaluate(() => window.__xzj.view().teleport(3.0, 21.0));
    await page.waitForFunction(() => document.getElementById('interact-name').textContent === '小安' && !document.getElementById('interact').classList.contains('hidden'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const inCorner = await page.evaluate(() => { const t = window.__xzj.game.target('xiaoan'); const v = window.__xzj.view(); return { seen: v.onScreen(t.x, 0.8, t.z), ring: v.ringShown, x: t.x, z: t.z }; });
    const marks = await page.evaluate(() => document.querySelectorAll('.goal-mark').length);
    const goals = await page.evaluate(() => window.__xzj.game.goalTargets());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('xinzhijian.save')).area === 'alley', null, { timeout: 15000 }).catch(() => {});
    check('3D：主要步道上畫面裡看不到小安；走到西南角才會出現互動，看得到他，身上沒有光圈；沒有目標記號', !seenOnPath.length && inCorner.seen && !inCorner.ring && inCorner.x < 4 && inCorner.z > 20 && !goals.includes('xiaoan') && marks === goals.length && (await state(page)).area === 'alley', seenOnPath.join('、'));
    await page.screenshot({ path: `${process.env.OUT || '.'}/alley.png` });
    await page.keyboard.press('KeyE');
    await page.waitForSelector('#dialogue:not(.hidden)');
    check('3D：和小安對話', /制服的學生/.test(await lineText(page)));
    check('3D 小巷流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }
}

async function main() {
  const OUT = process.env.OUT || '.';
  if (process.env.ONLY === 'v43') {
    await sectionV43();
    const bad = results.filter((r) => !r.ok);
    console.log(`\n共 ${results.length} 項，通過 ${results.length - bad.length} 項，未通過 ${bad.length} 項`);
    process.exit(bad.length ? 1 : 0);
  }

  // 0. 舊名稱不得殘留
  {
    const root = path.join(__dirname, '..');
    const files = ['index.html', '3d.html', ...['content', 'src', 'src/three'].flatMap((d) => fs.readdirSync(path.join(root, d))
      .filter((f) => /\.(js|json)$/.test(f)).map((f) => `${d}/${f}`))];
    const hits = files.filter((f) => /晴隅|沐雨|阿澄|muyu|acheng|佈置/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    check('介面、對話、程式不殘留舊名（晴隅、沐雨、阿澄、佈置）', hits.length === 0, hits.join(','));
  }

  // 0b. 背景音樂：曲目檔案存在、大小合理、授權有記錄
  {
    const root = path.join(__dirname, '..');
    const music = JSON.parse(fs.readFileSync(path.join(root, 'content/music.json'), 'utf8'));
    const credits = fs.readFileSync(path.join(root, 'docs/素材來源.md'), 'utf8');
    const tracks = [...new Map(Object.values(music.tracks).filter(Boolean).map((t) => [t.file, t])).values()]; // 小巷沿用咖啡店的曲子，同一個檔案只算一次
    const bad = tracks.filter((t) => !fs.existsSync(path.join(root, t.file)) || fs.statSync(path.join(root, t.file)).size > 3 * 1024 * 1024
      || !/CC0/.test(t.license) || !t.url || !credits.includes(t.url));
    check('背景音樂曲目存在、每首小於 3 MB、CC0 授權並記錄在素材來源', tracks.length === 3 && bad.length === 0,
      tracks.map((t) => `${t.title} ${(fs.statSync(path.join(root, t.file)).size / 1048576).toFixed(1)}MB`).join('、'));
  }

  // 1. 文字模式：完整主線（親手完成兩個練習），完全不解謎也能完成
  {
    const { browser, page, errors } = await launch();
    await newGame(page, '#home-text');
    await textMainline(page);
    const s = await state(page);
    check('文字模式主線完成（不解謎也能完成）', s.step === 'done' && ['K01', 'K02', 'K03', 'K04'].every((k) => s.cards.includes(k)) && !s.cards.includes('E01'),
      `step=${s.step} cards=${s.cards.join(',')}`);
    check('練習親手完成才記錄', s.practice.thought === 1 && s.practice.present === 1, JSON.stringify(s.practice));
    check('兩人各自的小決定依選擇記錄', s.flags.adeSit && !s.flags.xqSent, JSON.stringify(s.flags));

    // 文字模式的謎題：兩題各故意放錯三次再完成
    await text.go(page, 'cafe');
    await lookAt(page, 't2', SPOTS.t2);
    const tableText = await page.innerText('#puzzle-body .text-list');
    const tx1 = await tryCode(page, [3, 2, 1]);
    check('文字模式 E02：查看桌子的文字描述；拉不開時說明哪一格不對，不出現對錯字樣', /火車誤點/.test(tableText) && /第一格/.test(tx1) && /好像不只是看到的那樣/.test(tx1) && !NO_JUDGE.test(tx1.replace(/不對/g, '')), tx1);
    await tryCode(page, CODE);
    await page.click('#puzzle-body [data-done]');
    const solvedText = await page.innerText('#puzzle-body');
    check('文字模式完成 E02，說明「可以問，也可以等對方說」', /可以問，也可以等對方說/.test(solvedText) && (await state(page)).cards.includes('E02'));
    await page.click('#puzzle-body [data-close]');

    // 文字模式的麻糬：按一下就說明牠走去哪裡坐下，沒有選單
    await page.click('#text-mode [data-hint]');
    await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => /麻糬/.test(t.textContent)));
    const said = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).filter((t) => /麻糬/.test(t)).pop());
    const noMenu = !(await page.$('dialog[open]'));
    await text.go(page, 'garden');
    const marked = await page.innerText('#text-mode li.marked').catch(() => '');
    check('文字模式「問問麻糬」：沒有選單，麻糬自己走到還沒解開的謎題旁坐下', noMenu && /往小花園/.test(said) && /三盆植物/.test(said) && /麻糬坐在旁邊/.test(marked), `${said}｜${marked.split('\n')[0]}`);
    await text.go(page, 'garden');
    await text.act(page, 'pots');
    const plantWrongs = [];
    for (const [item, slot] of [['mint', 'shade'], ['fern', 'wet'], ['rosemary', 'eaves']]) {
      await place(page, item, slot);
      plantWrongs.push(await caption(page));
    }
    check('文字模式 E01 放錯三次：描述植物的反應，不直接寫答案', plantWrongs.every((w) => w.length > 10 && !NO_JUDGE.test(w) && !/向陽|半陰|遮蔭/.test(w)), plantWrongs.join('｜'));
    for (const [item, slot] of Object.entries(E01)) await place(page, item, slot);
    await page.waitForSelector('#puzzle-body .solved');
    check('文字模式解開 E01，說明「需要不同，沒有哪個比較好」', /需要不同，沒有哪個比較好/.test(await page.innerText('#puzzle-body')) && (await state(page)).cards.includes('E01'));
    await page.click('#puzzle-body [data-close]');
    check('文字模式無錯誤', errors.length === 0, errors.join(' | '));
    await page.screenshot({ path: `${OUT}/text-garden.png` });
    await browser.close();
  }

  // 2. 3D 模式：走路與碰撞、主線、練習、用卡、謎題、麻糬、每個階段重新整理
  {
    const { browser, page, errors } = await launch();
    await newGame(page);
    await page.waitForFunction(() => window.__xzj?.view()?.position, null, { timeout: 30000 });
    const p0 = await page.evaluate(() => window.__xzj.view().position);
    const p1 = await holdUntilStopped(page, 'ArrowUp');
    check('3D 可用鍵盤移動', p1.z < p0.z - 3, `z ${p0.z.toFixed(2)} → ${p1.z.toFixed(2)}`);
    check('3D 不能穿過公布欄（主要障礙）', p1.z > 9.65, `停在 z=${p1.z.toFixed(2)}`);
    await page.evaluate(() => window.__xzj.view().teleport(18, 17));
    const p2 = await holdUntilStopped(page, 'ArrowDown');
    check('3D 不能走出地圖', p2.z > 20 && p2.z <= 21.23, `z=${p2.z.toFixed(2)}`);

    const go = async (id, dx = 0, dz = 1.1) => {
      const name = await page.evaluate(([id, dx, dz]) => {
        const t = window.__xzj.game.target(id);
        window.__xzj.view().teleport(t.x + dx, t.z + dz);
        return t.name;
      }, [id, dx, dz]);
      await page.waitForFunction((n) => document.getElementById('interact-name').textContent === n
        && !document.getElementById('interact').classList.contains('hidden'), name, { timeout: 30000 });
    };
    const pressE = async () => {
      await page.waitForSelector('#interact:not(.hidden)', { timeout: 30000 });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(120);
    };

    await go('board', 0, 0.9);
    await pressE();
    await talkThrough(page, ['先去咖啡店']);
    await go('xiaoqing');
    await pressE();
    await talkThrough(page, ['工作時別一直看手機', '想聊聊嗎', '你最近還好嗎', '你想說多少', '謝謝你願意']);
    let s = await state(page);
    check('先問才拿到 K01（給建議會被帶回「先問」；揭露段可選、不額外發獎）', s.cards.join() === 'K01' && s.step === 'thought');

    await go('note', 0, 1.0);
    await pressE();
    await talkThrough(page, ['開始']);
    await page.waitForSelector('#minigame[open]');
    const noSummary = !(await page.$('#minigame-body [data-sum]'));
    await page.click('#minigame .panel-head button:last-child');
    s = await state(page);
    check('想法放大鏡沒有「看摘要拿卡」；中途離開不發卡', noSummary && !s.cards.includes('K02') && s.step === 'thought');
    await pressE();
    await talkThrough(page, ['開始']);
    const { hint, result } = await playThought(page);
    check('想法放大鏡：猜測放不進「確定知道的事」，只提示方向', /腦中想的/.test(hint), hint);
    check('想法放大鏡：結果保留「目前還不知道」', /目前還不知道/.test(result));
    await talkThrough(page);
    s = await state(page);
    check('親手完成想法放大鏡取得 K02', s.cards.includes('K02') && s.step === 'clarify' && s.practice.thought === 1);
    await reloadContinue(page);
    check('發卡後重整可恢復', (await state(page)).step === 'clarify');

    await go('xiaoqing');
    await useCard(page, () => page.keyboard.press('KeyF'), 'K01');
    const na = await page.innerText('#usecard-body');
    check('不適用卡：有說明與目前目標、不推進、不消耗', /目前目標/.test(na) && (await state(page)).step === 'clarify');
    await page.click('#usecard-body [data-again]');
    await page.click('#usecard-body [data-card="K02"]');
    await page.click('#usecard-body [data-go]');
    await talkThrough(page, ['比較安心']);
    s = await state(page);
    check('用卡點 1：對曉晴用 K02，由她自己決定（傳一句輕鬆的）', s.step === 'askAde' && s.flags.xqSent && s.cards.includes('K02'));
    await reloadContinue(page);
    check('用卡後重整可恢復', (await state(page)).step === 'askAde');

    await go('ade');
    await useCard(page, () => page.click('#interact-use'), 'K01');
    await talkThrough(page, ['一起試試']);
    await page.waitForSelector('#minigame[open]');
    await page.click('#minigame-body [data-go]');
    await page.click('#minigame-body [data-opt="1"]');
    await page.click('#minigame-body [data-stop]');
    s = await state(page);
    check('回到這座花園：「先停在這裡」可以隨時離開，不發卡', !s.cards.includes('K03') && s.step === 'present');
    await pressE();
    await talkThrough(page, ['一起試試']);
    const bubbles = await playPresent(page);
    await talkThrough(page);
    s = await state(page);
    check('回到這座花園：三次念頭冒出、看見後回到花園，完成取得 K03', bubbles === 3 && s.cards.includes('K03') && s.step === 'tonight');

    await go('bench', 0, 0.9);
    await useCard(page, () => page.keyboard.press('KeyF'), 'K03');
    await talkThrough(page, ['回一句']);
    s = await state(page);
    check('用卡點 3：在長椅陪阿德決定今晚的一小步', s.step === 'wrap' && s.flags.adeReply);
    await reloadContinue(page);

    await go('ade');
    await pressE();
    const adeWrap = [];
    for (let i = 0; i < 4 && await page.isVisible('#dialogue'); i++) { adeWrap.push(await lineText(page)); await page.click('#dlg-next'); await page.waitForTimeout(40); }
    await talkThrough(page);
    await go('xiaoqing');
    await pressE();
    await talkThrough(page, ['繼續逛逛']);
    s = await state(page);
    check('收尾保留「目前還不知道」，不寫成誤會解開', adeWrap.join('').includes('目前還不知道'), adeWrap[1]);
    check('3D 主線完成並取得 K04', s.step === 'done' && s.cards.includes('K04'));
    await reloadContinue(page);
    s = await state(page);
    check('結尾後重整可恢復、無重複獎勵', s.step === 'done' && s.rewards.length === 4 && new Set(s.cards).size === s.cards.length);

    // 麻糬：3D 裡靠近牠互動，牠就自己走到該去的地方（不跳選單）
    await page.waitForFunction(() => {
      const v = window.__xzj.view();
      return v && document.querySelector('.cat-tag');
    });
    const catPos0 = await page.evaluate(() => window.__xzj.view().catPosition);
    await page.evaluate(() => window.__xzj.ui.hints());
    const guide = await page.evaluate(() => window.__xzj.view().catGuide);
    const noPanel = !(await page.$('dialog[open]'));
    await page.waitForTimeout(4000);
    const catPos1 = await page.evaluate(() => window.__xzj.view().catPosition);
    const pots = await page.evaluate(() => window.__xzj.game.target('pots'));
    check('3D 問麻糬：沒有選單，牠自己往花園謎題走去', noPanel && guide && Math.hypot(guide.x - pots.x, guide.z - pots.z) < 1.2 && Math.hypot(catPos1.x - catPos0.x, catPos1.z - catPos0.z) > 0.3,
      `麻糬 (${catPos0.x.toFixed(1)},${catPos0.z.toFixed(1)}) → (${catPos1.x.toFixed(1)},${catPos1.z.toFixed(1)})，目的地在三盆植物旁`);
    await page.evaluate(() => window.__xzj.ui.hints());
    const next = await page.evaluate(() => window.__xzj.view().catGuide);
    const tables = await page.evaluate(() => window.__xzj.game.target('table1'));
    check('再問一次麻糬：換到下一個地方（咖啡店外的謎題）', next && Math.hypot(next.x - tables.x, next.z - tables.z) < 1.2);

    // 謎題 E01（插畫版）：故意放錯三次（一次用拖曳），中途離開、重整後位置仍在，再全部放對
    await go('pots', 0, 0.6);
    await pressE();
    const e01w = [];
    let cap = await caption(page);
    for (const [item, slot, how] of [['mint', 'shade', { drag: true }], ['rosemary', 'wall', {}], ['fern', 'sun', {}]]) {
      await place(page, item, slot, how);
      cap = await reaction(page, cap);
      e01w.push(cap);
    }
    const tilted = await page.evaluate(() => document.querySelector('#puzzle .cat')?.classList.contains('tilt'));
    const droopy = await page.evaluate(() => document.querySelector('#puzzle .pot[data-item="fern"] .plant')?.getAttribute('class'));
    check('E01 放錯三次（含拖曳）：約 2 秒後植物有反應、麻糬歪頭，不出現對錯字樣', e01w.every((w) => w.length > 10 && !NO_JUDGE.test(w)) && tilted && /r-curl/.test(droopy), e01w.join('｜'));
    check('E01 容易猜錯的薄荷：放到樹蔭下時提示去看第二個線索（土）', /土還是乾的/.test(e01w[0]), e01w[0]);
    await page.click('#puzzle-body [data-later]');
    await reloadContinue(page);
    s = await state(page);
    check('謎題中途離開、重整後保留已擺的位置', s.puzzles.E01.place.mint === 'shade' && s.puzzles.E01.place.fern === 'sun' && !s.puzzles.E01.solved, JSON.stringify(s.puzzles.E01.place));
    await go('pots', 0, 0.6);
    await pressE();
    const restored = await page.evaluate(() => document.querySelector('#puzzle .pot[data-item="mint"] .plant')?.getAttribute('class'));
    for (const [item, slot] of Object.entries(E01)) {
      cap = await caption(page);
      await place(page, item, slot);
      cap = await reaction(page, cap);
    }
    const bloomed = await page.evaluate(() => [...document.querySelectorAll('#puzzle .plant')].every((p) => p.classList.contains('r-bloom')));
    await page.waitForSelector('#puzzle-body .solved', { timeout: 15000 });
    const e01 = await page.innerText('#puzzle-body');
    await page.click('#puzzle-body [data-close]');
    check('E01 重新打開時植物仍保留反應；三盆都合適才取得卡片，說明「需要不同，沒有哪個比較好」', /r-droop/.test(restored) && bloomed && /需要不同，沒有哪個比較好/.test(e01) && (await state(page)).cards.includes('E01'));
    await page.screenshot({ path: `${OUT}/3d-pots-solved.png` });

    // 謎題 E02（插畫版）：麻糬的三層提示，走到桌子旁查看，再去開鎖
    const hints = await page.evaluate(() => { const g = window.__xzj.game; const out = []; for (let i = 0; i < 8 && out.length < 3; i++) { const r = g.catHint(); if (r.target?.id === 'table2') out.push({ text: r.text, at: !!r.at }); } return { out, mark: g.lockMark }; });
    check('麻糬對密碼鎖的三層提示：走到桌子 → 坐到還沒看的地方旁 → 直接標出那個地方', hints.out.length === 3 && !hints.out[0].at && hints.out[1].at && /翻開收據背面/.test(hints.out[1].text) && /拍了拍/.test(hints.out[2].text) && hints.mark === 't2a', JSON.stringify(hints));
    await go('table2', 0, 0.9);
    await pressE();
    await page.waitForSelector('#puzzle[open] .stage.table-close');
    const pawShown = await page.evaluate(() => !!document.querySelector('#puzzle .spot.marked .paw'));
    check('第三層提示：桌子特寫上標出麻糬拍過的地方', pawShown);
    for (const sp of SPOTS.t2) await page.click(`#puzzle .spot[data-spot="${sp}"] .spot-hit`, { force: true });
    await page.click('#puzzle .panel-head button:last-child');
    await settle(page);
    await go('lockbox', 0, 0.7);
    await pressE();
    await page.waitForSelector('#puzzle[open] .lock-body');
    await tryCode(page, CODE);
    await page.waitForSelector('#puzzle-body .box-items', { timeout: 10000 });
    await page.click('#puzzle-body [data-done]');
    await page.waitForSelector('#puzzle-body .solved');
    await page.click('#puzzle-body [data-close]');
    s = await state(page);
    check('謎題 E02 在 3D 解開', s.puzzles.E02.solved && s.cards.includes('E02'));
    await reloadContinue(page);
    s = await state(page);
    check('解謎後重整可恢復、卡片不重複', s.puzzles.E01.solved && s.puzzles.E02.solved && s.cards.length === 6 && new Set(s.cards).size === 6);

    await go('xiaoqing');
    await useCard(page, () => page.keyboard.press('KeyF'), 'E01');
    const e01talk = await lineText(page);
    await talkThrough(page, ['還不確定']);
    check('E01 分支：和曉晴聊各自喜歡的相處方式', /需要的空間/.test(e01talk));
    await go('ade');
    await useCard(page, () => page.keyboard.press('KeyF'), 'E02');
    const e02talk = await lineText(page);
    await talkThrough(page);
    check('E02 分支：和阿德聊「不要急著下結論」', /處境|分心/.test(e02talk));
    await useCard(page, () => page.keyboard.press('KeyF'), 'K04');
    await talkThrough(page, ['好。']);
    check('K04：主線後聊「需要的時候可以找誰」', (await state(page)).used.includes('next-support-ade'));

    const nothing = await page.evaluate(() => window.__xzj.ui.hints().text);
    check('全部完成後麻糬只打呵欠', /呵欠/.test(nothing));

    await page.click('#hud-buttons [data-open-settings]');
    await page.click('#settings-body [data-mode="text"]');
    await page.waitForSelector('#text-mode h2');
    check('3D 切換到文字模式共用進度', (await state(page)).cards.length === 6 && /微光里/.test(await page.innerText('#text-mode h2')));
    check('3D 流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // 3. 防卡關：異常存檔補回必要卡；缺卡時顯示取得來源；謎題、找支持不擋主線
  {
    const { browser, page } = await launch();
    await newGame(page, '#home-text');
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('xinzhijian.save'));
      s.step = 'tonight';
      s.cards = ['K01'];
      s.puzzles.E02.solved = true;
      localStorage.setItem('xinzhijian.save', JSON.stringify(s));
    });
    await page.reload();
    const s = await state(page);
    check('異常存檔補回必要卡與已解謎題的卡（不補發未達條件的卡）', ['K01', 'K02', 'K03', 'E02'].every((k) => s.cards.includes(k)) && !s.cards.includes('K04') && !s.cards.includes('E01'), s.cards.join(','));
    await page.click('#home-continue');
    await page.evaluate(() => {
      const g = window.__xzj.game;
      g.s.step = 'clarify';
      g.s.cards = ['K01'];
      g.changed();
    });
    const miss = await page.innerText('#goal-missing');
    check('缺少必要卡時顯示取得來源', /便條/.test(miss), miss);
    await page.click('#cardbook-button');
    await page.click('#cardbook-body [data-card="E01"]');
    const locked = await page.innerText('#cardbook-body');
    check('卡冊保留文字線索，沒有「顯示位置」按鈕', /木架前/.test(locked) && !(await page.$('#cardbook-body [data-locate]')));
    await browser.close();
  }

  // 4. 首頁：v1 舊存檔、找支持、清除進度
  {
    const { browser, page, errors } = await launch();
    await page.goto(`${BASE}/`);
    await page.evaluate(() => localStorage.setItem('xinzhijian.save', JSON.stringify({ version: 1, step: 'arrange' })));
    await page.reload();
    await page.waitForSelector('#home-message:not(.hidden)');
    const msg = await page.innerText('#home-message');
    check('v1 舊存檔：清楚告知改版、提供重新開始', /改版/.test(msg) && /重新開始/.test(msg) && await page.isVisible('#home-new'), msg.split('\n')[0]);
    await page.click('#home .btn[data-open-support]');
    const sup = await page.innerText('#support-body');
    check('不玩遊戲也能開啟找支持', /1925/.test(sup) && /最後查核/.test(sup));
    await page.click('#support-close');
    await page.click('#home-new');
    await page.waitForTimeout(500);
    const backup = await page.evaluate(() => localStorage.getItem('xinzhijian.save.unreadable'));
    check('舊進度先備份，不默默丟棄', backup && backup.includes('arrange'));
    await page.click('#hud-buttons [data-open-settings]');
    await page.click('#settings-body [data-act="clear"]');
    const confirmShown = await page.isVisible('#confirm[open]');
    await page.click('#confirm-cancel');
    check('清除進度前需確認', confirmShown && await page.evaluate(() => !!localStorage.getItem('xinzhijian.save')));
    const keys = await page.evaluate(() => Object.keys(localStorage));
    check('只在本機儲存進度與設定', keys.every((k) => k.startsWith('xinzhijian.')), keys.join(','));
    check('首頁流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // 5. 3D 無法載入時改用文字模式
  {
    const { browser, page } = await launch({ offline3d: true });
    await page.goto(`${BASE}/`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click('#home-new');
    await page.waitForSelector('#text-mode h2', { timeout: 15000 });
    check('3D 載入失敗時自動提供文字模式', (await page.evaluate(() => document.body.dataset.mode)) === 'text');
    await browser.close();
  }

  // 6. 手機觸控
  {
    const { browser, page, errors } = await launch({ mobile: true });
    await newGame(page);
    await page.waitForFunction(() => window.__xzj?.view()?.position, null, { timeout: 30000 });
    const p0 = await page.evaluate(() => window.__xzj.view().position);
    const box = await page.locator('#stick').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 50, { steps: 4 });
    await page.waitForFunction((z) => window.__xzj.view().position.z < z - 1, p0.z, { timeout: 40000 }).catch(() => {});
    await page.mouse.up();
    const p1 = await page.evaluate(() => window.__xzj.view().position);
    check('手機搖桿可移動', p1.z < p0.z - 1, `z ${p0.z.toFixed(2)} → ${p1.z.toFixed(2)}`);
    await page.evaluate(() => window.__xzj.view().teleport(18, 10.5));
    await page.waitForFunction(() => document.getElementById('interact-name').textContent === '公布欄', null, { timeout: 30000 });
    await page.tap('#interact-go');
    check('手機互動按鈕可開啟對話；對話時隱藏搖桿', await page.isVisible('#dialogue') && !(await page.isVisible('#stick')));
    await talkThrough(page, ['先去咖啡店']);
    // 手機上的謎題面板
    await page.evaluate(() => {
      const t = window.__xzj.game.target('lockbox');
      window.__xzj.view().teleport(t.x, t.z + 0.6);
    });
    await page.waitForFunction(() => document.getElementById('interact-name').textContent === '失物招領箱', null, { timeout: 30000 });
    await page.tap('#interact-go');
    await page.waitForSelector('#puzzle[open]');
    await page.locator('#puzzle .dial[data-i="0"] [data-step="1"]').tap();
    await page.screenshot({ path: `${OUT}/mobile-puzzle.png` });
    const p2 = await page.evaluate(() => window.__xzj.view().position);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 50, { steps: 4 });
    await page.waitForTimeout(800);
    await page.mouse.up();
    const p3 = await page.evaluate(() => window.__xzj.view().position);
    check('手機用點選操作謎題；面板開啟時角色不會誤走動', (await state(page)).puzzles.E02.dial?.[0] === 1 && Math.abs(p3.z - p2.z) < 0.01);
    check('手機流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }
  {
    // 金卡與卡冊分區、提示訊息條上限、許願池留言（本機用假的收件端）
    const { browser, page, errors } = await launch();
    await newGame(page, '#home-text');
    const book = await page.evaluate(() => {
      const x = window.__xzj;
      const read = () => ({
        heads: [...document.querySelectorAll('#cardbook-body .section-head')].map((h) => h.innerText.replace(/\s+/g, ' ')),
        secret: document.querySelectorAll('#cardbook-body .hidden-cards .card-tile.secret').length,
        gold: [...document.querySelectorAll('#cardbook-body .card-tile.gold')].map((g) => g.innerText),
      });
      x.ui.openCardbook();
      const before = read();
      document.getElementById('cardbook').close();
      x.game.store.mutate((s) => { s.cards.push('H01'); });
      x.game.changed();
      x.ui.openCardbook();
      const after = read();
      document.getElementById('cardbook').close();
      return { before, after, hud: document.getElementById('cardbook-count').textContent };
    });
    check('卡冊分成理解卡與隱藏卡兩區，進度分開；取得前隱藏卡只是「？」、不是金色', book.before.heads.join('｜') === '理解卡 0/6｜隱藏卡 0/1' && book.before.secret === 1 && book.before.gold.length === 0, JSON.stringify(book.before));
    check('已有 H01 的存檔：直接顯示為金卡、以「金卡」文字標示；卡冊按鈕的進度不算隱藏卡', book.after.gold.length === 1 && /金卡/.test(book.after.gold[0]) && book.after.heads[1] === '隱藏卡 1/1' && book.hud === '0/6', JSON.stringify(book));
    const toasts = await page.evaluate(async () => {
      for (let i = 1; i <= 8; i++) window.__xzj.ui.toast(`訊息 ${i}`, { ms: 8000 });
      await new Promise((r) => setTimeout(r, 900));
      return [...document.querySelectorAll('#toasts .toast')].map((e) => e.innerText);
    });
    check('連續 8 則提示訊息：畫面上最多 5 行，最舊的先消失', toasts.length === 5 && toasts[0] === '訊息 4' && toasts[4] === '訊息 8', toasts.join('、'));
    // 許願池（文字模式在廣場的地點清單裡）
    await text.act(page, 'wishpool');
    await page.waitForSelector('#wish[open]');
    const panel = await page.innerText('#wish');
    check('許願池：文字模式以一行描述丟硬幣；面板寫明只有製作者看得到、不是求助管道、不要寫個資', /丟出一枚硬幣/.test(panel) && /只有製作者看得到/.test(panel) && /不是求助管道/.test(panel) && /不要寫下姓名/.test(panel), panel);
    check('許願池：空白不能送出', await page.isDisabled('#wish-send'));
    await page.fill('#wish-text', '   ');
    check('許願池：只有空白也不能送出', await page.isDisabled('#wish-send'));
    await page.fill('#wish-text', '字'.repeat(250));
    check('許願池：最多 200 字，顯示剩餘字數', (await page.inputValue('#wish-text')).length === 200 && /還可以寫 0 字/.test(await page.innerText('#wish-count')));
    await page.click('#wish [data-open-support]');
    check('許願池：「現在想找人談談」打開找支持', await page.isVisible('#support[open]'));
    await page.click('#support-close');
    await page.context().setOffline(true);
    await page.fill('#wish-text', '希望麻糬多一點動作');
    await page.click('#wish-send');
    await page.waitForFunction(() => /沒有送成功/.test(document.getElementById('wish-status').textContent), null, { timeout: 10000 });
    check('許願池：斷網時送不出去，保留文字，不影響遊戲', (await page.inputValue('#wish-text')) === '希望麻糬多一點動作');
    await page.context().setOffline(false);
    await page.click('#wish-send');
    await page.waitForSelector('#wish-done:not(.hidden)', { timeout: 10000 });
    check('許願池：送出成功顯示「願望收到了，謝謝你告訴我們」', /願望收到了，謝謝你告訴我們/.test(await page.innerText('#wish-done')));
    const sent = await page.evaluate(() => JSON.parse(localStorage.getItem('xinzhijian.wish.fake') || '[]'));
    check('許願池：只送出留言文字（假的收件端只收到文字與時間）', sent.length === 1 && Object.keys(sent[0]).sort().join() === 'created_at,id,is_read,message' && sent[0].message === '希望麻糬多一點動作', JSON.stringify(sent));
    await page.click('#wish-ok');
    await text.act(page, 'wishpool');
    await page.waitForSelector('#wish[open]');
    await page.fill('#wish-text', '再一則');
    await page.click('#wish-send');
    check('許願池：30 秒內再送會請玩家稍等，文字保留', /秒後可以再送/.test(await page.innerText('#wish-status')) && (await page.inputValue('#wish-text')) === '再一則');
    await page.click('#wish-skip');
    check('許願池：「只許願，不留言」直接關閉', !(await page.isVisible('#wish[open]')));
    const progress = await page.evaluate(() => JSON.stringify(window.__xzj.store.data));
    check('許願池：硬幣與留言都不寫進遊戲進度', !/wish|coin|希望麻糬/.test(progress));
    check('金卡、訊息條、許願池流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // 7. 第二輪：背景音樂、繪製呼叫、省電畫質、手機預設省電
  {
    // 測試用的 1 秒靜音 WAV，代替真正的曲目（曲目檔由 content/music.json 指定）
    const wav = (() => {
      const rate = 8000; const n = rate; const buf = Buffer.alloc(44 + n * 2);
      buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
      buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
      buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
      return buf;
    })();
    const { browser, context, page, errors } = await launch();
    await context.route('**/content/music.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      duck: 0.3, fade: 0.2, default: null,
      tracks: { plaza: { file: 'assets/audio/_test-plaza.wav' }, cafe: { file: 'assets/audio/_test-cafe.wav' }, garden: { file: 'assets/audio/_test-garden.wav' } },
    }) }));
    await context.route('**/assets/audio/_test-*.wav', (route) => route.fulfill({ contentType: 'audio/wav', body: wav }));
    await page.goto(`${BASE}/?test=1`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/?test=1`);
    await page.waitForSelector('#home-new');
    check('首頁還沒播放音樂', !(await page.evaluate(() => window.__xzj.music.playing)));
    await page.click('#home-text');
    await page.waitForFunction(() => window.__xzj.music.playing, null, { timeout: 10000 }).catch(() => {});
    check('按下開始後才播放音樂', await page.evaluate(() => window.__xzj.music.playing));
    const src0 = await page.evaluate(() => [...document.querySelectorAll('audio')].length);
    await text.go(page, 'garden');
    await page.waitForTimeout(800);
    const vols = await page.evaluate(() => window.__xzj.music.volume);
    check('換區時切換曲目（淡入淡出）', vols > 0.3, `音量 ${vols.toFixed(2)}，audio 元素 ${src0}`);
    // 「回到這座花園」降低音量
    await page.evaluate(() => {
      const g = window.__xzj.game;
      g.store.mutate((s) => { s.step = 'present'; s.cards = ['K01', 'K02']; });
      g.changed();
    });
    await text.act(page, 'ade');
    await talkThrough(page, ['一起試試']);
    await page.waitForSelector('#minigame[open]');
    await page.waitForTimeout(800);
    const ducked = await page.evaluate(() => window.__xzj.music.volume);
    await page.click('#minigame .panel-head button:last-child');
    await page.waitForTimeout(800);
    const back = await page.evaluate(() => window.__xzj.music.volume);
    check('進入「回到這座花園」自動降低音量，離開後恢復', ducked < 0.2 && back > 0.4, `${ducked.toFixed(2)} → ${back.toFixed(2)}`);
    // 設定：音樂開關與音量，重整後記得
    await page.click('#hud-buttons [data-open-settings]');
    await page.fill('#music-volume', '0.2');
    await page.dispatchEvent('#music-volume', 'change');
    await page.click('#settings-body [data-key="music"][data-value="false"]');
    await page.click('#settings .panel-head button:last-child');
    await page.waitForTimeout(800);
    check('關閉音樂後停止', (await page.evaluate(() => window.__xzj.music.volume)) < 0.01);
    await page.reload();
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('xinzhijian.settings')));
    check('音樂開關與音量重整後記得', st.music === false && Math.abs(st.musicVolume - 0.2) < 0.001, JSON.stringify(st));
    check('音樂流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }
  {
    // 真正的曲目：開始遊戲後實際播放
    const { browser, page, errors } = await launch();
    await newGame(page, '#home-text');
    await page.waitForFunction(() => window.__xzj.music.playing, null, { timeout: 15000 }).catch(() => {});
    const src = await page.evaluate(() => window.__xzj.music.playing);
    await text.go(page, 'cafe');
    await page.waitForTimeout(2500);
    const v = await page.evaluate(() => window.__xzj.music.volume);
    check('實際播放真正的曲目，換到咖啡店外後淡入', src && v > 0.4, `音量 ${v.toFixed(2)}`);
    check('真正曲目播放無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }
  {
    const { browser, page } = await launch();
    await newGame(page);
    await page.waitForFunction(() => window.__xzj?.view()?.position, null, { timeout: 30000 });
    const calls = {};
    for (const [n, x, z] of [['小廣場', 18, 15], ['咖啡店外', 6, 11], ['小花園', 30, 13]]) {
      await page.evaluate(([x, z]) => window.__xzj.view().teleport(x, z), [x, z]);
      await page.waitForTimeout(2500);
      calls[n] = await page.evaluate(() => window.__xzj.view().drawCalls);
      await page.screenshot({ path: `${OUT}/r2-${n}.png` });
    }
    check('每個區域的繪製呼叫少於 200', Object.values(calls).every((c) => c > 0 && c < 200), JSON.stringify(calls));
    await page.click('#hud-buttons [data-open-settings]');
    await page.click('#settings-body [data-key="quality"][data-value="low"]');
    await page.click('#settings .panel-head button:last-child');
    await page.waitForTimeout(1500);
    const qy = await page.evaluate(() => window.__xzj.view().quality);
    check('省電畫質：關陰影、隱藏小裝飾、像素比 1', !qy.shadows && !qy.details && qy.pixelRatio === 1, JSON.stringify(qy));
    // 場景優化（小廣場）：低畫質隱藏遠景；小互動、樹冠半透明、隱藏角色的名牌
    const amb = await page.evaluate(() => window.__xzj.view().ambient);
    check('低畫質：隱藏邊界外的遠景', amb.far === false, JSON.stringify(amb));
    const toyState = await page.evaluate(async () => {
      const v = window.__xzj.view();
      const before = JSON.stringify(window.__xzj.store.data);
      const lines = v.toys().map((t) => v.poke(t.id));
      v.teleport(18, 16.2);
      await new Promise((r) => setTimeout(r, 800));
      const name = document.getElementById('interact-name').textContent;
      v.teleport(18, 10.5);
      await new Promise((r) => setTimeout(r, 800));
      const board = document.getElementById('interact-name').textContent;
      v.teleport(21.4, 4.8);
      await new Promise((r) => setTimeout(r, 1500));
      const canopy = v.ambient.canopyOpacity;
      v.teleport(3.0, 13.8);
      await new Promise((r) => setTimeout(r, 800));
      const tagFar = v.tagShown('xiaoan');
      return { lines, name, board, canopy, tagFar, same: before === JSON.stringify(window.__xzj.store.data) };
    });
    check('小互動：每個都有一行字，而且不寫進存檔', toyState.lines.length >= 8 && toyState.lines.every(Boolean) && toyState.same, JSON.stringify(toyState));
    check('小互動：靠近許願池可以互動；公布欄旁仍以公布欄優先', toyState.name === '許願池' && toyState.board === '公布欄', JSON.stringify(toyState));
    check('走到榕樹後面時樹冠變半透明', toyState.canopy < 0.6, String(toyState.canopy));
    check('隱藏角色的名牌：在主要步道上不顯示', toyState.tagFar === false, String(toyState.tagFar));
    await browser.close();
  }
  {
    const { browser, page } = await launch({ mobile: true });
    await page.goto(`${BASE}/?test=1`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/?test=1`);
    await page.waitForSelector('#home-new');
    const q = await page.evaluate(() => JSON.parse(localStorage.getItem('xinzhijian.settings'))?.quality);
    check('手機第一次開啟時預設省電畫質', q === 'low', q);
    await browser.close();
  }

  // 8. 手感與回饋（v4.1）：逐字對話、表情、卡片動畫、音效開關、減少動畫、聽風鈴時靜音、字體與文字大小
  {
    const { browser, page, errors } = await launch();
    await page.addInitScript(() => {
      window.__sfx = [];
      document.addEventListener('sfx', (e) => window.__sfx.push(e.detail));
    });
    await newGame(page);
    await page.waitForFunction(() => window.__xzj?.view()?.position, null, { timeout: 30000 });
    // 走路：腳步聲（音效預設開啟）
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => window.__sfx.some((x) => x.name === 'step'), null, { timeout: 30000 }).catch(() => {});
    await page.keyboard.up('ArrowUp');
    const steps = await page.evaluate(() => window.__sfx.filter((x) => x.name === 'step'));
    check('音效預設開啟；走路有腳步聲', steps.length > 0 && steps.every((x) => x.audible), `${steps.length} 次`);
    // 靠近：光圈與提示音
    await page.evaluate(() => { const t = window.__xzj.game.target('xiaoqing'); window.__xzj.view().teleport(t.x, t.z + 1.1); });
    await page.waitForFunction(() => window.__sfx.some((x) => x.name === 'near'), null, { timeout: 30000 }).catch(() => {});
    check('靠近可互動的人：有提示音與發光光圈', await page.evaluate(() => window.__sfx.some((x) => x.name === 'near')) && await page.evaluate(() => window.__xzj.view().ringShown));
    // 麻糬：靠近、點牠時都沒有光圈（帶路功能不變）
    await page.evaluate(() => { const c = window.__xzj.view().catPosition; window.__xzj.view().teleport(18, 17); });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const c = window.__xzj.view().catPosition; window.__xzj.view().teleport(c.x + 0.8, c.z); });
    await page.waitForFunction(() => document.getElementById('interact-name').textContent === '橘貓麻糬', null, { timeout: 30000 }).catch(() => {});
    const catNear = await page.evaluate(() => ({ name: document.getElementById('interact-name').textContent, ring: window.__xzj.view().ringShown }));
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    const catAfter = await page.evaluate(() => ({ ring: window.__xzj.view().ringShown, guide: window.__xzj.view().catGuide }));
    check('靠近麻糬、問麻糬時都沒有光圈；麻糬照樣帶路', catNear.name === '橘貓麻糬' && !catNear.ring && !catAfter.ring && !!catAfter.guide, JSON.stringify({ catNear, catAfter }));
    await page.evaluate(() => { const t = window.__xzj.game.target('xiaoqing'); window.__xzj.view().teleport(t.x, t.z + 1.1); });
    await page.waitForFunction(() => document.getElementById('interact-name').textContent === '曉晴', null, { timeout: 30000 }).catch(() => {});
    // 對話：逐字出現、點一下顯示整句、表情圖示
    await page.waitForSelector('#interact:not(.hidden)');
    await page.keyboard.press('KeyE');
    await page.waitForSelector('#dialogue:not(.hidden)');
    await page.waitForTimeout(60);
    const partial = await page.innerText('#dlg-text');
    await page.click('#dlg-text');
    const full = await page.innerText('#dlg-text');
    const emote = await page.$('#dlg-name svg');
    const bubble = await page.$('#labels .emote');
    check('對話文字逐字出現，點一下顯示整句', partial.length < full.length && /新搬來/.test(full), `${partial.length} → ${full.length} 字`);
    check('說話者有表情圖示氣泡（名牌旁與頭上）', !!emote && !!bubble);
    // 取得 K01：卡片飛入動畫，點一下可略過
    await talkThrough(page, ['想聊聊嗎', '一直想']);
    const flew = await page.evaluate(() => window.__sfx.some((x) => x.name === 'spin'));
    check('取得理解卡有動畫與音效，可略過', flew && (await state(page)).cards.includes('K01'));
    check('任務推進有提示音', await page.evaluate(() => window.__sfx.some((x) => x.name === 'quest')));
    // 用不適用的卡：疑惑表情，卡片不消耗
    await useCard(page, () => page.keyboard.press('KeyF'), 'K01');
    const puzzled = await page.$('#usecard-body .puzzled svg');
    check('不適用的卡：疑惑表情與溫和提示，卡片不消耗', !!puzzled && (await state(page)).cards.includes('K01'));
    await page.click('#usecard-body [data-close]');

    // 音效關閉：之後的音效都不出聲
    await page.click('#hud-buttons [data-open-settings]');
    await page.click('#settings-body [data-key="sound"][data-value="false"]');
    await page.click('#settings .panel-head button:last-child');
    await page.evaluate(() => { window.__sfx = []; });
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(3000);
    await page.keyboard.up('ArrowDown');
    const muted = await page.evaluate(() => window.__sfx);
    check('音效關閉後不出聲', muted.length > 0 && muted.every((x) => !x.audible), `${muted.length} 個事件`);

    // 減少動畫：謎題反應立即顯示（靜態前後變化＋描述），沒有卡片飛入動畫
    await page.click('#hud-buttons [data-open-settings]');
    await page.click('#settings-body [data-key="reduceMotion"][data-value="true"]');
    await page.click('#settings .panel-head button:last-child');
    await page.evaluate(() => window.__xzj.game.openPuzzle('E01'));
    await page.waitForSelector('#puzzle[open] svg.stage');
    await place(page, 'rosemary', 'shade');
    await page.waitForTimeout(150);
    const rmCap = await caption(page);
    const rmCls = await page.evaluate(() => document.querySelector('#puzzle .pot[data-item="rosemary"] .plant').getAttribute('class'));
    check('減少動畫：植物反應立即以靜態前後變化加一行描述呈現', /r-lean/.test(rmCls) && /往有光/.test(rmCap), rmCap);
    for (const [item, slot] of Object.entries(E01)) await place(page, item, slot);
    await page.waitForTimeout(300);
    check('減少動畫：取得卡片不播放飛入動畫', !(await page.$('.card-fly')) && (await state(page)).cards.includes('E01'));
    await page.waitForSelector('#puzzle-body .solved', { timeout: 5000 });
    await page.click('#puzzle-body [data-close]');
    check('回饋流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }
  {
    // 聆聽風鈴時背景音樂完全靜音
    const { browser, context, page } = await launch();
    await context.route('**/content/music.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      duck: 0.3, fade: 0.2, tracks: { plaza: { file: 'assets/audio/_t.wav' }, cafe: { file: 'assets/audio/_t.wav' }, garden: { file: 'assets/audio/_t.wav' } },
    }) }));
    const wav = Buffer.alloc(44 + 16000);
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + 16000, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40);
    await context.route('**/assets/audio/_t.wav', (route) => route.fulfill({ contentType: 'audio/wav', body: wav }));
    await newGame(page, '#home-text');
    await page.evaluate(() => { const g = window.__xzj.game; g.store.mutate((s) => { s.step = 'present'; s.cards = ['K01', 'K02']; s.area = 'garden'; }); g.changed(); });
    await text.go(page, 'cafe');
    await text.go(page, 'garden');
    await text.act(page, 'ade');
    await talkThrough(page, ['一起試試']);
    await page.waitForSelector('#minigame[open]');
    await page.click('#minigame-body [data-go]');
    await page.waitForTimeout(600);
    const ducked = await page.evaluate(() => window.__xzj.music.volume);
    await page.click('#minigame-body [data-opt="0"]');
    await page.click('#minigame-body [data-return]');
    await page.click('#minigame-body [data-next]');
    await page.waitForTimeout(700);
    const listening = await page.evaluate(() => window.__xzj.music.volume);
    await page.click('#minigame-body [data-opt="0"]');
    await page.click('#minigame-body [data-return]');
    await page.click('#minigame-body [data-next]');
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => window.__xzj.music.volume);
    check('練習中音樂降低；聆聽風鈴的那一段完全靜音，之後恢復', ducked > 0.05 && listening < 0.01 && after > 0.05, `${ducked.toFixed(2)} → ${listening.toFixed(2)} → ${after.toFixed(2)}`);
    await browser.close();
  }
  {
    // 字體與文字大小：手機上不破版，找支持的電話號碼不縮小
    const { browser, page, errors } = await launch({ mobile: true });
    await page.goto(`${BASE}/?test=1`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/?test=1`);
    await page.waitForSelector('#home-new');
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() => ({ round: document.fonts.check('16px "XZJ Round"', '心之間微光里'), hand: document.fonts.check('16px "XZJ Hand"', '心之間') }));
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    check('全站使用 jf open 粉圓，標題點綴用芫荽，都從專案內載入', fonts.round && fonts.hand && /XZJ Round/.test(family), JSON.stringify(fonts));
    const sizes = {};
    for (const size of ['s', 'm', 'l']) {
      await page.evaluate((v) => { const st = JSON.parse(localStorage.getItem('xinzhijian.settings') || '{}'); st.textSize = v; localStorage.setItem('xinzhijian.settings', JSON.stringify(st)); }, size);
      await page.reload();
      await page.waitForSelector('#home-new');
      const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      await page.click('#home .btn[data-open-support]');
      const m = await page.evaluate(() => {
        const link = document.querySelector('#support-body a[href^="tel:1925"]');
        const body = parseFloat(getComputedStyle(document.body).fontSize);
        const d = document.getElementById('support');
        return { tel: parseFloat(getComputedStyle(link).fontSize), body, wide: d.scrollWidth > d.clientWidth + 1 };
      });
      sizes[size] = m.tel;
      await page.click('#support-close');
      if (over || m.wide || m.tel < m.body) sizes[size] = `破版 ${JSON.stringify(m)}`;
    }
    check('文字大小小、中、大在手機上都不破版；找支持的電話號碼字級不小於內文', Object.values(sizes).every((v) => typeof v === 'number') && sizes.s < sizes.l, JSON.stringify(sizes));
    check('版本號顯示在首頁', /v4\.3/.test(await page.innerText('#home')));
    check('字體與版面流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // 10. 走路的移動感、收集卡片的特效
  {
    const { browser, page, errors } = await launch();
    await page.addInitScript(() => {
      window.__sfx = [];
      document.addEventListener('sfx', (e) => window.__sfx.push(e.detail.name));
    });
    await newGame(page);
    await page.waitForFunction(() => window.__xzj?.view()?.position, null, { timeout: 30000 });
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => window.__sfx.filter((n) => n.startsWith('step')).length >= 4, null, { timeout: 40000 }).catch(() => {});
    // 連續取樣幾次，取最大的擺動與彈跳（單一瞬間可能剛好在擺動的中點）
    const pose = { lean: 0, sway: 0, bounce: 0 };
    for (let i = 0; i < 6; i++) {
      const p = await page.evaluate(() => window.__xzj.view().playerPose);
      pose.lean = Math.max(pose.lean, p.lean);
      pose.sway = Math.max(pose.sway, Math.abs(p.sway));
      pose.bounce = Math.max(pose.bounce, p.bounce);
      await page.waitForTimeout(170);
    }
    await page.keyboard.up('ArrowUp');
    const steps = await page.evaluate(() => window.__sfx.filter((n) => n.startsWith('step')));
    check('走路時左右腳交替落地（腳步聲一高一低）', steps.includes('step') && steps.includes('step2'), steps.slice(0, 6).join(','));
    check('走路時身體前傾、擺臀、上下彈跳', pose.lean > 0.05 && pose.sway > 0.03 && pose.bounce > 0.02, JSON.stringify(pose));
    // 收集卡片：由小變大、旋轉、發光、光點散開
    await page.evaluate(() => window.__xzj.game.apply([{ giveCard: 'K01' }]));
    await page.waitForSelector('.card-fly');
    const fx = await page.evaluate(() => {
      const f = document.querySelector('.card-fly');
      return { rays: !!f.querySelector('.rays'), halo: !!f.querySelector('.halo'), sparks: f.querySelectorAll('.sparks i').length,
        flash: !!f.querySelector('.flash'), anim: getComputedStyle(f.querySelector('.inner')).animationName };
    });
    check('收集卡片：由小變大旋轉、光芒、光暈、閃光與光點散開', fx.rays && fx.halo && fx.flash && fx.sparks >= 10 && /card-grow/.test(fx.anim), JSON.stringify(fx));
    await page.waitForFunction(() => !document.querySelector('.card-fly'), null, { timeout: 15000 });
    check('收集卡片後收進卡冊、播放音效', (await state(page)).cards.includes('K01') && (await page.evaluate(() => window.__sfx.includes('spin') && window.__sfx.includes('card'))));
    check('走路與卡片特效無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // 9. 修正：音樂不重疊（模擬 iPhone 不能改 <audio> 音量）、手機搖桿推一半就是全速
  {
    const { browser, context, page, errors } = await launch({ mobile: true });
    await page.addInitScript(() => {
      // iPhone、iPad 的 Safari：<audio> 的 volume 唯讀，設定了也不會變
      Object.defineProperty(HTMLMediaElement.prototype, 'volume', { get() { return 1; }, set() {}, configurable: true });
    });
    await context.route('**/content/music.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      duck: 0.3, fade: 0.3, tracks: { plaza: { file: 'assets/audio/_p.wav' }, cafe: { file: 'assets/audio/_c.wav' }, garden: { file: 'assets/audio/_g.wav' } },
    }) }));
    const wav = Buffer.alloc(44 + 16000);
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + 16000, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40);
    await context.route('**/assets/audio/_*.wav', (route) => route.fulfill({ contentType: 'audio/wav', body: wav }));
    await newGame(page, '#home-text');
    await page.waitForFunction(() => window.__xzj.music.playing, null, { timeout: 10000 }).catch(() => {});
    for (const a of ['cafe', 'plaza', 'garden', 'cafe', 'garden']) await text.go(page, a);
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => ({ audible: window.__xzj.music.audible, volume: window.__xzj.music.volume }));
    check('連續換區後同一時間只有一首在播（模擬 iPhone 不能改音量）', m.audible === 1 && m.volume > 0.3, JSON.stringify(m));
    await page.evaluate(() => window.__xzj.music.mute(true));
    await page.waitForTimeout(800);
    const silent = await page.evaluate(() => window.__xzj.music.volume);
    await page.evaluate(() => window.__xzj.music.mute(false));
    check('iPhone 上也能靜音與降低音量（用 Web Audio 控制）', silent < 0.01, `靜音時 ${silent.toFixed(2)}`);
    check('音樂修正流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }
  {
    const { browser, page } = await launch({ mobile: true });
    await newGame(page);
    await page.waitForFunction(() => window.__xzj?.view()?.position, null, { timeout: 30000 });
    const speedOf = async (fn) => {
      await page.evaluate(() => window.__xzj.view().teleport(18, 19));
      await page.waitForTimeout(500);
      const p0 = await page.evaluate(() => window.__xzj.view().position);
      const t0 = Date.now();
      await fn(true);
      await page.waitForTimeout(3000);
      const p1 = await page.evaluate(() => window.__xzj.view().position);
      await fn(false);
      return (p0.z - p1.z) / ((Date.now() - t0) / 1000);
    };
    const box = await page.locator('#stick').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const half = await speedOf(async (on) => {
      if (on) { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy - box.height * 0.28, { steps: 3 }); } else await page.mouse.up();
    });
    const keys = await speedOf(async (on) => (on ? page.keyboard.down('ArrowUp') : page.keyboard.up('ArrowUp')));
    check('手機搖桿推約一半就接近全速（和鍵盤相比）', half > keys * 0.85, `搖桿 ${half.toFixed(2)}、鍵盤 ${keys.toFixed(2)} 單位／秒`);
    await browser.close();
  }

  await sectionV43();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 項，通過 ${results.length - failed.length} 項，未通過 ${failed.length} 項`);
  process.exit(failed.length ? 1 : 0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  module.exports = { talkThrough, textMainline, newGame, state };
}
