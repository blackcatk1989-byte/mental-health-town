# 心理健康衛教小鎮（名稱未定）

一款心理健康衛教網頁遊戲。協作規則請見 [AGENTS.md](AGENTS.md)。

## 本機執行

遊戲需要透過本機伺服器開啟（直接雙擊 `index.html` 會讀不到 JSON 檔）。在專案根目錄執行其中一個：

```bash
python -m http.server 8000
```

```bash
npx serve .
```

然後用瀏覽器打開 <http://localhost:8000>（`npx serve` 預設為 <http://localhost:3000>）。

## 操作

- 方向鍵或 WASD 移動，靠近居民後按空白鍵對話
- 手機：左下角虛擬搖桿移動，右下角「對話」按鈕
- 右上角「我需要幫忙」隨時可開啟求助專線

## 目前狀態

最小原型：角色創建、晨光廣場地圖、與新鄰居小禾對話、對話後灰霧變淡。美術皆為佔位素材。
`content/resources.json` 的資訊全部標註「待核對」。

## 3D 試作版

用 Three.js 做的 3D 版晨光廣場：本機開啟 <http://localhost:8000/3d.html>，線上版為 <https://blackcatk1989-byte.github.io/mental-health-town/3d.html>。
沿用同一份 `content/` 內容與 `maps/` 的 Tiled 地圖，2D 版 `index.html` 不受影響。
鏡頭可用 Q、E 或拖曳畫面旋轉；是否改用 3D 尚待兩位協作者決定。

### 玩家角色模型

`assets/models/player.glb` 是 3D 版的玩家角色（羽球造型的 Q 版人物），造型固定，角色創建只剩選擇陪伴小動物與心情溫度計。

- 來源：柯辰提供的 AI 生成模型；生成工具與條款連結：**待補**
- 為了網頁效能，以 Blender 從原始檔（約 150 萬面、3 張 4096 貼圖、83 MB）減到 9 萬面、貼圖縮為 1024、捨棄金屬度／粗糙度貼圖，檔案約 4.3 MB。
- 若檔案載入失敗，會自動改用佔位造型。

### 3D 角色模型（待協作者建立）

目前 3D 版的居民與小動物是簡單的佔位造型（膠囊身體＋圓頭、小圓球），寫在 `src/three/characters.js`。
正式模型由協作者重新建立，替換時請保留：

- `makePerson(look)`：`look` 有 `hairStyle`、`hairColor`、`outfit`、`skin`（顏色為 `#rrggbb` 字串），選項清單在 `src/art.js`。
- `makePet(type)`：`type` 為 `cat`、`dog`、`hedgehog`、`otter`。
- 兩者回傳的物件要有 `userData.body`（main.js 用它做呼吸與走路動畫），角色腳底在原點、面向 +Z、身高約 1.3。
- 使用外部或 AI 生成的素材時，依 `AGENTS.md` 第 5 節在這裡註明來源、工具與條款連結。

先前的模型與建模腳本已於 2026-10-29 刪除，需要參考時可從 git 歷史找回（commit `133b298` 之前的 `assets/models/`）。
