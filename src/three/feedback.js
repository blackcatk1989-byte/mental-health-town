// 3D 的手感與回饋：腳步塵土、靠近時的發光光圈與光點、頭上的表情氣泡、角色開心時跳一下。
// 物件都在一開始建好，主迴圈裡只更新位置與透明度，不新建物件；「減少動畫」時改成靜態或不顯示。
import * as THREE from 'three';
import { EMOTES } from '../ui.js';

function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createFeedback(scene, labelLayer) {
  // ---- 腳步塵土：8 個重複使用的小煙團 ----
  const dustTex = radialTexture('rgba(214,196,168,0.85)', 'rgba(214,196,168,0)');
  const dust = Array.from({ length: 8 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    s.userData.life = 0;
    scene.add(s);
    return s;
  });
  let dustNext = 0;

  // ---- 靠近時：地上的光圈＋上方的光點 ----
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture('rgba(255,248,215,1)', 'rgba(255,236,190,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sparkle.visible = false;
  scene.add(sparkle);
  let highlightY = 1.6;

  // ---- 表情氣泡（HTML 圖示）----
  const bubbles = new Map(); // 物件 → { el, until }
  function emote(obj, name, ms = 0) {
    let b = bubbles.get(obj);
    if (!name) {
      if (b) { b.el.remove(); bubbles.delete(obj); }
      return;
    }
    if (!b) {
      const el = document.createElement('div');
      el.className = 'emote';
      el.setAttribute('aria-hidden', 'true');
      labelLayer.append(el);
      b = { el, until: 0 };
      bubbles.set(obj, b);
    }
    b.el.innerHTML = EMOTES[name] ?? '';
    b.el.style.animation = 'none';
    void b.el.offsetWidth;
    b.el.style.animation = '';
    b.until = ms ? performance.now() + ms : 0;
  }

  // ---- 開心時跳一下 ----
  const jumps = new Map(); // 物件 → 剩餘時間

  return {
    // 走路時每一步呼叫一次
    step(x, z, still) {
      if (still) return;
      const s = dust[dustNext];
      dustNext = (dustNext + 1) % dust.length;
      s.position.set(x + (Math.random() - 0.5) * 0.2, 0.08, z + (Math.random() - 0.5) * 0.2);
      s.scale.setScalar(0.18);
      s.userData.life = 0.55;
      s.visible = true;
    },
    // 附近可互動的目標（null 表示沒有）
    highlight(t) {
      ring.visible = !!t;
      sparkle.visible = !!t;
      if (!t) return;
      ring.position.set(t.x, 0.03, t.z);
      sparkle.position.set(t.x, t.kind === 'character' ? 1.65 : 1.3, t.z);
      highlightY = sparkle.position.y;
    },
    emote,
    jump(obj) {
      jumps.set(obj, 0.6);
    },
    // 每一幀：place(el, x, y, z) 把 HTML 標籤放到 3D 位置
    update(dt, t, still, place) {
      for (const s of dust) {
        if (!s.visible) continue;
        s.userData.life -= dt;
        const k = Math.max(0, s.userData.life / 0.55);
        s.material.opacity = 0.55 * k;
        s.scale.setScalar(0.18 + (1 - k) * 0.35);
        s.position.y += dt * 0.15;
        if (k <= 0) s.visible = false;
      }
      if (ring.visible) {
        const p = still ? 0.5 : (Math.sin(t * 4) + 1) / 2;
        ring.material.opacity = 0.35 + p * 0.35;
        ring.scale.setScalar(1 + p * 0.08);
        sparkle.position.y = highlightY + (still ? 0 : Math.sin(t * 3) * 0.06);
        sparkle.scale.setScalar(0.45 + p * 0.15);
      }
      for (const [obj, left] of jumps) {
        const l = left - dt;
        obj.userData.hop = still ? 0 : Math.max(0, Math.sin((1 - l / 0.6) * Math.PI)) * 0.3;
        if (l <= 0) { jumps.delete(obj); obj.userData.hop = 0; } else jumps.set(obj, l);
      }
      const now = performance.now();
      for (const [obj, b] of bubbles) {
        if (b.until && now > b.until) { b.el.remove(); bubbles.delete(obj); continue; }
        place(b.el, obj.position.x, obj.position.y + 2.05, obj.position.z);
      }
    },
    dispose() {
      for (const b of bubbles.values()) b.el.remove();
      bubbles.clear();
    },
  };
}
