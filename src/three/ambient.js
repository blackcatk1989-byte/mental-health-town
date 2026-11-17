// 讓微光里看起來有人生活的動態：雲影、飄落的葉子、麻雀、水窪的漣漪、不能對話的居民（剪影式）。
// 都只是氣氛，不影響任務與進度。物件在一開始建好，主迴圈裡只更新位置；
// 「減少動畫」時全部靜止（麻雀與落葉不出現）；低畫質時關閉雲影、落葉與麻雀。
import * as THREE from 'three';
import { vertexToon } from './characters.js';
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
const PUDDLES = [{ x: 16.9, z: 17.6, r: 0.5 }];
// 麻雀停的地方
const FLOCKS = [[[20.6, 16.6], [21.3, 17.0], [20.9, 17.5]]];
// 不能對話的居民：在活動範圍外做自己的事
const RESIDENTS = [{ x: 21.3, z: -0.3, ry: 0.5, act: 'sweep', keepOnLow: true }];

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

// 剪影式的居民：沒有臉、低彩度，戴斗笠拿掃把
function makeResident() {
  const g = new THREE.Group();
  const body = mergedMesh([
    [CYL, 0xcdbfae, at(0, 0.5, 0, { sx: 0.2, sy: 0.6, sz: 0.17 })],
    [SPHERE, 0xcdbfae, at(0, 0.82, 0, { sx: 0.21, sy: 0.14, sz: 0.18 })],
    [SPHERE, 0xe3d2bd, at(0, 1.03, 0, { s: 0.17 })],
    [CONE, 0xe6d3a3, at(0, 1.2, 0, { sx: 0.3, sy: 0.16, sz: 0.3 })],
    [CYL, 0xb9ab9a, at(-0.08, 0.1, 0, { sx: 0.06, sy: 0.2, sz: 0.07 })],
    [CYL, 0xb9ab9a, at(0.08, 0.1, 0, { sx: 0.06, sy: 0.2, sz: 0.07 })],
  ], vertexToon);
  const broom = mergedMesh([
    [CYL, 0x8e6a4c, at(0, -0.45, 0, { sx: 0.02, sy: 1.1, sz: 0.02 })],
    [BOX, 0xd9b26f, at(0, -1.02, 0, { sx: 0.26, sy: 0.16, sz: 0.06 })],
  ], vertexToon);
  broom.position.set(0.22, 1.05, 0.2);
  g.add(body, broom);
  g.userData = { body, broom };
  return g;
}

export function createAmbient(scene, { banyan, fountain }) {
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
  const DROPS = 20;
  const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xe9f6fa }), DROPS);
  dropMesh.frustumCulled = false;
  fancy.add(dropMesh);
  // u 是 0～1 的進度：從噴嘴（高 1.38）往外拋到上層水盤，再從盤緣落到池面
  const placeDrop = (i, u) => {
    const a = (i / DROPS) * Math.PI * 2 * 3 + i;
    const upper = i % 2 === 0;
    const r = upper ? u * 0.34 : 0.45 + u * 0.4;
    const y = upper ? 1.36 + Math.sin(u * Math.PI) * 0.28 - u * 0.28 : 1.02 - u * u * 0.62 + Math.sin(u * Math.PI) * 0.06;
    dummy.position.set(fountain.x + Math.cos(a) * r, y, fountain.z + Math.sin(a) * r);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    dropMesh.setMatrixAt(i, dummy.matrix);
  };
  for (let i = 0; i < DROPS; i++) placeDrop(i, (i * 0.37) % 1);

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
    const m = makeResident();
    m.position.set(r.x, 0, r.z);
    m.rotation.y = r.ry;
    root.add(m);
    return { ...r, m };
  });

  let low = false;
  const state = { birdsAway: 0, ripples: 0 };

  return {
    state, // 測試用
    setQuality(quality) {
      low = quality === 'low';
      fancy.visible = !low;
      for (const r of residents) r.m.visible = !low || r.keepOnLow;
    },
    update(dt, t, still, pos, walking) {
      // 居民的循環動作
      for (const r of residents) {
        if (!r.m.visible) continue;
        const u = r.m.userData;
        const k = still ? 0 : 1;
        u.body.rotation.y = Math.sin(t * 1.6) * 0.18 * k;
        u.broom.rotation.z = (Math.sin(t * 1.6) * 0.35 + 0.15) * k;
        u.broom.rotation.x = 0.25;
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

      if (low) return;

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
            if (b === birds[0] || Math.hypot(pos.x - birds[0].hx, pos.z - birds[0].hz) >= 2.3) play('flutter');
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
