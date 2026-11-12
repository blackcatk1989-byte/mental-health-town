// 角色造型：簡化的圓潤人物（自製幾何造型，不使用外部模型）。
// 腳底在原點、臉朝 +Z、身高約 1.2。main.js 用 root.userData.body 做呼吸與走路動畫，替換成正式模型時請保留這個結構。
import * as THREE from 'three';

// 兩階光影，接近平塗插畫
const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([190, 255]), 2, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const materials = new Map();
export function toon(hex) {
  const key = typeof hex === 'string' ? hex : `#${new THREE.Color(hex).getHexString()}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshToonMaterial({ color: hex, gradientMap }));
  return materials.get(key);
}

// 玩家的預設中性造型（不要求填真名、性別或健康資訊）
export const PLAYER_LOOK = { skin: '#efcfb2', hair: '#7a5a44', hairStyle: 'short', outfit: '#e2b07c', accent: '#f6ecd9' };

export function makeCharacter(look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const parts = [];
  const mesh = (geo, color, x, y, z) => {
    const m = new THREE.Mesh(geo, toon(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parts.push(m);
    body.add(m);
    return m;
  };
  // 身體與衣服
  mesh(new THREE.CapsuleGeometry(0.24, 0.32, 6, 16), look.outfit, 0, 0.42, 0);
  mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 16), look.accent, 0, 0.72, 0).rotation.x = Math.PI / 2;
  // 腳
  for (const x of [-0.1, 0.1]) mesh(new THREE.CapsuleGeometry(0.07, 0.08, 4, 8), '#6f5a4c', x, 0.09, 0.02);
  // 頭
  mesh(new THREE.SphereGeometry(0.27, 24, 16), look.skin, 0, 0.98, 0);
  // 頭髮
  const cap = mesh(new THREE.SphereGeometry(0.29, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), look.hair, 0, 1.0, -0.02);
  cap.rotation.x = -0.25;
  if (look.hairStyle === 'long') {
    const back = mesh(new THREE.CapsuleGeometry(0.2, 0.32, 6, 12), look.hair, 0, 0.8, -0.13);
    back.scale.set(1.25, 1, 0.7);
  }
  // 眼睛與臉頰
  for (const x of [-0.09, 0.09]) {
    mesh(new THREE.SphereGeometry(0.03, 8, 6), '#3d322c', x, 0.97, 0.25);
    mesh(new THREE.SphereGeometry(0.035, 8, 6), '#f0a99a', x * 1.6, 0.91, 0.22).scale.set(1, 0.6, 0.4);
  }
  root.userData.body = body;
  root.userData.parts = parts;
  return root;
}

// 橘貓麻糬：提示用的動物，不能對話。腳底在原點、臉朝 +Z
export function makeCat() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mesh = (geo, color, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo, toon(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  mesh(new THREE.SphereGeometry(0.2, 16, 12), '#e8a35a', 0, 0.2, 0).scale.set(1, 0.85, 1.35);
  mesh(new THREE.SphereGeometry(0.15, 16, 12), '#eeb06a', 0, 0.36, 0.26);
  for (const x of [-0.08, 0.08]) {
    mesh(new THREE.ConeGeometry(0.05, 0.09, 8), '#e8a35a', x, 0.5, 0.25);
    mesh(new THREE.SphereGeometry(0.018, 8, 6), '#3d322c', x * 0.7, 0.38, 0.4);
  }
  mesh(new THREE.SphereGeometry(0.05, 10, 8), '#fff4e6', 0, 0.32, 0.38).scale.set(1.3, 0.8, 0.6);
  const tail = new THREE.Group();
  tail.position.set(0, 0.24, -0.26);
  mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), '#d48b45', 0, 0.12, -0.04, tail).rotation.x = -0.6;
  body.add(tail);
  root.userData.body = body;
  root.userData.tail = tail;
  return root;
}

const POT_PLANTS = {
  rosemary: { leaf: '#7f9d7a', shape: 'spiky' },
  mint: { leaf: '#9fd0a0', shape: 'round' },
  fern: { leaf: '#6fa36b', shape: 'wide' },
};

// 花園謎題的三盆植物：形狀不同（細長、圓團、寬葉），不只靠顏色區分
export function makePot(id) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 12), toon('#c98a6b'));
  pot.position.y = 0.15;
  pot.castShadow = true;
  g.add(pot);
  const p = POT_PLANTS[id];
  const mat = toon(p.leaf);
  if (p.shape === 'spiky') {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.45, 6), mat);
      m.position.set(Math.cos(i * 1.3) * 0.08, 0.5, Math.sin(i * 1.3) * 0.08);
      m.rotation.set(Math.sin(i) * 0.25, 0, Math.cos(i) * 0.25);
      g.add(m);
    }
  } else if (p.shape === 'round') {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), mat);
    m.position.y = 0.45;
    g.add(m);
  } else {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.42), mat);
      m.position.set(0, 0.42, 0);
      m.rotation.set(0.5, (i / 6) * Math.PI * 2, 0);
      m.translateZ(0.16);
      g.add(m);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
