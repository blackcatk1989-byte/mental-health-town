// 固定斜俯視的跟隨鏡頭：從角色南方斜上方往北看，只平滑跟隨，不旋轉、不晃動。
// 調整鏡頭請修改這裡開頭的常數，不要在其他模組直接操作 camera.position。
import * as THREE from 'three';

const PITCH = THREE.MathUtils.degToRad(45); // 鏡頭與地面的夾角
const FOV = 32;
const DISTANCE = 15; // 橫式螢幕的鏡頭距離；直式螢幕會自動拉遠
const FOLLOW = 3; // 跟隨速度，越大越緊

export class FollowCamera {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 200);
    this.target = new THREE.Vector3();
    this.snap = true;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt, focus, { reduceMotion = false } = {}) {
    const k = this.snap || reduceMotion ? 1 : Math.min(1, dt * FOLLOW);
    this.snap = false;
    this.target.x += (focus.x - this.target.x) * k;
    this.target.z += (focus.z - this.target.z) * k;
    this.target.y = 0.6;
    const dist = DISTANCE * Math.sqrt(Math.max(1, 1.1 / this.camera.aspect));
    this.camera.position.set(this.target.x, this.target.y + Math.sin(PITCH) * dist, this.target.z + Math.cos(PITCH) * dist);
    this.camera.lookAt(this.target);
  }
}
