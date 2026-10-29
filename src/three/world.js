// 3D 場景的地面：環境造景已清空，等重新設計。
// 目前只提供一塊空地、活動範圍與出生點；有 island.glb 時 main.js 會把 visuals 隱藏。
import * as THREE from 'three';
import { toon } from './characters.js';

/**
 * @param {THREE.Scene} scene
 * @param {{ width?: number, height?: number, residents?: { id: string }[] }} options
 */
export function buildWorld(scene, { width = 30, height = 20, residents = [] } = {}) {
  const visuals = new THREE.Group();
  visuals.name = 'ground';
  scene.add(visuals);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), toon(0xd9e8c6));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(width / 2, 0, height / 2);
  ground.receiveShadow = true;
  const area = new THREE.Mesh(new THREE.PlaneGeometry(width, height), toon(0xe8efdc)); // 可以走動的範圍
  area.rotation.x = -Math.PI / 2;
  area.position.set(width / 2, 0.01, height / 2);
  area.receiveShadow = true;
  visuals.add(ground, area);

  // 出生點：玩家在南邊，居民在北邊排成一排
  const spawns = { player: { x: width / 2, z: height * 0.75 } };
  residents.forEach((r, i) => {
    spawns[r.id] = { x: width / 2 + (i - (residents.length - 1) / 2) * 3, z: height * 0.4 };
  });

  const blocked = (x, z, r) => x - r < 0 || z - r < 0 || x + r > width || z + r > height;
  return { width, height, spawns, blocked, visuals };
}
