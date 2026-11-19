// 讓微光里看起來有人生活的動態：雲影、飄落的葉子、麻雀、水窪的漣漪、不能對話的居民（剪影式）。
// 都只是氣氛，不影響任務與進度。物件在一開始建好，主迴圈裡只更新位置；
// 「減少動畫」時全部靜止（麻雀與落葉不出現）；低畫質時關閉雲影、落葉與麻雀。
import * as THREE from 'three';
import { animateCharacter, makeCharacter, vertexToon } from './characters.js';
import { at, mergedMesh } from './merge.js';
import { play } from '../sfx.js';

function blobTexture(rgb, alpha) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.6, `rgba(${rgb},${alpha * 0.6})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// 水窪的位置（踩過會有漣漪）
const PUDDLES = [{ x: 6.4, z: 13.5, r: 0.45 }];
// 麻雀停的地方
const FLOCKS = [[[20.6, 16.6], [21.3, 17.0], [20.9, 17.5]], [[30.1, 17.3], [31.0, 17.35], [30.5, 15.9]]];
// 不能對話的居民：在活動範圍外做自己的事
const RESIDENTS = [
  { x: 21.3, z: -0.3, ry: 0.5, act: 'sweep', keepOnLow: true }, // 騎樓下掃地
  { x: -0.75, z: 9.75, ry: Math.PI / 2, act: 'water' }, // 西邊住家門口澆花
  { x: 33.4, z: 0.25, ry: 2.6, act: 'weed' }, // 花園北緣蹲著拔草
  { x: 20.55, y: 0.3, z: 7.85, ry: -0.7, act: 'sit' }, // 坐在榕樹的石椅上看書
  { x: 13.8, z: 16.4, x2: 19.4, ry: Math.PI / 2, act: 'walk', solid: true, look: { skin: '#eccdb0', hair: '#4f4038', hairStyle: 'short', outfit: '#a9c2a0', accent: '#f6ecd9', pants: '#7d8791' } }, // 在廣場南側來回散步的路人（玩家靠近時會停下來）
];
// 蝴蝶：在花圃上方繞圈，玩家靠近時會過來繞著玩家飛一下
const BUTTERFLIES = [[29.0, 4.0, 0xf6d98a], [33.5, 5.8, 0xf3b6a8], [31.2, 20.3, 0xf6d98a], [27.4, 7.2, 0xd9c3ea]];
const STEAM_AT = { x: 8.6, y: 5.3, z: 1.5 }; // 咖啡店的煙囪口
const CHIME_AT = { x: 3.3, z: 5.6 }; // 咖啡店遮陽棚下的小風鈴

const SPHERE = new THREE.SphereGeometry(1, 10, 8);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const CONE = new THREE.ConeGeometry(1, 1, 10);
const BOX = new THREE.BoxGeometry(1, 1, 1);

function makeSparrow() {
  const m = mergedMesh([
    [SPHERE, 0x9a7b5f, at(0, 0.09, 0, { sx: 0.075, sy: 0.07, sz: 0.1 })],
    [SPHERE, 0xe9dcc8, at(0, 0.075, 0.03, { sx: 0.06, sy: 0.05, sz: 0.07 })],
    [SPHERE, 0x7d5f48, at(0, 0.16, 0.07, { s: 0.055 })],
    [CONE, 0x5a504a, at(0, 0.155, 0.135, { rx: Math.PI / 2, sx: 0.018, sy: 0.04, sz: 0.018 })],
    [BOX, 0x7d5f48, at(0, 0.11, -0.12, { rx: -0.5, sx: 0.05, sy: 0.015, sz: 0.1 })],
  ], vertexToon);
  return m;
}

// 剪影式的居民：沒有臉、低彩度，戴斗笠；依動作拿掃把、澆水壺，或蹲著拔草
function makeResident(act) {
  const g = new THREE.Group();
  const body = mergedMesh([
    [CYL, 0xcdbfae, at(0, 0.5, 0, { sx: 0.2, sy: 0.6, sz: 0.17 })],
    [SPHERE, 0xcdbfae, at(0, 0.82, 0, { sx: 0.21, sy: 0.14, sz: 0.18 })],
    [SPHERE, 0xe3d2bd, at(0, 1.03, 0, { s: 0.17 })],
    [CONE, 0xe6d3a3, at(0, 1.2, 0, { sx: 0.3, sy: 0.16, sz: 0.3 })],
    [CYL, 0xb9ab9a, at(-0.08, 0.1, 0, { sx: 0.06, sy: 0.2, sz: 0.07 })],
    [CYL, 0xb9ab9a, at(0.08, 0.1, 0, { sx: 0.06, sy: 0.2, sz: 0.07 })],
  ], vertexToon);
  const tool = mergedMesh(act === 'sweep' ? [
    [CYL, 0x8e6a4c, at(0, -0.45, 0, { sx: 0.02, sy: 1.1, sz: 0.02 })],
    [BOX, 0xd9b26f, at(0, -1.02, 0, { sx: 0.26, sy: 0.16, sz: 0.06 })],
  ] : act === 'water' ? [
    [CYL, 0x8fb3c9, at(0, 0, 0, { sx: 0.1, sy: 0.2, sz: 0.1 })],
    [CYL, 0x8fb3c9, at(0, 0.06, 0.2, { rx: 1.1, sx: 0.02, sy: 0.26, sz: 0.02 })],
  ] : act === 'sit' ? [
    [BOX, 0xfffaf0, at(0, 0, 0, { rx: -0.6, sx: 0.24, sy: 0.02, sz: 0.17 })], // 攤開的書
  ] : act === 'walk' ? [
    [BOX, 0xd9b26f, at(0, -0.22, 0, { sx: 0.2, sy: 0.24, sz: 0.08 })], // 提袋
    [CYL, 0x8e6a4c, at(0, -0.05, 0, { sx: 0.012, sy: 0.14, sz: 0.012 })],
  ] : [
    [SPHERE, 0x93b98a, at(0, 0, 0, { sx: 0.07, sy: 0.1, sz: 0.07 })],
  ], vertexToon);
  tool.position.set(0.22, act === 'sweep' ? 1.05 : 0.72, act === 'sweep' ? 0.2 : 0.26);
  g.add(body, tool);
  if (act === 'weed') g.scale.y = 0.62; // 蹲著
  g.userData = { body, broom: tool, act };
  return g;
}

export function createAmbient(scene, { banyan, fountain, cafeChime, censer }) {
  const root = new THREE.Group();
  root.name = 'ambient';
  scene.add(root);
  const fancy = new THREE.Group(); // 低畫質時整組關掉
  root.add(fancy);

  // ---- 雲影：兩片很淡的影子慢慢飄過地面 ----
  const cloudMat = new THREE.MeshBasicMaterial({ map: blobTexture('92,78,62', 0.17), transparent: true, depthWrite: false });
  const clouds = [[-6, 7, 17, 11, 0.38], [16, 15, 21, 12, 0.3]].map(([x, z, w, d, v]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w, d, 1);
    m.position.set(x, 0.07, z);
    m.userData.v = v;
    m.renderOrder = 1;
    fancy.add(m);
    return m;
  });

  // ---- 榕樹的落葉：六片重複使用 ----
  const LEAVES = 6;
  const leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.08), new THREE.MeshBasicMaterial({ color: 0xa9bf7f, side: THREE.DoubleSide }), LEAVES);
  leafMesh.frustumCulled = false;
  fancy.add(leafMesh);
  const leaves = Array.from({ length: LEAVES }, (_, i) => ({ x: 0, y: -1, z: 0, wait: 1 + i * 2.3, phase: i * 1.7, rest: 0 }));
  const dummy = new THREE.Object3D();
  const hideLeaf = (i) => { dummy.position.set(0, -5, 0); dummy.updateMatrix(); leafMesh.setMatrixAt(i, dummy.matrix); };
  leaves.forEach((_, i) => hideLeaf(i));

  // ---- 許願池的水花：水滴沿著拋物線從噴嘴落回水池，重複使用 ----
  const DROPS = 28;
  const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xe9f6fa }), DROPS);
  dropMesh.frustumCulled = false;
  fancy.add(dropMesh);
  // u 是 0～1 的進度：從噴嘴（高 1.38）往外拋到上層水盤，再從盤緣落到池面
  const placeDrop = (i, u) => {
    const a = (i / DROPS) * Math.PI * 2 * 3 + i;
    const upper = i % 2 === 0;
    const r = upper ? u * 0.46 : 0.6 + u * (fountain.r - 1.0);
    const y = upper ? 1.52 + Math.sin(u * Math.PI) * 0.3 - u * 0.3 : 1.16 - u * u * 0.74 + Math.sin(u * Math.PI) * 0.1;
    dummy.position.set(fountain.x + Math.cos(a) * r, y, fountain.z + Math.sin(a) * r);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    dropMesh.setMatrixAt(i, dummy.matrix);
  };
  for (let i = 0; i < DROPS; i++) placeDrop(i, (i * 0.37) % 1);

  // ---- 蝴蝶：每隻兩片翅膀，全部用同一個 InstancedMesh ----
  const wingGeo = new THREE.PlaneGeometry(0.12, 0.1);
  wingGeo.translate(0.06, 0, 0);
  const wings = new THREE.InstancedMesh(wingGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), BUTTERFLIES.length * 2);
  wings.frustumCulled = false;
  const wingCol = new THREE.Color();
  const flies = BUTTERFLIES.map(([x, z, col], i) => {
    wingCol.set(col);
    wings.setColorAt(i * 2, wingCol);
    wings.setColorAt(i * 2 + 1, wingCol);
    return { hx: x, hz: z, cx: x, cz: z, x, y: 1, z, visit: 0, phase: i * 2.4 };
  });
  fancy.add(wings);
  const placeFly = (i, f, t, flap) => {
    for (let side = 0; side < 2; side++) {
      dummy.position.set(f.x, f.y, f.z);
      dummy.rotation.set(0, -(t * 0.9 + f.phase) + side * Math.PI, flap);
      dummy.updateMatrix();
      wings.setMatrixAt(i * 2 + side, dummy.matrix);
    }
  };

  flies.forEach((f, i) => { f.x = f.hx + 0.75; f.y = 1.15; placeFly(i, f, 0, 0.5); });

  // ---- 咖啡店的熱氣：四團慢慢往上飄的白霧 ----
  const steamMat = (o) => new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: o });
  const steamTex = blobTexture('255,252,246', 0.7);
  const steam = [0, 1, 2, 3].map((i) => {
    const s = new THREE.Sprite(steamMat(0));
    s.userData.phase = i / 4;
    fancy.add(s);
    return s;
  });
  const placeSteam = (s, u) => {
    s.position.set(STEAM_AT.x + Math.sin(u * 5 + s.userData.phase * 9) * 0.12, STEAM_AT.y + u * 1.3, STEAM_AT.z);
    s.scale.setScalar(0.35 + u * 0.55);
    s.material.opacity = Math.sin(u * Math.PI) * 0.55;
  };
  steam.forEach((s) => placeSteam(s, s.userData.phase));

  // ---- 土地公廟的香：玩家上香後，香爐裡插著三炷香，冒一陣子煙 ----
  const sticks = mergedMesh([-0.05, 0, 0.05].flatMap((dx) => [
    [CYL, 0xb5584a, at(dx, 0.17, 0, { rz: -dx * 2, sx: 0.008, sy: 0.34, sz: 0.008 })],
    [SPHERE, 0xf2a25a, at(dx * 1.7, 0.34, 0, { s: 0.016 })],
  ]), vertexToon);
  sticks.position.set(censer.x, censer.y, censer.z);
  sticks.visible = false;
  root.add(sticks);
  const smoke = [0, 1].map((i) => {
    const sp = new THREE.Sprite(steamMat(0));
    sp.userData.phase = i / 2;
    sp.visible = false;
    root.add(sp);
    return sp;
  });
  let incense = 0; // 剩幾秒

  // ---- 咖啡店的小風鈴：平常輕輕晃，玩家走近時響一聲、晃大一點 ----
  let chimeSwing = 0;
  let chimeNear = false;

  // ---- 麻雀：玩家靠近時飛走，過一陣子再回來 ----
  const birds = [];
  for (const flock of FLOCKS) {
    for (const [x, z] of flock) {
      const m = makeSparrow();
      m.position.set(x, 0, z);
      m.rotation.y = x * 7;
      fancy.add(m);
      birds.push({ m, hx: x, hz: z, state: 'ground', t: 0, dx: 0, dz: 0, phase: x * 3 + z });
    }
  }

  // ---- 水窪與漣漪 ----
  const puddleMat = new THREE.MeshBasicMaterial({ color: 0xa9c6d2, transparent: true, opacity: 0.42, depthWrite: false });
  const rippleGeo = new THREE.RingGeometry(0.82, 1, 28);
  const puddles = PUDDLES.map((p) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), puddleMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(p.r, p.r * 0.72, 1);
    m.position.set(p.x, 0.034, p.z);
    root.add(m);
    const shine = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: 0xe6f1f4, transparent: true, opacity: 0.5, depthWrite: false }));
    shine.rotation.x = -Math.PI / 2;
    shine.scale.set(p.r * 0.35, p.r * 0.14, 1);
    shine.position.set(p.x - p.r * 0.25, 0.036, p.z - p.r * 0.2);
    root.add(shine);
    const rings = [0, 1].map(() => {
      const r = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xf4fafb, transparent: true, opacity: 0, depthWrite: false }));
      r.rotation.x = -Math.PI / 2;
      r.position.set(p.x, 0.038, p.z);
      r.visible = false;
      r.userData.life = 0;
      root.add(r);
      return r;
    });
    return { ...p, rings, inside: false, timer: 0, next: 0 };
  });

  // ---- 居民 ----
  const residents = RESIDENTS.map((r) => {
    // 走在廣場上的路人離玩家很近，用和其他角色一樣的 Q 版造型（沒有名牌、不能對話）；遠處的居民維持剪影
    const m = r.look ? makeCharacter(r.look) : makeResident(r.act);
    m.position.set(r.x, r.y ?? 0, r.z);
    m.rotation.y = r.ry;
    root.add(m);
    return { ...r, m, dir: 1 };
  });

  // ---- 許願池的硬幣：拋物線飛進池裡，落水時起漣漪；池底的硬幣只是外觀，不存進進度 ----
  const coinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.012, 14);
  const coinMat = new THREE.MeshToonMaterial({ color: 0xe0c078 });
  const flying = new THREE.Mesh(coinGeo, coinMat);
  flying.visible = false;
  root.add(flying);
  const MAX_COINS = 40;
  const pile = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS);
  pile.count = 0;
  root.add(pile);
  const splashRings = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xf4fafb, transparent: true, opacity: 0, depthWrite: false }));
    r.rotation.x = -Math.PI / 2;
    r.visible = false;
    root.add(r);
    return r;
  });
  let toss = null; // { from, to, t }
  const landCoin = (to) => {
    const i = pile.count % MAX_COINS;
    dummy.position.set(to.x, 0.445, to.z);
    dummy.rotation.set(0, Math.random() * 3, 0);
    dummy.updateMatrix();
    pile.setMatrixAt(i, dummy.matrix);
    pile.count = Math.min(MAX_COINS, pile.count + 1);
    pile.instanceMatrix.needsUpdate = true;
    state.coins++;
  };

  let low = false;
  let lastFlutter = -9;
  const state = { birdsAway: 0, ripples: 0, chimes: 0, visiting: 0, incense: 0, coins: 0 };

  return {
    state, // 測試用
    // 玩家在土地公廟上香
    offerIncense() { incense = 30; },
    // 丟一枚硬幣進許願池；回傳動畫要多久（毫秒）。減少動畫時硬幣直接出現在池底
    tossCoin(from, still) {
      const a = Math.random() * Math.PI * 2;
      const rr = 0.45 + Math.random() * (fountain.r - 0.9);
      const to = { x: fountain.x + Math.cos(a) * rr, z: fountain.z + Math.sin(a) * rr };
      if (still) { landCoin(to); return 300; }
      toss = { from: { x: from.x, y: 1.0, z: from.z }, to, t: 0 };
      flying.visible = true;
      return 1300;
    },
    // 站在路上的居民（會擋住玩家）：main.js 用來做碰撞
    solids: residents.filter((r) => r.solid).map((r) => r.m),
    setQuality(quality) {
      low = quality === 'low';
      fancy.visible = !low;
      for (const r of residents) r.m.visible = !low || r.keepOnLow;
    },
    update(dt, t, still, pos, walking) {
      // 飛行中的硬幣（0.7 秒的拋物線）與落水後的漣漪
      if (toss) {
        toss.t += dt / 0.7;
        const k = Math.min(1, toss.t);
        flying.position.set(toss.from.x + (toss.to.x - toss.from.x) * k, toss.from.y + (0.44 - toss.from.y) * k + Math.sin(k * Math.PI) * 1.4, toss.from.z + (toss.to.z - toss.from.z) * k);
        flying.rotation.set(t * 14, 0, t * 9);
        if (k >= 1) {
          flying.visible = false;
          splashRings.forEach((r, i) => { r.position.set(toss.to.x, 0.45, toss.to.z); r.userData.life = 0.9 + i * 0.25; r.userData.max = r.userData.life; r.visible = true; });
          landCoin(toss.to);
          toss = null;
        }
      }
      for (const r of splashRings) {
        if (!r.visible) continue;
        r.userData.life -= dt;
        const k = Math.max(0, r.userData.life / r.userData.max);
        const s = 0.08 + (1 - k) * 0.5;
        r.scale.set(s, s, 1);
        r.material.opacity = 0.8 * k;
        if (k <= 0) r.visible = false;
      }

      // 居民的循環動作
      for (const r of residents) {
        if (!r.m.visible) continue;
        const u = r.m.userData;
        const k = still ? 0 : 1;
        if (r.act === 'sweep') {
          u.body.rotation.y = Math.sin(t * 1.6) * 0.18 * k;
          u.broom.rotation.z = (Math.sin(t * 1.6) * 0.35 + 0.15) * k;
          u.broom.rotation.x = 0.25;
        } else if (r.act === 'sit') {
          u.body.rotation.x = 0.12 + Math.sin(t * 0.6) * 0.05 * k; // 低頭看書，偶爾動一下
        } else if (r.act === 'walk') {
          // 來回散步；玩家靠近時停下來看一眼，不會撞到玩家
          const d = Math.hypot(pos.x - r.m.position.x, pos.z - r.m.position.z);
          const moving = d >= 1.5 && !still;
          if (moving) {
            r.m.position.x += r.dir * 1.3 * dt;
            if (r.m.position.x > r.x2) r.dir = -1;
            if (r.m.position.x < r.x) r.dir = 1;
            r.m.rotation.y = r.dir * Math.PI / 2;
          } else if (d < 1.5) {
            r.m.rotation.y = Math.atan2(pos.x - r.m.position.x, pos.z - r.m.position.z);
          }
          animateCharacter(r.m, t, moving, still);
        } else if (r.act === 'water') {
          u.body.rotation.y = Math.sin(t * 0.5) * 0.25 * k; // 慢慢從這盆澆到那盆
          u.broom.rotation.x = 0.35 + Math.sin(t * 0.9) * 0.2 * k;
        } else {
          u.body.rotation.x = 0.35 + Math.sin(t * 1.1) * 0.1 * k; // 彎腰拔一下、停一下
          u.broom.position.y = 0.3 + Math.max(0, Math.sin(t * 1.1)) * 0.25 * k;
        }
      }

      // 水窪：走進去時起漣漪；減少動畫時只顯示一圈靜止的水紋
      for (const p of puddles) {
        const inside = Math.hypot(pos.x - p.x, (pos.z - p.z) / 0.72) < p.r + 0.1;
        if (inside && !p.inside) { play('drop'); state.ripples++; }
        p.inside = inside;
        if (still) {
          const r = p.rings[0];
          r.visible = inside;
          r.scale.set(p.r * 0.7, p.r * 0.5, 1);
          r.material.opacity = 0.6;
          p.rings[1].visible = false;
          continue;
        }
        p.timer -= dt;
        if (inside && walking && p.timer <= 0) {
          p.timer = 0.32;
          const r = p.rings[p.next];
          p.next = (p.next + 1) % p.rings.length;
          r.position.set(pos.x, 0.038, pos.z);
          r.userData.life = 0.7;
          r.visible = true;
        }
        for (const r of p.rings) {
          if (!r.visible) continue;
          r.userData.life -= dt;
          const k = Math.max(0, r.userData.life / 0.7);
          const s = 0.12 + (1 - k) * 0.45;
          r.scale.set(s, s * 0.72, 1);
          r.material.opacity = 0.75 * k;
          if (k <= 0) r.visible = false;
        }
      }

      // 上香後的香與煙（減少動畫時煙停在原地）
      if (incense > 0) {
        incense -= dt;
        state.incense = Math.max(0, incense);
        sticks.visible = incense > 0;
        for (const sp of smoke) {
          sp.visible = incense > 0;
          const u = still ? 0.35 + sp.userData.phase * 0.3 : (t * 0.3 + sp.userData.phase) % 1;
          sp.position.set(censer.x + Math.sin(u * 6 + sp.userData.phase * 5) * 0.06, censer.y + 0.36 + u * 0.8, censer.z);
          sp.scale.setScalar(0.12 + u * 0.3);
          sp.material.opacity = Math.sin(u * Math.PI) * 0.45 * Math.min(1, incense / 3);
        }
      }

      // 小風鈴
      const nearChime = Math.hypot(pos.x - CHIME_AT.x, pos.z - CHIME_AT.z) < 1.9;
      if (nearChime && !chimeNear) { play('windchime'); chimeSwing = 1.6; state.chimes++; }
      chimeNear = nearChime;
      chimeSwing = Math.max(0, chimeSwing - dt);
      cafeChime.rotation.z = still ? 0 : Math.sin(t * 1.7) * 0.05 + Math.sin(t * 9) * 0.16 * (chimeSwing / 1.6);

      if (low) return;

      // 蝴蝶與熱氣（減少動畫時停在原地）
      if (!still) {
        let visiting = 0;
        for (let i = 0; i < flies.length; i++) {
          const f = flies[i];
          const d = Math.hypot(pos.x - f.hx, pos.z - f.hz);
          if (d < 2.4) f.visit = 4; else f.visit = Math.max(0, f.visit - dt);
          const tx = f.visit > 0 && d < 4.5 ? pos.x : f.hx;
          const tz = f.visit > 0 && d < 4.5 ? pos.z : f.hz;
          if (tx !== f.hx) visiting++;
          f.cx += (tx - f.cx) * Math.min(1, dt * 1.5);
          f.cz += (tz - f.cz) * Math.min(1, dt * 1.5);
          const a = t * 0.9 + f.phase;
          f.x = f.cx + Math.cos(a) * 0.75;
          f.z = f.cz + Math.sin(a) * 0.55;
          f.y = 1.15 + Math.sin(t * 1.7 + f.phase) * 0.22 + (tx !== f.hx ? 0.35 : 0);
          placeFly(i, f, t, Math.sin(t * 16 + f.phase) * 0.9);
        }
        state.visiting = visiting;
        wings.instanceMatrix.needsUpdate = true;
        for (const s of steam) placeSteam(s, (t * 0.22 + s.userData.phase) % 1);
      }

      // 雲影
      if (!still) {
        for (const c of clouds) {
          c.position.x += c.userData.v * dt;
          if (c.position.x > 48) c.position.x = -12;
        }
      }

      // 許願池的水花（減少動畫時停在原地，像一張靜止的畫面）
      if (!still) {
        for (let i = 0; i < DROPS; i++) placeDrop(i, (t * 0.9 + i * 0.37) % 1);
        dropMesh.instanceMatrix.needsUpdate = true;
      }

      // 落葉
      for (let i = 0; i < LEAVES; i++) {
        const l = leaves[i];
        if (still) { hideLeaf(i); continue; }
        if (l.y < 0) {
          l.wait -= dt;
          if (l.wait > 0) continue;
          const a = (t * 1.3 + l.phase * 2.1) % (Math.PI * 2);
          const r = 0.6 + ((l.phase * 7 + t) % 1) * 1.8;
          l.x = banyan.x + Math.cos(a) * r;
          l.z = banyan.z + Math.sin(a) * r;
          l.y = 3.1;
          l.rest = 0;
        }
        if (l.y > 0.04) {
          l.y = Math.max(0.04, l.y - dt * 0.55);
          l.x += Math.sin(t * 1.7 + l.phase) * dt * 0.35;
          dummy.rotation.set(Math.sin(t * 2.2 + l.phase) * 0.9, t * 1.4 + l.phase, Math.cos(t * 1.9 + l.phase) * 0.7);
        } else {
          l.rest += dt;
          dummy.rotation.set(-Math.PI / 2, 0, l.phase);
          if (l.rest > 4) { l.y = -1; l.wait = 3 + (l.phase % 4); hideLeaf(i); continue; }
        }
        dummy.position.set(l.x, l.y, l.z);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(i, dummy.matrix);
      }
      leafMesh.instanceMatrix.needsUpdate = true;

      // 麻雀
      let away = 0;
      for (const b of birds) {
        const d = Math.hypot(pos.x - b.hx, pos.z - b.hz);
        if (still) { b.m.visible = false; continue; }
        if (b.state === 'ground') {
          b.m.visible = true;
          const hop = Math.max(0, Math.sin(t * 5 + b.phase)) ** 6;
          b.m.position.set(b.hx, hop * 0.05, b.hz);
          b.m.rotation.x = Math.sin(t * 2.3 + b.phase) > 0.75 ? 0.6 : 0; // 低頭啄一下
          if (d < 2.3) {
            b.state = 'fly';
            b.t = 0;
            const n = Math.max(d, 0.01);
            b.dx = (b.hx - pos.x) / n + Math.sin(b.phase) * 0.5;
            b.dz = (b.hz - pos.z) / n - 0.6;
            b.m.rotation.set(0, Math.atan2(b.dx, b.dz), 0);
            if (t - lastFlutter > 0.5) { lastFlutter = t; play('flutter'); }
          }
        } else if (b.state === 'fly') {
          b.t += dt;
          b.m.position.x += b.dx * dt * 3.2;
          b.m.position.z += b.dz * dt * 3.2;
          b.m.position.y += dt * (2.2 + b.t * 2);
          b.m.rotation.z = Math.sin(t * 40) * 0.5;
          if (b.t > 1.6) { b.state = 'away'; b.t = 0; b.m.visible = false; }
        } else {
          b.t += dt;
          if (b.t > 10 && d > 5) { b.state = 'ground'; b.m.rotation.set(0, b.phase * 5, 0); }
        }
        if (b.state !== 'ground') away++;
      }
      state.birdsAway = away;
    },
    dispose() {
      scene.remove(root);
    },
  };
}
