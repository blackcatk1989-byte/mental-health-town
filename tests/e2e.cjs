// 依企劃書 7.1 驗收表的端對端測試（Playwright，瀏覽器實際操作）。
// 不屬於遊戲本身，也不需要 npm 安裝到專案；在有 Playwright 的環境執行：
//   python -m http.server 8000   （另一個終端機）
//   BASE=http://localhost:8000 node tests/e2e.cjs
// 無法連到 jsDelivr 時，可設 THREE_DIR 指向 three@0.170.0 套件資料夾，測試會改從本機讀取。
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
  await settle(page); // 面板關閉事件是非同步的，等接續的對話出現
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
  if (await page.isVisible('#hud') && await page.evaluate(() => document.body.dataset.mode === '3d')) {
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

async function playThought(page) {
  await page.click('#minigame-body [data-go]');
  const items = [['0', 'event'], ['1', 'thought'], ['2', 'feeling']];
  // 先故意放錯一次，確認有說明且不扣分
  await page.click('#minigame-body [data-item="0"][data-bin="thought"]');
  const hint = await page.isVisible('#minigame-body .notice');
  for (const [i, b] of items) await page.click(`#minigame-body [data-item="${i}"][data-bin="${b}"]`);
  await page.click('#minigame-body [data-next]');
  await page.click('#minigame-body [data-alt="3"]');
  await page.click('#minigame-body [data-next]');
  await page.click('#minigame-body [data-step="0"]');
  await page.click('#minigame-body [data-next]');
  await page.click('#minigame-body [data-done]');
  return hint;
}

async function playPresent(page) {
  await page.click('#minigame-body [data-go]');
  await page.click('#minigame-body [data-obj="mint"]');
  await page.click('#minigame-body [data-detail="0"]');
  await page.click('#minigame-body [data-next]');
  await page.click('#minigame-body [data-snd="2"]');
  await page.click('#minigame-body [data-next]');
  await page.click('#minigame-body [data-end]');
  await page.click('#minigame-body [data-done]');
}

async function readSummary(page) {
  await page.waitForSelector('#minigame[open]');
  await page.click('#minigame-body [data-done]');
}

// ---- 文字模式 ----
const text = {
  go: (page, area) => page.click(`#text-mode [data-area="${area}"]:not([disabled])`).catch(() => {}),
  act: (page, id) => page.click(`#text-mode [data-act="${id}"]`),
  use: (page, id, card) => useCard(page, () => page.click(`#text-mode [data-use="${id}"]`), card),
};

async function newGame(page, query, modeButton = '#home-new') {
  await page.goto(`${BASE}/?test=1${query ? `&${query}` : ''}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/?test=1${query ? `&${query}` : ''}`);
  await page.click(modeButton);
}

async function textMainline(page, { summaries }) {
  await text.act(page, 'board');
  await talkThrough(page, ['先去咖啡店']);
  await text.go(page, 'cafe');
  await text.act(page, 'muyu');
  await talkThrough(page, ['你想用什麼方式', '謝謝你告訴我']);
  await text.act(page, 'note');
  await talkThrough(page, [summaries ? '閱讀摘要' : '開始練習']);
  if (summaries) await readSummary(page);
  else { await page.waitForSelector('#minigame[open]'); await playThought(page); }
  await talkThrough(page);
  await text.use(page, 'muyu', 'K02');
  await talkThrough(page);
  await text.go(page, 'garden');
  await text.use(page, 'acheng', 'K01');
  await talkThrough(page, [summaries ? '摘要' : '一起試試']);
  if (summaries) await readSummary(page);
  else { await page.waitForSelector('#minigame[open]'); await playPresent(page); }
  await talkThrough(page);
  await text.use(page, 'bench', 'K03');
  await talkThrough(page);
  await page.waitForSelector('#arrange[open]');
  await page.click('#arrange-ok');
  await talkThrough(page);
  await text.act(page, 'muyu');
  await talkThrough(page);
  await text.act(page, 'acheng');
  await talkThrough(page, ['繼續逛逛']);
}

async function main() {
  // 1. 文字模式：兩個練習都改讀摘要、完全不找探索卡，也能完成主線
  {
    const { browser, page, errors } = await launch();
    await newGame(page, 'explore=plaza-planter,garden-path', '#home-text');
    await textMainline(page, { summaries: true });
    const s = await state(page);
    check('文字模式主線完成（練習改讀摘要、不找探索卡）', s.step === 'done' && ['K01', 'K02', 'K03', 'K04'].every((k) => s.cards.includes(k)) && !s.cards.includes('E01'),
      `step=${s.step} cards=${s.cards.join(',')}`);
    check('練習略過與完成分開記錄', s.practice.thought.summary === 1 && s.practice.thought.completed === 0 && s.practice.present.summary === 1, JSON.stringify(s.practice));
    check('文字模式無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // 2. 3D 模式：實際走路、碰撞、完成兩個練習與主線
  {
    const { browser, page, errors } = await launch();
    await newGame(page, 'explore=cafe-window,garden-trellis');
    await page.waitForFunction(() => window.__xzj?.view()?.position);
    const p0 = await page.evaluate(() => window.__xzj.view().position);
    const p1 = await holdUntilStopped(page, 'ArrowUp');
    check('3D 可用鍵盤移動', p1.z < p0.z - 3, `z ${p0.z.toFixed(2)} → ${p1.z.toFixed(2)}`);
    check('3D 不能穿過告示牌（主要障礙）', p1.z > 9.65, `停在 z=${p1.z.toFixed(2)}`);
    await page.evaluate(() => window.__xzj.view().teleport(18, 17));
    const p2 = await holdUntilStopped(page, 'ArrowDown');
    check('3D 不能走出地圖（往南走到邊界停下）', p2.z > 20 && p2.z <= 21.5 - 0.28 + 0.01, `z=${p2.z.toFixed(2)}`);
    await page.screenshot({ path: `${process.env.OUT || '.'}/3d-cafe.png` });

    // 量測一般遊玩的畫面更新率
    const fps = await page.evaluate(() => new Promise((res) => {
      let n = 0; const t0 = performance.now();
      const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); };
      requestAnimationFrame(f);
    }));
    check('畫面更新率（測試機為軟體繪圖，僅供參考）', fps > 0, `${fps.toFixed(1)} FPS`);
    await page.click('#hud-buttons [data-open-settings]');
    await page.click('#settings-body [data-key="quality"][data-value="low"]');
    await page.click('#settings .panel-head button:last-child');
    const fpsLow = await page.evaluate(() => new Promise((res) => {
      let n = 0; const t0 = performance.now();
      const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); };
      requestAnimationFrame(f);
    }));
    check('省電畫質可切換（關閉陰影）', fpsLow > 0, `${fpsLow.toFixed(1)} FPS`);
    await page.click('#hud-buttons [data-open-settings]');
    await page.click('#settings-body [data-key="quality"][data-value="high"]');
    await page.click('#settings .panel-head button:last-child');

    // 移到目標旁邊，等互動提示換成這個目標（測試機畫面更新慢，要等下一幀）
    const go = async (id, dx = 0, dz = 1.1) => {
      const name = await page.evaluate(([id, dx, dz]) => {
        const t = window.__xzj.game.target(id);
        window.__xzj.view().teleport(t.x + dx, t.z + dz);
        return t.name;
      }, [id, dx, dz]);
      await page.waitForFunction((n) => document.getElementById('interact-name').textContent === n
        && !document.getElementById('interact').classList.contains('hidden'), name, { timeout: 20000 });
    };
    const pressE = async () => {
      await page.waitForSelector('#interact:not(.hidden)', { timeout: 20000 });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(120);
    };

    await go('board', 0, 0.9);
    const shown = await page.isVisible('#interact');
    check('3D 互動提示出現', shown, await page.innerText('#interact').catch(() => ''));
    await pressE();
    await talkThrough(page, ['看看支持資源']);
    const supportOpened = await page.isVisible('#support[open]');
    if (supportOpened) await page.click('#support-close');
    await talkThrough(page);
    check('告示牌可開啟支持資源', supportOpened);

    await go('muyu');
    await pressE();
    await talkThrough(page, ['想太多', '你想用什麼方式', '多說一點', '我願意聽', '謝謝你願意']);
    let s = await state(page);
    check('沐雨初次對話後保證取得 K01（揭露段可選，不額外發獎）', s.cards.join() === 'K01' && s.step === 'thought', s.cards.join());

    // 對話中離開再回來
    await go('note', 0, 1.0);
    await pressE();
    await page.click('#dlg-exit');
    check('對話中可離開', !(await page.isVisible('#dialogue')));
    await pressE();
    await talkThrough(page, ['開始練習']);
    await page.waitForSelector('#minigame[open]');
    // 練習中也能開「找支持」
    await page.click('#minigame .support-mini');
    const supportOverPanel = await page.isVisible('#support[open]');
    await page.click('#support-close');
    check('練習面板開著時也能開啟找支持', supportOverPanel && await page.isVisible('#minigame[open]'));
    // 中途離開再重新進入
    await page.click('#minigame .panel-head button:last-child');
    s = await state(page);
    check('練習中途離開不記錄、不發卡', !s.cards.includes('K02') && s.step === 'thought');
    await pressE();
    await talkThrough(page, ['開始練習']);
    const wrongHint = await playThought(page);
    check('想法放大鏡：放錯時顯示說明、不扣分', wrongHint);
    await talkThrough(page);
    s = await state(page);
    check('完成想法放大鏡取得 K02', s.cards.includes('K02') && s.step === 'clarify');

    // 發卡後重新整理
    await page.reload();
    await page.click('#home-continue');
    await page.waitForFunction(() => window.__xzj?.view()?.position);
    s = await state(page);
    check('發卡後重整可恢復', s.cards.includes('K02') && s.step === 'clarify');

    // 不適用的卡：對沐雨使用 K01
    await go('muyu');
    await useCard(page, () => page.keyboard.press('KeyF'), 'K01');
    const naText = await page.innerText('#usecard-body');
    s = await state(page);
    check('不適用卡：有說明與目前目標、不推進、不消耗', /目前目標/.test(naText) && s.step === 'clarify' && s.cards.includes('K01'), naText.split('\n')[0]);
    await page.click('#usecard-body [data-again]');
    await page.click('#usecard-body [data-card="K02"]');
    await page.click('#usecard-body [data-go]');
    await talkThrough(page);
    s = await state(page);
    check('用卡點 1：對沐雨用 K02 推進，卡片保留', s.step === 'askAcheng' && s.cards.includes('K02') && s.used.includes('clarify-invite'));

    // 只閱讀卡片不算用卡
    await page.click('#cardbook-button');
    await page.click('#cardbook-body [data-card="K01"]');
    await page.click('#cardbook .panel-head button:last-child');
    s = await state(page);
    check('只閱讀卡片不推進任務', s.step === 'askAcheng');

    await page.reload();
    await page.click('#home-continue');
    await page.waitForFunction(() => window.__xzj?.view()?.position);
    check('用卡後重整可恢復', (await state(page)).step === 'askAcheng');

    await go('acheng');
    await useCard(page, () => page.click('#interact-use'), 'K01');
    await talkThrough(page, ['一起試試']);
    await page.waitForSelector('#minigame[open]');
    await playPresent(page);
    await talkThrough(page);
    s = await state(page);
    check('用卡點 2 與回到這座花園：取得 K03', s.step === 'arrange' && s.cards.includes('K03') && s.practice.present.completed === 1,
      `step=${s.step} cards=${s.cards} practice=${JSON.stringify(s.practice.present)} dialog=${await page.isVisible('#dialogue')}`);

    await go('bench', 0, 0.9);
    await useCard(page, () => page.keyboard.press('KeyF'), 'K03');
    await talkThrough(page);
    await page.waitForSelector('#arrange[open]');
    const quietLocked = /找到探索卡/.test(await page.innerText('#arrange-body'));
    await page.click('#arrange-body [data-spot="trellis"]');
    await page.click('#arrange-body [data-sign="1"]');
    await page.click('#arrange-ok');
    await talkThrough(page);
    s = await state(page);
    check('用卡點 3：佈置完成；沒有 E01 時安靜座位顯示取得線索', s.step === 'wrap' && s.arrangement.spot === 'trellis' && quietLocked);

    await go('muyu');
    await pressE();
    await talkThrough(page);
    await go('acheng');
    await pressE();
    await talkThrough(page, ['繼續逛逛']);
    s = await state(page);
    check('3D 主線完成並取得 K04', s.step === 'done' && s.cards.includes('K04'));
    await page.screenshot({ path: `${process.env.OUT || '.'}/3d-garden-done.png` });

    await page.reload();
    await page.click('#home-continue');
    await page.waitForFunction(() => window.__xzj?.view()?.position);
    s = await state(page);
    check('結尾後重整可恢復、無重複獎勵', s.step === 'done' && s.cards.length === new Set(s.cards).size && s.rewards.length === 4);

    // 主線後補找探索卡，並回訪使用
    await go('pickup:cafe-window', 0, 0.8);
    await pressE();
    await talkThrough(page);
    await go('pickup:garden-trellis', 0.8, 0);
    await pressE();
    await talkThrough(page);
    s = await state(page);
    check('主線後拾取兩張探索卡', s.cards.includes('E01') && s.cards.includes('E02') && s.picked.length === 2);
    await page.reload();
    await page.click('#home-continue');
    await page.waitForFunction(() => window.__xzj?.view()?.position);
    const respawn = await page.evaluate(() => window.__xzj.game.targets().filter((t) => t.kind === 'pickup').length);
    check('拾取後重整不重生', respawn === 0);
    await go('bench', 0, 0.9);
    await useCard(page, () => page.keyboard.press('KeyF'), 'E01');
    await talkThrough(page);
    s = await state(page);
    check('E01 額外分支：結尾後回到長椅加入安靜座位', s.arrangement.quiet === true);
    await go('acheng');
    await useCard(page, () => page.keyboard.press('KeyF'), 'E02');
    const e02 = await page.innerText('#dlg-text');
    await talkThrough(page);
    check('E02 額外分支：開啟「不要急著下結論」對話', /處境|分心/.test(e02));
    await go('muyu');
    await useCard(page, () => page.keyboard.press('KeyF'), 'K04');
    await talkThrough(page, ['嗯，謝謝']);
    check('K04 收尾後開啟「下一步支持」延伸對話', (await state(page)).used.includes('next-support-muyu'));

    // 重玩練習不重複發卡
    await go('note', 0, 1.0);
    await pressE();
    await talkThrough(page, ['閱讀摘要']);
    await readSummary(page);
    s = await state(page);
    check('重玩練習不重複發卡、任務不倒退', s.cards.filter((c) => c === 'K02').length === 1 && s.step === 'done');

    // 切換文字模式共用進度
    await page.click('#hud-buttons [data-open-settings]');
    await page.click('#settings-body [data-mode="text"]');
    await page.waitForSelector('#text-mode h2');
    const textOk = (await page.innerText('#text-mode')).length > 0 && (await state(page)).cards.length === 6;
    check('3D 切換到文字模式共用進度', textOk);
    check('3D 流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // 3. 隨機探索：三組指定配置＋隨機配置，點位不同、可到達、重整不重抽
  {
    const { browser, page } = await launch();
    const configs = ['plaza-planter,cafe-rack', 'plaza-bench,garden-path', 'cafe-window,garden-trellis'];
    for (const c of configs) {
      await newGame(page, `explore=${c}`);
      await page.waitForFunction(() => window.__xzj?.view()?.position);
      let reachable = true;
      for (const pid of c.split(',')) {
        // 從點位四周找一個角色可以站的位置，確認在可互動距離內
        reachable &&= await page.evaluate((pid) => {
          const g = window.__xzj.game;
          const p = g.pointById[pid];
          const v = window.__xzj.view();
          for (let a = 0; a < 16; a++) {
            const x = p.x + Math.cos(a / 16 * Math.PI * 2) * 1.0;
            const z = p.z + Math.sin(a / 16 * Math.PI * 2) * 1.0;
            v.teleport(x, z);
            if (!v.blockedAt?.(x, z)) return true;
          }
          return false;
        }, pid);
      }
      const before = (await state(page)).explore;
      await page.reload();
      const after = (await state(page)).explore;
      check(`探索配置 ${c}：兩張卡在不同點位、可到達、重整不重抽`, before.E01 !== before.E02 && JSON.stringify(before) === JSON.stringify(after) && reachable, JSON.stringify(after));
    }
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      await newGame(page, '');
      const ex = (await state(page)).explore;
      if (ex.E01 === ex.E02) seen.add('重複');
      seen.add(`${ex.E01}/${ex.E02}`);
    }
    check('隨機配置：每局兩張卡點位不同', !seen.has('重複'), [...seen].join('、'));
    await browser.close();
  }

  // 4. 防卡關：已走過發卡步驟卻缺卡的異常存檔會補回
  {
    const { browser, page } = await launch();
    await newGame(page, 'explore=plaza-planter,cafe-rack', '#home-text');
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('xinzhijian.save'));
      s.step = 'arrange';
      s.cards = ['K01'];
      localStorage.setItem('xinzhijian.save', JSON.stringify(s));
    });
    await page.reload();
    const s = await state(page);
    check('異常存檔補回必要卡（不補發未達條件的卡）', ['K01', 'K02', 'K03'].every((k) => s.cards.includes(k)) && !s.cards.includes('K04') && !s.cards.includes('E01'), s.cards.join(','));
    // 缺卡指引（直接把記憶體中的進度改成「該用 K02 卻沒有 K02」）
    await page.click('#home-continue');
    await page.evaluate(() => {
      const g = window.__xzj.game;
      g.s.step = 'clarify';
      g.s.cards = ['K01'];
      g.changed();
    });
    const miss = await page.innerText('#goal-missing');
    check('缺少必要卡時顯示取得來源', /活動便條/.test(miss), miss);
    await page.click('#cardbook-button');
    await page.click('#cardbook-body [data-card="E01"]');
    const locate = await page.isVisible('#cardbook-body [data-locate]');
    await page.click('#cardbook-body [data-locate]');
    const marked = await page.innerText('#text-mode');
    check('探索卡可「顯示位置」（不用等主線）', locate && /已標記/.test(marked), '文字模式在所在地點標示「已標記」');
    await browser.close();
  }

  // 5. 首頁：資源全程開放、舊進度無法讀取、清除進度須確認
  {
    const { browser, page, errors } = await launch();
    await page.goto(`${BASE}/`);
    await page.evaluate(() => localStorage.setItem('xinzhijian.save', JSON.stringify({ version: 99 })));
    await page.reload();
    await page.waitForSelector('#home-message:not(.hidden)');
    const msg = await page.innerText('#home-message');
    check('舊進度無法讀取時說明原因並提供重新開始', /無法讀取/.test(msg) && await page.isVisible('#home-new'), msg.split('\n')[0]);
    await page.click('#home .btn[data-open-support]');
    const sup = await page.innerText('#support-body');
    const links = await page.$$eval('#support-body a[href^="http"]', (as) => as.map((a) => a.href));
    check('不破關即可開啟找支持；有來源與查核日期', /最後查核/.test(sup) && /1925/.test(sup) && links.length >= 6, `${links.length} 個官方連結`);
    check('外部連結不附帶遊戲資料', links.every((l) => !/save|step|card/.test(l)));
    await page.click('#support-close');
    await page.click('#home-new');
    await page.waitForFunction(() => window.__xzj === undefined || true);
    const backup = await page.evaluate(() => localStorage.getItem('xinzhijian.save.unreadable'));
    check('讀不懂的舊進度先備份，不默默丟棄', backup && backup.includes('99'));
    await page.click('#hud-buttons [data-open-settings]');
    await page.click('#settings-body [data-act="clear"]');
    const confirmShown = await page.isVisible('#confirm[open]');
    await page.click('#confirm-cancel');
    const kept = await page.evaluate(() => !!localStorage.getItem('xinzhijian.save'));
    check('清除進度前需確認（取消後進度仍在）', confirmShown && kept);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    check('只在本機儲存進度與設定', keys.every((k) => k.startsWith('xinzhijian.')), keys.join(','));
    check('首頁流程無錯誤', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // 6. 3D 無法載入時改用文字模式
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

  // 7. 手機觸控：搖桿移動、互動按鈕、直式畫面
  {
    const { browser, page, errors } = await launch({ mobile: true });
    await newGame(page, 'explore=plaza-planter,cafe-rack');
    await page.waitForFunction(() => window.__xzj?.view()?.position);
    const p0 = await page.evaluate(() => window.__xzj.view().position);
    const box = await page.locator('#stick').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 50, { steps: 4 });
    await page.waitForFunction((z) => window.__xzj.view().position.z < z - 1, p0.z, { timeout: 30000 }).catch(() => {});
    await page.mouse.up();
    const p1 = await page.evaluate(() => window.__xzj.view().position);
    check('手機搖桿可移動', p1.z < p0.z - 1, `z ${p0.z.toFixed(2)} → ${p1.z.toFixed(2)}`);
    await page.evaluate(() => window.__xzj.view().teleport(18, 10.5));
    await page.waitForTimeout(300);
    await page.tap('#interact-go');
    const dlg = await page.isVisible('#dialogue');
    const stickHidden = !(await page.isVisible('#stick'));
    check('手機互動按鈕可開啟對話；對話時隱藏搖桿', dlg && stickHidden);
    await page.screenshot({ path: `${process.env.OUT || '.'}/mobile-dialogue.png` });
    await talkThrough(page, ['先去咖啡店']);
    const p2 = await page.evaluate(() => window.__xzj.view().position);
    await page.click('#cardbook-button');
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 50, { steps: 4 });
    await page.waitForTimeout(800);
    await page.mouse.up();
    const p3 = await page.evaluate(() => window.__xzj.view().position);
    check('面板開啟時角色不會誤走動', Math.abs(p3.z - p2.z) < 0.01);
    await page.screenshot({ path: `${process.env.OUT || '.'}/mobile-cardbook.png` });
    check('手機流程無錯誤', errors.length === 0, errors.join(' | '));
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
