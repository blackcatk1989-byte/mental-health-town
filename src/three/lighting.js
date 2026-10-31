// 溫暖的日光：暖色天光＋地面反光、斜斜的暖陽（柔和陰影）、一點冷色補光讓暗部不死黑。
// 陽光的陰影範圍跟著鏡頭目標移動，陰影才會清楚又不用很大的陰影貼圖。
import * as THREE from 'three';

const SUN_OFFSET = new THREE.Vector3(7, 12, 6); // 從東南方高處照下來
const SHADOW_SIZE = 14;

export function setupLighting(renderer, scene) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const hemi = new THREE.HemisphereLight(0xfff3df, 0xc9dcb0, 1.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe6c4, 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -SHADOW_SIZE, right: SHADOW_SIZE, top: SHADOW_SIZE, bottom: -SHADOW_SIZE, near: 1, far: 50,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight(0xd6e6ff, 0.45); // 冷色補光，不投影
  fill.position.set(-6, 5, -8);
  scene.add(fill);

  return {
    sun,
    // 每幀呼叫：讓陽光與陰影範圍跟著鏡頭看的地方
    follow(target) {
      sun.target.position.copy(target);
      sun.position.copy(target).add(SUN_OFFSET);
    },
    // 省電畫質：關閉陰影
    setQuality(quality) {
      const on = quality !== 'low';
      if (sun.castShadow === on) return;
      sun.castShadow = on;
      renderer.shadowMap.enabled = on;
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    },
  };
}
