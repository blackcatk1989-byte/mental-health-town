// 3D 人物已清空，等重新設計；暫時用簡單的標記代表玩家、居民與陪伴小動物。
// 標記前方的小圓錐指出面對的方向（+Z）。main.js 會用 root.userData.body 做呼吸、走路的動畫，替換時請保留這個結構。
import * as THREE from 'three';

// 兩階光影，接近平塗插畫
const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([200, 255]), 2, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

// 灰霧的去飽和效果在 main.js 用 canvas 的 CSS filter 處理，材質不需個別調整
export function toon(hex) {
  return new THREE.MeshToonMaterial({ color: hex, gradientMap });
}

function marker(color, radius, height) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(radius, height - radius * 2, 6, 16), toon(color));
  capsule.position.y = height / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.35, radius * 0.8, 12), toon(0xfffaf3));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, height * 0.7, radius * 1.1);
  for (const m of [capsule, nose]) m.castShadow = true;
  body.add(capsule, nose);
  root.userData.body = body;
  return root;
}

export const makePlayerMarker = () => marker(0xe8a08a, 0.25, 1.1);
export const makeResidentMarker = () => marker(0x9bb7a5, 0.25, 1.1);
export const makePetMarker = () => marker(0xf3d29b, 0.16, 0.4);
