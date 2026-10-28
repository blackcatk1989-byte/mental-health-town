// 3D 佔位模型：圓潤的麻糬風格原創角色與陪伴小動物（卡通著色＋描邊）
import * as THREE from 'three';

// 三階卡通光影
const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

// 灰霧的去飽和效果在 main.js 用 canvas 的 CSS filter 處理，材質不需個別調整
export function toon(hex) {
  return new THREE.MeshToonMaterial({ color: hex, gradientMap });
}

export const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x7a6156, side: THREE.BackSide });
const BLACK = new THREE.MeshBasicMaterial({ color: 0x3d322c });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const BLUSH = new THREE.MeshBasicMaterial({ color: 0xf6a9a9, transparent: true, opacity: 0.75 });

const sphereGeo = new THREE.SphereGeometry(1, 32, 20);

// outline 為描邊的絕對粗細，0 表示不描邊
function ball(r, mat, x = 0, y = 0, z = 0, outline = 0.018) {
  const m = new THREE.Mesh(sphereGeo, mat);
  m.scale.setScalar(r);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (outline) {
    const o = new THREE.Mesh(sphereGeo, OUTLINE_MAT);
    o.scale.setScalar(1 + outline / r);
    m.add(o);
  }
  return m;
}

// 在球面上放一個平貼的小物件（眼睛、腮紅、嘴巴）
function onSurface(parent, obj, radius, dir) {
  const n = dir.clone().normalize();
  obj.position.copy(n).multiplyScalar(radius * 1.002);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  parent.add(obj);
}

// 臉：小豆豆眼睛加高光、腮紅、小小的微笑。center 為頭部群組，r 為頭的半徑
function addFace(head, r, spread = 0.36, eyeY = 0) {
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(sphereGeo, BLACK);
    eye.scale.set(r * 0.075, r * 0.095, r * 0.04);
    onSurface(head, eye, r, new THREE.Vector3(s * spread, eyeY, 0.92));
    const hi = new THREE.Mesh(sphereGeo, WHITE);
    hi.scale.set(r * 0.028, r * 0.028, r * 0.02);
    onSurface(head, hi, r * 1.03, new THREE.Vector3(s * spread + 0.03, eyeY + 0.05, 0.92));
    const blush = new THREE.Mesh(new THREE.CircleGeometry(r * 0.13, 20), BLUSH);
    blush.scale.y = 0.6;
    onSurface(head, blush, r * 1.01, new THREE.Vector3(s * (spread + 0.22), eyeY - 0.2, 0.85));
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(r * 0.06, r * 0.014, 6, 16, Math.PI), BLACK);
  mouth.rotation.z = Math.PI;
  const wrap = new THREE.Group();
  wrap.add(mouth);
  onSurface(head, wrap, r * 1.005, new THREE.Vector3(0, eyeY - 0.17, 1));
}

export function makePerson(look) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // 呼吸、走路時縮放這一層
  root.add(body);
  const skin = toon(look.skin);
  const outfit = toon(look.outfit);
  const hair = toon(look.hairColor);
  const shoe = toon(new THREE.Color(look.outfit).multiplyScalar(0.8).getHex());

  body.add(ball(0.1, shoe, -0.12, 0.07, 0.03), ball(0.1, shoe, 0.12, 0.07, 0.03));
  const torso = ball(0.3, outfit, 0, 0.3, 0);
  torso.scale.set(0.3, 0.27, 0.28);
  body.add(torso);
  body.add(ball(0.085, skin, -0.3, 0.32, 0.04), ball(0.085, skin, 0.3, 0.32, 0.04));

  const head = new THREE.Group();
  head.position.y = 0.86;
  body.add(head);
  const R = 0.44;
  const face = ball(R, skin);
  face.scale.set(R, R * 0.93, R);
  head.add(face);

  if (look.hairStyle === 'long') {
    const back = ball(0.4, hair, 0, -0.18, -0.16);
    back.scale.set(0.44, 0.46, 0.32);
    head.add(back);
  }
  const capGeo = new THREE.SphereGeometry(R * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
  const cap = new THREE.Mesh(capGeo, hair);
  cap.rotation.x = -0.32;
  cap.castShadow = true;
  head.add(cap);
  for (const [x, s] of [[-0.2, 0.12], [0, 0.14], [0.2, 0.12]]) head.add(ball(s, hair, x, 0.24, 0.33, 0));
  if (look.hairStyle === 'bun') head.add(ball(0.15, hair, 0, 0.5, -0.08));
  if (look.hairStyle === 'short') head.add(ball(0.12, hair, -0.4, 0.06, 0.05, 0), ball(0.12, hair, 0.4, 0.06, 0.05, 0));
  addFace(head, R * 1.01, 0.34, -0.06);

  root.userData.body = body;
  root.scale.setScalar(0.85);
  return root;
}

const PET_COLORS = {
  cat: { fur: 0xfff3e6, accent: 0xf2c79b },
  dog: { fur: 0xf4dcbc, accent: 0xc99a6c },
  hedgehog: { fur: 0xf8e9d4, accent: 0xb59379 },
  otter: { fur: 0xd8b08c, accent: 0xa9805f },
};

export function makePet(type) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const { fur, accent } = PET_COLORS[type];
  const furMat = toon(fur);
  const accentMat = toon(accent);
  const cream = toon(0xfffaf2);

  const torso = ball(0.22, type === 'hedgehog' ? accentMat : furMat, 0, 0.2, -0.06);
  torso.scale.set(0.22, 0.18, 0.26);
  body.add(torso);
  body.add(ball(0.06, accentMat, -0.1, 0.05, 0.1, 0), ball(0.06, accentMat, 0.1, 0.05, 0.1, 0));

  if (type === 'hedgehog') {
    const cone = new THREE.ConeGeometry(0.05, 0.14, 8);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 * 3.1;
      const v = new THREE.Vector3(Math.cos(a) * 0.8, 0.5 + (i % 3) * 0.2, -0.3 - (i / 26) * 0.7).normalize();
      const spike = new THREE.Mesh(cone, accentMat);
      spike.position.set(v.x * 0.22, 0.2 + v.y * 0.18, -0.06 + v.z * 0.26);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
      spike.castShadow = true;
      body.add(spike);
    }
  }

  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.12);
  body.add(head);
  const R = 0.2;
  head.add(ball(R, furMat));

  if (type === 'cat') {
    const ear = new THREE.ConeGeometry(0.07, 0.13, 16);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(ear, furMat);
      e.position.set(s * 0.11, 0.18, 0);
      e.rotation.z = -s * 0.35;
      e.castShadow = true;
      head.add(e);
    }
    const tail = ball(0.05, accentMat, 0, 0.32, -0.32, 0);
    tail.scale.set(0.05, 0.14, 0.05);
    tail.rotation.x = -0.5;
    body.add(tail);
  }
  if (type === 'dog') {
    for (const s of [-1, 1]) {
      const e = ball(0.07, accentMat, s * 0.19, 0.02, 0, 0);
      e.scale.set(0.05, 0.1, 0.06);
      e.rotation.z = s * 0.3;
      head.add(e);
    }
    body.add(ball(0.06, accentMat, 0, 0.3, -0.34, 0));
  }
  if (type === 'otter') {
    head.add(ball(0.045, accentMat, -0.15, 0.13, -0.02, 0), ball(0.045, accentMat, 0.15, 0.13, -0.02, 0));
    const tail = ball(0.08, accentMat, 0, 0.1, -0.4, 0);
    tail.scale.set(0.07, 0.05, 0.16);
    body.add(tail);
  }
  if (type === 'hedgehog') {
    head.add(ball(0.045, accentMat, -0.13, 0.15, -0.02, 0), ball(0.045, accentMat, 0.13, 0.15, -0.02, 0));
  }
  if (type === 'dog' || type === 'otter') head.add(ball(0.08, cream, 0, -0.07, 0.15, 0));
  addFace(head, R, 0.38, 0.02);
  const nose = new THREE.Mesh(sphereGeo, BLACK);
  nose.scale.set(0.022, 0.016, 0.016);
  onSurface(head, nose, R * 1.04, new THREE.Vector3(0, -0.12, 1));

  root.userData.body = body;
  return root;
}
