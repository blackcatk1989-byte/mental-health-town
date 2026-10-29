// 3D 角色佔位造型：等協作者完成正式的人物與小動物模型後替換。
// 人物＝膠囊身體＋圓頭，小動物＝小圓球；兩個小黑點標示臉朝的方向（+Z）。
// main.js 會用 root.userData.body 做呼吸、走路的縮放動畫，替換時請保留這個結構。
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

export const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x4f3c33, side: THREE.BackSide });
const EYE = new THREE.MeshBasicMaterial({ color: 0x2f2622 });
const sphereGeo = new THREE.SphereGeometry(1, 24, 16);

function part(geo, mat, x, y, z, scale = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.setScalar(scale);
  m.castShadow = true;
  return m;
}

function eyes(body, y, z, spread, size) {
  body.add(part(sphereGeo, EYE, -spread, y, z, size), part(sphereGeo, EYE, spread, y, z, size));
}

export function makePerson(look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(part(new THREE.CapsuleGeometry(0.22, 0.3, 8, 16), toon(look.outfit), 0, 0.4, 0));
  body.add(part(sphereGeo, toon(look.skin), 0, 0.92, 0, 0.3));
  eyes(body, 0.94, 0.28, 0.1, 0.03);
  root.userData.body = body;
  return root;
}

const PET_COLORS = { cat: 0xf3b56e, dog: 0xe9a25b, hedgehog: 0x8d6a52, otter: 0xa47450 };

export function makePet(type) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(part(sphereGeo, toon(PET_COLORS[type] ?? 0xcccccc), 0, 0.22, 0, 0.22));
  eyes(body, 0.27, 0.2, 0.07, 0.022);
  root.userData.body = body;
  return root;
}

