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

### 鏡頭與光線

- 鏡頭（`src/three/camera.js`）：固定 45 度俯角、視角 32 度的溫馨卡通風跟隨鏡頭；滾輪縮放，Q、E 或拖曳旋轉；
  角色創建時拉近看正面，對話時轉到主角斜後方。
- 光線（`src/three/lighting.js`）：暖色天光＋暖陽（柔和陰影，陰影範圍跟著鏡頭移動）＋冷色補光。

### 島嶼模型 island.glb（整座小鎮）

把小鎮模型放在 `assets/models/island.glb`，3D 版就會改用它當外觀；沒有這個檔案時，照舊用 Tiled 地圖蓋出小鎮。
載入程式在 `src/three/island.js`，支援 Draco 壓縮。製作時請遵守：

- **座標對齊 Tiled 地圖**：1 單位 = 1 格；地圖左上角在原點，往東為 +X、往南為 +Z（Blender 裡往南是 -Y，匯出時勾選 +Y Up）。
- **地面高度 y = 0**。碰撞、角色與居民的出生點仍然讀 `maps/` 的 Tiled 地圖，所以房子、樹、水池的位置要和地圖上的障礙物格子一致。
- 名稱以 `Water` 開頭的網格會有水面閃動效果；以 `NoShadow` 開頭的網格不投影。
- 檔案建議 5 MB 以內（減面、貼圖 1024～2048、可用 Draco 壓縮），手機才載得動。
- 外部或 AI 生成的模型，依 `AGENTS.md` 第 5 節在這裡註明來源與條款。

### 3D 角色模型（待協作者建立）

目前 3D 版的人物與小動物是簡單的佔位造型（膠囊身體＋圓頭、小圓球），寫在 `src/three/characters.js`。
正式模型由協作者重新建立，替換時請保留：

- `makePerson(look)`：`look` 有 `hairStyle`、`hairColor`、`outfit`、`skin`（顏色為 `#rrggbb` 字串），選項清單在 `src/art.js`。
- `makePet(type)`：`type` 為 `cat`、`dog`、`hedgehog`、`otter`。
- 兩者回傳的物件要有 `userData.body`（main.js 用它做呼吸與走路動畫），角色腳底在原點、面向 +Z、身高約 1.3。
- 使用外部或 AI 生成的素材時，依 `AGENTS.md` 第 5 節在這裡註明來源、工具與條款連結。

先前的模型與建模腳本已於 2026-10-29 刪除，需要參考時可從 git 歷史找回（commit `133b298` 之前的 `assets/models/`）。
