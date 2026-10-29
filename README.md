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

### 3D 角色畫風

參考「いらすとや」（<https://www.irasutoya.com/>）的畫風自行建模，未使用其圖檔。
若之後直接使用いらすとや的圖檔，需遵守其使用條款（<https://www.irasutoya.com/p/terms.html>）：商用作品最多 20 張、不可把素材本身當成主要商品，版權仍屬原作者。

### 3D 模型（Blender）

人物與小動物模型在 `assets/models/*.glb`，由 `assets/models/build_models.py` 用 Blender 產生。修改造型後重新產生：

```bash
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python assets/models/build_models.py
```

加上 `-- --preview 預覽圖.png` 可另外渲染一張全部模型的預覽圖。遊戲依材質名稱上色、依 `Hair_` 物件名稱切換髮型，規則寫在腳本開頭。
