// 晴隅小鎮的 3D 場景：小廣場、咖啡店外、小花園三區，用簡單幾何造型拼成（自製，不使用外部模型）。
// 回傳 { width, height, blocked, areaOf, visuals, anchors }。座標：西北角在原點，+X 往東、+Z 往南，地面 y = 0。
// 互動物件與角色的位置寫在 content/places.json、content/characters.json；這裡的擺設要和那些座標對齊。
import * as THREE from 'three';
import { toon } from './characters.js';

export const WIDTH = 36;
export const HEIGHT = 22;

const C = {
  grass: 0xc9dcae, grassDeep: 0xb5cf98, path: 0xeadcc3, stone: 0xe4ddd2, wall: 0xf6ead6, roof: 0xd08a6c,
  wood: 0xb68a62, woodDark: 0x8e6a4c, awningA: 0xf2e1c6, awningB: 0xd99a7a, window: 0xa9c7d6, leaf: 0x93b98a,
  leafDark: 0x7aa476, trunk: 0x9a7556, soil: 0xa88466, paper: 0xfffaf0, metal: 0x8d8580, flowerA: 0xf2c46b,
  flowerB: 0xc9a7d8, flowerC: 0xf0a59a, mint: 0x9fd0a0, pot: 0xc98a6b,
};

function box(w, h, d, color, x, y, z, { shadow = true, rotY = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, color, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function flat(w, d, color, x, z, y = 0.01) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toon(color));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

// 同一種造型重複出現時用 InstancedMesh，減少繪製呼叫
function instanced(geo, color, transforms) {
  const m = new THREE.InstancedMesh(geo, toon(color), transforms.length);
  const o = new THREE.Object3D();
  transforms.forEach(([x, y, z, s = 1, sy = s, rotY = 0], i) => {
    o.position.set(x, y, z);
    o.scale.set(s, sy, s);
    o.rotation.set(0, rotY, 0);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function chair(color = C.wood) {
  const g = new THREE.Group();
  g.add(box(0.5, 0.06, 0.5, color, 0, 0.45, 0));
  g.add(box(0.5, 0.5, 0.06, color, 0, 0.72, -0.22));
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(box(0.05, 0.45, 0.05, C.woodDark, x, 0.22, z));
  return g;
}

function table(x, z) {
  const g = new THREE.Group();
  g.add(cyl(0.55, 0.55, 0.06, C.paper, 0, 0.74, 0, 20));
  g.add(cyl(0.06, 0.06, 0.72, C.metal, 0, 0.37, 0, 8));
  g.add(cyl(0.3, 0.3, 0.04, C.metal, 0, 0.02, 0, 12));
  g.position.set(x, 0, z);
  return g;
}

export function signPost(color = C.paper) {
  const g = new THREE.Group();
  g.add(box(0.08, 1.0, 0.08, C.woodDark, 0, 0.5, 0));
  g.add(box(0.7, 0.45, 0.05, color, 0, 1.05, 0.04));
  return g;
}

export function buildWorld(scene) {
  const visuals = new THREE.Group();
  visuals.name = 'town';
  scene.add(visuals);
  const add = (...o) => visuals.add(...o);
  const boxes = []; // 碰撞方塊 [x1, z1, x2, z2]
  const circles = []; // 碰撞圓 [x, z, r]

  // ---- 地面與步道 ----
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), toon(C.grassDeep));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WIDTH / 2, -0.01, HEIGHT / 2);
  ground.receiveShadow = true;
  add(ground, flat(WIDTH, HEIGHT, C.grass, WIDTH / 2, HEIGHT / 2, 0));
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), toon(C.stone));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(18, 0.02, 13.8);
  plaza.receiveShadow = true;
  add(plaza);
  add(flat(14.5, 3.2, C.path, 6.5, 12.6, 0.015)); // 咖啡店前的步道
  add(flat(10.5, 3.2, C.stone, 5.6, 7.0, 0.016)); // 咖啡店的露臺
  add(flat(6.5, 3.0, C.path, 25.5, 11.4, 0.015)); // 往花園
  add(flat(3.2, 12, C.path, 18, 17, 0.012)); // 廣場往南
  // 花園步道的石板
  const stones = [];
  for (let x = 26.2; x < 35; x += 0.9) stones.push([x, 0.025, 18.0 + Math.sin(x) * 0.25, 1, 1, x]);
  for (let z = 12.4; z < 17.6; z += 0.9) stones.push([28.0 + Math.sin(z) * 0.2, 0.025, z, 1, 1, z]);
  add(instanced(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 7), C.stone, stones));

  // ---- 咖啡店（只有外觀，內部不開放）----
  add(box(10, 3.2, 3.5, C.wall, 5.5, 1.6, 2.25));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 10.6, 3), toon(C.roof));
  roof.rotation.set(0, 0, Math.PI / 2);
  roof.rotation.order = 'ZXY';
  roof.position.set(5.5, 3.9, 2.25);
  roof.scale.set(1, 1, 0.9);
  roof.castShadow = true;
  add(roof);
  add(box(1.2, 2.1, 0.1, C.woodDark, 6.4, 1.05, 4.02)); // 門
  for (const x of [2.4, 4.2, 8.6]) add(box(1.3, 1.1, 0.08, C.window, x, 1.7, 4.02, { shadow: false }));
  // 遮陽棚：條紋
  for (let i = 0; i < 8; i++) {
    const s = box(1.25, 0.08, 1.4, i % 2 ? C.awningB : C.awningA, 1.1 + i * 1.25, 2.55, 4.7);
    s.rotation.x = 0.28;
    add(s);
  }
  // 窗台花箱
  add(box(2.2, 0.35, 0.4, C.wood, 3.3, 0.85, 4.3), box(2.1, 0.12, 0.3, C.leaf, 3.3, 1.07, 4.3));
  boxes.push([0.4, 0.4, 10.6, 4.6]);
  // 露臺桌椅（活動便條放在其中一張桌上）
  add(table(3.4, 8.2), table(8.6, 12.6));
  circles.push([3.4, 8.2, 0.6], [8.6, 12.6, 0.6]);
  for (const [x, z, r] of [[2.6, 8.2, Math.PI / 2], [4.2, 8.2, -Math.PI / 2], [9.4, 12.6, -Math.PI / 2], [8.6, 13.4, Math.PI]]) {
    const c = chair();
    c.position.set(x, 0, z);
    c.rotation.y = r;
    add(c);
  }
  // 活動便條
  const note = box(0.3, 0.01, 0.22, C.paper, 8.6, 0.78, 12.55, { shadow: false });
  note.rotation.y = 0.3;
  add(note);
  // 公告架
  const rack = new THREE.Group();
  rack.add(box(0.9, 1.3, 0.08, C.wood, 0, 0.9, 0), box(0.07, 1.6, 0.07, C.woodDark, -0.45, 0.8, 0), box(0.07, 1.6, 0.07, C.woodDark, 0.45, 0.8, 0));
  rack.add(box(0.3, 0.4, 0.02, C.paper, -0.18, 1.0, 0.05, { shadow: false }), box(0.3, 0.3, 0.02, 0xf6d9c8, 0.2, 1.15, 0.05, { shadow: false }));
  rack.position.set(11.2, 0, 5.2);
  add(rack);
  boxes.push([10.7, 4.95, 11.7, 5.45]);

  // ---- 小廣場 ----
  // 花台
  add(cyl(1.0, 1.05, 0.5, C.stone, 15.0, 0.25, 12.8, 20), cyl(0.9, 0.9, 0.12, C.soil, 15.0, 0.52, 12.8, 20));
  circles.push([15.0, 12.8, 1.05]);
  // 社區資源告示牌（面向南方）
  const board = new THREE.Group();
  board.add(box(1.8, 1.1, 0.1, C.wood, 0, 1.35, 0), box(0.1, 1.9, 0.1, C.woodDark, -0.85, 0.95, 0), box(0.1, 1.9, 0.1, C.woodDark, 0.85, 0.95, 0));
  board.add(box(0.5, 0.6, 0.02, C.paper, -0.45, 1.4, 0.06, { shadow: false }), box(0.45, 0.4, 0.02, 0xdfeedd, 0.15, 1.5, 0.06, { shadow: false }));
  board.add(box(0.4, 0.5, 0.02, 0xf6d9c8, 0.6, 1.3, 0.06, { shadow: false }));
  board.add(box(2.0, 0.12, 0.25, C.roof, 0, 1.96, 0));
  board.position.set(18, 0, 9.4);
  add(board);
  boxes.push([17.0, 9.2, 19.0, 9.65]);
  // 廣場長椅
  const pBench = new THREE.Group();
  pBench.add(box(1.7, 0.08, 0.5, C.wood, 0, 0.45, 0), box(1.7, 0.4, 0.07, C.wood, 0, 0.72, -0.22));
  for (const x of [-0.7, 0.7]) pBench.add(box(0.08, 0.45, 0.45, C.woodDark, x, 0.22, 0));
  pBench.position.set(23.6, 0, 18.4);
  pBench.rotation.y = -Math.PI / 2;
  add(pBench);
  boxes.push([23.3, 17.5, 23.9, 19.3]);
  // 路燈
  for (const [x, z] of [[12.6, 15.6], [23.4, 11.2]]) {
    add(cyl(0.06, 0.08, 2.6, C.metal, x, 1.3, z, 8));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
    lamp.position.set(x, 2.7, z);
    add(lamp);
    circles.push([x, z, 0.15]);
  }

  // ---- 小花園 ----
  // 矮籬笆（入口在 z 9.6～13.4）
  const posts = [];
  for (let z = 1; z <= 21; z += 0.8) if (z < 9.6 || z > 13.4) posts.push([24.6, 0.35, z]);
  add(instanced(new THREE.BoxGeometry(0.1, 0.7, 0.1), C.wood, posts));
  for (const [z1, z2] of [[1, 9.6], [13.4, 21]]) {
    add(box(0.05, 0.08, z2 - z1, C.wood, 24.6, 0.55, (z1 + z2) / 2), box(0.05, 0.08, z2 - z1, C.wood, 24.6, 0.3, (z1 + z2) / 2));
    boxes.push([24.45, z1, 24.75, z2]);
  }
  // 入口花架
  for (const z of [9.5, 13.5]) {
    add(box(0.14, 2.3, 0.14, C.wood, 25.0, 1.15, z));
    circles.push([25.0, z, 0.15]);
  }
  add(box(0.5, 0.1, 4.4, C.wood, 25.0, 2.3, 11.5));
  const vine = [];
  for (let z = 9.4; z <= 13.6; z += 0.45) vine.push([25.0, 2.42, z, 1, 0.8]);
  for (let y = 0.4; y < 2.2; y += 0.45) vine.push([25.0, y, 9.5, 0.8], [25.0, y, 13.5, 0.8]);
  add(instanced(new THREE.IcosahedronGeometry(0.22, 0), C.leaf, vine));
  // 花圃
  const beds = [[27, 3, 31, 5], [32, 4, 35, 7.5], [29.5, 19.6, 33, 21]];
  const flowers = [[], [], []];
  beds.forEach(([x1, z1, x2, z2], bi) => {
    add(box(x2 - x1, 0.3, z2 - z1, C.wood, (x1 + x2) / 2, 0.15, (z1 + z2) / 2), flat(x2 - x1 - 0.2, z2 - z1 - 0.2, C.soil, (x1 + x2) / 2, (z1 + z2) / 2, 0.31));
    boxes.push([x1, z1, x2, z2]);
    for (let x = x1 + 0.35; x < x2 - 0.2; x += 0.5) {
      for (let z = z1 + 0.35; z < z2 - 0.2; z += 0.5) flowers[(Math.round(x * 2) + Math.round(z * 2) + bi) % 3].push([x, 0.48, z, 0.9 + ((x * 7 + z * 3) % 1) * 0.4]);
    }
  });
  const petal = new THREE.IcosahedronGeometry(0.13, 0);
  [C.flowerA, C.flowerB, C.flowerC].forEach((col, i) => add(instanced(petal, col, flowers[i])));
  // 薄荷盆栽（阿澄旁邊）
  for (const [x, z] of [[27.4, 7.4], [28.1, 6.8], [26.8, 6.6]]) {
    add(cyl(0.22, 0.17, 0.35, C.pot, x, 0.17, z, 12));
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), toon(C.mint));
    m.position.set(x, 0.5, z);
    m.castShadow = true;
    add(m);
    circles.push([x, z, 0.25]);
  }
  // 風鈴
  add(box(0.1, 2.2, 0.1, C.woodDark, 27.4, 1.1, 15.2), box(0.7, 0.07, 0.07, C.woodDark, 27.7, 2.15, 15.2));
  const chimes = new THREE.Group();
  for (let i = 0; i < 4; i++) chimes.add(cyl(0.035, 0.035, 0.35 + i * 0.06, 0xe9d8b8, -0.12 + i * 0.08, -0.2 - i * 0.03, 0, 6));
  chimes.position.set(27.95, 2.1, 15.2);
  add(chimes);
  circles.push([27.4, 15.2, 0.15]);
  // 花園長椅（面向南方）
  const bench = new THREE.Group();
  bench.add(box(1.9, 0.09, 0.55, C.wood, 0, 0.46, 0), box(1.9, 0.45, 0.07, C.wood, 0, 0.75, -0.25));
  for (const x of [-0.8, 0.8]) bench.add(box(0.09, 0.46, 0.5, C.woodDark, x, 0.23, 0));
  bench.position.set(31.5, 0, 12.6);
  add(bench);
  boxes.push([30.5, 12.25, 32.5, 12.95]);

  // ---- 樹 ----
  const trees = [
    [35.0, 10.2, 1.4], [13.2, 2.2, 1.1], [16.4, 1.6, 1.0], [20.4, 2.0, 1.2], [23.2, 1.6, 0.9], [1.6, 20.4, 1.2],
    [5.4, 20.8, 1.0], [11.8, 20.6, 1.1], [26.4, 20.6, 1.0], [35.0, 20.4, 1.2], [34.6, 1.6, 1.1], [26.0, 1.8, 0.9],
    [1.2, 12.4, 1.0], [12.4, 8.4, 0.8],
  ];
  add(instanced(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 8), C.trunk, trees.map(([x, z, s]) => [x, 0.7 * s, z, s])));
  add(instanced(new THREE.IcosahedronGeometry(1, 1), C.leaf, trees.map(([x, z, s]) => [x, 1.9 * s, z, 1.05 * s])));
  add(instanced(new THREE.IcosahedronGeometry(0.7, 1), C.leafDark, trees.map(([x, z, s]) => [x + 0.4 * s, 2.5 * s, z + 0.2 * s, s])));
  for (const [x, z, s] of trees) circles.push([x, z, 0.35 * s + 0.1]);

  // ---- 遠景：廣場北邊的房子（不在活動範圍內）----
  for (const [x, w, col] of [[15, 3.4, 0xf3e4cf], [19.6, 3.0, 0xe9eedf], [30, 4, 0xf3e4cf]]) {
    add(box(w, 2.6, 2.6, col, x, 1.3, -2.2));
    const r = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, w + 0.3, 3), toon(C.roof));
    r.rotation.set(0, 0, Math.PI / 2);
    r.position.set(x, 3.2, -2.2);
    r.scale.set(1, 1, 0.75);
    add(r);
  }

  const blocked = (x, z, r) => {
    if (x - r < 0.5 || z - r < 0.5 || x + r > WIDTH - 0.5 || z + r > HEIGHT - 0.5) return true;
    for (const [x1, z1, x2, z2] of boxes) {
      if (x + r > x1 && x - r < x2 && z + r > z1 && z - r < z2) return true;
    }
    for (const [cx, cz, cr] of circles) if (Math.hypot(x - cx, z - cz) < r + cr) return true;
    return false;
  };
  const areaOf = (x) => (x < 11.8 ? 'cafe' : x > 24.6 ? 'garden' : 'plaza');

  return { width: WIDTH, height: HEIGHT, blocked, areaOf, visuals, anchors: { chimes } };
}
