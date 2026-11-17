// 微光里的 3D 場景：小廣場、咖啡店外、小花園三區，用簡單幾何造型拼成（自製，不使用外部模型）。
// 回傳 { width, height, blocked, areaOf, visuals, details, far, anchors }。座標：西北角在原點，+X 往東、+Z 往南，地面 y = 0。
// 互動物件與角色的位置寫在 content/places.json、content/characters.json；這裡的擺設要和那些座標對齊。
// 靜態擺設最後合併成少數幾個網格（merge.js 的 bakeStatic）；小裝飾放在 details，省電畫質時隱藏。
import * as THREE from 'three';
import { toon, vertexToon } from './characters.js';
import { bakeStatic, mergedMesh } from './merge.js';

export const WIDTH = 36;
export const HEIGHT = 22;

const C = {
  grass: 0xc9dcae, grassDeep: 0xb5cf98, path: 0xeadcc3, stone: 0xe4ddd2, wall: 0xf6ead6, roof: 0xd08a6c,
  wood: 0xb68a62, woodDark: 0x8e6a4c, awningA: 0xf2e1c6, awningB: 0xd99a7a, window: 0xa9c7d6, leaf: 0x93b98a,
  leafDark: 0x7aa476, trunk: 0x9a7556, soil: 0xa88466, paper: 0xfffaf0, metal: 0x8d8580, flowerA: 0xf2c46b,
  flowerB: 0xc9a7d8, flowerC: 0xf0a59a, mint: 0x9fd0a0, pot: 0xc98a6b,
  alley: 0xd9d3c8, curb: 0xc4bcb0, shop: 0xf1e3cd, shopB: 0xe6ecdf, shopC: 0xf3dccc, shutter: 0xb9b4ad, column: 0xe9dcc6,
  scooterA: 0x9cc3c9, scooterB: 0xe7b9a0, scooterC: 0xd9d2a6, tire: 0x4f4a46, postRed: 0xd2705f, postGreen: 0x6f9f78,
  chalk: 0x4a5a52, cup: 0xfff6e8,
  asphalt: 0xbdb6ac, zebra: 0xf4efe6, drain: 0x8f8a82, pole: 0x8c8279, wire: 0x5c5550, shrine: 0xe2a48c, gold: 0xe0c078, water: 0xa9d0dc,
};

// ---- 風：樹葉與花草輕輕擺動（在頂點著色器裡位移，不用每幀改矩陣）。main.js 每幀更新 wind.value，「減少動畫」時不更新 ----
export const wind = { value: 0 };
function windy(base, amp = 0.05) {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = `uniform float uWind;\n${sh.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      float wPhase = uWind;
      #ifdef USE_INSTANCING
        wPhase += instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.4;
      #endif
      transformed.x += sin(wPhase + position.y * 1.3) * ${amp.toFixed(3)};
      transformed.z += cos(wPhase * 0.8 + position.x * 1.1) * ${(amp * 0.6).toFixed(3)};`);
  };
  m.customProgramCacheKey = () => `wind${amp}`;
  return m;
}

// 人行磚的貼圖（程式畫的，幾種暖色交錯）
function brickTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#cbb69c';
  ctx.fillRect(0, 0, 128, 128);
  const tones = ['#dcc4a6', '#d3b999', '#e0cab0', '#cfb898'];
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col < 4; col++) {
      ctx.fillStyle = tones[(row * 3 + col * 5 + 8) % tones.length];
      ctx.fillRect(col * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 從 a 到 b 的一根圓柱（樹枝、電線、車架）
function limb(a, b, r1, r2, color, seg = 6, shadow = true) {
  const from = new THREE.Vector3(...a);
  const dir = new THREE.Vector3(...b).sub(from);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, dir.length(), seg), toon(color));
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// 把幾個零件合成一個獨立的網格，給會晃動的小東西用（頂點色材質，不會被 bakeStatic 併進場景）
function fuse(objs) {
  const g = new THREE.Group();
  g.add(...objs);
  g.updateMatrixWorld(true);
  const parts = [];
  g.traverse((o) => { if (o.isMesh) parts.push([o.geometry, o.material.color, o.matrixWorld.clone()]); });
  return mergedMesh(parts, vertexToon);
}

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
function instanced(geo, color, transforms, material) {
  const m = new THREE.InstancedMesh(geo, material ?? toon(color), transforms.length);
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
  const details = new THREE.Group(); // 小裝飾：省電畫質時隱藏
  details.name = 'details';
  visuals.add(details);
  const deco = (...o) => details.add(...o);
  const boxes = []; // 碰撞方塊 [x1, z1, x2, z2]
  const circles = []; // 碰撞圓 [x, z, r]

  // ---- 地面與步道 ----
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), toon(C.grassDeep));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WIDTH / 2, -0.01, HEIGHT / 2);
  ground.receiveShadow = true;
  add(ground, flat(WIDTH, HEIGHT, C.grass, WIDTH / 2, HEIGHT / 2, 0));
  // 廣場鋪人行磚（貼圖是程式畫的），和柏油巷道、咖啡店露臺、花園小徑區分開來
  const brick = brickTexture();
  brick.repeat.set(9, 9);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), new THREE.MeshToonMaterial({ map: brick, gradientMap: toon(C.stone).gradientMap }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.userData.keep = true; // 有貼圖，不併進頂點色的網格
  plaza.position.set(18, 0.02, 13.8);
  plaza.receiveShadow = true;
  add(plaza);
  // 巷道：從咖啡店經過廣場通到花園的一條水泥巷，兩側有路緣石，把三區連在一起
  // 西段是柏油路，到廣場口有斑馬線；廣場裡是人行磚；東段進花園
  add(flat(12.2, 3.0, C.asphalt, 6.5, 12.6, 0.012), flat(12.6, 3.0, C.alley, 29.7, 12.6, 0.012));
  for (let z = 11.5; z < 13.9; z += 0.55) add(box(1.2, 0.012, 0.3, C.zebra, 11.0, 0.02, z, { shadow: false })); // 斑馬線
  // 水溝蓋：沿著路緣與騎樓前
  for (const [x, z] of [[7.5, 11.3], [9.6, 13.9], [16.6, 2.3], [21.2, 2.3]]) {
    add(box(0.62, 0.012, 0.36, C.drain, x, 0.022, z, { shadow: false }));
    for (const dx of [-0.18, 0, 0.18]) add(box(0.06, 0.012, 0.26, 0x6f6a64, x + dx, 0.026, z, { shadow: false }));
  }
  for (const [x1, x2] of [[0.4, 11.8], [24.4, 35.6]]) {
    for (const z of [11.05, 14.15]) add(box(x2 - x1, 0.08, 0.12, C.curb, (x1 + x2) / 2, 0.04, z, { shadow: false }));
  }
  add(flat(10.5, 3.6, C.stone, 5.6, 7.0, 0.016)); // 咖啡店的露臺
  add(flat(3.6, 2.3, C.stone, 8.2, 9.9, 0.016)); // 露臺往南多鋪一小塊，放曉晴的便條桌（不佔用巷道）
  add(flat(3.2, 8, C.path, 18, 18, 0.014)); // 廣場往南
  add(flat(12.4, 1.6, C.alley, 18, 1.3, 0.012)); // 騎樓前的人行道
  add(flat(5.0, 3.0, C.path, 30.0, 12.6, 0.016)); // 花園裡的小徑
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
  for (const x of [2.4, 4.2, 8.6]) {
    add(box(1.3, 1.1, 0.08, C.window, x, 1.7, 4.02, { shadow: false }));
    add(box(1.45, 0.08, 0.14, C.woodDark, x, 2.28, 4.05), box(1.45, 0.08, 0.14, C.woodDark, x, 1.12, 4.05)); // 窗框
    add(box(0.06, 1.1, 0.12, C.woodDark, x, 1.7, 4.05), box(0.08, 1.16, 0.14, C.woodDark, x - 0.7, 1.7, 4.05), box(0.08, 1.16, 0.14, C.woodDark, x + 0.7, 1.7, 4.05));
  }
  add(box(1.45, 0.12, 0.16, C.woodDark, 6.4, 2.16, 4.06)); // 門框
  add(cyl(0.18, 0.18, 0.04, C.window, 6.4, 1.6, 4.09, 16).rotateX(Math.PI / 2)); // 門上的圓窗
  add(cyl(0.04, 0.04, 0.04, 0xd9b26f, 6.85, 1.0, 4.1, 8).rotateX(Math.PI / 2)); // 門把
  add(box(10, 0.3, 0.08, 0xe0cdb2, 5.5, 0.15, 4.03)); // 牆腳
  // 招牌：咖啡杯造型（不寫字）
  add(box(0.08, 0.08, 0.6, C.metal, 6.4, 3.05, 4.3));
  add(cyl(0.42, 0.42, 0.08, C.paper, 6.4, 3.05, 4.62, 24).rotateX(Math.PI / 2));
  add(cyl(0.16, 0.13, 0.24, 0xc98f6b, 6.38, 3.02, 4.68, 14), box(0.36, 0.03, 0.03, 0xc98f6b, 6.38, 2.88, 4.68));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12, Math.PI), toon(0xc98f6b));
  handle.position.set(6.54, 3.03, 4.68);
  handle.rotation.z = -Math.PI / 2;
  add(handle);
  // 黑板菜單立牌（A 字型，不寫字，用粉筆線條示意）
  const menu = new THREE.Group();
  for (const sgn of [-1, 1]) {
    const b = box(0.6, 0.85, 0.04, C.woodDark, 0, 0.45, sgn * 0.12);
    b.rotation.x = sgn * 0.22;
    const c = box(0.48, 0.7, 0.02, C.chalk, 0, 0.47, sgn * 0.145);
    c.rotation.x = sgn * 0.22;
    menu.add(b, c);
  }
  for (const [y, w] of [[0.66, 0.3], [0.54, 0.22], [0.42, 0.26], [0.3, 0.18]]) menu.add(box(w, 0.02, 0.01, C.paper, -0.04, y, 0.16 + (0.66 - y) * 0.22, { shadow: false }));
  menu.position.set(8.2, 0, 5.0);
  menu.rotation.y = -0.3;
  deco(menu);
  boxes.push([7.85, 4.75, 8.55, 5.25]);
  // 門口的盆栽
  for (const x of [5.55, 7.25]) {
    deco(cyl(0.2, 0.16, 0.36, C.pot, x, 0.18, 4.85, 12));
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), toon(C.leaf));
    leaf.position.set(x, 0.55, 4.85);
    leaf.castShadow = true;
    deco(leaf);
    circles.push([x, 4.85, 0.22]);
  }
  // 遮陽棚：條紋
  for (let i = 0; i < 8; i++) {
    const s = box(1.25, 0.08, 1.4, i % 2 ? C.awningB : C.awningA, 1.1 + i * 1.25, 2.55, 4.7);
    s.rotation.x = 0.28;
    add(s);
  }
  // 窗台花箱
  add(box(2.2, 0.35, 0.4, C.wood, 3.3, 0.85, 4.3), box(2.1, 0.12, 0.3, C.leaf, 3.3, 1.07, 4.3));
  boxes.push([0.4, 0.4, 10.6, 4.6]);
  // 露臺：曉晴的便條桌，以及謎題「還沒收的三張桌子」（靠窗、中間、門口）
  const TABLES = [[2.4, 7.2], [5.0, 6.6], [7.8, 7.2], [8.0, 9.9]];
  for (const [x, z] of TABLES) {
    add(table(x, z));
    circles.push([x, z, 0.6]);
  }
  for (const [x, z, r] of [[1.6, 7.2, Math.PI / 2], [5.0, 7.4, Math.PI], [8.6, 7.2, -Math.PI / 2], [8.8, 9.9, -Math.PI / 2], [8.0, 10.7, Math.PI]]) {
    const c = chair();
    c.position.set(x, 0, z);
    c.rotation.y = r;
    add(c);
  }
  // 桌上留下的東西（線索的文字在 content/puzzles.json，這裡只是外觀）
  add(box(0.34, 0.02, 0.26, 0xf6f0a8, 2.3, 0.78, 7.15, { shadow: false })); // 畫滿螢光筆的講義
  for (const dx of [-0.25, 0.05, 0.3]) add(cyl(0.05, 0.04, 0.1, C.paper, 2.4 + dx, 0.82, 7.4, 10)); // 空咖啡杯
  add(box(0.28, 0.02, 0.2, C.paper, 4.9, 0.78, 6.55, { shadow: false })); // 帳單
  add(box(0.18, 0.02, 0.18, 0xf2ece0, 5.2, 0.78, 6.75, { shadow: false })); // 寫滿數字的餐巾紙
  add(box(0.22, 0.02, 0.15, 0xe9d0b0, 7.7, 0.78, 7.1, { shadow: false })); // 寫一半的明信片
  add(box(0.12, 0.02, 0.16, 0xb8cfe0, 8.0, 0.78, 7.3, { shadow: false })); // 合照
  // 收桌托盤（謎題入口）
  add(box(0.7, 0.75, 0.45, C.woodDark, 9.6, 0.38, 8.0), box(0.6, 0.03, 0.4, 0x9d7b5c, 9.6, 0.78, 8.0));
  boxes.push([9.25, 7.75, 9.95, 8.25]);
  // 活動便條
  const note = box(0.3, 0.01, 0.22, C.paper, 8.0, 0.78, 9.85, { shadow: false });
  note.rotation.y = 0.3;
  add(note);
  // 公告架
  const rack = new THREE.Group();
  rack.add(box(0.9, 1.3, 0.08, C.wood, 0, 0.9, 0), box(0.07, 1.6, 0.07, C.woodDark, -0.45, 0.8, 0), box(0.07, 1.6, 0.07, C.woodDark, 0.45, 0.8, 0));
  rack.add(box(0.3, 0.4, 0.02, C.paper, -0.18, 1.0, 0.05, { shadow: false }), box(0.3, 0.3, 0.02, 0xf6d9c8, 0.2, 1.15, 0.05, { shadow: false }));
  rack.position.set(9.9, 0, 5.2); // 靠咖啡店這一側，讓出旁邊小巷的入口
  add(rack);
  // ---- 咖啡店旁的小巷：夾在咖啡店和隔壁店面之間，盡頭有幾階通往後門的階梯 ----
  add(flat(1.4, 4.4, C.alley, 11.3, 2.7, 0.013));
  add(box(0.2, 1.7, 3.9, 0xe6d9c6, 12.1, 0.85, 2.45)); // 東側的矮牆
  boxes.push([12.0, 0.5, 12.2, 4.4]);
  for (let i = 0; i < 3; i++) add(box(1.3, 0.16, 0.42, C.stone, 11.3, 0.08 + i * 0.16, 1.5 - i * 0.42)); // 階梯
  add(box(0.9, 1.9, 0.08, C.woodDark, 11.3, 1.43, 0.42)); // 後門
  deco(cyl(0.2, 0.17, 0.5, 0x8d8580, 11.75, 0.25, 3.6, 10)); // 巷子裡的小水桶
  boxes.push([9.4, 4.95, 10.4, 5.45]);

  // ---- 廣場北側：騎樓連棟店面（只是背景，不能進去）----
  [[13.9, C.shop], [18.1, C.shopB], [22.3, C.shopC]].forEach(([x, col]) => {
    add(box(4.2, 2.8, 4.4, col, x, 3.8, -1.8)); // 二、三樓（往前突出成騎樓）
    add(box(4.4, 0.18, 4.6, 0xd6c4ad, x, 5.28, -1.8)); // 屋頂
    add(box(4.0, 2.4, 0.1, 0xe8dccb, x, 1.2, -2.6)); // 一樓內牆
    add(box(3.0, 2.0, 0.06, C.shutter, x, 1.0, -2.52)); // 鐵捲門
    for (let y = 0.2; y < 2.0; y += 0.25) add(box(3.0, 0.02, 0.07, 0xa7a29b, x, y, -2.49, { shadow: false }));
    for (const dx of [-2.05, 2.05]) add(box(0.32, 2.4, 0.32, C.column, x + dx, 1.2, 0.2)); // 騎樓柱
    for (const dx of [-1.0, 1.0]) {
      add(box(1.2, 1.0, 0.08, C.window, x + dx, 3.7, 0.42, { shadow: false })); // 窗
      add(box(1.3, 0.08, 0.3, 0xcfc3b3, x + dx, 3.15, 0.5)); // 窗台
    }
    add(box(0.6, 0.4, 0.4, 0xe9e6e0, x + 1.4, 4.6, 0.55)); // 冷氣室外機
    add(box(2.2, 0.5, 0.08, col === C.shopB ? 0xc98f6b : 0x8fb3c9, x, 2.65, 0.46)); // 店招（不寫字）
  });
  // 機車
  const scooter = (x, z, col, ry) => {
    const g = new THREE.Group();
    for (const dz of [-0.45, 0.45]) {
      const w = cyl(0.17, 0.17, 0.1, C.tire, 0, 0.17, dz, 14);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
    g.add(box(0.32, 0.22, 0.8, col, 0, 0.36, -0.05), box(0.3, 0.12, 0.45, 0x5a504a, 0, 0.53, -0.15)); // 車身、坐墊
    g.add(box(0.28, 0.55, 0.12, col, 0, 0.55, 0.42), box(0.5, 0.05, 0.05, C.metal, 0, 0.86, 0.45)); // 前擋、龍頭
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    deco(g);
    boxes.push([x - 0.35, z - 0.55, x + 0.35, z + 0.55]);
  };
  scooter(12.9, 1.4, C.scooterA, 0.1);
  scooter(13.8, 1.4, C.scooterB, -0.05);
  scooter(22.6, 1.4, C.scooterC, 0.08);
  boxes.push([12.75, 18.15, 13.85, 18.65]);
  // 廣場的盆栽與小板凳
  for (const [x, z] of [[15.9, 2.0], [20.3, 2.0], [24.0, 15.4]]) {
    deco(cyl(0.22, 0.17, 0.38, C.pot, x, 0.19, z, 12));
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), toon(C.leafDark));
    leaf.position.set(x, 0.58, z);
    leaf.castShadow = true;
    deco(leaf);
    circles.push([x, z, 0.24]);
  }
  deco(box(0.4, 0.04, 0.3, 0xd2705f, 16.9, 0.36, 1.8), box(0.04, 0.34, 0.04, 0xd2705f, 16.75, 0.17, 1.7), box(0.04, 0.34, 0.04, 0xd2705f, 17.05, 0.17, 1.9));

  // ---- 小廣場 ----
  // 許願池：在廣場正中央，圓形石砌水池、中間一座兩層的小噴泉（水花由 ambient.js 負責）
  const FX = 18;
  const FZ = 13.8;
  add(cyl(1.25, 1.3, 0.42, C.stone, FX, 0.21, FZ, 28), cyl(1.08, 1.08, 0.04, C.water, FX, 0.415, FZ, 28));
  add(cyl(0.2, 0.28, 0.85, C.stone, FX, 0.6, FZ, 12), cyl(0.5, 0.3, 0.16, C.stone, FX, 0.98, FZ, 16), cyl(0.42, 0.42, 0.03, C.water, FX, 1.06, FZ, 16));
  add(cyl(0.08, 0.12, 0.3, C.stone, FX, 1.2, FZ, 8));
  for (const [dx, dz] of [[0.5, 0.4], [-0.6, 0.2], [0.1, -0.7], [-0.3, 0.75], [0.75, -0.3]]) add(cyl(0.05, 0.05, 0.012, C.gold, FX + dx, 0.44, FZ + dz, 8)); // 池底的硬幣
  circles.push([FX, FZ, 1.3]);
  // 公布欄（面向南方）
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
  // 路燈：同一個造型重複繪製
  const LAMPS = [[12.6, 15.6], [23.4, 11.2], [15.9, 20.3], [18.1, 2.8]];
  add(instanced(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), C.metal, LAMPS.map(([x, z]) => [x, 1.3, z])));
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1cf }), LAMPS.length);
  LAMPS.forEach(([x, z], i) => bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 2.7, z)));
  add(bulbs);
  for (const [x, z] of LAMPS) circles.push([x, z, 0.15]);

  // 大榕樹：環狀石椅、粗樹幹、分枝與氣根。樹冠是獨立的網格，玩家走到樹後面時 main.js 會讓它變半透明
  const BX = 21.4;
  const BZ = 7.0;
  add(cyl(1.35, 1.42, 0.42, C.stone, BX, 0.21, BZ, 24), cyl(1.0, 1.0, 0.06, C.soil, BX, 0.44, BZ, 20));
  add(cyl(0.42, 0.62, 2.3, C.trunk, BX, 1.55, BZ, 10));
  for (const [dx, dz] of [[-1.3, 0.4], [1.3, 0.3], [0.2, 1.2], [-0.5, -1.2], [0.9, -0.8]]) {
    add(limb([BX + dx * 0.15, 2.3, BZ + dz * 0.15], [BX + dx, 3.5, BZ + dz], 0.2, 0.1, C.trunk));
  }
  for (const [dx, dz, len] of [[-0.9, 0.5, 1.3], [1.0, 0.45, 1.0], [0.5, 1.0, 1.5], [-0.3, 0.95, 0.9], [1.25, -0.2, 1.2]]) {
    add(limb([BX + dx, 3.2 - len, BZ + dz], [BX + dx, 3.2, BZ + dz], 0.018, 0.018, 0x8a6a50, 4, false)); // 氣根
  }
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const canopy = mergedMesh([[0, 4.3, 0, 1.9, C.leaf], [-1.5, 3.7, 0.5, 1.4, C.leafDark], [1.5, 3.8, 0.3, 1.45, C.leaf], [0.2, 3.6, 1.5, 1.3, C.leafDark],
    [-0.6, 3.9, -1.4, 1.4, C.leaf], [1.0, 4.6, -0.9, 1.2, C.leafDark]].map(([x, y, z, r, col]) => [blob, col, new THREE.Matrix4().makeTranslation(x, y, z).scale(new THREE.Vector3(r, r * 0.82, r))]), windy(vertexToon, 0.045));
  canopy.position.set(BX, 0, BZ);
  add(canopy);
  circles.push([BX, BZ, 1.42]);

  // 小土地公廟（只有外觀）：石台、紅牆、小屋頂、香爐
  const SX = 15.2;
  const SZ = 6.2;
  add(box(1.5, 0.22, 1.3, C.stone, SX, 0.11, SZ), box(1.1, 0.9, 0.9, C.shrine, SX, 0.67, SZ));
  add(box(0.5, 0.6, 0.06, 0x6b4a3a, SX, 0.6, SZ + 0.46, { shadow: false }), box(0.16, 0.22, 0.04, C.gold, SX, 0.48, SZ + 0.49, { shadow: false }));
  const sRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 3), toon(C.roof));
  sRoof.rotation.set(0, 0, Math.PI / 2);
  sRoof.rotation.order = 'ZXY';
  sRoof.scale.set(0.62, 1, 1.05);
  sRoof.position.set(SX, 1.31, SZ);
  sRoof.castShadow = true;
  add(sRoof);
  for (const sgn of [-1, 1]) {
    add(box(0.3, 0.06, 0.08, C.roof, SX + sgn * 0.82, 1.74, SZ).rotateZ(sgn * 0.5)); // 翹起來的屋脊
    add(cyl(0.08, 0.08, 0.16, 0xd9604e, SX + sgn * 0.45, 0.98, SZ + 0.52, 8)); // 小燈籠
  }
  add(box(0.4, 0.3, 0.4, C.stone, SX, 0.15, SZ + 0.95), cyl(0.15, 0.11, 0.18, C.gold, SX, 0.39, SZ + 0.95, 12)); // 香爐
  boxes.push([SX - 0.75, SZ - 0.65, SX + 0.75, SZ + 0.65], [SX - 0.2, SZ + 0.75, SX + 0.2, SZ + 1.15]);

  // 電線桿與電線：都在步道北側，電線沿著騎樓前拉過去，不會橫過玩家頭上
  const POLES = [[12.5, 2.9], [24.1, 2.7], [12.2, 10.6]];
  add(instanced(new THREE.CylinderGeometry(0.07, 0.1, 6, 8), C.pole, POLES.map(([x, z]) => [x, 3, z])));
  for (const [x, z] of POLES) {
    add(box(1.0, 0.08, 0.08, C.pole, x, 5.6, z), box(0.08, 0.14, 0.08, 0xe9e6e0, x - 0.4, 5.7, z), box(0.08, 0.14, 0.08, 0xe9e6e0, x + 0.4, 5.7, z));
    circles.push([x, z, 0.14]);
  }
  add(cyl(0.2, 0.2, 0.5, 0x9aa39c, 12.78, 4.6, 2.9, 10)); // 桿上的變壓器
  const wire = (a, b) => {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.3, (a[2] + b[2]) / 2];
    add(limb(a, mid, 0.014, 0.014, C.wire, 4, false), limb(mid, b, 0.014, 0.014, C.wire, 4, false));
  };
  for (const dx of [-0.4, 0.4]) {
    wire([12.5 + dx, 5.75, 2.9], [24.1 + dx, 5.75, 2.7]);
    wire([12.2 + dx, 5.75, 10.6], [12.5 + dx, 5.75, 2.9]);
  }
  // 變電箱
  add(box(0.9, 1.1, 0.5, 0xa9b8ab, 23.3, 0.63, 3.0), box(1.0, 0.08, 0.6, C.curb, 23.3, 0.04, 3.0), box(0.02, 0.9, 0.02, 0x8c9c90, 23.3, 0.63, 3.26, { shadow: false }));
  boxes.push([22.85, 2.75, 23.75, 3.25]);

  // 垃圾分類桶（三個，蓋子的開口形狀不同）
  [[22.0, 0x9db7c4], [22.5, 0xa9c2a0], [23.0, 0xc9c1b4]].forEach(([x, col], i) => {
    add(box(0.42, 0.7, 0.42, col, x, 0.35, 20.6), box(0.46, 0.06, 0.46, 0x7d7770, x, 0.73, 20.6));
    if (i === 0) add(cyl(0.09, 0.09, 0.02, 0x4f4a46, x, 0.77, 20.6, 12));
    else add(box(i === 1 ? 0.26 : 0.12, 0.02, i === 1 ? 0.06 : 0.2, 0x4f4a46, x, 0.77, 20.6, { shadow: false }));
  });
  boxes.push([21.75, 20.35, 23.25, 20.85]);

  // 騎樓的生活細節：柱子上的信箱、柱腳的盆栽、飲料店的杯子招牌
  for (const x of [13.9, 18.1, 22.3]) {
    add(box(0.2, 0.28, 0.08, C.postRed, x - 2.05, 1.3, 0.4));
    deco(cyl(0.17, 0.13, 0.3, C.pot, x + 1.75, 0.15, 0.62, 10));
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), toon(C.leaf));
    leaf.position.set(x + 1.75, 0.46, 0.62);
    deco(leaf);
  }
  add(cyl(0.15, 0.11, 0.32, C.cup, 13.2, 2.68, 0.56, 12), box(0.03, 0.3, 0.03, C.postRed, 13.24, 2.9, 0.56));

  // ---- 會晃的小東西：各自是一個獨立的網格，toys.js 在玩家摸它的時候讓它晃一下 ----
  const toyMeshes = {};
  // 二樓的曬衣架（隨風飄）
  const clothes = [box(1.9, 0.035, 0.035, C.metal, 0, 0, 0)];
  for (const [dx, col, h] of [[-0.75, 0xf0a59a, 0.5], [-0.3, 0xfffaf0, 0.42], [0.15, 0x9cc3c9, 0.55], [0.6, 0xf2c46b, 0.4]]) clothes.push(box(0.34, h, 0.02, col, dx, -h / 2 - 0.03, 0));
  const laundry = fuse(clothes);
  laundry.position.set(17.5, 4.78, 0.62);
  add(laundry);
  // 郵筒（紅、綠）
  const mail = [];
  for (const [dx, col] of [[-0.3, C.postRed], [0.3, C.postGreen]]) {
    mail.push(box(0.42, 0.9, 0.4, col, dx, 0.45, 0), cyl(0.21, 0.21, 0.42, col, dx, 0.9, 0, 14).rotateZ(Math.PI / 2));
    mail.push(box(0.24, 0.03, 0.02, 0x3d322c, dx, 0.75, 0.21, { shadow: false }));
  }
  toyMeshes.mailbox = fuse(mail);
  toyMeshes.mailbox.position.set(13.3, 0, 18.4);
  // 腳踏車（停在騎樓前）
  const bikeParts = [];
  for (const dz of [-0.5, 0.5]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 16), toon(C.tire));
    w.position.set(0, 0.3, dz);
    w.rotation.y = Math.PI / 2;
    bikeParts.push(w);
  }
  const FRAME = 0x8fb3c9;
  bikeParts.push(limb([0, 0.3, -0.5], [0, 0.72, -0.15], 0.022, 0.022, FRAME), limb([0, 0.72, -0.15], [0, 0.7, 0.35], 0.022, 0.022, FRAME));
  bikeParts.push(limb([0, 0.3, 0.5], [0, 0.95, 0.35], 0.022, 0.022, FRAME), limb([0, 0.3, -0.5], [0, 0.35, 0.05], 0.022, 0.022, FRAME), limb([0, 0.35, 0.05], [0, 0.7, 0.35], 0.022, 0.022, FRAME));
  bikeParts.push(box(0.14, 0.05, 0.26, 0x5a504a, 0, 0.78, -0.17), box(0.46, 0.03, 0.03, C.metal, 0, 0.95, 0.35), cyl(0.045, 0.045, 0.04, C.gold, 0.14, 0.99, 0.35, 8));
  toyMeshes.bike = fuse(bikeParts);
  toyMeshes.bike.position.set(19.6, 0, 1.5);
  boxes.push([19.35, 0.8, 19.85, 2.2]);
  // 飲料店的立牌
  const signParts = [];
  for (const sgn of [-1, 1]) signParts.push(box(0.55, 0.8, 0.04, 0xf3d9a4, 0, 0.42, sgn * 0.11).rotateX(sgn * 0.22));
  signParts.push(cyl(0.09, 0.07, 0.2, C.cup, 0, 0.5, 0.17, 10).rotateX(0.22), box(0.3, 0.03, 0.01, C.postRed, 0, 0.26, 0.21, { shadow: false }));
  toyMeshes.drink = fuse(signParts);
  toyMeshes.drink.position.set(14.9, 0, 2.5);
  boxes.push([14.6, 2.3, 15.2, 2.7]);
  // 里民活動海報架（面向南方；和劇情用的公布欄分開）
  const posterParts = [box(1.0, 0.8, 0.06, C.wood, 0, 1.15, 0), box(0.07, 1.6, 0.07, C.woodDark, -0.5, 0.8, 0), box(0.07, 1.6, 0.07, C.woodDark, 0.5, 0.8, 0)];
  posterParts.push(box(0.36, 0.5, 0.02, 0xf6d9c8, -0.24, 1.18, 0.04, { shadow: false }), box(0.3, 0.3, 0.02, 0xdfeedd, 0.2, 1.3, 0.04, { shadow: false }), box(0.3, 0.22, 0.02, C.paper, 0.2, 0.98, 0.04, { shadow: false }));
  toyMeshes.poster = fuse(posterParts);
  toyMeshes.poster.position.set(20.2, 0, 19.6);
  boxes.push([19.65, 19.45, 20.75, 19.75]);
  add(...Object.values(toyMeshes));

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
  [C.flowerA, C.flowerB, C.flowerC].forEach((col, i) => add(instanced(petal, col, flowers[i], windy(toon(col), 0.02))));
  // 薄荷盆栽（阿德旁邊）
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
  for (let i = 0; i < 4; i++) {
    const c = cyl(0.035, 0.035, 0.35 + i * 0.06, 0xe9d8b8, -0.12 + i * 0.08, -0.2 - i * 0.03, 0, 6);
    c.userData.keep = true; // 會擺動，不合併
    chimes.add(c);
  }
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
  // 植物角落（謎題「三盆植物」）：木架左邊向陽、中間格子棚（半陰）、右邊有屋簷（遮蔭）
  add(box(2.6, 0.08, 0.5, C.wood, 34.0, 0.6, 16.6), box(2.6, 0.08, 0.5, C.wood, 34.0, 0.05, 16.6));
  for (const x of [32.75, 35.25]) add(box(0.08, 2.2, 0.08, C.woodDark, x, 1.1, 16.4));
  for (let x = 33.5; x <= 34.4; x += 0.22) add(box(0.04, 0.04, 0.8, C.wood, x, 2.05, 16.6)); // 格子棚
  add(box(0.95, 0.06, 0.95, C.roof, 34.8, 2.1, 16.6)); // 屋簷
  add(cyl(0.16, 0.18, 0.32, 0x8fb3c9, 35.4, 0.16, 17.9, 12), box(0.3, 0.04, 0.04, 0x8fb3c9, 35.65, 0.3, 17.9)); // 澆水壺
  boxes.push([32.7, 16.3, 35.3, 16.9]);
  // 水龍頭與水桶、工具架
  add(box(0.12, 0.8, 0.12, C.metal, 25.4, 0.4, 5.2), box(0.2, 0.06, 0.06, C.metal, 25.48, 0.75, 5.2));
  deco(cyl(0.2, 0.16, 0.34, 0x8fb3c9, 25.9, 0.17, 5.3, 14));
  circles.push([25.6, 5.25, 0.35]);
  const tools = new THREE.Group();
  tools.add(box(1.6, 1.6, 0.1, C.wood, 0, 0.8, 0), box(1.7, 0.08, 0.3, C.woodDark, 0, 1.62, 0.1));
  for (const [dx, h] of [[-0.5, 1.3], [-0.1, 1.2], [0.35, 1.35]]) tools.add(box(0.05, h, 0.05, C.woodDark, dx, h / 2, 0.12));
  tools.add(box(0.3, 0.06, 0.05, C.metal, -0.5, 1.28, 0.12), box(0.18, 0.22, 0.04, C.metal, -0.1, 0.14, 0.12)); // 耙子、鏟子
  tools.position.set(29.8, 0, 1.0);
  deco(tools);
  boxes.push([28.95, 0.9, 30.65, 1.3]);
  // 謎題「三盆植物」的五個位置在 3D 裡的對應：木架左（曬得到）、大樹下、水龍頭旁、東邊牆邊、木架右（屋簷下）
  const potSpots = {
    sun: { x: 33.2, y: 0.64, z: 16.6 },
    shade: { x: 33.9, y: 0, z: 11.6 },
    wet: { x: 26.1, y: 0, z: 6.0 },
    wall: { x: 35.5, y: 0, z: 14.4 },
    eaves: { x: 34.8, y: 0.64, z: 16.6 },
    ground: { rosemary: { x: 34.6, z: 17.6 }, mint: { x: 33.2, z: 17.7 }, fern: { x: 33.9, z: 17.9 } },
  };

  // ---- 西南角的窄巷：舊倉庫和木籬笆之間，盡頭有幾階通往倉庫後門的階梯 ----
  // 隱藏角色小安坐在這裡。入口只有倉庫東側的窄巷（從北邊進去），從廣場、咖啡店、花園的主要步道上看不到；
  // 南邊只有矮樹叢，鏡頭跟進來時不會被擋住。這裡不放任何提示或發光的東西。
  add(flat(3.9, 1.9, C.alley, 2.45, 20.55, 0.013)); // 階梯前的小空地
  add(flat(1.2, 4.2, C.alley, 3.8, 18.5, 0.013)); // 窄巷
  add(box(2.7, 2.4, 2.0, C.shopC, 1.85, 1.2, 18.6)); // 舊倉庫
  add(box(2.9, 0.14, 2.2, 0xd6c4ad, 1.85, 2.47, 18.6)); // 屋頂
  add(box(0.9, 1.7, 0.08, C.woodDark, 1.6, 1.33, 19.62)); // 後門
  add(box(1.05, 0.1, 0.12, C.woodDark, 1.6, 2.22, 19.64)); // 門框
  add(box(0.7, 0.45, 0.06, C.window, 2.75, 1.6, 19.62, { shadow: false })); // 小窗
  for (let i = 0; i < 3; i++) add(box(1.3, 0.16, 0.42, C.stone, 1.6, 0.08 + i * 0.16, 20.65 - i * 0.42)); // 階梯
  boxes.push([0.4, 17.6, 3.2, 19.6]);
  // 東側的木籬笆（擋住從咖啡店南邊看過來的視線，入口留在北邊）
  const corner = [];
  for (let z = 17.5; z <= 21.5; z += 0.5) corner.push([4.45, 0.45, z]);
  add(instanced(new THREE.BoxGeometry(0.12, 0.9, 0.12), C.wood, corner));
  add(box(0.06, 0.08, 4.0, C.wood, 4.45, 0.7, 19.5), box(0.06, 0.08, 4.0, C.wood, 4.45, 0.35, 19.5));
  boxes.push([4.35, 17.4, 4.55, 21.6]);
  deco(cyl(0.2, 0.17, 0.5, 0x8d8580, 0.8, 0.25, 21.1, 10)); // 牆角的小水桶
  // 圍牆外往東北斜長的大樹：樹冠很高，從北邊遠處（例如手機直式螢幕走在巷道上）看過來會擋住階梯，
  // 走進角落時鏡頭的視線從樹冠下面穿過，看得到坐在階梯上的人（位置與高度經過計算，修改前請重新確認）
  const lean = new THREE.Group();
  const trunkFrom = new THREE.Vector3(-0.3, 0, 23.5);
  const trunkDir = new THREE.Vector3(1.3, 4.6, 23.0).sub(trunkFrom);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, trunkDir.length(), 8), toon(C.trunk));
  trunk.position.copy(trunkFrom).addScaledVector(trunkDir, 0.5);
  trunk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), trunkDir.clone().normalize());
  trunk.castShadow = true;
  lean.add(trunk);
  for (const [x, y, z, r, col] of [[1.7, 5.4, 22.9, 1.2, C.leaf], [0.7, 5.8, 23.2, 0.96, C.leafDark], [2.4, 5.0, 23.3, 0.7, C.leaf]]) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), toon(col));
    leaf.position.set(x, y, z);
    leaf.castShadow = true;
    lean.add(leaf);
  }
  add(lean);

  // ---- 樹 ----
  const trees = [
    [35.0, 10.2, 1.4], [5.4, 18.4, 1.1],
    [5.4, 20.8, 1.0], [11.8, 20.6, 1.1], [26.4, 20.6, 1.0], [35.0, 20.4, 1.2], [34.6, 1.6, 1.1], [26.0, 1.8, 0.9],
    [1.2, 12.4, 1.0], [12.4, 8.4, 0.8],
  ];
  add(instanced(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 8), C.trunk, trees.map(([x, z, s]) => [x, 0.7 * s, z, s])));
  add(instanced(new THREE.IcosahedronGeometry(1, 1), C.leaf, trees.map(([x, z, s]) => [x, 1.9 * s, z, 1.05 * s]), windy(toon(C.leaf))));
  add(instanced(new THREE.IcosahedronGeometry(0.7, 1), C.leafDark, trees.map(([x, z, s]) => [x + 0.4 * s, 2.5 * s, z + 0.2 * s, s]), windy(toon(C.leafDark))));
  for (const [x, z, s] of trees) circles.push([x, z, 0.35 * s + 0.1]);

  // ---- 邊界：南邊的矮樹叢、西邊與東邊的圍牆，不再像空地上的積木 ----
  const hedge = [];
  for (let x = 0.6; x < 36; x += 0.9) hedge.push([x, 0.35, 21.85, 0.55 + ((x * 3) % 1) * 0.2]);
  for (let z = 5.2; z < 21; z += 0.9) hedge.push([0.15, 0.35, z, 0.5]);
  add(instanced(new THREE.IcosahedronGeometry(1, 1), C.leafDark, hedge));
  add(box(0.3, 1.2, 22, 0xe6d9c6, 36.15, 0.6, 11)); // 東邊的磚牆
  add(box(0.3, 1.2, 4.6, 0xe6d9c6, -0.15, 0.6, 2.3)); // 咖啡店西側

  // ---- 邊界外的遠景帶：南邊的鄰居屋頂與矮樹（x > 8；西南角維持原樣）。都很矮，不會擋到走在南緣的玩家；低畫質時隱藏 ----
  const far = new THREE.Group();
  far.name = 'far';
  visuals.add(far);
  const houseCols = [C.shop, C.shopC, C.shopB];
  for (let i = 0, x = 10.5; x < 36; x += 4.6, i++) {
    const w = 3.4 + (i % 2) * 0.5;
    far.add(box(w, 1.1, 2.2, houseCols[i % 3], x, 0.55, 27.4));
    const r = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, w + 0.4, 3), toon(i % 2 ? 0xc79a80 : C.roof));
    r.rotation.set(0, 0, Math.PI / 2);
    r.rotation.order = 'ZXY';
    r.scale.set(0.3, 1, 0.9);
    r.position.set(x, 1.32, 27.4);
    r.castShadow = true;
    far.add(r);
    far.add(box(0.5, 0.36, 0.3, 0xe9e6e0, x + w / 2 - 0.5, 0.7, 26.2)); // 冷氣室外機
  }
  far.add(box(27.5, 0.6, 0.2, 0xe6d9c6, 22.2, 0.3, 23.2)); // 矮圍牆
  const shrubs = [];
  for (let x = 8.6; x < 36; x += 1.7) shrubs.push([x, 0.45, 23.9 + Math.sin(x * 2.3) * 0.25, 0.6 + ((x * 5) % 1) * 0.25]);
  far.add(instanced(new THREE.IcosahedronGeometry(1, 1), C.leaf, shrubs, windy(toon(C.leaf), 0.03)));
  bakeStatic(far, vertexToon);

  // 靜態擺設合併成少數網格，減少繪製呼叫
  bakeStatic(details, vertexToon);
  bakeStatic(visuals, vertexToon);

  const blocked = (x, z, r) => {
    if (x - r < 0.5 || z - r < 0.5 || x + r > WIDTH - 0.5 || z + r > HEIGHT - 0.5) return true;
    for (const [x1, z1, x2, z2] of boxes) {
      if (x + r > x1 && x - r < x2 && z + r > z1 && z - r < z2) return true;
    }
    for (const [cx, cz, cr] of circles) if (Math.hypot(x - cx, z - cz) < r + cr) return true;
    return false;
  };
  // 小巷（id 沿用 alley，舊存檔可直接讀）：西南角舊倉庫旁的窄巷與階梯前的空地。只給 x 時（麻糬帶路）只看東西向
  const areaOf = (x, z = 0) => (x < 4.4 && z > 17.4 ? 'alley' : x < 11.8 ? 'cafe' : x > 24.6 ? 'garden' : 'plaza');

  // 麻糬會去打盹的地方（玩家停著不動一陣子時）：榕樹的石椅上、廣場長椅前
  const napSpots = [{ x: BX, y: 0.47, z: BZ + 1.17 }, { x: 22.9, y: 0, z: 18.4 }];
  return {
    width: WIDTH, height: HEIGHT, blocked, areaOf, visuals, details, far,
    anchors: { chimes, potSpots, banyan: { canopy, x: BX, z: BZ }, fountain: { x: FX, z: FZ }, laundry: [laundry], toyMeshes, napSpots },
  };
}
