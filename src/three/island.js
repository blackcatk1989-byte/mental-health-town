// 載入整座小鎮的 3D 模型（assets/models/island.glb）。
// 檔案不存在或載入失敗時回傳 null，main.js 就繼續使用由 Tiled 地圖蓋出來的小鎮。
//
// island.glb 製作約定（詳見 README「島嶼模型 island.glb」）：
// - 1 單位 = Tiled 地圖的 1 格；地圖左上角在原點，+X 往東、+Z 往南（Blender 匯出時勾選 +Y Up）。
// - 地面高度 y = 0；碰撞與角色出生點仍讀 Tiled 地圖，模型只負責外觀。
// - 名稱以 Water 開頭的網格會自動有水面波光；以 NoShadow 開頭的網格不投影。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const THREE_VERSION = '0.170.0';

function makeLoader() {
  const loader = new GLTFLoader();
  // 支援 Draco 壓縮的模型（大型場景建議壓縮，手機下載比較快）
  const draco = new DRACOLoader();
  draco.setDecoderPath(`https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/libs/draco/gltf/`);
  loader.setDRACOLoader(draco);
  return loader;
}

async function exists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * @param {THREE.Scene} scene
 * @param {string} url
 * @param {(ratio: number) => void} [onProgress] 下載進度 0～1
 * @returns {Promise<{ root: THREE.Object3D, waters: THREE.Mesh[] } | null>}
 */
export async function loadIsland(scene, url, onProgress) {
  if (!(await exists(url))) {
    console.info(`沒有找到 ${url}，使用 Tiled 地圖蓋出的小鎮`);
    return null;
  }
  try {
    const gltf = await makeLoader().loadAsync(url, (e) => {
      if (e.total) onProgress?.(e.loaded / e.total);
    });
    const root = gltf.scene;
    root.name = 'island';
    const waters = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const noShadow = o.name.startsWith('NoShadow');
      o.castShadow = !noShadow;
      o.receiveShadow = true;
      if (o.name.startsWith('Water')) {
        o.castShadow = false;
        waters.push(o);
      }
    });
    scene.add(root);
    return { root, waters };
  } catch (e) {
    console.warn(`${url} 載入失敗，使用 Tiled 地圖蓋出的小鎮`, e);
    return null;
  }
}

// 讓水面的顏色輕輕起伏，像陽光在水上閃動
export function animateWaters(waters, t) {
  for (const w of waters) {
    const mat = w.material;
    if (!mat?.emissive) continue;
    mat.emissiveIntensity = 0.08 + Math.sin(t * 1.5 + w.id) * 0.05;
    mat.emissive.setHex(0xbfe8ff);
  }
}
