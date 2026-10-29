// 3D 佔位模型：參考「いらすとや」的畫風自行建模的原創角色與陪伴小動物
// 畫風重點：平塗色塊、細深咖啡描邊、圓臉、黑豆眼加白色高光、小腮紅、張口微笑、動物用自然毛色。
// 未使用いらすとや的圖檔，只參考風格；如之後直接使用其圖檔，需遵守其使用條款並在 README 註明出處。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
const BLACK = new THREE.MeshBasicMaterial({ color: 0x2f2622 });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const MOUTH = new THREE.MeshBasicMaterial({ color: 0xc0504a, side: THREE.DoubleSide });
const BLUSH = new THREE.MeshBasicMaterial({ color: 0xf59a9a, transparent: true, opacity: 0.8 });

const sphereGeo = new THREE.SphereGeometry(1, 32, 20);
const capsuleGeo = new THREE.CapsuleGeometry(1, 1, 8, 20); // 眉毛用

function withOutline(m, thickness, size) {
  if (!thickness) return m;
  const o = new THREE.Mesh(m.geometry, OUTLINE_MAT);
  o.scale.setScalar(1 + thickness / size);
  m.add(o);
  return m;
}

// outline 為描邊的絕對粗細，0 表示不描邊
function ball(r, mat, x = 0, y = 0, z = 0, outline = 0.014) {
  const m = new THREE.Mesh(sphereGeo, mat);
  m.scale.setScalar(r);
  m.position.set(x, y, z);
  m.castShadow = true;
  return withOutline(m, outline, r);
}

// 膠囊：r 半徑、len 中段長度
function capsule(r, len, mat, x, y, z, outline = 0.014) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return withOutline(m, outline, r);
}

// 在球面上放一個平貼的小物件（眼睛、腮紅、嘴巴）
function onSurface(parent, obj, radius, dir) {
  const n = dir.clone().normalize();
  obj.position.copy(n).multiplyScalar(radius * 1.002);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  parent.add(obj);
}

// 臉：黑豆眼＋白色高光、細眉、小腮紅、張口微笑。r 為頭的半徑
function addFace(head, r, { spread = 0.32, eyeY = 0, brows = true, mouth = true } = {}) {
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(sphereGeo, BLACK);
    eye.scale.set(r * 0.085, r * 0.11, r * 0.04);
    onSurface(head, eye, r, new THREE.Vector3(s * spread, eyeY, 0.93));
    const hi = new THREE.Mesh(sphereGeo, WHITE);
    hi.scale.set(r * 0.035, r * 0.035, r * 0.02);
    onSurface(head, hi, r * 1.035, new THREE.Vector3(s * spread + 0.035, eyeY + 0.05, 0.93));
    if (brows) {
      const brow = new THREE.Mesh(capsuleGeo, BLACK);
      brow.scale.set(r * 0.018, r * 0.07, r * 0.01);
      const wrap = new THREE.Group();
      brow.rotation.z = Math.PI / 2 - s * 0.12; // 眉尾微微下垂，表情溫和
      wrap.add(brow);
      onSurface(head, wrap, r * 1.01, new THREE.Vector3(s * spread, eyeY + 0.24, 0.93));
    }
    const blush = new THREE.Mesh(new THREE.CircleGeometry(r * 0.11, 20), BLUSH);
    blush.scale.y = 0.55;
    onSurface(head, blush, r * 1.01, new THREE.Vector3(s * (spread + 0.2), eyeY - 0.17, 0.87));
  }
  if (mouth) {
    // 張口微笑：下半圓
    const m = new THREE.Mesh(new THREE.CircleGeometry(r * 0.09, 20, Math.PI, Math.PI), MOUTH);
    m.scale.y = 0.8;
    onSurface(head, m, r * 1.012, new THREE.Vector3(0, eyeY - 0.2, 1));
  }
}

function makePersonProcedural(look) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // 呼吸、走路時縮放這一層
  root.add(body);
  const skin = toon(look.skin);
  const outfit = toon(look.outfit);
  const pants = toon(new THREE.Color(look.outfit).multiplyScalar(0.72).getHex());
  const hair = toon(look.hairColor);
  const shoe = toon(0x8a6450);

  // 鞋、腿、身體、袖子、手
  body.add(ball(0.08, shoe, -0.09, 0.05, 0.04), ball(0.08, shoe, 0.09, 0.05, 0.04));
  body.add(capsule(0.065, 0.12, pants, -0.085, 0.17, 0), capsule(0.065, 0.12, pants, 0.085, 0.17, 0));
  const torso = capsule(0.2, 0.16, outfit, 0, 0.44, 0);
  torso.scale.z = 0.85;
  body.add(torso);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 8, 20), toon(0xfffaf2));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.62;
  body.add(collar);
  for (const sx of [-1, 1]) {
    const arm = capsule(0.055, 0.14, outfit, sx * 0.23, 0.45, 0);
    arm.rotation.z = sx * 0.18;
    body.add(arm, ball(0.055, skin, sx * 0.27, 0.32, 0.01));
  }

  // 頭
  const head = new THREE.Group();
  head.position.y = 0.93;
  body.add(head);
  const R = 0.34;
  head.add(ball(R, skin));
  if (look.hairStyle === 'long') {
    const back = ball(0.34, hair, 0, -0.14, -0.1);
    back.scale.set(0.37, 0.4, 0.3);
    head.add(back);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), hair);
  cap.rotation.x = -0.38;
  cap.castShadow = true;
  head.add(withOutline(cap, 0.012, R));
  // 瀏海：一片斜斜的髮束
  const fringe = ball(0.15, hair, 0.06, 0.2, 0.24, 0);
  fringe.scale.set(0.22, 0.09, 0.12);
  fringe.rotation.z = -0.25;
  head.add(fringe);
  if (look.hairStyle === 'bun') head.add(ball(0.12, hair, 0, 0.38, -0.08));
  if (look.hairStyle === 'short') {
    const side = (sx) => { const b = ball(0.1, hair, sx * 0.3, 0.02, 0.03, 0); b.scale.set(0.07, 0.13, 0.1); return b; };
    head.add(side(-1), side(1));
  }
  addFace(head, R, { spread: 0.3, eyeY: -0.04 });

  root.userData.body = body;
  return root;
}

// 自然毛色：橘虎斑貓、柴犬、刺蝟、水獺
const PET = {
  cat: { fur: 0xf3b56e, accent: 0xd98a45, belly: 0xfff4e4 },
  dog: { fur: 0xe9a25b, accent: 0xd38a45, belly: 0xfff4e1 },
  hedgehog: { fur: 0xf6e3c8, accent: 0x8d6a52, belly: 0xf6e3c8 },
  otter: { fur: 0xa47450, accent: 0x7d553a, belly: 0xf1e0c8 },
};

function makePetProcedural(type) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const c = PET[type];
  const fur = toon(c.fur);
  const accent = toon(c.accent);
  const belly = toon(c.belly);

  const torso = ball(0.2, type === 'hedgehog' ? accent : fur, 0, 0.2, -0.06);
  torso.scale.set(0.2, 0.17, 0.25);
  body.add(torso);
  const chest = ball(0.12, belly, 0, 0.2, 0.1, 0);
  chest.scale.set(0.12, 0.12, 0.08);
  body.add(chest);
  for (const [x, z] of [[-0.1, 0.1], [0.1, 0.1], [-0.1, -0.2], [0.1, -0.2]]) body.add(ball(0.055, type === 'hedgehog' ? belly : fur, x, 0.05, z));

  if (type === 'cat') {
    // 虎斑條紋
    for (const z of [-0.18, -0.06, 0.06]) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 20, Math.PI), accent);
      stripe.position.set(0, 0.22, z);
      stripe.rotation.y = Math.PI / 2;
      stripe.scale.set(1, 0.95, 1.15);
      body.add(stripe);
    }
    const tail = capsule(0.035, 0.22, fur, 0, 0.33, -0.33);
    tail.rotation.x = -0.6;
    body.add(tail);
  }
  if (type === 'dog') {
    // 捲捲的柴犬尾巴
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.035, 10, 20), fur);
    tail.position.set(0, 0.36, -0.28);
    tail.rotation.y = Math.PI / 2;
    tail.castShadow = true;
    body.add(withOutline(tail, 0.01, 0.07));
  }
  if (type === 'otter') {
    const tail = ball(0.08, fur, 0, 0.1, -0.38);
    tail.scale.set(0.06, 0.045, 0.17);
    body.add(tail);
  }
  if (type === 'hedgehog') {
    const cone = new THREE.ConeGeometry(0.045, 0.13, 8);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2 * 3.1;
      const v = new THREE.Vector3(Math.cos(a) * 0.8, 0.5 + (i % 3) * 0.2, -0.3 - (i / 30) * 0.7).normalize();
      const spike = new THREE.Mesh(cone, accent);
      spike.position.set(v.x * 0.2, 0.2 + v.y * 0.17, -0.06 + v.z * 0.25);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
      spike.castShadow = true;
      body.add(spike);
    }
  }

  const head = new THREE.Group();
  head.position.set(0, 0.4, 0.13);
  body.add(head);
  const R = 0.18;
  head.add(ball(R, fur));

  if (type === 'cat' || type === 'dog') {
    const ear = new THREE.ConeGeometry(0.065, 0.12, 16);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(ear, fur);
      e.position.set(s * 0.1, 0.16, -0.01);
      e.rotation.z = -s * 0.3;
      e.castShadow = true;
      head.add(withOutline(e, 0.008, 0.065));
    }
  }
  if (type === 'cat') {
    const stripe = ball(0.05, accent, 0, 0.14, 0.08, 0);
    stripe.scale.set(0.05, 0.02, 0.04);
    head.add(stripe);
  }
  if (type === 'otter' || type === 'hedgehog') head.add(ball(0.04, accent, -0.13, 0.12, -0.02), ball(0.04, accent, 0.13, 0.12, -0.02));
  // 白色口鼻
  if (type !== 'cat') head.add(ball(0.075, belly, 0, -0.07, 0.13, 0));
  addFace(head, R, { spread: 0.38, eyeY: 0.04, brows: false, mouth: false });
  const nose = new THREE.Mesh(sphereGeo, BLACK);
  nose.scale.set(0.022, 0.016, 0.016);
  onSurface(head, nose, R * (type === 'cat' ? 1.02 : 1.12), new THREE.Vector3(0, -0.12, 1));

  root.userData.body = body;
  return root;
}

// ---- Blender 模型（assets/models/*.glb，由 assets/models/build_models.py 產生）----
// 載入失敗時改用上面程式拼出來的備用造型。
const MODEL_NAMES = ['person', 'cat', 'dog', 'hedgehog', 'otter'];
const models = {};
const OUTLINE_GLB = new THREE.MeshBasicMaterial({ color: 0x4f3c33 }); // glb 的描邊外殼已翻轉法線
const FIXED = { Outline: OUTLINE_GLB, Eye: BLACK, Nose: BLACK, Highlight: WHITE, Blush: BLUSH, Mouth: MOUTH };

export async function loadModels() {
  const loader = new GLTFLoader();
  await Promise.all(MODEL_NAMES.map(async (name) => {
    try {
      models[name] = (await loader.loadAsync(`assets/models/${name}.glb`)).scene;
    } catch (e) {
      console.warn(`模型 ${name}.glb 載入失敗，改用備用造型`, e);
    }
  }));
}

// 依材質名稱上色；visible(node) 回傳 false 的物件會隱藏（用來切換髮型）
function fromModel(src, colors, visible = () => true) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const model = src.clone(true);
  const mats = {};
  model.traverse((o) => {
    if (o !== model && o.parent === model && !visible(o)) o.visible = false;
    if (!o.isMesh) return;
    const key = o.material.name.split('.')[0];
    if (FIXED[key]) {
      o.material = FIXED[key];
    } else {
      mats[key] ??= toon(colors[key] ?? 0xcccccc);
      o.material = mats[key];
      o.castShadow = true;
    }
  });
  body.add(model);
  root.userData.body = body;
  return root;
}

export function makePerson(look) {
  if (!models.person) return makePersonProcedural(look);
  const outfit = new THREE.Color(look.outfit);
  return fromModel(models.person, {
    Skin: look.skin,
    Outfit: look.outfit,
    Pants: outfit.clone().multiplyScalar(0.72).getHex(),
    Hair: look.hairColor,
    Shoe: 0x8a6450,
    White: 0xfffaf2,
  }, (node) => !node.name.startsWith('Hair_') || node.name.startsWith('Hair_common') || node.name.startsWith(`Hair_${look.hairStyle}`));
}

export function makePet(type) {
  if (!models[type]) return makePetProcedural(type);
  const c = PET[type];
  return fromModel(models[type], { Fur: c.fur, Accent: c.accent, Belly: c.belly });
}
