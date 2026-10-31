// 3D 模式：晴隅小鎮的場景、角色、移動與碰撞、互動提示、探索卡、佈置後的場景變化。
// 遊戲規則與進度都在 src/game.js；這裡只負責呈現與輸入，和文字模式共用同一份進度。
import * as THREE from 'three';
import { makeCharacter, PLAYER_LOOK, toon } from './characters.js';
import { buildWorld, chair, signPost } from './world.js';
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

  // ---- 探索卡 ----
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,248,220,1)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const pickups = new Map(); // 點位 id → 物件
  function syncPickups() {
    const want = new Set(game.targets().filter((t) => t.kind === 'pickup').map((t) => t.point.id));
    for (const [pid, g] of pickups) {
      if (!want.has(pid)) {
        scene.remove(g);
        pickables.splice(pickables.indexOf(g.userData.hit), 1);
        pickups.delete(pid);
        if (beacon.userData.point === pid) hideBeacon();
      }
    }
    for (const t of game.targets()) {
      if (t.kind !== 'pickup' || pickups.has(t.point.id)) continue;
      const g = new THREE.Group();
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.03), toon(game.card(t.card).color));
      card.position.y = 0.9;
      card.castShadow = true;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(1.3);
      glow.position.y = 0.9;
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.y = 0.8;
      hit.userData.targetId = t.id;
      pickables.push(hit);
      g.add(card, glow, hit);
      g.position.set(t.x, 0, t.z);
      g.userData.card = card;
      g.userData.hit = hit;
      scene.add(g);
      pickups.set(t.point.id, g);
    }
  }

  // 卡冊「顯示位置」的標記光柱
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 6, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
  );
  beacon.visible = false;
  scene.add(beacon);
  const beaconTag = label('tag beacon-tag hidden', '在這裡');
  const hideBeacon = () => {
    beacon.visible = false;
    beacon.userData.point = null;
    beaconTag.classList.add('hidden');
  };
  const onLocate = (e) => {
    const p = e.detail;
    beacon.position.set(p.x, 3, p.z);
    beacon.visible = true;
    beacon.userData.point = p.id;
    beaconTag.classList.remove('hidden');
  };
  game.addEventListener('locate', onLocate);

  // ---- 佈置後的場景變化 ----
  const decor = new THREE.Group();
  scene.add(decor);
  function syncArrangement() {
    decor.clear();
    const a = game.s.arrangement;
    if (!a) return;
    const cfg = game.c.places.objects.find((o) => o.id === 'bench').arrangement;
    const spot = cfg.spots.find((x) => x.id === a.spot) ?? cfg.spots[0];
    const c = chair(0xd9b98f);
    c.position.set(spot.x, 0, spot.z);
    c.rotation.y = Math.PI;
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42), toon(0xe3a48a));
    cushion.position.set(spot.x, 0.52, spot.z);
    const sign = signPost(0xfff3dc);
    sign.position.set(spot.x + 0.7, 0, spot.z - 0.3);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
    lantern.position.set(spot.x + 0.7, 1.4, spot.z - 0.3);
    decor.add(c, cushion, sign, lantern);
    if (a.quiet) {
      const q = chair(0xb9a3c9);
      q.position.set(31.2, 0, 18.4);
      const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), toon(0x93b98a));
      plant.position.set(31.9, 0.35, 18.6);
      decor.add(q, plant);
    }
  }

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
  }
  // 互動目標在進度改變時才重算，主迴圈裡不新建物件
  let targetList = [];
  const targetMap = new Map();
  const onChange = () => {
    targetList = game.targets();
    targetMap.clear();
    for (const tg of targetList) targetMap.set(tg.id, tg);
    syncActors();
    syncPickups();
    syncArrangement();
  };
  game.addEventListener('change', onChange);
  onChange();

  // ---- 輸入 ----
  let near = null;
  const blockedUI = () => ui.busy() || document.body.classList.contains('home-open');
  const controls = setupControls({
    isBlocked: blockedUI,
    onInteract: () => { if (near && !blockedUI()) game.interact(near.id); },
    onUse: () => { if (near?.cardTarget && !blockedUI()) ui.openUseCard(near.id); },
  });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onPointer = (e) => {
    if (blockedUI()) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (!hit) return;
    const t = game.target(hit.object.userData.targetId);
    if (!t) return;
    if (Math.hypot(t.x - pos.x, t.z - pos.z) <= REACH) game.interact(t.id);
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
    }
    if (near?.id !== shownTarget) {
      shownTarget = near?.id;
      controls.showTarget(near);
    }

    // 探索卡輕輕浮動
    for (const g of pickups.values()) {
      g.userData.card.rotation.y = still ? 0.4 : t * 1.2;
      g.userData.card.position.y = 0.9 + (still ? 0 : Math.sin(t * 2) * 0.06);
    }
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
      game.removeEventListener('locate', onLocate);
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
    isTouch,
  };
}
