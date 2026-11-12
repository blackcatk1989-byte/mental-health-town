// 3D 模式：微光里的場景、角色、移動與碰撞、互動提示、謎題的盆栽、橘貓麻糬的帶路提示。
// 遊戲規則與進度都在 src/game.js；這裡只負責呈現與輸入，和文字模式共用同一份進度。
import * as THREE from 'three';
import { makeCat, makeCharacter, makePot, PLAYER_LOOK } from './characters.js';
import { buildWorld } from './world.js';
import { FollowCamera } from './camera.js';
import { setupLighting } from './lighting.js';
import { animateWaters, loadIsland } from './island.js';
import { setupControls, isTouch } from './controls.js';
import { $ } from '../ui.js';

const ISLAND_URL = 'assets/models/island.glb'; // 有這個檔案時改用模型當小鎮外觀
const SPEED = 3; // 步行速度（單位／秒）
const RADIUS = 0.28; // 角色碰撞半徑
const REACH = 1.7; // 可互動距離
const SAVE_EVERY = 1.5; // 位置每幾秒存一次

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export async function start3D(game, ui, store) {
  if (!webglAvailable()) throw new Error('這個瀏覽器不支援 WebGL');
  const container = $('scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const applyQuality = () => {
    const low = store.settings.quality === 'low';
    renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    lighting?.setQuality(store.settings.quality);
  };
  let lighting = null;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8ecdb);
  scene.fog = new THREE.Fog(0xf8ecdb, 26, 60);
  const follow = new FollowCamera(innerWidth / innerHeight);
  const camera = follow.camera;
  lighting = setupLighting(renderer, scene);
  applyQuality();

  const world = buildWorld(scene);
  const island = await loadIsland(scene, ISLAND_URL);
  if (island) world.visuals.visible = false;

  // ---- 角色 ----
  const labels = [];
  const label = (cls, text) => {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    $('labels').append(el);
    labels.push(el);
    return el;
  };
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const hitGeo = new THREE.BoxGeometry(1, 1.6, 1);
  const pickables = []; // 可點選的網格，userData.targetId 指向互動目標

  const actors = new Map(); // 角色 id → { mesh, tag, spot }
  for (const ch of game.c.characters.characters) {
    const mesh = makeCharacter(ch.look);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.y = 0.8;
    hit.userData.targetId = ch.id;
    mesh.add(hit);
    pickables.push(hit);
    scene.add(mesh);
    actors.set(ch.id, { mesh, tag: label('tag', ch.name), spot: null });
  }
  for (const o of game.c.places.objects) {
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.set(o.x, 0.8, o.z);
    hit.userData.targetId = o.id;
    scene.add(hit);
    pickables.push(hit);
  }

  const player = makeCharacter(PLAYER_LOOK);
  scene.add(player);
  const s = game.s;
  const start = s.player && !world.blocked(s.player.x, s.player.z, RADIUS) ? s.player : game.areaById[s.area]?.spawn ?? { x: 18, z: 17 };
  const pos = new THREE.Vector3(start.x, 0, start.z);
  let yaw = Math.PI; // 面向北方（背對鏡頭）
  let lastArea = world.areaOf(pos.x);

  // ---- 謎題：三盆植物的位置跟著存檔變動 ----
  const potSpots = world.anchors.potSpots; // 木架上的位置（sun／half／shade）與地上的起始位置
  const pots = new Map();
  for (const it of game.c.puzzles.puzzles.E01.items) {
    const pot = makePot(it.id);
    scene.add(pot);
    pots.set(it.id, pot);
  }
  function syncPots() {
    const place = game.s.puzzles.E01.place;
    for (const [id, pot] of pots) {
      const p = potSpots[place[id]] ?? potSpots.ground[id];
      pot.position.set(p.x, p.y ?? 0, p.z);
    }
  }

  // ---- 麻糬：跟在玩家附近；提示時帶路、停在物件旁 ----
  const cat = makeCat();
  scene.add(cat);
  const catHit = new THREE.Mesh(hitGeo, hitMat);
  catHit.scale.set(0.8, 0.5, 0.8);
  catHit.position.y = 0.3;
  catHit.userData.targetId = 'mochi';
  cat.add(catHit);
  pickables.push(catHit);
  cat.position.set(pos.x - 1.2, 0, pos.z + 0.6);
  const catTag = label('tag cat-tag', '麻糬');
  const catTarget = { id: 'mochi', kind: 'cat', name: '橘貓麻糬', x: 0, z: 0, cardTarget: false };
  const catRoute = []; // 要走的路點；空的時候跟著玩家
  let catGuide = null; // 提示中的目的地 { x, z }
  // 三區之間的出入口，帶路時依序經過，不穿過建築與籬笆
  const GATES = { 'cafe-plaza': { x: 11.8, z: 12.6 }, 'plaza-garden': { x: 24.6, z: 11.4 } };
  function routeTo(dest, destArea) {
    catRoute.length = 0;
    const order = ['cafe', 'plaza', 'garden'];
    let a = order.indexOf(world.areaOf(cat.position.x));
    const b = order.indexOf(destArea);
    while (a !== b) {
      const next = a + Math.sign(b - a);
      catRoute.push(GATES[[order[Math.min(a, next)], order[Math.max(a, next)]].join('-')]);
      a = next;
    }
    catRoute.push(dest);
    catGuide = dest;
  }

  // 麻糬提示第 3 層：在互動位置標出光柱
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 6, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
  );
  beacon.visible = false;
  scene.add(beacon);
  const beaconTag = label('tag beacon-tag hidden', '在這裡');
  const hideBeacon = () => {
    beacon.visible = false;
    beacon.userData.target = null;
    beaconTag.classList.add('hidden');
  };
  const onHint = (e) => {
    const { layer, target, area } = e.detail;
    hideBeacon();
    if (layer === 1) {
      // 走到該區域的入口附近；已經在同一區就往物件的方向走幾步
      const sp = area.spawn;
      const here = world.areaOf(cat.position.x) === area.id;
      const dest = here ? { x: (cat.position.x + target.x) / 2, z: (cat.position.z + target.z) / 2 } : { x: sp.x, z: sp.z };
      routeTo(dest, area.id);
    } else {
      routeTo({ x: target.x + 0.7, z: target.z + 0.6 }, area.id);
    }
    if (layer === 3) {
      beacon.position.set(target.x, 3, target.z);
      beacon.visible = true;
      beacon.userData.target = target.id;
      beaconTag.classList.remove('hidden');
    }
  };
  game.addEventListener('hint', onHint);

  // ---- 狀態同步 ----
  const goalTags = new Map();
  function syncActors() {
    for (const [id, a] of actors) {
      const t = game.target(id);
      if (a.spot?.x !== t.x || a.spot?.z !== t.z) {
        a.mesh.position.set(t.x, 0, t.z);
        a.spot = { x: t.x, z: t.z };
      }
    }
    const goals = new Set(game.goalTargets());
    for (const [id, el] of goalTags) {
      if (!goals.has(id)) {
        el.remove();
        goalTags.delete(id);
      }
    }
    for (const id of goals) if (!goalTags.has(id)) goalTags.set(id, label('goal-mark', '！'));
    // 提示的目標已經完成（例如謎題解開），光柱就收起來
    if (beacon.userData.target && !game.hintTopics().some((tp) => tp.target === beacon.userData.target)) hideBeacon();
  }
  // 互動目標在進度改變時才重算，主迴圈裡不新建物件
  let targetList = [];
  const targetMap = new Map();
  const onChange = () => {
    targetList = game.targets();
    targetMap.clear();
    for (const tg of targetList) targetMap.set(tg.id, tg);
    syncActors();
    syncPots();
  };
  game.addEventListener('change', onChange);
  onChange();

  // ---- 輸入 ----
  let near = null;
  const blockedUI = () => ui.busy() || document.body.classList.contains('home-open');
  const controls = setupControls({
    isBlocked: blockedUI,
    onInteract: () => { if (near && !blockedUI()) interact(near); },
    onUse: () => { if (near?.cardTarget && !blockedUI()) ui.openUseCard(near.id); },
  });

  function interact(t) {
    if (t.kind === 'cat') ui.hints();
    else game.interact(t.id);
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onPointer = (e) => {
    if (blockedUI()) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (!hit) return;
    const id = hit.object.userData.targetId;
    const t = id === 'mochi' ? catTarget : game.target(id);
    if (!t) return;
    if (Math.hypot(t.x - pos.x, t.z - pos.z) <= REACH) interact(t);
    else ui.toast(`再靠近${t.name}一點，就可以互動。`, { ms: 2200 });
  };
  renderer.domElement.addEventListener('pointerup', onPointer);

  const onResize = () => {
    follow.setAspect(innerWidth / innerHeight);
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  // ---- 主迴圈 ----
  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  let saveTimer = 0;
  let moved = false;
  let shownTarget;

  const blocked = (x, z) => {
    if (world.blocked(x, z, RADIUS)) return true;
    for (const a of actors.values()) if (Math.hypot(a.mesh.position.x - x, a.mesh.position.z - z) < 0.45 + RADIUS) return true;
    return false;
  };

  const placeLabel = (el, x, y, z) => {
    tmp.set(x, y, z).project(camera);
    el.style.display = tmp.z < 1 ? '' : 'none';
    el.style.left = `${((tmp.x + 1) / 2) * innerWidth}px`;
    el.style.top = `${((1 - tmp.y) / 2) * innerHeight}px`;
  };

  // 麻糬：沒有提示時跟在玩家身後；有提示時沿著路點走到目的地，坐著等玩家過來
  const CAT_SPEED = 2.6;
  function updateCat(dt, t, still) {
    let tx;
    let tz;
    if (catRoute.length) {
      tx = catRoute[0].x;
      tz = catRoute[0].z;
    } else if (catGuide) {
      tx = catGuide.x;
      tz = catGuide.z;
      if (Math.hypot(pos.x - tx, pos.z - tz) < 2.2) catGuide = null; // 玩家跟上了，回去跟著玩家
    } else {
      tx = pos.x - Math.sin(yaw) * 1.1 + Math.cos(yaw) * 0.5;
      tz = pos.z - Math.cos(yaw) * 1.1 - Math.sin(yaw) * 0.5;
    }
    const dx = tx - cat.position.x;
    const dz = tz - cat.position.z;
    const d = Math.hypot(dx, dz);
    const walking = d > (catRoute.length ? 0.15 : 0.4);
    if (walking) {
      const step = Math.min(d, CAT_SPEED * dt);
      cat.position.x += (dx / d) * step;
      cat.position.z += (dz / d) * step;
      cat.rotation.y = Math.atan2(dx, dz);
    } else if (catRoute.length) {
      catRoute.shift();
    }
    const body = cat.userData.body;
    body.position.y = walking && !still ? Math.abs(Math.sin(t * 14)) * 0.04 : 0;
    cat.userData.tail.rotation.z = still ? 0 : Math.sin(t * (walking ? 6 : 2)) * 0.4;
  }

  function breathe(a, t, still) {
    const b = still ? 0 : Math.sin(t * 2.2 + a.position.x) * 0.02;
    a.userData.body.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5);
  }

  function savePosition() {
    game.setPlayer(pos.x, pos.z, world.areaOf(pos.x));
    store.save();
    moved = false;
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const still = store.settings.reduceMotion;

    // 移動（鏡頭在南方往北看：上＝-Z，右＝+X）
    let { x: ix, y: iy } = controls.direction();
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    const walking = len > 0.1;
    if (walking) {
      const nx = pos.x + ix * SPEED * dt;
      const nz = pos.z + iy * SPEED * dt;
      if (!blocked(nx, pos.z)) pos.x = nx;
      if (!blocked(pos.x, nz)) pos.z = nz;
      yaw = Math.atan2(ix, iy);
      moved = true;
    }
    player.position.copy(pos);
    player.rotation.y += Math.atan2(Math.sin(yaw - player.rotation.y), Math.cos(yaw - player.rotation.y)) * Math.min(1, dt * 12);
    const body = player.userData.body;
    if (walking && !still) {
      body.position.y = Math.abs(Math.sin(t * 12)) * 0.07;
      body.rotation.z = Math.sin(t * 12) * 0.05;
    } else {
      body.position.y = 0;
      body.rotation.z *= 0.8;
    }
    breathe(player, t, still);
    for (const a of actors.values()) breathe(a.mesh, t, still);
    // 角色面向玩家（距離近時）
    for (const a of actors.values()) {
      const d = Math.hypot(pos.x - a.mesh.position.x, pos.z - a.mesh.position.z);
      if (d < 3) a.mesh.rotation.y = Math.atan2(pos.x - a.mesh.position.x, pos.z - a.mesh.position.z);
    }

    // 區域切換提示
    const area = world.areaOf(pos.x);
    if (area !== lastArea) {
      lastArea = area;
      game.setPlayer(pos.x, pos.z, area);
      ui.toast(game.areaById[area].name, { ms: 1600 });
    }
    saveTimer += dt;
    if (moved && saveTimer > SAVE_EVERY) {
      saveTimer = 0;
      savePosition();
    }

    // 附近可互動的目標
    near = null;
    if (!blockedUI()) {
      let best = REACH;
      for (const tg of targetList) {
        const d = Math.hypot(tg.x - pos.x, tg.z - pos.z);
        if (d <= best) { best = d; near = tg; }
      }
      catTarget.x = cat.position.x;
      catTarget.z = cat.position.z;
      if (!near && Math.hypot(catTarget.x - pos.x, catTarget.z - pos.z) <= REACH) near = catTarget;
    }
    if (near?.id !== shownTarget) {
      shownTarget = near?.id;
      controls.showTarget(near);
    }

    updateCat(dt, t, still);
    world.anchors.chimes.rotation.z = still ? 0 : Math.sin(t * 1.3) * 0.06;

    follow.update(dt, pos, { reduceMotion: still });
    lighting.follow(follow.target);
    if (island) animateWaters(island.waters, t);

    // 名牌與目標記號
    for (const a of actors.values()) placeLabel(a.tag, a.mesh.position.x, 1.55, a.mesh.position.z);
    for (const [id, el] of goalTags) {
      const tg = targetMap.get(id);
      if (tg) placeLabel(el, tg.x, tg.kind === 'character' ? 2.0 : 2.4, tg.z);
    }
    if (beacon.visible) placeLabel(beaconTag, beacon.position.x, 2.2, beacon.position.z);
    placeLabel(catTag, cat.position.x, 0.9, cat.position.z);

    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  const onHide = () => savePosition();
  addEventListener('pagehide', onHide);

  return {
    applySettings: applyQuality,
    stop() {
      savePosition();
      renderer.setAnimationLoop(null);
      controls.stop();
      game.removeEventListener('change', onChange);
      game.removeEventListener('hint', onHint);
      removeEventListener('resize', onResize);
      removeEventListener('pagehide', onHide);
      renderer.domElement.removeEventListener('pointerup', onPointer);
      for (const el of labels) el.remove();
      for (const el of goalTags.values()) el.remove();
      renderer.dispose();
      renderer.domElement.remove();
    },
    // 測試用：直接移動到某個目標旁邊
    teleport(x, z) {
      pos.set(x, 0, z);
      moved = true;
    },
    blockedAt: (x, z) => blocked(x, z),
    get position() { return { x: pos.x, z: pos.z }; },
    get catPosition() { return { x: cat.position.x, z: cat.position.z }; },
    get beaconTarget() { return beacon.visible ? beacon.userData.target : null; },
    isTouch,
  };
}
