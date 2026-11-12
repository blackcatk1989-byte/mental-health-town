// 角色造型：可愛圓潤的 Q 版（約 2.2 頭身、大頭、圓角、柔和配色），全部用幾何造型拼成（自製，不使用外部模型）。
// 腳底在原點、臉朝 +Z、身高約 1.2。零件依可動部位合併（merge.js），每個角色只有幾個繪製呼叫。
// 回傳的物件有 userData.body（main.js 用它整體上下彈跳），動畫用 animateCharacter()／animateCat()。
// 角色只用髮型、服裝與配件區分，不用任何和疾病有關的顏色或符號。
import * as THREE from 'three';
import { at, mergedMesh } from './merge.js';
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

// 頂點色的卡通材質：合併後的零件共用這一個材質
export const vertexToon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap });

// 玩家的預設中性造型（不要求填真名、性別或健康資訊）
export const PLAYER_LOOK = { skin: '#efcfb2', hair: '#7a5a44', hairStyle: 'short', outfit: '#e9b98a', accent: '#f6ecd9', pants: '#8a7a6c' };

const G = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLow: new THREE.SphereGeometry(1, 12, 8),
  cap: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
  capsule: new THREE.CapsuleGeometry(1, 1, 6, 14),
  cone: new THREE.ConeGeometry(1, 1, 10),
  smile: new THREE.TorusGeometry(1, 0.28, 6, 12, Math.PI * 0.8),
  box: new THREE.BoxGeometry(1, 1, 1),
};

// 一個可動的部位：pivot 群組裝著合併好的網格
function part(parent, x, y, z, parts) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.add(mergedMesh(parts, vertexToon));
  parent.add(pivot);
  return pivot;
}

export function makeCharacter(look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pants = look.pants ?? '#7d6a5c';
  const shoe = '#6f5a4c';

  // 腿與鞋（臀部為轉軸）
  const leg = (x) => part(body, x, 0.21, 0, [
    [G.capsule, pants, at(0, -0.07, 0, { sx: 0.07, sy: 0.05, sz: 0.07 })],
    [G.sphere, shoe, at(0, -0.17, 0.03, { sx: 0.085, sy: 0.05, sz: 0.11 })],
  ]);
  const legL = leg(-0.085);
  const legR = leg(0.085);

  // 身體：圓圓的上衣，加上配件
  const torso = [
    [G.sphere, look.outfit, at(0, 0.36, 0, { sx: 0.19, sy: 0.17, sz: 0.16 })],
    [G.sphere, look.outfit, at(0, 0.25, 0, { sx: 0.18, sy: 0.08, sz: 0.15 })],
    [G.sphere, look.accent, at(0, 0.5, 0.05, { sx: 0.09, sy: 0.03, sz: 0.07 })], // 衣領
  ];
  if (look.accessory === 'apron') {
    torso.push([G.box, look.accent, at(0, 0.3, 0.15, { sx: 0.22, sy: 0.2, sz: 0.03, rx: -0.15 })]);
    torso.push([G.box, '#c9a77f', at(0, 0.27, 0.168, { sx: 0.1, sy: 0.06, sz: 0.01, rx: -0.15 })]); // 口袋
  }
  if (look.accessory === 'scarf') {
    torso.push([G.capsule, look.accent, at(0, 0.52, 0, { sx: 0.17, sy: 0.02, sz: 0.15, rz: Math.PI / 2 })]);
  }
  const torsoPart = part(body, 0, 0, 0, torso);

  // 手（肩膀為轉軸）
  const arm = (x) => part(body, x, 0.45, 0, [
    [G.capsule, look.outfit, at(0, -0.09, 0, { sx: 0.05, sy: 0.045, sz: 0.05 })],
    [G.sphere, look.skin, at(0, -0.19, 0.01, { s: 0.05 })],
  ]);
  const armL = arm(-0.2);
  const armR = arm(0.2);

  // 頭（脖子為轉軸）：大頭、圓臉、頭髮、腮紅、嘴巴
  const R = 0.31;
  const headParts = [
    [G.sphere, look.skin, at(0, R, 0, { sx: R, sy: R * 0.95, sz: R * 0.95 })],
    [G.sphereLow, look.skin, at(-R * 0.98, R * 0.95, 0, { s: 0.05 })], // 耳朵
    [G.sphereLow, look.skin, at(R * 0.98, R * 0.95, 0, { s: 0.05 })],
    [G.cap, look.hair, at(0, R * 1.02, -0.015, { sx: R * 1.07, sy: R * 1.05, sz: R * 1.07, rx: -0.3 })],
    [G.sphereLow, '#f2a99a', at(-0.15, R * 0.78, R * 0.83, { sx: 0.05, sy: 0.03, sz: 0.02 })], // 腮紅
    [G.sphereLow, '#f2a99a', at(0.15, R * 0.78, R * 0.83, { sx: 0.05, sy: 0.03, sz: 0.02 })],
    [G.smile, '#8a5a4a', at(0, R * 0.7, R * 0.93, { s: 0.028, rz: Math.PI * 1.1 })],
  ];
  // 瀏海
  for (const [x, y, sz] of [[-0.14, 0.5, 0.12], [0, 0.53, 0.13], [0.14, 0.5, 0.12]]) {
    headParts.push([G.sphereLow, look.hair, at(x, y, 0.2, { sx: sz, sy: 0.08, sz: 0.1 })]);
  }
  if (look.hairStyle === 'long') {
    headParts.push([G.capsule, look.hair, at(0, 0.22, -0.18, { sx: 0.26, sy: 0.12, sz: 0.14 })]);
    for (const x of [-0.27, 0.27]) headParts.push([G.capsule, look.hair, at(x, 0.2, -0.02, { sx: 0.08, sy: 0.12, sz: 0.1 })]);
  } else if (look.hairStyle === 'short') {
    headParts.push([G.cone, look.hair, at(0.05, 0.66, -0.02, { sx: 0.05, sy: 0.08, sz: 0.05, rz: -0.4 })]); // 翹起的一撮
  }
  if (look.accessory === 'clip') headParts.push([G.sphereLow, look.accent, at(0.2, 0.52, 0.17, { sx: 0.05, sy: 0.03, sz: 0.03 })]);
  const head = part(body, 0, 0.47, 0, headParts);

  // 眼睛（另一個網格，眨眼時壓扁）
  const eyes = part(head, 0, R * 0.98, 0, [
    [G.sphereLow, '#3d322c', at(-0.11, 0, R * 0.88, { sx: 0.042, sy: 0.055, sz: 0.03 })],
    [G.sphereLow, '#3d322c', at(0.11, 0, R * 0.88, { sx: 0.042, sy: 0.055, sz: 0.03 })],
    [G.sphereLow, '#ffffff', at(-0.098, 0.018, R * 0.93, { s: 0.014 })],
    [G.sphereLow, '#ffffff', at(0.122, 0.018, R * 0.93, { s: 0.014 })],
  ]);

  root.userData = { body, legL, legR, armL, armR, head, torso: torsoPart, eyes, phase: Math.random() * 10 };
  return root;
}

// 待機：呼吸、偶爾眨眼、頭輕輕晃；走路：手腳擺動、身體一彈一彈。減少動畫時全部停止。
export function animateCharacter(root, t, walking, still) {
  const u = root.userData;
  const k = still ? 0 : 1;
  if (walking && !still) {
    const w = Math.sin(t * 11);
    u.legL.rotation.x = w * 0.6;
    u.legR.rotation.x = -w * 0.6;
    u.armL.rotation.x = -w * 0.55;
    u.armR.rotation.x = w * 0.55;
    u.body.position.y = Math.abs(Math.sin(t * 11)) * 0.045;
    u.head.rotation.z = Math.sin(t * 11) * 0.04;
  } else {
    u.legL.rotation.x *= 0.8;
    u.legR.rotation.x *= 0.8;
    u.armL.rotation.x *= 0.8;
    u.armR.rotation.x *= 0.8;
    u.body.position.y *= 0.8;
    u.head.rotation.z = Math.sin(t * 0.9 + u.phase) * 0.05 * k;
  }
  const b = Math.sin(t * 2.2 + u.phase) * 0.02 * k;
  u.torso.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5);
  u.armL.rotation.z = -0.12 - b;
  u.armR.rotation.z = 0.12 + b;
  u.eyes.scale.y = k && ((t + u.phase) % 4.2) < 0.13 ? 0.12 : 1;
}

// 橘貓麻糬：圓滾滾、大頭、小耳朵、尾巴會擺。腳底在原點、臉朝 +Z
export function makeCat() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const fur = '#eaa25a';
  const light = '#fbe3c4';
  const torso = part(body, 0, 0, 0, [
    [G.sphere, fur, at(0, 0.17, -0.02, { sx: 0.15, sy: 0.13, sz: 0.19 })],
    [G.sphere, light, at(0, 0.13, 0.06, { sx: 0.1, sy: 0.09, sz: 0.12 })],
    ...[[-0.07, 0.09], [0.07, 0.09], [-0.07, -0.11], [0.07, -0.11]].map(([x, z]) => [G.capsule, fur, at(x, 0.05, z, { sx: 0.035, sy: 0.03, sz: 0.035 })]),
  ]);
  const head = part(body, 0, 0.27, 0.13, [
    [G.sphere, fur, at(0, 0.06, 0.02, { sx: 0.16, sy: 0.14, sz: 0.14 })],
    [G.sphere, light, at(0, 0.02, 0.12, { sx: 0.075, sy: 0.05, sz: 0.04 })],
    [G.cone, fur, at(-0.09, 0.19, 0.0, { sx: 0.05, sy: 0.08, sz: 0.04, rz: 0.25 })],
    [G.cone, fur, at(0.09, 0.19, 0.0, { sx: 0.05, sy: 0.08, sz: 0.04, rz: -0.25 })],
    [G.cone, '#f2b5a6', at(-0.09, 0.185, 0.015, { sx: 0.028, sy: 0.05, sz: 0.02, rz: 0.25 })],
    [G.cone, '#f2b5a6', at(0.09, 0.185, 0.015, { sx: 0.028, sy: 0.05, sz: 0.02, rz: -0.25 })],
    [G.sphereLow, '#3d322c', at(-0.055, 0.07, 0.13, { sx: 0.022, sy: 0.03, sz: 0.015 })],
    [G.sphereLow, '#3d322c', at(0.055, 0.07, 0.13, { sx: 0.022, sy: 0.03, sz: 0.015 })],
    [G.sphereLow, '#e48c86', at(0, 0.035, 0.165, { sx: 0.016, sy: 0.011, sz: 0.01 })],
  ]);
  const tail = part(body, 0, 0.2, -0.19, [
    [G.capsule, '#d98d45', at(0, 0.1, -0.03, { sx: 0.03, sy: 0.1, sz: 0.03, rx: -0.5 })],
  ]);
  root.userData = { body, torso, head, tail, phase: Math.random() * 10 };
  return root;
}

// 麻糬的動作：走路時身體彈、尾巴快擺；停下來時坐著、尾巴慢慢擺、偶爾歪頭
export function animateCat(cat, t, walking, still) {
  const u = cat.userData;
  const k = still ? 0 : 1;
  u.body.position.y = walking && !still ? Math.abs(Math.sin(t * 14)) * 0.035 : 0;
  const sit = walking ? 0 : 0.35;
  u.torso.rotation.x += (-sit - u.torso.rotation.x) * 0.1;
  u.tail.rotation.z = Math.sin(t * (walking ? 7 : 2) + u.phase) * 0.45 * k;
  u.head.rotation.z = walking ? 0 : Math.sin(t * 0.7 + u.phase) * 0.12 * k;
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
