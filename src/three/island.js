// 載入整座小鎮的 3D 模型（assets/models/island.glb）。
// 檔案不存在或載入失敗時回傳 null，main.js 就繼續使用 world.js 用簡單幾何拼成的小鎮。
//
// island.glb 製作約定（詳見 README「替換成正式模型」）：
// - 活動範圍為 world.js 的 36 × 22 單位，西北角在原點，+X 往東、+Z 往南（Blender 匯出時勾選 +Y Up）。
// - 地面高度 y = 0；碰撞由 world.js 提供，模型只負責外觀，擺設位置要和 world.js、content/ 的座標對齊。
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
    console.info(`沒有找到 ${url}，使用內建的小鎮造型`);
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
    console.warn(`${url} 載入失敗，使用內建的小鎮造型`, e);
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
