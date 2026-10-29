// 溫馨卡通風的跟隨鏡頭：從斜上方 45 度俯看角色，視角窄、帶一點透視，移動時平滑跟上。
// 三種狀態：create（角色創建時拉近看正面）、play（45 度俯視）、talk（對話時拉近、轉到主角斜後方）。
import * as THREE from 'three';

const PLAY_PITCH = THREE.MathUtils.degToRad(45); // 鏡頭與地面的夾角
const PLAY_FOV = 32;
const ZOOM_MIN = 8;
const ZOOM_MAX = 18;

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class CozyCamera {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(PLAY_FOV, aspect, 0.1, 200);
    this.mode = 'create';
    this.azimuth = 0; // 0 = 鏡頭在角色南方（+Z），往北看
    this.zoom = 12; // play 狀態的鏡頭距離，可用滾輪調整
    this.state = { dist: 3.4, pitch: THREE.MathUtils.degToRad(18), height: 0.6, side: 0, lift: 0 };
    this.target = new THREE.Vector3();
    this.talkFocus = null;
    this.talkAzimuth = 0;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  zoomBy(delta) {
    this.zoom = THREE.MathUtils.clamp(this.zoom + delta, ZOOM_MIN, ZOOM_MAX);
  }

  rotate(delta) {
    this.azimuth += delta;
  }

  // 對話時：鏡頭從主角斜後方看過去，看得到居民的正臉
  startTalk(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    this.talkFocus = new THREE.Vector3(from.x + dx / 2, 0, from.z + dz / 2);
    const back = Math.atan2(-dx, -dz);
    const a = back + 1.3;
    const b = back - 1.3;
    this.talkAzimuth = Math.abs(angleDiff(a, this.azimuth)) < Math.abs(angleDiff(b, this.azimuth)) ? a : b;
    this.mode = 'talk';
  }

  endTalk() {
    this.talkFocus = null;
    if (this.mode === 'talk') this.mode = 'play';
  }

  update(dt, focus, { wide = true } = {}) {
    const s = this.state;
    const k = Math.min(1, dt * 2.5);
    const narrow = Math.max(1, 1 / this.camera.aspect); // 直式螢幕視野較窄，鏡頭拉遠一點
    let goal;
    if (this.mode === 'create') {
      goal = { dist: 3.4 * Math.min(2, Math.max(1, 0.95 / this.camera.aspect)), pitch: THREE.MathUtils.degToRad(18),
        height: 0.6, side: wide ? 0.85 : 0, lift: wide ? 0 : 1.25 };
    } else if (this.mode === 'talk') {
      goal = { dist: 5 * Math.sqrt(narrow), pitch: THREE.MathUtils.degToRad(25), height: 0.5, side: 0, lift: 0 };
      this.azimuth += angleDiff(this.talkAzimuth, this.azimuth) * k;
      focus = this.talkFocus ?? focus;
    } else {
      goal = { dist: this.zoom * Math.sqrt(narrow), pitch: PLAY_PITCH, height: 0.5, side: 0, lift: 0 };
    }
    for (const key of Object.keys(goal)) s[key] += (goal[key] - s[key]) * k;

    // side：角色創建時讓角色偏左、讓出右邊的面板；lift：手機時讓角色往上、讓出下方面板
    this.target.set(
      focus.x + Math.cos(this.azimuth) * s.side,
      s.height - s.lift,
      focus.z - Math.sin(this.azimuth) * s.side,
    );
    const horizontal = Math.cos(s.pitch) * s.dist;
    this.camera.position.set(
      this.target.x + Math.sin(this.azimuth) * horizontal,
      this.target.y + Math.sin(s.pitch) * s.dist,
      this.target.z + Math.cos(this.azimuth) * horizontal,
    );
    this.camera.lookAt(this.target);
  }
}
