// 把很多小零件合併成一個網格（用頂點色區分顏色），減少繪製呼叫，手機才跑得動。
// 角色依可動的部位（頭、身體、手腳）各合併一次；場景的靜態擺設在 world.js 最後一次合併。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmpColor = new THREE.Color();

// 複製幾何、套上位置與顏色；只保留合併需要的屬性
export function colored(geo, color, matrix) {
  const g = (geo.index ? geo.toNonIndexed() : geo.clone());
  if (matrix) g.applyMatrix4(matrix);
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  tmpColor.set(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = tmpColor.r;
    arr[i * 3 + 1] = tmpColor.g;
    arr[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const sc = new THREE.Vector3();

// 方便描述零件位置的小工具：pos、rot（弧度）、scale
export function at(x, y, z, { rx = 0, ry = 0, rz = 0, s = 1, sx = s, sy = s, sz = s } = {}) {
  return m4.clone().compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), sc.set(sx, sy, sz));
}

// 零件清單 [[geometry, color, matrix], ...] → 一個網格
export function mergedMesh(parts, material) {
  const geo = mergeGeometries(parts.map(([g, c, mtx]) => colored(g, c, mtx)), false);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 把群組裡用單色卡通材質的靜態網格，依「投不投影」合併成兩個網格（頂點色）。
// 特殊材質（發光、透明）、InstancedMesh 與標記為 keep 的物件保留原樣。
export function bakeStatic(group, material) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = { cast: [], still: [] };
  const remove = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    const mat = o.material;
    if (!mat?.isMeshToonMaterial || mat.vertexColors || mat.transparent) return;
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    buckets[o.castShadow ? 'cast' : 'still'].push(colored(o.geometry, mat.color, mtx));
    remove.push(o);
  });
  for (const o of remove) o.removeFromParent();
  for (const [kind, list] of Object.entries(buckets)) {
    if (!list.length) continue;
    const geo = mergeGeometries(list, false);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = kind === 'cast';
    mesh.receiveShadow = true;
    mesh.name = `baked-${kind}`;
    group.add(mesh);
  }
}
