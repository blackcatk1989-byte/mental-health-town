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
  for (let i = 0; i < 60; i++) {
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
      await choices[idx].click();
    } else {
      await page.click('#dlg-next');
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

// 謎題：依 answers 放好，按「放好了」
async function solvePuzzle(page, answers) {
  await page.waitForSelector('#puzzle[open]');
  for (const [item, slot] of Object.entries(answers)) {
    if (!(await page.$(`#puzzle-body [data-item="${item}"][data-slot="${slot}"].on`))) {
      await page.click(`#puzzle-body [data-item="${item}"][data-slot="${slot}"]`);
    }
  }
  await page.click('#puzzle-body [data-check]');
}
const E01 = { rosemary: 'sun', mint: 'half', fern: 'shade' };
const E02 = { table1: 'exam', table2: 'rent', table3: 'friend' };

const text = {
  go: (page, area) => page.click(`#text-mode [data-area="${area}"]:not([disabled])`).catch(() => {}),
  act: (page, id) => page.click(`#text-mode [data-act="${id}"]`),
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

async function main() {
  const OUT = process.env.OUT || '.';

  // 0. 舊名稱不得殘留
  {
    const root = path.join(__dirname, '..');
    const files = ['index.html', ...['content', 'src', 'src/three'].flatMap((d) => fs.readdirSync(path.join(root, d))
      .filter((f) => /\.(js|json)$/.test(f)).map((f) => `${d}/${f}`))];
    const hits = files.filter((f) => /晴隅|沐雨|阿澄|muyu|acheng|佈置/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    check('介面、對話、程式不殘留舊名（晴隅、沐雨、阿澄、佈置）', hits.length === 0, hits.join(','));
  }

  // 0b. 背景音樂：曲目檔案存在、大小合理、授權有記錄
  {
    const root = path.join(__dirname, '..');
    const music = JSON.parse(fs.readFileSync(path.join(root, 'content/music.json'), 'utf8'));
    const credits = fs.readFileSync(path.join(root, 'docs/素材來源.md'), 'utf8');
    const tracks = Object.values(music.tracks).filter(Boolean);
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

    // 文字模式的謎題：E02 先放錯，再改對
    await text.go(page, 'cafe');
    await text.act(page, 'tables');
    await solvePuzzle(page, { table1: 'rent', table2: 'exam', table3: 'friend' });
    const wrongText = await page.innerText('#puzzle-body .notice');
    check('謎題答錯：只給線索方向，不評價', /再看看|跟什麼有關/.test(wrongText) && !/錯|失敗|扣/.test(wrongText), wrongText.split('\n')[0]);
    await solvePuzzle(page, E02);
    const solvedText = await page.innerText('#puzzle-body');
    check('文字模式解開 E02，說明「相似的表現，背後的處境不同」', /相似的表現，背後的處境不同/.test(solvedText) && (await state(page)).cards.includes('E02'));
    await page.click('#puzzle-body [data-close]');

    // 文字模式的麻糬：三層提示
    await page.click('#text-mode [data-hint]');
    await page.click('#hints-body [data-topic="E01"]');
    await page.click('#hints-body [data-layer="1"]');
    const l1 = await page.innerText('#hints-body .notice');
    await page.click('#hints-body [data-layer="2"]');
    await page.click('#hints-body [data-layer="3"]');
    const l3 = await page.innerText('#hints-body .notice');
    await page.click('#hints-body [data-close]');
    await text.go(page, 'garden');
    const marked = await page.innerText('#text-mode li.marked').catch(() => '');
    check('文字模式「問問麻糬」三層提示', /往小花園/.test(l1) && /標出來/.test(l3) && /三盆植物/.test(marked) && /就是這裡/.test(marked), `${l1}｜${marked.split('\n')[0]}`);
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
    for (let i = 0; i < 4 && await page.isVisible('#dialogue'); i++) { adeWrap.push(await page.innerText('#dlg-text')); await page.click('#dlg-next'); await page.waitForTimeout(40); }
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

    // 麻糬：3D 的三層提示
    await page.waitForFunction(() => {
      const v = window.__xzj.view();
      return v && document.querySelector('.cat-tag');
    });
    const catPos0 = await page.evaluate(() => window.__xzj.view().catPosition);
    await page.evaluate(() => window.__xzj.ui.hints());
    await page.click('#hints-body [data-topic="E01"]');
    await page.click('#hints-body [data-layer="1"]');
    await page.click('#hints-body [data-layer="2"]');
    await page.click('#hints-body [data-layer="3"]');
    await page.click('#hints-body [data-close]');
    await page.waitForTimeout(4000);
    const catPos1 = await page.evaluate(() => window.__xzj.view().catPosition);
    const beacon = await page.evaluate(() => window.__xzj.view().beaconTarget);
    check('3D 麻糬提示：帶路走向花園謎題，第 3 層標出互動位置', Math.hypot(catPos1.x - catPos0.x, catPos1.z - catPos0.z) > 0.3 && beacon === 'pots',
      `麻糬 (${catPos0.x.toFixed(1)},${catPos0.z.toFixed(1)}) → (${catPos1.x.toFixed(1)},${catPos1.z.toFixed(1)})；標記 ${beacon}`);

    // 謎題 E01：先放錯、中途離開，重整後回來位置仍在，再改對
    await go('pots', 0, 0.6);
    await pressE();
    await solvePuzzle(page, { rosemary: 'shade', mint: 'half', fern: 'sun' });
    const e01hint = await page.innerText('#puzzle-body .notice');
    await page.click('#puzzle-body [data-later]');
    await reloadContinue(page);
    s = await state(page);
    check('謎題中途離開、重整後保留已擺的位置', s.puzzles.E01.place.mint === 'half' && !s.puzzles.E01.solved, JSON.stringify(s.puzzles.E01.place));
    await go('pots', 0, 0.6);
    await pressE();
    await solvePuzzle(page, E01);
    const e01 = await page.innerText('#puzzle-body');
    await page.click('#puzzle-body [data-close]');
    check('謎題 E01：答錯只提示看哪個線索；解開說明「需要不同，沒有哪個比較好」', /標籤/.test(e01hint) && /需要不同，沒有哪個比較好/.test(e01) && (await state(page)).cards.includes('E01'));
    check('解開後提示光柱收起', (await page.evaluate(() => window.__xzj.view().beaconTarget)) === null);
    await page.screenshot({ path: `${OUT}/3d-pots-solved.png` });

    // 謎題 E02
    await go('tables', 0, 0.6);
    await pressE();
    await solvePuzzle(page, E02);
    await page.click('#puzzle-body [data-close]');
    s = await state(page);
    check('謎題 E02 在 3D 解開', s.puzzles.E02.solved && s.cards.includes('E02'));
    await reloadContinue(page);
    s = await state(page);
    check('解謎後重整可恢復、卡片不重複', s.puzzles.E01.solved && s.puzzles.E02.solved && s.cards.length === 6 && new Set(s.cards).size === 6);

    await go('xiaoqing');
    await useCard(page, () => page.keyboard.press('KeyF'), 'E01');
    const e01talk = await page.innerText('#dlg-text');
    await talkThrough(page, ['還不確定']);
    check('E01 分支：和曉晴聊各自喜歡的相處方式', /需要的空間/.test(e01talk));
    await go('ade');
    await useCard(page, () => page.keyboard.press('KeyF'), 'E02');
    const e02talk = await page.innerText('#dlg-text');
    await talkThrough(page);
    check('E02 分支：和阿德聊「不要急著下結論」', /處境|分心/.test(e02talk));
    await useCard(page, () => page.keyboard.press('KeyF'), 'K04');
    await talkThrough(page, ['好。']);
    check('K04：主線後聊「需要的時候可以找誰」', (await state(page)).used.includes('next-support-ade'));

    await page.evaluate(() => window.__xzj.ui.hints());
    const nothing = await page.innerText('#hints-body');
    await page.click('#hints-body [data-close]').catch(() => page.click('#hints .panel-head button:last-child'));
    check('全部完成後麻糬不再給題目', /呵欠/.test(nothing));

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
      const t = window.__xzj.game.target('tables');
      window.__xzj.view().teleport(t.x, t.z + 0.6);
    });
    await page.waitForFunction(() => document.getElementById('interact-name').textContent === '還沒收的三張桌子', null, { timeout: 30000 });
    await page.tap('#interact-go');
    await page.waitForSelector('#puzzle[open]');
    await page.tap('#puzzle-body [data-item="table1"][data-slot="exam"]');
    await page.screenshot({ path: `${OUT}/mobile-puzzle.png` });
    const p2 = await page.evaluate(() => window.__xzj.view().position);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 50, { steps: 4 });
    await page.waitForTimeout(800);
    await page.mouse.up();
    const p3 = await page.evaluate(() => window.__xzj.view().position);
    check('手機上可操作謎題；面板開啟時角色不會誤走動', (await state(page)).puzzles.E02.place.table1 === 'exam' && Math.abs(p3.z - p2.z) < 0.01);
    check('手機流程無錯誤', errors.length === 0, errors.join(' | '));
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
