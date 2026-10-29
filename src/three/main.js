// 3D 試作版主程式（Three.js）。內容與地圖沿用 content/ 與 maps/ 的 JSON。
import * as THREE from 'three';
import { HAIR_STYLES, HAIR_COLORS, OUTFITS, SKINS, COMPANIONS } from '../art.js';
import { loadPlayerModel, makePerson, makePet, makePlayer } from './characters.js';
import { buildWorld } from './world.js';
import {
  Dialogue, makeLabel, setupCreatePanel, showPlayControls, setTalkHint, setupJoystick, setupRotateButtons, isTouch,
} from './ui.js';

const ZONE = '晨光廣場';
const SPEED = 3;
const RADIUS = 0.28;
const TALK_DISTANCE = 1.7;
const REST_REMINDER_MS = 15 * 60 * 1000;

// 今日心情溫度計：只是互動，不儲存、不評分（與 2D 版 CreateScene 相同）
const MOODS = [
  { label: '有點冷', reply: '今天有點冷啊。那我們慢慢走就好，不用急。' },
  { label: '涼涼的', reply: '涼涼的也沒關係，我會陪著你。' },
  { label: '普通', reply: '普普通通的一天，也是很好的一天。' },
  { label: '暖暖的', reply: '暖暖的呀，真好。一起去看看小鎮吧！' },
  { label: '很溫暖', reply: '你的溫暖，說不定也能分一點給小鎮呢。' },
];

const content = await fetch(`content/${ZONE}.json`).then((r) => r.json());
const tiled = await fetch(content.map).then((r) => r.json());
const hasPlayerModel = await loadPlayerModel();

// ---- 場景、光線 ----
const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.append(renderer.domElement);

const scene = new THREE.Scene();
const CLEAR_SKY = new THREE.Color(0xfbeee0);
const FOG_SKY = new THREE.Color(0xdcd6d0);
scene.background = FOG_SKY.clone();
scene.fog = new THREE.Fog(FOG_SKY.clone(), 8, 26);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);

const world = buildWorld(scene, tiled);
const center = new THREE.Vector3(world.width / 2, 0, world.height / 2);
scene.add(new THREE.HemisphereLight(0xfff6ea, 0xc5d6b4, 2.2));
const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
sun.position.set(center.x + 8, 16, center.z + 10);
sun.target.position.copy(center);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

// ---- 灰霧：去飽和（CSS filter）、霧氣距離、飄動的霧團與光點 ----
let fogLevel = 1;
let colorPreview = true; // 角色創建時先不去飽和，才看得清楚顏色
const mistTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(240,236,232,0.85)');
  g.addColorStop(1, 'rgba(240,236,232,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const sparkleTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,246,214,0.8)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const mists = Array.from({ length: 14 }, () => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, depthWrite: false, transparent: true }));
  s.position.set(Math.random() * world.width, 0.8 + Math.random() * 1.2, Math.random() * world.height);
  s.scale.setScalar(5 + Math.random() * 4);
  s.userData.speed = 0.15 + Math.random() * 0.2;
  scene.add(s);
  return s;
});
function makePoints(count, size) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mat = new THREE.PointsMaterial({
    map: sparkleTex, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}
const motes = makePoints(160, 0.22);
const motePos = motes.geometry.attributes.position;
for (let i = 0; i < motePos.count; i++) {
  motePos.setXYZ(i, Math.random() * world.width, Math.random() * 3, Math.random() * world.height);
}
const burst = makePoints(60, 0.3);
const burstVel = Array.from({ length: 60 }, () => new THREE.Vector3());
let burstTime = 0;
burst.visible = false;

function sparkleAt(p) {
  const pos = burst.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, p.x, 1, p.z);
    burstVel[i].set(Math.random() - 0.5, Math.random() * 0.8 + 0.4, Math.random() - 0.5).normalize().multiplyScalar(1 + Math.random() * 1.5);
  }
  burstTime = 1.6;
  burst.visible = true;
}

function applyFog() {
  const tint = colorPreview ? 0 : fogLevel;
  renderer.domElement.style.filter = `saturate(${1 - 0.75 * tint}) brightness(${1 + 0.04 * tint})`;
  scene.background.copy(CLEAR_SKY).lerp(FOG_SKY, fogLevel);
  scene.fog.color.copy(scene.background);
  scene.fog.near = 8 + (1 - fogLevel) * 30;
  scene.fog.far = 26 + (1 - fogLevel) * 60;
  for (const m of mists) m.material.opacity = 0.75 * fogLevel;
  motes.material.opacity = 0.25 + 0.75 * (1 - fogLevel);
}

let fogTween = null;
function clearFog(amount) {
  fogTween = { from: fogLevel, to: Math.max(0, fogLevel - amount), t: 0, duration: 3 };
}
applyFog();

// ---- 角色 ----
const playerPos = new THREE.Vector3(world.spawns.player.x, 0, world.spawns.player.z);
let player = null;
let pet = null;
let petInfo = COMPANIONS[0];
let yaw = 0; // 0 = 面向鏡頭（+z）

function rebuildCharacters(choice) {
  if (player) scene.remove(player);
  if (pet) scene.remove(pet);
  player = makePlayer({
    hairStyle: HAIR_STYLES[choice.hairStyle ?? 0].id,
    hairColor: HAIR_COLORS[choice.hairColor ?? 0].id,
    outfit: OUTFITS[choice.outfit ?? 0].id,
    skin: SKINS[choice.skin ?? 1].id,
  });
  petInfo = COMPANIONS[choice.companion];
  pet = makePet(petInfo.id);
  player.position.copy(playerPos);
  pet.position.set(playerPos.x - 0.75, 0, playerPos.z + 0.3);
  scene.add(player, pet);
}

const residents = content.residents.map((data) => {
  const sp = world.spawns[data.id];
  const mesh = makePerson(data.appearance);
  mesh.position.set(sp.x, 0, sp.z);
  scene.add(mesh);
  return {
    data, mesh, talked: false,
    nameTag: makeLabel('tag', data.name),
    heart: makeLabel('heart', '♡'),
  };
});

// ---- 介面 ----
const dialogue = new Dialogue();
let mode = 'create';
let panel = null;
// 有玩家模型時造型固定，只保留選擇陪伴小動物
const appearanceRows = hasPlayerModel ? [] : [
  ['髮型', 'hairStyle', HAIR_STYLES],
  ['髮色', 'hairColor', HAIR_COLORS],
  ['服裝', 'outfit', OUTFITS],
  ['膚色', 'skin', SKINS, 1],
];
panel = setupCreatePanel([
  ...appearanceRows,
  ['陪伴小動物', 'companion', COMPANIONS],
], MOODS, {
  onChange: (choice) => {
    rebuildCharacters(choice);
    panel?.say(`我是你的${petInfo.label}夥伴，會陪你逛小鎮，也會提醒你休息喔。`);
  },
  onMood: (m) => panel.say(m.reply),
  onStart: () => {
    mode = 'play';
    colorPreview = false;
    applyFog();
    showPlayControls();
    dialogue.show([{ speaker: petInfo.label, text: content.intro }]);
    setInterval(() => companionSay('玩一陣子了，要不要起來伸展一下、喝口水？'), REST_REMINDER_MS);
  },
});
panel.say(`我是你的${petInfo.label}夥伴，會陪你逛小鎮，也會提醒你休息喔。`);

let bubble = null;
function companionSay(text) {
  bubble?.remove();
  const el = makeLabel('bubble', text);
  bubble = el;
  setTimeout(() => { el.style.opacity = 0; }, 4000);
  setTimeout(() => { el.remove(); if (bubble === el) bubble = null; }, 5000);
}

// 對話時鏡頭轉到主角斜後方，把兩個人都拍進畫面
let talkFocus = null;
let talkAzimuth = 0;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function talk(r) {
  if (!r || !dialogue.canStart()) return;
  const dx = r.mesh.position.x - playerPos.x;
  const dz = r.mesh.position.z - playerPos.z;
  yaw = Math.atan2(dx, dz);
  r.mesh.rotation.y = Math.atan2(-dx, -dz);
  talkFocus = new THREE.Vector3(playerPos.x + dx / 2, 0, playerPos.z + dz / 2);
  // 從主角的斜後方看過去，看得到居民的正臉
  const back = Math.atan2(-dx, -dz);
  talkAzimuth = Math.abs(angleDiff(back + 1.3, azimuth)) < Math.abs(angleDiff(back - 1.3, azimuth)) ? back + 1.3 : back - 1.3;
  dialogue.show(r.data.dialogue, () => {
    talkFocus = null;
    if (r.talked) return;
    r.talked = true;
    r.heart.remove();
    sparkleAt(r.mesh.position);
    clearFog(r.data.fogReduction ?? 0.3);
    setTimeout(() => companionSay('你看，廣場的顏色回來了一些。'), 1500);
  });
}

// ---- 輸入 ----
const keys = new Set();
const helpDialog = document.getElementById('help-dialog');
const stick = isTouch ? setupJoystick() : { x: 0, y: 0 };
const rotateState = { rotate: 0 };
setupRotateButtons(rotateState);
let near = null;

addEventListener('keydown', (e) => {
  if (helpDialog.open || mode !== 'play') return;
  keys.add(e.code);
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (e.repeat) return;
    if (dialogue.open) dialogue.advance();
    else talk(near);
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// 拖曳畫面旋轉鏡頭
let azimuth = 0;
let dragId = null;
let dragX = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { if (mode === 'play') { dragId = e.pointerId; dragX = e.clientX; } });
addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragId) return;
  azimuth -= (e.clientX - dragX) * 0.008;
  dragX = e.clientX;
});
addEventListener('pointerup', (e) => { if (e.pointerId === dragId) dragId = null; });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- 主迴圈 ----
const camState = { dist: 3.4, polar: 1.25, height: 0.55, side: 0 };
const camTarget = new THREE.Vector3();
const tmp = new THREE.Vector3();
const clock = new THREE.Clock();
let lastNearName = undefined;

function blocked(x, z) {
  if (world.blocked(x, z, RADIUS)) return true;
  return residents.some((r) => Math.hypot(r.mesh.position.x - x, r.mesh.position.z - z) < 0.95);
}

function placeLabel(el, obj, height) {
  tmp.copy(obj.position).setY(obj.position.y + height).project(camera);
  const visible = tmp.z < 1;
  el.style.display = visible ? '' : 'none';
  el.style.left = `${(tmp.x + 1) / 2 * innerWidth}px`;
  el.style.top = `${(1 - tmp.y) / 2 * innerHeight}px`;
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // 移動
  let ix = 0, iy = 0;
  if (mode === 'play' && !dialogue.open) {
    ix = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0) + stick.x;
    iy = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) + stick.y;
    azimuth += ((keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0) + rotateState.rotate) * dt * 1.8;
  }
  const len = Math.hypot(ix, iy);
  if (len > 1) { ix /= len; iy /= len; }
  const moving = len > 0.1;
  if (moving) {
    const wx = ix * Math.cos(azimuth) + iy * Math.sin(azimuth);
    const wz = -ix * Math.sin(azimuth) + iy * Math.cos(azimuth);
    const nx = playerPos.x + wx * SPEED * dt;
    const nz = playerPos.z + wz * SPEED * dt;
    if (!blocked(nx, playerPos.z)) playerPos.x = nx;
    if (!blocked(playerPos.x, nz)) playerPos.z = nz;
    yaw = Math.atan2(wx, wz);
  }

  // 角色動畫：走路時一蹦一蹦，站著時慢慢呼吸
  if (player) {
    player.position.copy(playerPos);
    const dy = Math.atan2(Math.sin(yaw - player.rotation.y), Math.cos(yaw - player.rotation.y));
    player.rotation.y += dy * Math.min(1, dt * 12);
    const body = player.userData.body;
    if (moving) {
      body.position.y = Math.abs(Math.sin(t * 13)) * 0.09;
      body.rotation.z = Math.sin(t * 13) * 0.07;
      body.scale.set(1, 1, 1);
    } else {
      body.position.y = 0;
      body.rotation.z *= 0.8;
      const b = Math.sin(t * 2.4) * 0.025;
      body.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5);
    }

    // 小動物跟在身後
    tmp.set(playerPos.x - Math.sin(yaw) * 0.8 + Math.cos(yaw) * 0.35, 0, playerPos.z - Math.cos(yaw) * 0.8 - Math.sin(yaw) * 0.35);
    const gap = tmp.distanceTo(pet.position);
    if (mode === 'play' && gap > 0.05) {
      pet.position.lerp(tmp, Math.min(1, dt * 4));
      pet.rotation.y = Math.atan2(tmp.x - pet.position.x, tmp.z - pet.position.z) || pet.rotation.y;
    }
    if (mode === 'create') pet.rotation.y = 0.4;
    pet.userData.body.position.y = gap > 0.15 ? Math.abs(Math.sin(t * 16)) * 0.08 : 0;
    const pb = Math.sin(t * 3) * 0.03;
    pet.userData.body.scale.set(1 - pb * 0.5, 1 + pb, 1 - pb * 0.5);
  }

  // 居民輕輕呼吸
  for (const r of residents) {
    const b = Math.sin(t * 2 + r.mesh.position.x) * 0.025;
    r.mesh.userData.body.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5);
  }

  // 互動提示
  near = mode === 'play' && !dialogue.open
    ? residents.find((r) => Math.hypot(r.mesh.position.x - playerPos.x, r.mesh.position.z - playerPos.z) < TALK_DISTANCE)
    : null;
  const nearName = near?.data.name ?? null;
  if (nearName !== lastNearName) {
    setTalkHint(nearName, () => talk(near));
    lastNearName = nearName;
  }

  // 灰霧與光點
  if (fogTween) {
    fogTween.t += dt;
    const k = Math.min(1, fogTween.t / fogTween.duration);
    fogLevel = fogTween.from + (fogTween.to - fogTween.from) * (1 - Math.cos(k * Math.PI)) / 2;
    applyFog();
    if (k >= 1) fogTween = null;
  }
  for (const m of mists) {
    m.position.x += m.userData.speed * dt;
    if (m.position.x > world.width + 4) m.position.x = -4;
  }
  for (let i = 0; i < motePos.count; i++) {
    let y = motePos.getY(i) + dt * 0.25;
    if (y > 3) y = 0;
    motePos.setY(i, y);
    motePos.setX(i, motePos.getX(i) + Math.sin(t + i) * dt * 0.1);
  }
  motePos.needsUpdate = true;
  if (burstTime > 0) {
    burstTime -= dt;
    const pos = burst.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      burstVel[i].y -= dt * 0.6;
      pos.setXYZ(i, pos.getX(i) + burstVel[i].x * dt, pos.getY(i) + burstVel[i].y * dt, pos.getZ(i) + burstVel[i].z * dt);
    }
    pos.needsUpdate = true;
    burst.material.opacity = Math.max(0, burstTime / 1.6);
    if (burstTime <= 0) burst.visible = false;
  }

  // 鏡頭：創建畫面時拉近看角色，出發後退到俯視角
  const play = mode === 'play';
  const wide = innerWidth > 700;
  const k = Math.min(1, dt * 2.5);
  const talking = play && dialogue.open && talkFocus;
  if (talking) azimuth += angleDiff(talkAzimuth, azimuth) * k;
  const focus = talking ? talkFocus : playerPos;
  // 直式螢幕視野較窄，鏡頭拉遠一點
  const narrow = Math.max(1, 1 / camera.aspect);
  const createDist = 3.4 * Math.min(2, Math.max(1, 0.95 / camera.aspect));
  camState.dist += ((talking ? 5 * Math.sqrt(narrow) : play ? 10 * Math.sqrt(narrow) * 0.85 : createDist) - camState.dist) * k;
  camState.polar += ((talking ? 1.2 : play ? 0.92 : 1.25) - camState.polar) * k;
  camState.height += ((play ? 0.5 : 0.6) - camState.height) * k;
  camState.side += ((play || !wide ? 0 : 0.85) - camState.side) * k;
  const lift = !play && !wide ? 1.25 : 0; // 手機：角色往畫面上方，讓出下方的面板
  camTarget.set(focus.x + Math.cos(azimuth) * camState.side, camState.height - lift, focus.z - Math.sin(azimuth) * camState.side);
  camera.position.set(
    camTarget.x + Math.sin(azimuth) * Math.sin(camState.polar) * camState.dist,
    camTarget.y + Math.cos(camState.polar) * camState.dist,
    camTarget.z + Math.cos(azimuth) * Math.sin(camState.polar) * camState.dist,
  );
  camera.lookAt(camTarget);

  // 頭上的名牌、愛心、對話泡泡
  for (const r of residents) {
    placeLabel(r.nameTag, r.mesh, 1.55);
    if (!r.talked) placeLabel(r.heart, r.mesh, 1.95);
  }
  if (bubble && pet) placeLabel(bubble, pet, 0.9);

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);
