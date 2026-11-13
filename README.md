# 心之間

> 在一座溫暖的小鎮裡，透過相遇、探索與練習，多理解自己與別人一點。

「心之間」是一款面向台灣成年大眾的**日常探索解謎**網頁遊戲原型。玩家在「微光里」平凡的一天裡和人聊天、親手完成小練習與謎題，用「理解卡」認識心理健康知識，並取得台灣的現實支持資源。

完整規格見 [docs/心之間原型提案.md](docs/心之間原型提案.md)（v4）。

本專案為非營利的衛教專案，不做任何商業用途。協作規則請見 [AGENTS.md](AGENTS.md)。

> **內容為衛教草案，尚未完成心理專業審閱。** 角色與故事均為虛構。這個遊戲不能診斷，也不會監測危機或即時回應。

## 本機執行

遊戲需要透過本機伺服器開啟（直接雙擊 `index.html` 會讀不到 JSON 檔）。在專案根目錄執行：

```bash
python -m http.server 8000
```

然後用瀏覽器打開 <http://localhost:8000>。3D 引擎 Three.js 從 jsDelivr CDN 載入，需要網路；連不上或瀏覽器不支援 WebGL 時，遊戲會自動改用文字模式。

## 玩法與操作

主線《今天有點卡卡的》，約 20 分鐘，不計時、不扣分：

1. 在小廣場看公布欄。
2. 到咖啡店外認識曉晴。先問她想不想聊，取得 K01「先問，再陪伴」。
3. 親手完成「想法放大鏡」（把便條上的句子分成確定的事、猜測、感受），取得 K02「想法不等於事實」。
4. 對曉晴使用 K02，聊要不要直接問問看，由她自己決定。
5. 到小花園對阿德使用 K01，問他現在需要什麼。
6. 親手完成「回到這座花園」（念頭冒出來時，看見它，再回到花園），取得 K03「回到此刻」。
7. 在長椅使用 K03，陪阿德決定今晚的一小步。
8. 聽兩人各自的小決定，取得 K04「求助不必獨自承擔」。

另有兩個謎題，直接拿起東西放到場地上（電腦可拖曳或點選，手機用點選）：小花園的「三盆植物」（E01，看植物的樣子和地上的光影、濕度，找每盆住得舒服的地方）、咖啡店外的「還沒收的三張桌子」（E02，把客人忘記的東西放回原本的桌上）。卡住的時候，可以找跟在身邊的橘貓麻糬，牠會自己走到該去的地方坐下等你；再問一次就換下一個地方。

| | 電腦 | 手機 |
|---|---|---|
| 移動 | WASD／方向鍵 | 左下角虛擬搖桿 |
| 互動 | E，或點選附近的人／物件／麻糬 | 右下角「對話／查看／問問麻糬」按鈕 |
| 使用理解卡 | F | 右下角「使用理解卡」按鈕 |

- 右上角「找支持」全程開放，不需要完成任務或持有卡片。
- 「文字模式」用地點與按鈕取代走路，和 3D 模式共用同一份進度，可以在設定裡隨時切換。
- 設定：背景音樂開關與音量、音效（預設開啟；聆聽風鈴時背景音樂自動靜音）、減少動畫、文字大小、3D 畫質（省電模式關閉陰影與小裝飾；手機第一次開啟時預設省電）、重新開始、清除進度。
- 進度只存在玩家自己的瀏覽器（localStorage），不會傳送到伺服器，也不收集姓名、病史或心情。

## 修改內容

所有文字（對話、任務、理解卡、練習、資源）都在 `content/` 的 JSON 檔，改內容不用動程式。詳見 [docs/內容編輯說明.md](docs/內容編輯說明.md)。

## 程式架構

不使用建置工具：原生 JavaScript ES modules，Three.js 0.170.0 由 `index.html` 的 importmap 從 CDN 載入。

| 檔案 | 負責 |
|---|---|
| `src/app.js` | 入口：讀取內容、首頁、開始／繼續、3D 與文字模式切換、3D 失敗時改用文字模式 |
| `src/game.js` | 遊戲規則：任務進度、對話入口、發卡、用卡、謎題、麻糬的提示、讀檔修復（兩種模式共用） |
| `src/state.js` | 本機進度與設定（localStorage，存檔 v2） |
| `src/ui.js` | 對話框、提示訊息、確認視窗、設定、麻糬的帶路提示、取得卡片特效、任務目標 |
| `src/cards.js` | 卡面插圖、卡冊、使用理解卡面板 |
| `src/minigames.js` | 「想法放大鏡」與「回到這座花園」兩個練習 |
| `src/puzzles.js`、`src/puzzle-art.js` | 兩個謎題的直接操作與插畫 |
| `src/sfx.js` | 音效（程式即時合成） |
| `src/text-mode.js` | 文字模式 |
| `src/help.js` | 「找支持」面板，獨立於遊戲程式，遊戲出錯時也能使用 |
| `src/three/` | 3D 模式：場景（`world.js`）、角色（`characters.js`）、鏡頭（`camera.js`）、光線（`lighting.js`）、輸入（`controls.js`）、主程式（`main.js`）、正式模型載入（`island.js`） |

### 地圖座標

活動範圍 36 × 22 單位（約公尺），西北角在原點，+X 往東、+Z 往南，地面 `y = 0`。咖啡店外在西側（x < 11.8）、小廣場在中間、小花園在東側（x > 24.6）。
`content/places.json`、`content/characters.json` 的座標要和 `src/three/world.js` 的擺設與碰撞對齊（謎題的桌子與植物木架也在 `world.js`）。

### 替換成正式模型

目前的小鎮與角色都是程式用簡單幾何造型拼成。要換成正式模型時：

- **小鎮**：把模型放在 `assets/models/island.glb`，3D 模式會改用它當外觀（碰撞仍由 `world.js` 提供）。座標依上一節，名稱以 `Water` 開頭的網格會有水面閃動，以 `NoShadow` 開頭的不投影。支援 Draco 壓縮，建議 5 MB 以內。
- **角色**：在 `src/three/characters.js` 載入模型，回傳的物件要有 `userData.body`（`main.js` 用它做呼吸與走路動畫），腳底在原點、臉朝 +Z、身高約 1.2。

## 字體

全站內文用 jf open 粉圓，便條、卡片標題等點綴用芫荽，都是 OFL 開源字體，子集化後放在 `assets/fonts/`（約 230 KB 與 110 KB）。字體載入前會先顯示系統字體。

新增或修改文字後，用維護腳本重新產生字體檔（不重跑時，新字會先用系統字體顯示）：

```bash
pip install fonttools brotli
python3 tools/subset-fonts.py --huninn 路徑/jf-openhuninn-2.1.ttf --iansui 路徑/Iansui-Regular.ttf
```

原始字體下載：jf open 粉圓 <https://github.com/justfont/open-huninn-font>、芫荽 <https://github.com/ButTaiwan/iansui>。

## 測試

驗收測試依企劃書 7.1 節，用 Playwright 在瀏覽器實際操作（不屬於遊戲本身，不需要裝進專案）：

```bash
python -m http.server 8000          # 另一個終端機
BASE=http://localhost:8000 node tests/e2e.cjs
```

最新的測試結果與已知限制見 [docs/測試紀錄.md](docs/測試紀錄.md)。

## 素材來源

| 素材 | 來源 |
|---|---|
| 3D 小鎮、Q 版角色、橘貓麻糬、盆栽、理解卡插圖 | 自製（程式產生的幾何造型與 SVG 線條） |
| 背景音樂 | OpenGameArt 的 CC0 曲子：Hot Springs Town、Catmint、Bluebonnet（Kistol），詳見 docs/素材來源.md |
| 風鈴音效 | 自製（瀏覽器 Web Audio 即時合成，不使用音檔） |
| 3D 引擎 | [Three.js](https://threejs.org/) 0.170.0（MIT 授權），由 jsDelivr CDN 載入 |
| 字型 | 使用玩家裝置內建字型 |

完整清單與授權見 [docs/素材來源.md](docs/素材來源.md)。目前沒有使用第三方圖片或模型；背景音樂是 OpenGameArt 上的 CC0 曲子。

## 心理健康內容的參考來源

- 想法放大鏡：[NIMH 心理治療介紹](https://www.nimh.nih.gov/health/topics/psychotherapies)
- 回到這座花園：[WHO 壓力調適指南介紹](https://www.who.int/thailand/activities/doing-what-matters-in-times-of-stress)
- 現實資源：見 `content/resources.json`，每筆都附官方來源與查核日期（2026-11-01，依企劃文件）。
