// 從 Tiled 地圖蓋出 3D 小鎮：每格 = 1 單位。Tiled 仍是關卡配置工具。
import * as THREE from 'three';
import { toon, OUTLINE_MAT } from './characters.js';

const GID = { grass: 1, path: 2, stone: 3, water: 4, tree: 5, wall: 6, roof: 7, flower: 8 };

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

function instanced(scene, geo, mat, list, { shadow = true, outline = 0 } = {}) {
  if (!list.length) return;
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((it, i) => {
    m4.compose(v.set(...it.p), q.setFromEuler(new THREE.Euler(0, it.ry || 0, 0)), s.set(...it.s));
    mesh.setMatrixAt(i, m4);
    if (it.c !== undefined) mesh.setColorAt(i, new THREE.Color(it.c));
  });
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (outline) {
    instanced(scene, geo, OUTLINE_MAT, list.map((it) => ({ ...it, s: it.s.map((x) => x + outline), c: undefined })), { shadow: false });
  }
  return mesh;
}

export function buildWorld(scene, tiled) {
  // 所有看得到的物件放進 visuals；載入 island.glb 後會把它隱藏，只保留碰撞與出生點
  const visuals = new THREE.Group();
  visuals.name = 'tiled-visuals';
  scene.add(visuals);
  const W = tiled.width;
  const H = tiled.height;
  const layer = (name) => tiled.layers.find((l) => l.name === name);
  const ground = layer('ground').data;
  const obst = layer('obstacles').data;
  const at = (arr, x, y) => arr[y * W + x];
  const rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();

  // 地面：小鎮外圍也鋪草地，看起來像一座小島
  const grass = new THREE.Mesh(new THREE.CircleGeometry(40, 64), toon(0xbfdaa8));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(W / 2, 0, H / 2);
  grass.receiveShadow = true;
  visuals.add(grass);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const lists = { path: [], stone: [], flowerPetal: [], flowerCenter: [], trunk: [], canopy: [], fruit: [] };
  const solid = new Set();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const g = at(ground, x, y);
      const o = at(obst, x, y);
      const cx = x + 0.5;
      const cz = y + 0.5;
      if (o || g === GID.water) solid.add(`${x},${y}`);
      if (g === GID.path) lists.path.push({ p: [cx, 0.02, cz], s: [1, 0.04, 1] });
      if (g === GID.stone) lists.stone.push({ p: [cx, 0.03, cz], s: [0.9, 0.06, 0.9], c: rnd() < 0.5 ? 0xeadbc7 : 0xe2d0ba });
      if (g === GID.flower) {
        for (let i = 0; i < 3; i++) {
          const fx = cx + (rnd() - 0.5) * 0.7;
          const fz = cz + (rnd() - 0.5) * 0.7;
          const c = [0xf6b9c4, 0xfbe1a0, 0xdcc8ef, 0xffffff][Math.floor(rnd() * 4)];
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            lists.flowerPetal.push({ p: [fx + Math.cos(a) * 0.06, 0.1, fz + Math.sin(a) * 0.06], s: [0.05, 0.03, 0.05], c });
          }
          lists.flowerCenter.push({ p: [fx, 0.11, fz], s: [0.035, 0.03, 0.035] });
        }
      }
      if (o === GID.tree) {
        const k = 0.85 + rnd() * 0.3;
        lists.trunk.push({ p: [cx, 0.3 * k, cz], s: [0.12 * k, 0.3 * k, 0.12 * k] });
        for (const [dx, dy, dz, r] of [[0, 0.95, 0, 0.42], [-0.2, 0.75, 0.12, 0.3], [0.22, 0.78, -0.05, 0.3]]) {
          lists.canopy.push({ p: [cx + dx * k, dy * k, cz + dz * k], s: [r * k, r * k * 0.95, r * k], c: rnd() < 0.5 ? 0x9fd08f : 0xa9d79a });
        }
        if (rnd() < 0.6) {
          for (let i = 0; i < 3; i++) {
            const a = rnd() * Math.PI * 2;
            lists.fruit.push({ p: [cx + Math.cos(a) * 0.36 * k, (0.8 + rnd() * 0.3) * k, cz + Math.sin(a) * 0.36 * k], s: [0.05, 0.05, 0.05] });
          }
        }
      }
    }
  }

  instanced(visuals, box, toon(0xe8d3b0), lists.path, { shadow: false });
  instanced(visuals, box, toon(0xffffff), lists.stone, { shadow: false });
  instanced(visuals, sphere, toon(0xffffff), lists.flowerPetal, { shadow: false });
  instanced(visuals, sphere, toon(0xf6c96b), lists.flowerCenter, { shadow: false });
  instanced(visuals, new THREE.CylinderGeometry(1, 1.2, 2, 12), toon(0xc9a07c), lists.trunk);
  instanced(visuals, sphere, toon(0xffffff), lists.canopy, { outline: 0.03 });
  instanced(visuals, sphere, toon(0xf4a3a0), lists.fruit, { shadow: false });

  buildFountain(visuals, ground, W, H);
  buildHouses(visuals, obst, W, H);

  const spawns = {};
  for (const o of layer('spawns').objects) spawns[o.name] = { x: o.x / tiled.tilewidth, z: o.y / tiled.tileheight };

  // 圓形角色與格子碰撞
  const blocked = (x, z, r) => {
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      const tx = Math.floor(x + dx);
      const tz = Math.floor(z + dz);
      if (tx < 0 || tz < 0 || tx >= W || tz >= H || solid.has(`${tx},${tz}`)) return true;
    }
    return false;
  };
  return { width: W, height: H, spawns, blocked, visuals };
}

function buildFountain(scene, ground, W, H) {
  const cells = [];
  ground.forEach((g, i) => g === GID.water && cells.push([i % W, Math.floor(i / W)]));
  if (!cells.length) return;
  const cx = cells.reduce((a, c) => a + c[0], 0) / cells.length + 0.5;
  const cz = cells.reduce((a, c) => a + c[1], 0) / cells.length + 0.5;
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.16, 12, 40), toon(0xf3e9dc));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.28;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.15, 0.28, 40), toon(0xeadccb));
  base.position.y = 0.14;
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), toon(0xa8d8e6));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.29;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.7, 16), toon(0xf3e9dc));
  pillar.position.y = 0.5;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), toon(0xbfe3ec));
  top.position.y = 0.92;
  for (const m of [rim, base, pillar, top]) { m.castShadow = true; m.receiveShadow = true; }
  group.add(base, rim, water, pillar, top);
  scene.add(group);
}

// 把相連的牆／屋頂格子合成一棟房子
function buildHouses(scene, obst, W, H) {
  const isHouse = (g) => g === GID.wall || g === GID.roof;
  const seen = new Set();
  const roofColors = [0xf2a7a0, 0xa9cbe8, 0xf6cf8e, 0xc4b3e6];
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isHouse(obst[y * W + x]) || seen.has(`${x},${y}`)) continue;
      let x0 = x, x1 = x, y0 = y, y1 = y;
      const stack = [[x, y]];
      seen.add(`${x},${y}`);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && isHouse(obst[ny * W + nx]) && !seen.has(`${nx},${ny}`)) {
            seen.add(`${nx},${ny}`);
            stack.push([nx, ny]);
          }
        }
      }
      scene.add(makeHouse(x0, y0, x1 - x0 + 1, y1 - y0 + 1, roofColors[n++ % roofColors.length]));
    }
  }
}

function makeHouse(x, y, w, d, roofColor) {
  const g = new THREE.Group();
  g.position.set(x + w / 2, 0, y + d / 2);
  const wallH = 1.3;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, wallH, d - 0.2), toon(0xfbefdc));
  wall.position.y = wallH / 2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), toon(roofColor));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w + 0.3, 1.1, d + 0.3);
  roof.position.y = wallH + 0.55;
  const door = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 6, 16), toon(0xc9926a));
  door.scale.z = 0.25;
  door.position.set(0, 0.42, d / 2 - 0.1);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), toon(0xf6cf8e));
  knob.position.set(0.1, 0.42, d / 2 - 0.03);
  g.add(wall, roof, door, knob);
  for (const sx of [-1, 1]) {
    if (w < 3.5) continue;
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), toon(0xcfe8ef));
    win.position.set(sx * (w / 2 - 0.75), 0.85, d / 2 - 0.09);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 24), toon(0xd9b48f));
    frame.position.copy(win.position);
    g.add(win, frame);
  }
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), toon(0xe0c7ad));
  chimney.position.set(w / 4, wallH + 0.8, -d / 6);
  g.add(chimney);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
